'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

const OWNER_NAME = '김근석';

interface Participant {
  name: string;
  nickname: string;
  handicap?: number;
  gHandicap?: number;
}

interface Group {
  id: string;
  groupNumber: number;
  label: string;
  members: Participant[];
}

export default function TournamentGroupsViewPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    setIsOwner(name === OWNER_NAME);
    fetchData();
  }, [tournamentId]);

  const fetchData = async () => {
    try {
      const snap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!snap.exists()) return;
      const data = snap.data();
      setTournament(data);
      setGroups(data.groups || []);
    } catch (err) {
      console.error('로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHandicapLabel = (p: Participant) => {
    if (p.gHandicap !== null && p.gHandicap !== undefined) return `G${p.gHandicap}`;
    if (p.handicap) return `H${p.handicap}`;
    return '';
  };

  // 내가 속한 조 찾기
  const myGroup = groups.find(g => g.members.some(m => m.name === myName));

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <div>
            <h1 className="text-xl font-black text-gray-800">조 편성 결과</h1>
            <p className="text-xs text-gray-400">{tournament?.title}</p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => router.push(`/tournament/${tournamentId}/group-assign`)}
            className="text-sm font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg"
          >
            수정
          </button>
        )}
      </header>

      <div className="p-4 space-y-4">

        {groups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-gray-400 text-sm">아직 조 편성이 되지 않았어요.</p>
            {isOwner && (
              <button
                onClick={() => router.push(`/tournament/${tournamentId}/group-assign`)}
                className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold"
              >
                조 편성하기
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 내 조 강조 표시 */}
            {myGroup && (
              <div className="bg-green-600 rounded-2xl p-4 text-white">
                <p className="text-green-200 text-xs font-bold mb-1">내 조</p>
                <p className="text-xl font-black mb-3">{myGroup.label}</p>
                <div className="flex gap-3 flex-wrap">
                  {myGroup.members.map(m => (
                    <div key={m.name} className="flex items-center gap-2">
                      <Avatar name={m.name} size={32} />
                      <div>
                        <p className={`text-sm font-bold ${m.name === myName ? 'text-yellow-300' : 'text-white'}`}>
                          {m.nickname || m.name}
                          {m.name === myName && ' ★'}
                        </p>
                        {getHandicapLabel(m) && (
                          <p className="text-xs text-green-200">{getHandicapLabel(m)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 조 목록 */}
            <p className="text-sm font-bold text-gray-500">전체 조 편성 ({groups.length}개 조)</p>
            {groups.map(group => {
              const isMyGroup = group.id === myGroup?.id;
              return (
                <div key={group.id}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                    isMyGroup ? 'border-green-300' : 'border-gray-100'
                  }`}>
                  {/* 조 헤더 */}
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    isMyGroup ? 'bg-green-50' : 'bg-gray-50'
                  }`}>
                    <p className={`font-black text-base ${isMyGroup ? 'text-green-700' : 'text-gray-700'}`}>
                      {group.label}
                      {isMyGroup && <span className="text-xs font-normal text-green-500 ml-2">내 조</span>}
                    </p>
                    <span className="text-xs text-gray-400">{group.members.length}명</span>
                  </div>

                  {/* 멤버 */}
                  <div className="divide-y divide-gray-50">
                    {group.members.map(member => (
                      <div key={member.name} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={member.name} size={36} />
                        <div className="flex-1">
                          <p className={`font-bold ${member.name === myName ? 'text-green-700' : 'text-gray-800'}`}>
                            {member.nickname || member.name}
                            {member.name === myName && <span className="text-xs text-green-500 ml-1">(나)</span>}
                          </p>
                          {member.nickname && (
                            <p className="text-xs text-gray-400">{member.name}</p>
                          )}
                        </div>
                        {getHandicapLabel(member) && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                            {getHandicapLabel(member)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}