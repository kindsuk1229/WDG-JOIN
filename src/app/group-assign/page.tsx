'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface GroupMember {
  name: string;
  nickname: string;
  handicap?: number;
  isGuest?: boolean;
}

interface Group {
  groupNumber: number;
  teeTime: string;
  members: GroupMember[];
}

function GroupAssignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [meetupId, setMeetupId] = useState('');
  const [meetup, setMeetup] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [unassigned, setUnassigned] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myName, setMyName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    const id = searchParams.get('meetupId') || '';
    if (id) setMeetupId(id);
  }, [searchParams]);

  useEffect(() => {
    if (meetupId) fetchData();
  }, [meetupId]);

  const fetchData = async () => {
    try {
      // 관리자 확인
      const name = (localStorage.getItem('user_name') || '').trim();
      const adminSnap = await getDoc(doc(db, 'admins', name));
      setIsAdmin(adminSnap.exists() || name === '김근석');

      const meetupSnap = await getDoc(doc(db, 'meetups', meetupId));
      if (!meetupSnap.exists()) return;
      const data = { id: meetupSnap.id, ...meetupSnap.data() } as any;
      setMeetup(data);

      // 회원 핸디캡 불러오기
      const { collection, getDocs } = await import('firebase/firestore');
      const usersSnap = await getDocs(collection(db, 'users'));
      const handicapMap: Record<string, number> = {};
      usersSnap.docs.forEach(d => {
        handicapMap[d.data().name || d.id] = d.data().handicap || 0;
      });

      const participants: GroupMember[] = (data.participants || []).map((p: any) => ({
        name: p.name,
        nickname: p.nickname || p.name,
        isGuest: p.isGuest || false,
        handicap: handicapMap[p.name] || 0,
      }));

      // 기존 조 편성 불러오기
      const groupSnap = await getDoc(doc(db, 'groups', meetupId));
      if (groupSnap.exists()) {
        const saved = groupSnap.data().groups as Group[];
        setGroups(saved);
        const assignedNames = saved.flatMap(g => g.members.map(m => m.name));
        setUnassigned(participants.filter(p => !assignedNames.includes(p.name)));
      } else {
        autoAssign(data, participants);
      }
    } catch (error) {
      console.error('로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoAssign = (meetupData: any, participants: GroupMember[]) => {
    const cartCount = meetupData.cartCount || 1;
    const cartTimes = meetupData.cartTimes || [];
    const newGroups: Group[] = Array.from({ length: cartCount }, (_, i) => ({
      groupNumber: i + 1,
      teeTime: cartTimes[i] || 'TBD',
      members: [],
    }));
    participants.forEach((member, idx) => {
      newGroups[idx % cartCount].members.push(member);
    });
    setGroups(newGroups);
    setUnassigned([]);
  };

  // 핸디캡 그룹 배정 (뱀 방식)
  const handleHandicapAssign = () => {
    const all = [...unassigned, ...groups.flatMap(g => g.members)];
    // 핸디캡 낮은 순(잘치는 순) 정렬, 핸디캡 0은 맨 뒤
    const sorted = [...all].sort((a, b) => {
      const ha = a.handicap || 99;
      const hb = b.handicap || 99;
      return ha - hb;
    });

    const cartCount = meetup?.cartCount || 1;
    const cartTimes = meetup?.cartTimes || [];
    const newGroups: Group[] = Array.from({ length: cartCount }, (_, i) => ({
      groupNumber: i + 1,
      teeTime: cartTimes[i] || 'TBD',
      members: [],
    }));

    // 뱀 방식 배정 (1,2,3...N, N,N-1...1 반복)
    let direction = 1;
    let groupIdx = 0;
    sorted.forEach((member) => {
      newGroups[groupIdx].members.push(member);
      groupIdx += direction;
      if (groupIdx >= cartCount) {
        groupIdx = cartCount - 1;
        direction = -1;
      } else if (groupIdx < 0) {
        groupIdx = 0;
        direction = 1;
      }
    });

    setGroups(newGroups);
    setUnassigned([]);
  };

  const handleRandomAssign = () => {
    const all = [...unassigned, ...groups.flatMap(g => g.members)];
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    const cartCount = meetup?.cartCount || 1;
    const cartTimes = meetup?.cartTimes || [];
    const newGroups: Group[] = Array.from({ length: cartCount }, (_, i) => ({
      groupNumber: i + 1,
      teeTime: cartTimes[i] || 'TBD',
      members: [],
    }));
    shuffled.forEach((member, idx) => {
      newGroups[idx % cartCount].members.push(member);
    });
    setGroups(newGroups);
    setUnassigned([]);
  };

  const moveMember = (member: GroupMember, fromGroup: number, toGroup: number) => {
    if (fromGroup === toGroup) return;
    const newGroups = groups.map(g => ({ ...g, members: [...g.members] }));
    let newUnassigned = [...unassigned];

    if (fromGroup === -1) {
      newUnassigned = newUnassigned.filter(m => m.name !== member.name);
    } else {
      newGroups[fromGroup].members = newGroups[fromGroup].members.filter(m => m.name !== member.name);
    }

    if (toGroup === -1) {
      newUnassigned.push(member);
    } else {
      newGroups[toGroup].members.push(member);
    }

    setGroups(newGroups);
    setUnassigned(newUnassigned);
  };

  const handleSave = async () => {
    if (!meetupId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'groups', meetupId), {
        meetupId,
        groups,
        updatedAt: new Date().toISOString(),
      });
      alert('조 편성이 저장되었습니다! ⛳');
      router.back();
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    const formatTime = (t: string) => {
      if (!t || t === 'TBD') return '시간 미정';
      const [h, m] = t.split(':').map(Number);
      return `${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    };
    const lines = groups.map(g =>
      `[${g.groupNumber}조] ${formatTime(g.teeTime)}\n${g.members.map(m => `  • ${m.nickname || m.name}`).join('\n')}`
    ).join('\n\n');
    const text = `⛳ ${meetup?.title} 조 편성\n\n${lines}`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert('조 편성 내용이 복사되었습니다!');
    }
  };

  const formatTime = (t: string) => {
    if (!t || t === 'TBD') return '시간 미정';
    const [h, m] = t.split(':').map(Number);
    return `${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  };

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <div>
            <h1 className="text-lg font-black text-gray-800">조 편성</h1>
            <p className="text-sm text-gray-400">{meetup?.title}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${saving ? 'bg-gray-400' : 'bg-green-600'}`}>
          {saving ? '저장중...' : '저장'}
        </button>
      </header>

      <div className="p-4 space-y-4 pb-20">
        {/* 액션 버튼 */}
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={handleRandomAssign}
              className="flex-1 py-3 bg-white rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 active:bg-gray-50">
              🎲 랜덤
            </button>
            <button onClick={() => {
              const all = [...unassigned, ...groups.flatMap(g => g.members)];
              autoAssign(meetup, all);
            }} className="flex-1 py-3 bg-white rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 active:bg-gray-50">
              ↕️ 순서
            </button>
            <button onClick={handleHandicapAssign}
              className="flex-1 py-3 bg-purple-50 rounded-2xl border border-purple-200 text-sm font-bold text-purple-700 active:bg-purple-100">
              🏌️ 핸디
            </button>
            <button onClick={handleShare}
              className="flex-1 py-3 bg-yellow-400 rounded-2xl text-sm font-bold text-yellow-900 active:bg-yellow-300">
              💬 공유
            </button>
          </div>
        )}

        {/* 미배정 멤버 */}
        {unassigned.length > 0 && (
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <p className="text-sm font-bold text-orange-700 mb-3">미배정 ({unassigned.length}명)</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((member) => (
                <div key={member.name} className="relative group">
                  <div className="px-3 py-1.5 bg-white rounded-full text-sm font-bold text-gray-700 border border-orange-200 shadow-sm">
                    {member.nickname || member.name}
                  </div>
                  {isAdmin && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-10 hidden group-hover:block min-w-max">
                      <p className="text-xs text-gray-400 px-3 pt-2 pb-1">이동할 조</p>
                      {groups.map((g, idx) => (
                        <button key={idx} onClick={() => moveMember(member, -1, idx)}
                          className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 font-medium">
                          {g.groupNumber}조
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 조별 카드 */}
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`flex justify-between items-center px-5 py-4 ${
              groupIdx % 2 === 0 ? 'bg-green-50 border-b border-green-100' : 'bg-blue-50 border-b border-blue-100'
            }`}>
              <div>
                <span className={`font-black text-lg ${groupIdx % 2 === 0 ? 'text-green-800' : 'text-blue-800'}`}>
                  {group.groupNumber}조
                </span>
                <span className={`text-sm ml-2 ${groupIdx % 2 === 0 ? 'text-green-600' : 'text-blue-600'}`}>
                  {formatTime(group.teeTime)}
                </span>
              </div>
              <span className="text-sm text-gray-500 font-bold">{group.members.length}명</span>
            </div>

            <div className="p-4">
              {group.members.length === 0 ? (
                <p className="text-gray-300 text-sm text-center py-2">멤버 없음</p>
              ) : (
                <div className="space-y-2">
                  {group.members.map((member) => (
                    <div key={member.name} className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-black text-sm">
                          {(member.nickname || member.name).charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 text-sm">{member.nickname || member.name}</span>
                          {member.isGuest && (
                            <span className="ml-1.5 text-xs text-purple-500 font-bold">게스트</span>
                          )}
                          {member.handicap ? (
                            <span className="ml-1.5 text-xs text-blue-400 font-bold">H{member.handicap}</span>
                          ) : null}
                        </div>
                      </div>
                      {isAdmin && (
                        <select
                          value={groupIdx}
                          onChange={(e) => {
                            const target = parseInt(e.target.value);
                            if (target === -1) moveMember(member, groupIdx, -1);
                            else moveMember(member, groupIdx, target);
                          }}
                          className="text-xs text-gray-400 bg-white border border-gray-200 rounded-lg px-2 py-1"
                        >
                          {groups.map((g, idx) => (
                            <option key={idx} value={idx}>{g.groupNumber}조</option>
                          ))}
                          <option value={-1}>미배정</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupAssignPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-400">로딩 중...</div>}>
      <GroupAssignContent />
    </Suspense>
  );
}