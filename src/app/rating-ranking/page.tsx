'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Avatar } from '@/components/UI';
import { getReliabilityBadge, RATING_DEFAULT, RATING_MIN, calcRoundRating } from '@/lib/rating';

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
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState('');

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

      // 4라운드 이상 → 정식 랭킹 (배치고사 완료)
      const ranked = all.filter(p => p.rounds >= 4).sort((a, b) => b.rating - a.rating);
      // 4라운드 미만 → 배치고사 중 (아이언)
      const notRanked = all.filter(p => p.rounds > 0 && p.rounds < 4).sort((a, b) => b.rounds - a.rounds);

      setPlayers(ranked);
      setUnranked(notRanked);
    } catch (err) {
      console.error('랭킹 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 전체 레이팅 재계산 (벙개 성적표 + 대회 타수 포함)
  const handleRecalculate = async () => {
    if (!window.confirm('모든 성적표(벙개+대회)를 바탕으로 레이팅을 처음부터 재계산합니다.\n시간이 걸릴 수 있어요. 계속할까요?')) return;
    setRecalculating(true);
    setRecalcMsg('성적표 불러오는 중...');
    try {
      const scorecardsSnap = await getDocs(collection(db, 'scorecards'));
      setRecalcMsg(`성적표 ${scorecardsSnap.size}개 로드 완료, 대회 불러오는 중...`);
      const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
      setRecalcMsg(`대회 ${tournamentsSnap.size}개 로드 완료, 계산 중...`);

      // 벙개 성적표 → 라운드 목록
      const rounds: { date: string; players: { name: string; score: number }[] }[] = [];

      scorecardsSnap.docs.forEach(d => {
        const data = d.data();
        const date = data.date || data.savedAt?.substring(0, 10) || '2000-01-01';
        const playerList: { name: string; score: number }[] = [];
        (data.players || []).forEach((p: any) => {
          const total = (p.totalOverride || 0) > 0
            ? p.totalOverride
            : (p.scores || []).reduce((a: number, b: number) => a + b, 0);
          if (p.name && total > 0) playerList.push({ name: p.name, score: total });
        });
        if (playerList.length >= 2) rounds.push({ date, players: playerList });
      });

      // 완료된 필드 대회 → 라운드 목록 (스크린 제외)
      tournamentsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status !== 'completed') return;
        if (data.type === 'screen') return;
        const date = data.date || '2000-01-01';
        const participants: string[] = (data.participants || []).map((p: any) => p.name);
        const results = data.results || [];
        const playerList: { name: string; score: number }[] = [];
        results.forEach((r: any, idx: number) => {
          if (!participants.includes(r.name)) return;
          const scoreNum = Number(r.score);
          const score = isNaN(scoreNum) || scoreNum === 0 ? 72 + idx * 2 : scoreNum;
          if (r.name) playerList.push({ name: r.name, score });
        });
        if (playerList.length >= 2) rounds.push({ date, players: playerList });
      });

      // 날짜 오름차순 정렬
      rounds.sort((a, b) => a.date.localeCompare(b.date));
      setRecalcMsg(`${rounds.length}개 라운드 계산 중...`);

      // 플레이어 상태 맵 (첫 등장 시 기본값 1000으로 시작 — 미래 성적 반영 방지)
      const ratingMap: Record<string, { rating: number; rounds: number; recentOpponents: string[]; lastDelta: number }> = {};

      const initPlayer = (name: string) => {
        if (ratingMap[name]) return;
        ratingMap[name] = {
          rating: RATING_DEFAULT,  // 첫 라운드 전에는 항상 1000으로 시작
          rounds: 0,
          recentOpponents: [],
          lastDelta: 0,
        };
      };

      // 라운드별 순차 계산
      for (const round of rounds) {
        round.players.forEach(p => initPlayer(p.name));

        const recentOpponentsMap: Record<string, string[]> = {};
        round.players.forEach(p => { recentOpponentsMap[p.name] = ratingMap[p.name].recentOpponents; });

        const deltas = calcRoundRating(
          round.players.map(p => ({
            name: p.name,
            rating: ratingMap[p.name].rating,
            rounds: ratingMap[p.name].rounds,
            score: p.score,
          })),
          recentOpponentsMap,
        );

        const allNames = round.players.map(p => p.name);
        deltas.forEach(({ name, delta }) => {
          const cur = ratingMap[name];
          const newRating = Math.max(RATING_MIN, Math.round(cur.rating + delta));
          const newRounds = cur.rounds + 1;
          const opponents = allNames.filter(n => n !== name);
          const updatedRecentOpponents = [...opponents, ...cur.recentOpponents]
            .slice(0, Math.min(newRounds, 7) * 4);
          ratingMap[name] = { rating: newRating, rounds: newRounds, recentOpponents: updatedRecentOpponents, lastDelta: delta };
        });
      }

      // Firebase 업데이트
      const updates = Object.entries(ratingMap);
      setRecalcMsg(`계산 완료 (${updates.length}명), Firebase 저장 중...`);
      let savedCount = 0;
      for (const [name, data] of updates) {
        try {
          const userRef = doc(db, 'users', name);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            await updateDoc(userRef, {
              rating: data.rating,
              ratingRounds: data.rounds,
              ratingDelta: data.lastDelta,
              recentOpponents: data.recentOpponents,
              ratingUpdatedAt: new Date().toISOString(),
            });
            savedCount++;
          }
        } catch (writeErr: any) {
          console.error(`${name} 저장 실패:`, writeErr);
          throw new Error(`${name} 저장 실패: ${writeErr?.message}`);
        }
      }

      setRecalcMsg(`✅ 완료! ${savedCount}명 업데이트`);
      await fetchRankings();
    } catch (err: any) {
      console.error('재계산 실패:', err);
      setRecalcMsg(`❌ 재계산 실패: ${err?.message || String(err)}`);
    } finally {
      setRecalculating(false);
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
  const isAdmin = myName === OWNER_NAME;

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">골프 Rating 랭킹</h1>
          <p className="text-xs text-gray-400">강한 상대를 이길수록 · 큰 타수 차일수록 · 많은 인원일수록</p>
        </div>
      </header>

      <div className="p-4 space-y-4">

        {/* ✅ 관리자 재계산 버튼 */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-xs font-bold text-gray-400">관리자 도구</p>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold disabled:bg-gray-300"
            >
              {recalculating ? '계산 중...' : '🔄 전체 레이팅 재계산'}
            </button>
            {recalcMsg && <p className="text-xs text-center text-gray-500">{recalcMsg}</p>}
            <p className="text-xs text-gray-400">모든 벙개+대회 성적표를 날짜순으로 처음부터 재계산해요.</p>
          </div>
        )}

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