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
  ratingDelta: number;
}

// ✅ 등급 시스템
const TIERS = [
  { name: '챌린저',   emoji: '🏆', color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    fixed: 3  },
  { name: '마스터',   emoji: '💎', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   fixed: 4  },
  { name: '다이아몬드',emoji: '🔷', color: 'text-cyan-500',   bg: 'bg-cyan-50',   border: 'border-cyan-200',   fixed: 7  },
  { name: '에메랄드', emoji: '💚', color: 'text-emerald-500',bg: 'bg-emerald-50',border: 'border-emerald-200', fixed: 10 },
  { name: '플래티넘', emoji: '⚪', color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  fixed: 15 },
  { name: '골드',    emoji: '🥇', color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', fixed: 20 },
  { name: '실버',    emoji: '🥈', color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200',   fixed: 25 },
  { name: '브론즈',  emoji: '🥉', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', fixed: 30 },
  { name: '아이언',  emoji: '⚙️', color: 'text-gray-400',   bg: 'bg-gray-50',   border: 'border-gray-200',   fixed: null }, // 나머지
];

const IRON = TIERS[TIERS.length - 1]; // 아이언 = 마지막 등급 (나머지)

function getTier(rank: number, total: number) {
  let cumulative = 0;
  for (const tier of TIERS) {
    const count = tier.fixed ?? (total - cumulative);
    cumulative += count;
    if (rank <= cumulative) return tier;
  }
  return TIERS[TIERS.length - 1];
}

export default function RatingRankingPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<RatingPlayer[]>([]);
  const [unranked, setUnranked] = useState<RatingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [showUnranked, setShowUnranked] = useState(false);

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

      const all = usersSnap.docs.map(d => {
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
      });

      // 3라운드 이상 → 정식 랭킹 (배치고사 완료)
      const ranked = all.filter(p => p.rounds >= 3).sort((a, b) => b.rating - a.rating);
      // 3라운드 미만 → 배치고사 중 (아이언)
      const notRanked = all.filter(p => p.rounds > 0 && p.rounds < 3).sort((a, b) => b.rounds - a.rounds);

      setPlayers(ranked);
      setUnranked(notRanked);
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

  const getStars = (rounds: number) => {
    const r = getReliabilityBadge(rounds);
    if (r.stars === 0) return <span className="text-red-400 text-xs">❓</span>;
    return <span className="text-yellow-400 text-xs">{'⭐'.repeat(r.stars)}</span>;
  };

  const total = players.length;

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

        {/* 등급 안내 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 mb-3">등급 기준</p>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {TIERS.map(t => (
              <div key={t.name} className={`${t.bg} rounded-xl p-2`}>
                <p className="text-base">{t.emoji}</p>
                <p className={`text-xs font-bold ${t.color}`}>{t.name}</p>
                <p className="text-xs text-gray-400">{t.fixed ? `${t.fixed}명` : '나머지'}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-xs text-gray-400 text-center">3라운드 완료 시 랭킹 등록 (배치고사) · 1개월 미참여 −10점</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : players.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-400 text-sm">아직 랭킹에 오른 회원이 없어요.</p>
            <p className="text-gray-300 text-xs mt-1">필드 벙개 3라운드 완료 시 랭킹에 등록돼요!</p>
          </div>
        ) : (
          <>
            {/* ✅ 정식 랭킹 */}
            <div className="space-y-2">
              {players.map((player, idx) => {
                const rank = idx + 1;
                const tier = getTier(rank, total);
                const badge = getRoleBadge(player);
                const isMe = player.name === myName;

                return (
                  <div key={player.name} className={`bg-white p-4 rounded-2xl shadow-sm border ${
                    isMe ? 'border-green-300' : tier.border
                  }`}>
                    <div className="flex items-center gap-3">
                      {/* 순위 + 등급 */}
                      <div className="flex flex-col items-center w-12 flex-shrink-0">
                        <span className="text-lg">{tier.emoji}</span>
                        <span className="text-xs font-black text-gray-400">{rank}위</span>
                      </div>

                      <Avatar name={player.name} size={40} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-black ${isMe ? 'text-green-800' : 'text-gray-800'}`}>
                            {player.nickname || player.name}
                          </span>
                          {player.nickname && <span className="text-xs text-gray-400">({player.name})</span>}
                          {isMe && <span className="text-xs text-green-600 font-bold">(나)</span>}
                          {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                            {tier.name}
                          </span>
                          {getStars(player.rounds)}
                          <span className="text-xs text-gray-400">{player.rounds}라운드</span>
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xl font-black ${isMe ? 'text-green-700' : 'text-gray-800'}`}>
                          {player.rating.toLocaleString()}
                        </p>
                        {player.ratingDelta !== 0 && (
                          <p className={`text-xs font-bold ${player.ratingDelta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                            {player.ratingDelta > 0 ? `▲ +${player.ratingDelta}` : `▼ ${player.ratingDelta}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ✅ 아이언 (배치고사 중) */}
            {unranked.length > 0 && (
              <div>
                <button
                  onClick={() => setShowUnranked(v => !v)}
                  className="w-full py-3 bg-white rounded-2xl border border-gray-200 text-sm font-bold text-gray-500 flex items-center justify-center gap-2"
                >
                  <span>{IRON.emoji} 아이언 (배치고사 중) {unranked.length}명</span>
                  <span>{showUnranked ? '▲' : '▼'}</span>
                </button>

                {showUnranked && (
                  <div className="mt-2 space-y-2">
                    {unranked.map((player) => {
                      const badge = getRoleBadge(player);
                      const isMe = player.name === myName;
                      return (
                        <div key={player.name} className="bg-white p-4 rounded-2xl border border-gray-100 opacity-70">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center w-12 flex-shrink-0">
                              <span className="text-lg">{IRON.emoji}</span>
                              <span className="text-xs text-gray-400">배치중</span>
                            </div>
                            <Avatar name={player.name} size={40} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-gray-600">{player.nickname || player.name}</span>
                                {isMe && <span className="text-xs text-green-600 font-bold">(나)</span>}
                                {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{player.rounds}/3 라운드 완료</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-black text-gray-400">{3 - player.rounds}라운드 남음</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}