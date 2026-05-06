'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

interface PlayerStats {
  name: string;
  nickname: string;
  rounds: number;
  avgScore: number;
  bestScore: number;
  totalScore: number;
}

export default function ScoreRankingPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'avg' | 'best' | 'rounds'>('avg');

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      // 유저 닉네임 맵
      const usersSnap = await getDocs(collection(db, 'users'));
      const nicknameMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        nicknameMap[d.data().name || d.id] = d.data().nickname || '';
      });

      const snap = await getDocs(query(collection(db, 'scorecards'), orderBy('date', 'desc')));
      const statsMap: Record<string, { scores: number[], name: string }> = {};

      snap.docs.forEach(d => {
        const data = d.data();
        const players = data.players || [];
        players.forEach((p: any) => {
          // ✅ 간편입력(totalOverride) 또는 홀별 합산
          const total = ((p.totalOverride || 0) > 0)
            ? p.totalOverride
            : (p.scores || []).reduce((a: number, b: number) => a + b, 0);
          if (total === 0) return;
          if (!statsMap[p.name]) {
            statsMap[p.name] = { scores: [], name: p.name };
          }
          statsMap[p.name].scores.push(total);
        });
      });

      const playerList: PlayerStats[] = Object.entries(statsMap).map(([name, data]) => {
        const scores = data.scores;
        return {
          name,
          nickname: nicknameMap[name] || '',
          rounds: scores.length,
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          bestScore: Math.min(...scores),
          totalScore: scores.reduce((a, b) => a + b, 0),
        };
      }).filter(p => p.rounds > 0);

      setPlayers(playerList);
    } catch (error) {
      console.error('랭킹 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...players].sort((a, b) => {
    if (sortBy === 'avg') return a.avgScore - b.avgScore;
    if (sortBy === 'best') return a.bestScore - b.bestScore;
    return b.rounds - a.rounds;
  });

  const getRankEmoji = (rank: number) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `${rank + 1}`;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">성적 랭킹</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 정렬 탭 */}
        <div className="flex gap-2">
          {[
            { key: 'avg', label: '평균 스코어' },
            { key: 'best', label: '베스트 스코어' },
            { key: 'rounds', label: '라운드 수' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSortBy(tab.key as any)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                sortBy === tab.key ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-gray-400">아직 성적 기록이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((player, rank) => (
              <div key={player.name} className={`bg-white p-5 rounded-2xl shadow-sm border ${
                rank === 0 ? 'border-yellow-200' : rank === 1 ? 'border-gray-200' : rank === 2 ? 'border-orange-200' : 'border-gray-100'
              }`}>
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-black w-8 text-center ${
                    rank === 0 ? 'text-yellow-500' : rank === 1 ? 'text-gray-400' : rank === 2 ? 'text-orange-400' : 'text-gray-300'
                  }`}>
                    {getRankEmoji(rank)}
                  </span>
                  <Avatar name={player.name} size={44} />
                  <div className="flex-1">
                    <p className="font-black text-gray-800">
                      {player.nickname || player.name}
                      {player.nickname && <span className="text-sm text-gray-400 ml-1 font-normal">({player.name})</span>}
                    </p>
                    <p className="text-sm text-gray-400">{player.rounds}라운드</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-800">
                      {sortBy === 'rounds' ? `${player.rounds}회` : sortBy === 'best' ? `${player.bestScore}타` : `${player.avgScore}타`}
                    </p>
                    <p className="text-sm text-gray-400">
                      {sortBy === 'rounds' ? `평균 ${player.avgScore}타` : sortBy === 'best' ? `평균 ${player.avgScore}타` : `베스트 ${player.bestScore}타`}
                    </p>
                  </div>
                </div>

                {/* 상세 통계 */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">라운드</p>
                    <p className="font-black text-gray-700">{player.rounds}회</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">평균</p>
                    <p className="font-black text-blue-500">{player.avgScore}타</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">베스트</p>
                    <p className="font-black text-green-600">{player.bestScore}타</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}