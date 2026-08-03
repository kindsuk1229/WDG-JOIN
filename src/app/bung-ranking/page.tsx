'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

interface PlayerRanking {
  name: string;
  nickname: string;
  seasonScore: number;
  yearlyScore: number;
  totalCount: number;
  fieldCount: number;
  screenCount: number;
  overnightCount: number;
  isOwner: boolean;
  isAdmin: boolean;
  role: string;
}

const OWNER_NAME = '김근석';

export default function BungRankingPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'season' | 'yearly'>('season');
  const [myName, setMyName] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const currentMonth = now.getMonth() + 1;
      const seasonStartMonth = Math.floor((currentMonth - 1) / 2) * 2 + 1;
      const seasonStart = `${currentYear}-${String(seasonStartMonth).padStart(2, '0')}`;
      const seasonEnd = `${currentYear}-${String(seasonStartMonth + 1).padStart(2, '0')}`;

      const [meetupsSnap, usersSnap, adminsSnap] = await Promise.all([
        getDocs(collection(db, 'meetups')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
      ]);

      // 닉네임/역할 맵
      const userMap: Record<string, { nickname: string; role: string }> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        const name = data.name || d.id;
        userMap[name] = { nickname: data.nickname || '', role: 'member' };
      });
      const adminMap: Record<string, string> = {};
      adminsSnap.docs.forEach(d => { adminMap[d.id] = d.data().role || 'manager'; });

      const statsMap: Record<string, {
        seasonScore: number; yearlyScore: number; totalCount: number;
        fieldCount: number; screenCount: number; overnightCount: number;
      }> = {};

      meetupsSnap.forEach(d => {
        const data = d.data();
        if (!data.date || !data.date.startsWith(currentYear)) return;
        if (data.status === 'cancelled') return;
        if (data.meetupType === 'etc' || data.isEtc) return;

        // 날짜 지난 것만
        if (data.status === 'open') return;
        if (data.status === 'closed' || data.status === 'manually_closed') {
          const timeStr = (!data.cartTimes?.[0] || data.cartTimes[0] === 'TBD') ? '23:59' : data.cartTimes[0];
          if (now < new Date(`${data.date}T${timeStr}:00`)) return;
        }

        const type = data.meetupType || 'field';
        const point = type === 'overnight' || data.isOvernight ? 4 : type === 'field' ? 2 : 1;
        const isInSeason = data.date >= seasonStart && data.date <= `${seasonEnd}-31`;

        (data.participants || []).forEach((p: any) => {
          const name = p.name || '';
          if (!name) return;
          if (!statsMap[name]) statsMap[name] = { seasonScore: 0, yearlyScore: 0, totalCount: 0, fieldCount: 0, screenCount: 0, overnightCount: 0 };
          statsMap[name].totalCount += 1;
          statsMap[name].yearlyScore += point;
          if (isInSeason) statsMap[name].seasonScore += point;
          if (type === 'field') statsMap[name].fieldCount += 1;
          else if (type === 'screen') statsMap[name].screenCount += 1;
          else if (type === 'overnight' || data.isOvernight) statsMap[name].overnightCount += 1;
        });
      });

      const list: PlayerRanking[] = Object.entries(statsMap)
        .map(([name, stats]) => ({
          name,
          nickname: userMap[name]?.nickname || '',
          role: name === OWNER_NAME ? 'owner' : (adminMap[name] || 'member'),
          isOwner: name === OWNER_NAME,
          isAdmin: !!adminMap[name] || name === OWNER_NAME,
          ...stats,
        }))
        .filter(p => p.yearlyScore > 0);

      setPlayers(list);
    } catch (error) {
      console.error('랭킹 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...players].sort((a, b) =>
    tab === 'season'
      ? b.seasonScore - a.seasonScore || b.yearlyScore - a.yearlyScore
      : b.yearlyScore - a.yearlyScore || b.seasonScore - a.seasonScore
  );

  const getRoleBadge = (player: PlayerRanking) => {
    if (player.isOwner) return { label: '오너', cls: 'bg-yellow-100 text-yellow-700' };
    if (player.role === 'manager') return { label: '매니저', cls: 'bg-blue-100 text-blue-700' };
    return null;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">벙 점수 랭킹</h1>
      </header>

      <div className="p-4 space-y-4">

        {/* 점수 기준 안내 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 mb-3">벙개 유형별 점수</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '🏌️ 필드', point: '2점', color: 'bg-green-50 text-green-700' },
              { label: '🌙 1박2일', point: '4점', color: 'bg-purple-50 text-purple-700' },
              { label: '🖥️ 스크린', point: '1점', color: 'bg-blue-50 text-blue-700' },
            ].map((item) => (
              <div key={item.label} className={`${item.color} rounded-xl p-3 text-center`}>
                <p className="text-xs mb-1">{item.label}</p>
                <p className="font-black text-lg">{item.point}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 시즌 / 연간 탭 */}
        <div className="flex gap-2">
          <button onClick={() => setTab('season')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${tab === 'season' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            🏅 시즌 랭킹
          </button>
          <button onClick={() => setTab('yearly')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${tab === 'yearly' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            🏆 연간 랭킹
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-400">아직 기록이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((player, rank) => {
              const badge = getRoleBadge(player);
              const score = tab === 'season' ? player.seasonScore : player.yearlyScore;
              const isMe = player.name === myName;

              return (
                <div key={player.name} className={`bg-white p-4 rounded-2xl shadow-sm border ${
                  isMe ? 'border-green-300' :
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
                        <span className="font-black text-gray-800">{player.nickname || player.name}</span>
                        {player.nickname && <span className="text-xs text-gray-400">({player.name})</span>}
                        {isMe && <span className="text-xs text-green-600 font-bold">(나)</span>}
                        {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>}
                      </div>
                      {/* 타입별 참여 */}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {player.fieldCount > 0 && <span className="text-xs text-green-600">필드 {player.fieldCount}회</span>}
                        {player.overnightCount > 0 && <span className="text-xs text-purple-600">1박2일 {player.overnightCount}회</span>}
                        {player.screenCount > 0 && <span className="text-xs text-blue-600">스크린 {player.screenCount}회</span>}
                      </div>
                    </div>

                    {/* 점수 */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-black text-gray-800">
                        {score}<span className="text-sm font-bold text-gray-400 ml-0.5">점</span>
                      </p>
                      <p className="text-xs text-gray-400">총 {player.totalCount}회</p>
                    </div>
                  </div>

                  {/* 시즌/연간 점수 모두 표시 */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">시즌 점수</p>
                      <p className={`font-black ${tab === 'season' ? 'text-green-600' : 'text-gray-500'}`}>{player.seasonScore}점</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">연간 점수</p>
                      <p className={`font-black ${tab === 'yearly' ? 'text-green-600' : 'text-gray-500'}`}>{player.yearlyScore}점</p>
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