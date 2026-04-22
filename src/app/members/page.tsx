'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

const OWNER_NAME = '김근석'; // 오너 이름 (매니저 지정 권한자)

interface Member {
  name: string;
  nickname: string;
  joinedAt: string;
  lastLoginAt: string;
  isAdmin: boolean;
  isOwner: boolean;
  role: string;
  meetupCount: number;
  seasonScore: number;
  yearlyScore: number;
  avgScore: number;
  bestScore: number;
  rounds: number;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [myName, setMyName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchMembers = async (myNameStr: string) => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const adminsSnap = await getDocs(collection(db, 'admins'));
      const meetupsSnap = await getDocs(collection(db, 'meetups'));

      // admins 컬렉션에서 role 정보 가져오기
      const adminMap: Record<string, string> = {};
      adminsSnap.docs.forEach(d => {
        adminMap[d.id] = d.data().role || 'manager';
      });

      const currentYear = new Date().getFullYear().toString();
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1~12
      // 2달 시즌 계산 (1~2월, 3~4월, 5~6월, 7~8월, 9~10월, 11~12월)
      const seasonStartMonth = Math.floor((currentMonth - 1) / 2) * 2 + 1;
      const seasonStart = `${currentYear}-${String(seasonStartMonth).padStart(2, '0')}`;
      const seasonEnd = `${currentYear}-${String(seasonStartMonth + 1).padStart(2, '0')}`;

      const meetupCountMap: Record<string, number> = {};
      const seasonScoreMap: Record<string, number> = {};
      const yearlyScoreMap: Record<string, number> = {};

      meetupsSnap.forEach((d) => {
        const data = d.data();
        if (!data.date || !data.date.startsWith(currentYear)) return;
        // ✅ completed 또는 날짜가 지난 closed/manually_closed만 카운트
        const now = new Date();
        if (data.status === 'cancelled' || data.status === 'open') return;
        if (data.status === 'closed' || data.status === 'manually_closed') {
          const timeStr = (data.cartTimes?.[0] === 'TBD' || !data.cartTimes?.[0]) ? '23:59' : data.cartTimes[0];
          const meetupDateTime = new Date(`${data.date}T${timeStr}:00`);
          if (now < meetupDateTime) return;
        }
        if (data.meetupType === 'etc' || data.isEtc) return; // 기타벙 점수 제외
        const point = data.meetupType === 'overnight' || data.isOvernight ? 4 : data.meetupType === 'field' ? 2 : 1;
        const isInSeason = data.date >= seasonStart && data.date <= `${seasonEnd}-31`;

        const participants = data.participants || [];
        participants.forEach((p: any) => {
          const name = p.name || '';
          meetupCountMap[name] = (meetupCountMap[name] || 0) + 1;
          yearlyScoreMap[name] = (yearlyScoreMap[name] || 0) + point;
          if (isInSeason) {
            seasonScoreMap[name] = (seasonScoreMap[name] || 0) + point;
          }
        });
      });

      const memberList: Member[] = usersSnap.docs.map((d) => {
        const data = d.data();
        const name = data.name || d.id;
        const role = name === OWNER_NAME ? 'owner' : (adminMap[name] || '');
        return {
          name,
          nickname: data.nickname || '',
          joinedAt: data.joinedAt || '',
          lastLoginAt: data.lastLoginAt || '',
          isAdmin: !!adminMap[name] || name === OWNER_NAME,
          isOwner: name === OWNER_NAME,
          role,
          meetupCount: meetupCountMap[name] || 0,
          seasonScore: seasonScoreMap[name] || 0,
          yearlyScore: yearlyScoreMap[name] || 0,
          avgScore: 0,
          bestScore: 0,
          rounds: 0,
        };
      });

      memberList.sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        // 시즌 점수 높은 순
        if (b.seasonScore !== a.seasonScore) return b.seasonScore - a.seasonScore;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      });

      // ✅ 성적 통계 불러오기
      const scoreSnap = await getDocs(collection(db, 'scorecards'));
      const scoreStatsMap: Record<string, { scores: number[] }> = {};
      scoreSnap.docs.forEach(d => {
        const data = d.data();
        const players = data.players || [];
        players.forEach((p: any) => {
          const total = (p.scores || []).reduce((a: number, b: number) => a + b, 0);
          if (total === 0) return;
          if (!scoreStatsMap[p.name]) scoreStatsMap[p.name] = { scores: [] };
          scoreStatsMap[p.name].scores.push(total);
        });
      });

      memberList.forEach(m => {
        const stats = scoreStatsMap[m.name];
        if (stats && stats.scores.length > 0) {
          m.rounds = stats.scores.length;
          m.avgScore = Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length);
          m.bestScore = Math.min(...stats.scores);
        }
      });

      setMembers(memberList);
    } catch (error) {
      console.error('멤버 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    setIsOwner(name === OWNER_NAME);

    const checkAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', name));
        setIsAdmin(adminDoc.exists() || name === OWNER_NAME);
      } catch (error) {
        console.error('관리자 확인 실패:', error);
      }
    };
    checkAdmin();
    fetchMembers(name);
  }, []);

  const handleDelete = async (member: Member) => {
    if (!window.confirm(`${member.nickname || member.name}님을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(member.name);
    try {
      await deleteDoc(doc(db, 'users', member.name));
      await deleteDoc(doc(db, 'fcm_tokens', member.name));
      alert(`${member.nickname || member.name}님이 삭제되었습니다.`);
      fetchMembers(myName);
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  // ✅ 매니저 지정/해제 (오너만 가능)
  const handleToggleManager = async (member: Member) => {
    if (!isOwner) return;
    const isManager = member.role === 'manager';
    const action = isManager ? '해제' : '지정';
    if (!window.confirm(`${member.nickname || member.name}님을 매니저 ${action}하시겠습니까?`)) return;

    setToggling(member.name);
    try {
      if (isManager) {
        // 매니저 해제
        await deleteDoc(doc(db, 'admins', member.name));
        alert(`${member.nickname || member.name}님의 매니저 권한이 해제되었습니다.`);
      } else {
        // 매니저 지정
        await setDoc(doc(db, 'admins', member.name), {
          role: 'manager',
          assignedAt: new Date().toISOString(),
          assignedBy: myName,
        });
        alert(`${member.nickname || member.name}님이 매니저로 지정되었습니다!`);
      }
      fetchMembers(myName);
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setToggling(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const getRoleBadge = (member: Member) => {
    if (member.isOwner) return { label: '오너', className: 'bg-yellow-100 text-yellow-700' };
    if (member.role === 'manager') return { label: '매니저', className: 'bg-blue-100 text-blue-700' };
    return null;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">멤버</h1>
        {!loading && (
          <span className="ml-2 text-base text-gray-400 font-medium">총 {members.length}명</span>
        )}
      </header>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400">멤버 목록을 불러오는 중...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400">아직 가입한 멤버가 없어요.</p>
          </div>
        ) : (
          members.map((member, i) => {
            const badge = getRoleBadge(member);
            return (
              <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <Avatar name={member.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-gray-800">
                        {member.nickname || member.name}
                      </p>
                      {member.nickname && (
                        <p className="text-sm text-gray-400">({member.name})</p>
                      )}
                      {badge && (
                        <span className={`text-sm px-2 py-0.5 rounded-full font-black ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm text-gray-400">⛳ {member.meetupCount}회</span>
                      <span className="text-sm font-bold text-blue-500">시즌 {member.seasonScore}점</span>
                      <span className="text-sm font-bold text-green-600">연간 {member.yearlyScore}점</span>
                    </div>
                    {member.rounds > 0 && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-gray-400">🏌️ {member.rounds}라운드</span>
                        <span className="text-sm font-bold text-purple-500">평균 {member.avgScore}타</span>
                        <span className="text-sm font-bold text-orange-500">베스트 {member.bestScore}타</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {/* ✅ 오너만 매니저 지정/해제 가능 (본인 및 오너 제외) */}
                    {isOwner && !member.isOwner && (
                      <button
                        onClick={() => handleToggleManager(member)}
                        disabled={toggling === member.name}
                        className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                          toggling === member.name
                            ? 'bg-gray-100 text-gray-400'
                            : member.role === 'manager'
                            ? 'bg-blue-50 text-blue-500'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {toggling === member.name ? '처리중' : member.role === 'manager' ? '매니저 해제' : '매니저 지정'}
                      </button>
                    )}

                    {/* ✅ 매니저/오너만 삭제 가능 (본인 및 다른 관리자 제외) */}
                    {isAdmin && member.name !== myName && !member.isAdmin && (
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={deleting === member.name}
                        className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                          deleting === member.name
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-red-50 text-red-500'
                        }`}
                      >
                        {deleting === member.name ? '삭제중' : '삭제'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                  <p className="text-sm text-gray-300">마지막 접속 {formatDate(member.lastLoginAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}