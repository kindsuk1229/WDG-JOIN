'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Avatar } from '@/components/UI';
import { getReliabilityBadge, RATING_DEFAULT } from '@/lib/rating';

const OWNER_NAME = '김근석';

interface RatingPlayer {
  name: string;
  nickname: string;
  role: string;
  isOwner: boolean;
  isAdmin: boolean;
  rating: number;
  rounds: number;
  ratingDelta: number; // 최근 변동
}

export default function RatingRankingPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<RatingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const [usersSnap, adminsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
      ]);

      const adminMap: Record<string, string> = {};
      adminsSnap.docs.forEach(d => { adminMap[d.id] = d.data().role || 'manager'; });

      const list: RatingPlayer[] = usersSnap.docs
        .map(d => {
          const data = d.data();
          const name = data.name || d.id;
          return {
            name,
            nickname: data.nickname || '',
            role: name === OWNER_NAME ? 'owner' : (adminMap[name] || 'member'),
            isOwner: name === OWNER_NAME,
            isAdmin: !!adminMap[name] || name === OWNER_NAME,
            rating: data.rating ?? RATING_DEFAULT,
            rounds: data.ratingRounds ?? 0,
            ratingDelta: data.ratingDelta ?? 0,
          };
        })
        // rating이 기록된 사람만 표시 (rounds > 0 이거나 rating이 기본값과 다른 경우)
        .filter(p => p.rounds > 0 || p.rating !== RATING_DEFAULT);

      list.sort((a, b) => b.rating - a.rating);
      setPlayers(list);
    } catch (err) {
      console.error('랭킹 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (p: RatingPlayer) => {
    if (p.isOwner) return { label: '오너', cls: 'bg-yellow-100 text-yellow-700' };
    if (p.role === 'manager') return { label: '매니저', cls: 'bg-blue-100 text-blue-700' };
    return null;
  };

  const getStars = (stars: number) => {
    if (stars === 0) return <span className="text-red-400 text-xs font-bold">❓</span>;
    return <span className="text-yellow-400 text-xs">{'⭐'.repeat(stars)}</span>;
  };

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">골프 Rating 랭킹</h1>
          <p className="text-xs text-gray-400">강한 상대를 이길수록 · 큰 타수 차일수록 · 많은 인원일수록</p>
        </div>
      </header>

      <div className="p-4 space-y-4">

        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 mb-3">Rating 산정 기준</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: '🎯', label: 'Rating 차이', desc: '강자 이길수록 큰 보상' },
              { icon: '📊', label: '타수차 가중', desc: '압도적 승리 추가 반영' },
              { icon: '👥', label: '참가인원', desc: '대규모 경기 가중' },
            ].map(item => (
              <div key={item.label} className="bg-green-50 rounded-xl p-3">
                <p className="text-lg mb-1">{item.icon}</p>
                <p className="text-xs font-bold text-green-700">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-xs text-gray-400 text-center">신규: 1,000점 시작 · 1개월 미참여 시 −10점 패널티</p>
          </div>
        </div>

        {/* 신뢰도 배지 안내 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-xs font-bold text-gray-400 mb-2">신뢰도 배지</p>
          <div className="flex gap-4 flex-wrap">
            {[
              { badge: '❓', label: '5회 미만', color: 'text-red-400' },
              { badge: '⭐', label: '5~15회', color: 'text-orange-400' },
              { badge: '⭐⭐', label: '15~30회', color: 'text-green-600' },
              { badge: '⭐⭐⭐', label: '30회+', color: 'text-blue-600' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="text-xs">{item.badge}</span>
                <span className={`text-xs ${item.color}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : players.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-400 text-sm">아직 Rating 기록이 없어요.</p>
            <p className="text-gray-300 text-xs mt-1">필드 벙개 성적표를 입력하면 자동으로 반영돼요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player, rank) => {
              const badge = getRoleBadge(player);
              const reliability = getReliabilityBadge(player.rounds);
              const isMe = player.name === myName;
              const isUnreliable = player.rounds < 5;

              return (
                <div key={player.name} className={`bg-white p-4 rounded-2xl shadow-sm border transition-all ${
                  isMe ? 'border-green-300 bg-green-50' :
                  rank === 0 ? 'border-yellow-200' :
                  rank === 1 ? 'border-gray-200' :
                  rank === 2 ? 'border-orange-200' : 'border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    {/* 순위 */}
                    <span className={`text-xl font-black w-8 text-center flex-shrink-0 ${
                      rank === 0 ? 'text-yellow-500' :
                      rank === 1 ? 'text-gray-400' :
                      rank === 2 ? 'text-orange-400' : 'text-gray-300'
                    }`}>
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
                    </span>

                    <Avatar name={player.name} size={44} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-black ${isMe ? 'text-green-800' : 'text-gray-800'}`}>
                          {player.nickname || player.name}
                        </span>
                        {player.nickname && <span className="text-xs text-gray-400">({player.name})</span>}
                        {isMe && <span className="text-xs text-green-600 font-bold">(나)</span>}
                        {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getStars(reliability.stars)}
                        <span className={`text-xs ${reliability.color}`}>{reliability.label}</span>
                        <span className="text-xs text-gray-400">· {player.rounds}라운드</span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <p className={`text-2xl font-black ${isMe ? 'text-green-700' : 'text-gray-800'}`}>
                          {player.rating.toLocaleString()}
                          {isUnreliable && <span className="text-base text-gray-400">?</span>}
                        </p>
                      </div>
                      {player.ratingDelta !== 0 && (
                        <p className={`text-xs font-bold ${player.ratingDelta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {player.ratingDelta > 0 ? `▲ +${player.ratingDelta}` : `▼ ${player.ratingDelta}`}
                        </p>
                      )}
                      {player.ratingDelta === 0 && player.rounds > 0 && (
                        <p className="text-xs text-gray-300">변동 없음</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}