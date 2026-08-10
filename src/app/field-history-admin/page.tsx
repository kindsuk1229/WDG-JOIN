'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

const OWNER_NAME = '김근석';

interface RoundRecord {
  id: string;
  title: string;
  golfCourse: string;
  date: string;
  meetupType: string;
  participants: { name: string; nickname: string }[];
  hasScorecard: boolean;
  playerScores: { name: string; nickname: string; score: number }[];
  ratingDeltas: Record<string, number>; // name → delta
}

export default function FieldHistoryAdminPage() {
  const router = useRouter();
  const [records, setRecords] = useState<RoundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>('전체');
  const [years, setYears] = useState<string[]>([]);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    if (name !== OWNER_NAME) {
      router.replace('/mypage');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [meetupsSnap, scorecardsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'meetups'), orderBy('date', 'desc'))),
        getDocs(collection(db, 'scorecards')),
        getDocs(collection(db, 'users')),
      ]);

      // 닉네임 맵
      const nicknameMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        nicknameMap[data.name || d.id] = data.nickname || '';
      });

      // Rating 변동 맵 (name → lastDelta)
      const ratingDeltaMap: Record<string, number> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        const name = data.name || d.id;
        ratingDeltaMap[name] = data.ratingDelta ?? 0;
      });

      // 성적표 맵 (meetupId → players)
      const scorecardMap: Record<string, { name: string; nickname: string; score: number }[]> = {};
      scorecardsSnap.docs.forEach(d => {
        const sc = d.data();
        if (sc.isDay2) return;
        const mid = sc.meetupId || d.id;
        const players = (sc.players || []).map((p: any) => {
          const score = (p.totalOverride || 0) > 0
            ? p.totalOverride
            : (p.scores || []).reduce((a: number, b: number) => a + b, 0);
          return { name: p.name, nickname: p.nickname || nicknameMap[p.name] || '', score };
        }).filter((p: any) => p.score > 0);

        // 1박2일 day2 합산
        const day2Snap = scorecardsSnap.docs.find(d2 => d2.id === mid + '_day2');
        if (day2Snap) {
          const day2 = day2Snap.data();
          players.forEach((p: any) => {
            const day2Player = (day2.players || []).find((p2: any) => p2.name === p.name);
            if (day2Player) {
              const day2Score = (day2Player.totalOverride || 0) > 0
                ? day2Player.totalOverride
                : (day2Player.scores || []).reduce((a: number, b: number) => a + b, 0);
              p.score += day2Score;
            }
          });
        }

        scorecardMap[mid] = players.sort((a: any, b: any) => a.score - b.score);
      });

      // 필드/1박2일 벙개만 필터
      const now = new Date();
      const roundRecords: RoundRecord[] = meetupsSnap.docs
        .map(d => {
          const data = d.data();
          const id = d.id;
          const type = data.meetupType || 'field';
          if (type !== 'field' && type !== 'overnight') return null;
          if (data.status === 'cancelled') return null;

          // 지난 벙개만
          const timeStr = (data.cartTimes?.[0] === 'TBD' || !data.cartTimes?.[0]) ? '23:59' : data.cartTimes[0];
          const meetupDT = new Date(`${data.date}T${timeStr}:00`);
          if (now < meetupDT) return null;

          const participants = (data.participants || []).map((p: any) => ({
            name: p.name,
            nickname: p.nickname || nicknameMap[p.name] || p.name,
          }));

          const hasScorecard = !!scorecardMap[id];
          const playerScores = scorecardMap[id] || [];

          // Rating 변동은 users에서 가져온 lastDelta (이번 라운드 것만 표시)
          const ratingDeltas: Record<string, number> = {};
          playerScores.forEach(p => {
            ratingDeltas[p.name] = ratingDeltaMap[p.name] ?? 0;
          });

          return {
            id,
            title: data.title || '',
            golfCourse: data.golfCourse || '',
            date: data.date || '',
            meetupType: type,
            participants,
            hasScorecard,
            playerScores,
            ratingDeltas,
          } as RoundRecord;
        })
        .filter(Boolean) as RoundRecord[];

      // 연도 목록
      const yearSet = new Set(roundRecords.map(r => r.date.substring(0, 4)));
      const yearList = ['전체', ...Array.from(yearSet).sort((a, b) => b.localeCompare(a))];
      setYears(yearList);
      setRecords(roundRecords);
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter(r =>
    filterYear === '전체' || r.date.startsWith(filterYear)
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateStr} (${days[d.getDay()]})`;
  };

  // 통계
  const totalRounds = filtered.length;
  const scorecardCount = filtered.filter(r => r.hasScorecard).length;
  const scorecardRate = totalRounds > 0 ? Math.round((scorecardCount / totalRounds) * 100) : 0;

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">필드 라운딩 기록</h1>
          <p className="text-xs text-gray-400">오너 전용 페이지</p>
        </div>
      </header>

      <div className="p-4 space-y-4">

        {/* 연도 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {years.map(y => (
            <button key={y} onClick={() => setFilterYear(y)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold ${
                filterYear === y ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {y}
            </button>
          ))}
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '총 라운드', value: `${totalRounds}회`, color: 'text-gray-800' },
            { label: '성적표 입력', value: `${scorecardCount}회`, color: 'text-green-600' },
            { label: '입력률', value: `${scorecardRate}%`, color: scorecardRate >= 80 ? 'text-green-600' : 'text-orange-500' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={`text-lg font-black mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 라운드 목록 */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400">기록이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((record) => {
              const isExpanded = expandedId === record.id;
              return (
                <div key={record.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                  {/* 헤더 */}
                  <div
                    className="p-4 cursor-pointer active:bg-gray-50"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {record.meetupType === 'overnight' && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">1박2일</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            record.hasScorecard
                              ? 'bg-green-50 text-green-600'
                              : 'bg-red-50 text-red-400'
                          }`}>
                            {record.hasScorecard ? '✅ 성적표 있음' : '❌ 성적표 없음'}
                          </span>
                        </div>
                        <p className="font-black text-gray-800">{record.golfCourse || record.title}</p>
                        <p className="text-sm text-gray-400 mt-0.5">{formatDate(record.date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-500">{record.participants.length}명 참여</p>
                        <p className="text-gray-300 text-lg">{isExpanded ? '▲' : '▼'}</p>
                      </div>
                    </div>

                    {/* 참여자 미리보기 */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {record.participants.slice(0, 8).map((p, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-bold">
                          {p.nickname || p.name}
                        </span>
                      ))}
                      {record.participants.length > 8 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded-full">
                          +{record.participants.length - 8}명
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 펼쳐진 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-50 p-4 space-y-4">

                      {/* 성적표 있을 때 — 타수 순위 */}
                      {record.hasScorecard && record.playerScores.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 mb-2">📊 타수 순위 {record.meetupType === 'overnight' ? '(합산)' : ''}</p>
                          <div className="space-y-2">
                            {record.playerScores.map((p, rank) => (
                              <div key={p.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                                <span className={`text-base font-black w-6 text-center ${
                                  rank === 0 ? 'text-yellow-500' :
                                  rank === 1 ? 'text-gray-400' :
                                  rank === 2 ? 'text-orange-400' : 'text-gray-300'
                                }`}>
                                  {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}
                                </span>
                                <Avatar name={p.name} size={28} />
                                <span className="flex-1 text-sm font-bold text-gray-700">
                                  {p.nickname || p.name}
                                </span>
                                <span className="text-base font-black text-gray-800">{p.score}타</span>
                                {record.ratingDeltas[p.name] !== undefined && record.ratingDeltas[p.name] !== 0 && (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    record.ratingDeltas[p.name] > 0
                                      ? 'bg-green-50 text-green-600'
                                      : 'bg-red-50 text-red-400'
                                  }`}>
                                    {record.ratingDeltas[p.name] > 0 ? '+' : ''}{record.ratingDeltas[p.name]}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 성적표 없을 때 — 참여자 목록만 */}
                      {!record.hasScorecard && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 mb-2">👥 참여자</p>
                          <div className="flex flex-wrap gap-2">
                            {record.participants.map((p, i) => (
                              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl">
                                <Avatar name={p.name} size={20} />
                                <span className="text-sm text-gray-600 font-bold">{p.nickname || p.name}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-red-400 mt-2">⚠️ 성적표 미입력 — Rating 반영 안 됨</p>
                        </div>
                      )}

                      {/* 성적표 이동 버튼 */}
                      <button
                        onClick={() => router.push(`/scorecard?meetupId=${record.id}`)}
                        className="w-full py-3 rounded-xl text-sm font-bold bg-green-600 text-white active:scale-95 transition-all"
                      >
                        📊 성적표 {record.hasScorecard ? '수정' : '입력'}하기
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}