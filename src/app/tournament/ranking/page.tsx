'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface TournamentResult {
  tournamentId: string;
  title: string;
  round: number;
  date: string;
  type: string;
  rank: number;
  name: string;
  nickname: string;
  score: string;
}

interface HallOfFame {
  name: string;
  nickname: string;
  wins: number;        // 우승 횟수
  top3: number;        // 3위 이내
  appearances: number; // 대회 참여 횟수
  bestRank: number;    // 최고 순위
  records: { round: number; title: string; rank: number; score: string; date: string }[];
}

export default function TournamentRankingPage() {
  const router = useRouter();
  const [hallOfFame, setHallOfFame] = useState<HallOfFame[]>([]);
  const [recentResults, setRecentResults] = useState<TournamentResult[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'hall' | 'history'>('hall');
  const [myName, setMyName] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('date', 'desc')));
      const tList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setTournaments(tList);

      // 역대 결과 집계
      const allResults: TournamentResult[] = [];
      const fameMap: Record<string, HallOfFame> = {};

      tList.forEach(t => {
        if (!t.results || t.results.length === 0) return;

        // 점수 기준 정렬 → 순위 부여
        const sorted = [...t.results].sort((a: any, b: any) => Number(a.score) - Number(b.score));

        sorted.forEach((r: any, idx: number) => {
          const rank = idx + 1;
          allResults.push({
            tournamentId: t.id,
            title: t.title,
            round: t.round || 0,
            date: t.date,
            type: t.type,
            rank,
            name: r.name,
            nickname: r.nickname || r.name,
            score: r.score,
          });

          // 명예의 전당 집계
          if (!fameMap[r.name]) {
            fameMap[r.name] = {
              name: r.name,
              nickname: r.nickname || r.name,
              wins: 0,
              top3: 0,
              appearances: 0,
              bestRank: rank,
              records: [],
            };
          }
          const fame = fameMap[r.name];
          fame.appearances += 1;
          if (rank === 1) fame.wins += 1;
          if (rank <= 3) fame.top3 += 1;
          if (rank < fame.bestRank) fame.bestRank = rank;
          fame.records.push({ round: t.round, title: t.title, rank, score: r.score, date: t.date });
        });
      });

      // 우승 횟수 → 3위이내 → 참여 횟수 순 정렬
      const fameList = Object.values(fameMap).sort((a, b) =>
        b.wins - a.wins || b.top3 - a.top3 || b.appearances - a.appearances
      );

      setHallOfFame(fameList);
      setRecentResults(allResults);
    } catch (err) {
      console.error('랭킹 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}위`;
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <div>
          <h1 className="text-xl font-black text-gray-800">명예의 전당</h1>
          <p className="text-xs text-gray-400">역대 대회 랭킹</p>
        </div>
      </header>

      {/* 탭 */}
      <div className="flex gap-2 p-4 pb-0">
        <button onClick={() => setTab('hall')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${tab === 'hall' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
          🏆 명예의 전당
        </button>
        <button onClick={() => setTab('history')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${tab === 'history' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
          📋 대회별 결과
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : tab === 'hall' ? (
          <>
            {hallOfFame.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-4xl mb-3">🏆</p>
                <p className="text-gray-400 text-sm">아직 대회 결과가 없어요.</p>
              </div>
            ) : (
              // 최대 10명 표시 (중복 포함)
              hallOfFame.slice(0, 10).map((p, i) => {
                const isMe = p.name === myName;
                return (
                  <div key={p.name} className={`bg-white rounded-2xl p-4 shadow-sm border ${
                    isMe ? 'border-green-300' :
                    i === 0 ? 'border-yellow-200' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl font-black w-8 text-center ${
                        i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'
                      }`}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-black ${isMe ? 'text-green-700' : 'text-gray-800'}`}>
                            {p.nickname || p.name}
                          </span>
                          {isMe && <span className="text-xs text-green-600 font-bold">(나)</span>}
                        </div>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-yellow-600 font-bold">🏆 {p.wins}회 우승</span>
                          <span className="text-xs text-orange-500 font-bold">🎖 3위이내 {p.top3}회</span>
                          <span className="text-xs text-gray-400">{p.appearances}회 참가</span>
                        </div>
                      </div>
                    </div>

                    {/* 개인 기록 (최근 5개) */}
                    <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                      {p.records.slice(0, 5).map((r, ri) => (
                        <div key={ri} className="flex items-center gap-2 text-xs">
                          <span className={`font-black w-8 text-center ${
                            r.rank === 1 ? 'text-yellow-500' : r.rank === 2 ? 'text-gray-400' : r.rank === 3 ? 'text-orange-400' : 'text-gray-300'
                          }`}>{getRankEmoji(r.rank)}</span>
                          <span className="text-gray-500 flex-1">제{r.round}회 {r.title}</span>
                          <span className="text-gray-400">{r.date}</span>
                          <span className="font-bold text-gray-700">{r.score}</span>
                        </div>
                      ))}
                      {p.records.length > 5 && (
                        <p className="text-xs text-gray-400 text-center">외 {p.records.length - 5}개 기록</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          <>
            {/* 대회별 결과 */}
            {tournaments.filter(t => t.results?.length > 0).length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">아직 완료된 대회가 없어요.</p>
              </div>
            ) : (
              tournaments
                .filter(t => t.results?.length > 0)
                .map(t => {
                  const sorted = [...t.results].sort((a: any, b: any) => Number(a.score) - Number(b.score));
                  // 1~5위만 표시
                  const top5 = sorted.slice(0, 5);
                  return (
                    <div key={t.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        {t.round > 0 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">제{t.round}회</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          t.type === 'screen' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {t.type === 'screen' ? '🖥️ 스크린' : '🏌️ 필드'}
                        </span>
                        <span className="text-sm font-black text-gray-800 flex-1">{t.title}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">{t.date} · {t.venue}</p>

                      <div className="space-y-2">
                        {top5.map((r: any, idx: number) => (
                          <div key={r.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                            <span className={`text-base font-black w-8 text-center ${
                              idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                            }`}>
                              {getRankEmoji(idx + 1)}
                            </span>
                            <span className={`flex-1 font-bold ${r.name === myName ? 'text-green-700' : 'text-gray-700'}`}>
                              {r.nickname || r.name}
                              {r.name === myName && <span className="text-xs text-green-500 ml-1">(나)</span>}
                            </span>
                            <span className="font-black text-gray-800">{r.score}</span>
                          </div>
                        ))}
                        {sorted.length > 5 && (
                          <p className="text-xs text-gray-400 text-center">외 {sorted.length - 5}명</p>
                        )}
                      </div>

                      {/* 시상 내역 */}
                      {t.awards?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-50">
                          <p className="text-xs font-bold text-gray-400 mb-2">🏅 시상</p>
                          <div className="flex flex-wrap gap-2">
                            {t.awards.map((a: any) => (
                              <span key={a.id} className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg font-bold">
                                {a.rank}: {a.winner} {a.prize && `(${a.prize})`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </>
        )}
      </div>
    </div>
  );
}