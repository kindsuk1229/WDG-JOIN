'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface ScoreRecord {
  id: string;
  meetupTitle: string;
  golfCourse: string;
  date: string;
  totalPar: number;
  myScore: number;
  pars: number[];
  scores: number[];
}

export default function MyScoresPage() {
  const router = useRouter();
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchScores(name);
  }, []);

  const fetchScores = async (name: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'scorecards'), orderBy('date', 'desc')));
      const myRecords: ScoreRecord[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        const players = data.players || [];
        const myPlayer = players.find((p: any) => p.name === name);
        if (!myPlayer) return;

        // ✅ 간편입력(totalOverride) 또는 홀별 합산
        const myScore = myPlayer.totalOverride > 0
          ? myPlayer.totalOverride
          : myPlayer.scores.reduce((a: number, b: number) => a + b, 0);
        if (myScore === 0) return;

        myRecords.push({
          id: d.id,
          meetupTitle: data.meetupTitle || '',
          golfCourse: data.golfCourse || '',
          date: data.date || '',
          totalPar: data.totalPar || 72,
          myScore,
          pars: data.pars || [],
          scores: myPlayer.scores || [],
        });
      });

      setRecords(myRecords);
    } catch (error) {
      console.error('성적 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreDiff = (score: number, par: number) => {
    if (score === 0) return '-';
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const getDiffColor = (score: number, par: number) => {
    const diff = score - par;
    if (diff < 0) return 'text-blue-500';
    if (diff === 0) return 'text-green-500';
    if (diff <= 5) return 'text-gray-600';
    return 'text-red-500';
  };

  const getBestScore = () => {
    if (records.length === 0) return null;
    return records.reduce((best, r) => r.myScore < best.myScore ? r : best);
  };

  const getAvgScore = () => {
    if (records.length === 0) return 0;
    return Math.round(records.reduce((sum, r) => sum + r.myScore, 0) / records.length);
  };

  const best = getBestScore();
  const avg = getAvgScore();

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">내 성적 히스토리</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 통계 카드 */}
        {records.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
              <p className="text-sm text-gray-400 font-medium">라운드</p>
              <p className="text-xl font-black text-gray-800 mt-1">{records.length}회</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
              <p className="text-sm text-gray-400 font-medium">평균</p>
              <p className="text-xl font-black text-blue-500 mt-1">{avg}타</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
              <p className="text-sm text-gray-400 font-medium">베스트</p>
              <p className="text-xl font-black text-green-600 mt-1">{best?.myScore}타</p>
            </div>
          </div>
        )}

        {/* 성적 목록 */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">⛳</p>
            <p className="text-gray-400">아직 기록된 성적이 없어요.</p>
          </div>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
              onClick={() => router.push(`/scorecard?meetupId=${record.id}`)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-gray-800">{record.meetupTitle}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">{record.golfCourse} | {record.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-800">{record.myScore}타</p>
                  <p className={`text-sm font-bold ${getDiffColor(record.myScore, record.totalPar)}`}>
                    {getScoreDiff(record.myScore, record.totalPar)}
                  </p>
                </div>
              </div>

              {/* 전반/후반 스코어 */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">전반</p>
                  <p className="font-black text-gray-700">
                    {record.scores.slice(0, 9).reduce((a, b) => a + b, 0) || '-'}타
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">후반</p>
                  <p className="font-black text-gray-700">
                    {record.scores.slice(9, 18).reduce((a, b) => a + b, 0) || '-'}타
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}