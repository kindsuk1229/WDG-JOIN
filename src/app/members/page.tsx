'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

interface Member {
  name: string;
  nickname: string;
  joinedAt: string;
  lastLoginAt: string;
  isAdmin: boolean;
  meetupCount: number;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // 1. users 컬렉션 전체 가져오기
        const usersSnap = await getDocs(collection(db, 'users'));
        const adminsSnap = await getDocs(collection(db, 'admins'));
        const meetupsSnap = await getDocs(collection(db, 'meetups'));

        // 관리자 목록
        const adminNames = new Set(adminsSnap.docs.map(d => d.id));

        // ✅ 벙개별 참여자 카운트 (올해 기준)
        const currentYear = new Date().getFullYear().toString();
        const meetupCountMap: Record<string, number> = {};
        meetupsSnap.forEach((d) => {
          const data = d.data();
          // 올해 벙개만 카운트
          if (!data.date || !data.date.startsWith(currentYear)) return;
          const participants = data.participants || [];
          participants.forEach((p: any) => {
            const name = p.name || '';
            meetupCountMap[name] = (meetupCountMap[name] || 0) + 1;
          });
        });

        // 멤버 목록 조합
        const memberList: Member[] = usersSnap.docs.map((d) => {
          const data = d.data();
          return {
            name: data.name || d.id,
            nickname: data.nickname || '',
            joinedAt: data.joinedAt || '',
            lastLoginAt: data.lastLoginAt || '',
            isAdmin: adminNames.has(d.id),
            meetupCount: meetupCountMap[data.name] || 0,
          };
        });

        // 관리자 먼저, 그 다음 가입일 순 정렬
        memberList.sort((a, b) => {
          if (a.isAdmin && !b.isAdmin) return -1;
          if (!a.isAdmin && b.isAdmin) return 1;
          return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        });

        setMembers(memberList);
      } catch (error) {
        console.error('멤버 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">멤버</h1>
        {!loading && (
          <span className="ml-2 text-sm text-gray-400 font-medium">총 {members.length}명</span>
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
          members.map((member, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <Avatar name={member.name} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-gray-800">
                      {member.nickname || member.name}
                    </p>
                    {member.nickname && (
                      <p className="text-[11px] text-gray-400">({member.name})</p>
                    )}
                    {member.isAdmin && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">관리자</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      🗓 가입 {formatDate(member.joinedAt)}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      ⛳ 올해 벙개 {member.meetupCount}회
                    </span>
                  </div>
                </div>
              </div>

              {/* 마지막 접속일 */}
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                <p className="text-[10px] text-gray-300">
                  마지막 접속 {formatDate(member.lastLoginAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}