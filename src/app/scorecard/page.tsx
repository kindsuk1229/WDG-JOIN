'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface PlayerScore {
  name: string;
  nickname: string;
  scores: number[];
}

function ScorecardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('meetupId');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [meetup, setMeetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [pars, setPars] = useState<number[]>(Array(18).fill(4));
  const [parMode, setParMode] = useState(true);
  const [holeGroup, setHoleGroup] = useState<'front' | 'back'>('front');
  const [activePlayer, setActivePlayer] = useState(0);
  const [players, setPlayers] = useState<PlayerScore[]>([]);

  useEffect(() => {
    if (!meetupId) return;
    const fetchMeetup = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'meetups', meetupId));
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setMeetup(data);

          const participants = (data as any).participants || [];
          setPlayers(participants.map((p: any) => ({
            name: p.name,
            nickname: p.nickname || '',
            scores: Array(18).fill(0),
          })));

          const scorecardSnap = await getDoc(doc(db, 'scorecards', meetupId));
          if (scorecardSnap.exists()) {
            const sc = scorecardSnap.data();
            if (sc.pars) setPars(sc.pars);
            if (sc.players) setPlayers(sc.players);
            setParMode(false);
          }
        }
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetup();
  }, [meetupId]);

  // ✅ 사진으로 스코어 자동 입력
  const handlePhotoAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      // 이미지를 base64로 변환
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const playerNames = players.map(p => p.nickname || p.name).join(', ');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: file.type, data: base64 }
              },
              {
                type: 'text',
                text: `이 골프 스코어카드 이미지에서 각 플레이어의 홀별 타수를 추출해주세요.
                
플레이어 목록: ${playerNames}

반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "pars": [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  "players": [
    {
      "name": "플레이어명",
      "scores": [5,4,3,4,5,4,3,4,5,4,5,4,3,4,5,4,3,4]
    }
  ]
}

주의사항:
- pars와 scores는 반드시 18개 숫자 배열이어야 합니다
- 읽을 수 없는 홀은 0으로 입력하세요
- 플레이어 이름은 위 목록에서 가장 유사한 이름으로 매핑해주세요`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      // JSON 파싱
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');

      const result = JSON.parse(jsonMatch[0]);

      // 파 설정 적용
      if (result.pars && result.pars.length === 18) {
        setPars(result.pars);
      }

      // 플레이어 스코어 적용
      if (result.players && result.players.length > 0) {
        setPlayers(prev => prev.map(player => {
          const found = result.players.find((p: any) =>
            p.name === player.name ||
            p.name === player.nickname ||
            player.name.includes(p.name) ||
            p.name.includes(player.name)
          );
          if (found && found.scores?.length === 18) {
            return { ...player, scores: found.scores };
          }
          return player;
        }));
      }

      setParMode(false);
      alert(`✅ 스코어 분석 완료!\n${result.players?.length || 0}명의 스코어가 입력되었습니다.\n확인 후 수정하세요.`);

    } catch (error) {
      console.error('분석 실패:', error);
      alert('스코어 분석에 실패했어요. 직접 입력해주세요.');
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updatePar = (holeIndex: number, value: number) => {
    const newPars = [...pars];
    newPars[holeIndex] = Math.min(6, Math.max(3, value));
    setPars(newPars);
  };

  const updateScore = (playerIndex: number, holeIndex: number, value: number) => {
    const newPlayers = [...players];
    newPlayers[playerIndex].scores[holeIndex] = Math.min(15, Math.max(0, value));
    setPlayers(newPlayers);
  };

  const getScoreLabel = (score: number, par: number) => {
    if (score === 0) return { label: '-', color: 'text-gray-300' };
    const diff = score - par;
    if (diff <= -2) return { label: '이글', color: 'text-yellow-500' };
    if (diff === -1) return { label: '버디', color: 'text-blue-500' };
    if (diff === 0) return { label: '파', color: 'text-green-500' };
    if (diff === 1) return { label: '보기', color: 'text-gray-500' };
    if (diff === 2) return { label: '더블', color: 'text-orange-500' };
    return { label: `+${diff}`, color: 'text-red-500' };
  };

  const getTotalScore = (scores: number[]) => scores.reduce((a, b) => a + b, 0);
  const getTotalPar = () => pars.reduce((a, b) => a + b, 0);
  const getScoreDiff = (scores: number[]) => {
    const total = getTotalScore(scores);
    if (total === 0) return '-';
    const diff = total - getTotalPar();
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const getRanking = () => {
    return [...players]
      .map((p, i) => ({ ...p, index: i, total: getTotalScore(p.scores) }))
      .filter(p => p.total > 0)
      .sort((a, b) => a.total - b.total);
  };

  const handleSave = async () => {
    if (!meetupId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'scorecards', meetupId), {
        meetupId,
        meetupTitle: meetup?.title,
        golfCourse: meetup?.golfCourse,
        date: meetup?.date,
        pars,
        players,
        totalPar: getTotalPar(),
        updatedAt: new Date().toISOString(),
      });
      alert('성적표가 저장되었습니다! ⛳');
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!meetup) return <div className="p-10 text-center">벙개를 찾을 수 없습니다.</div>;

  const holeStart = holeGroup === 'front' ? 0 : 9;
  const holes = Array.from({ length: 9 }, (_, i) => holeStart + i);

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <div>
            <h1 className="text-lg font-black text-gray-800">성적표</h1>
            <p className="text-sm text-gray-400">{meetup.golfCourse} | {meetup.date}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${saving ? 'bg-gray-400' : 'bg-green-600'}`}>
          {saving ? '저장중...' : '저장'}
        </button>
      </header>

      {/* ✅ 사진 분석 버튼 */}
      <div className="px-4 pt-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            analyzing
              ? 'bg-gray-200 text-gray-400'
              : 'bg-purple-600 text-white shadow-lg shadow-purple-200 active:scale-95'
          }`}
        >
          {analyzing ? (
            <>
              <span className="animate-spin">⏳</span> AI 스코어 분석 중...
            </>
          ) : (
            <>
              <span>📸</span> 스코어카드 사진으로 자동 입력
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoAnalysis}
          className="hidden"
        />
        <p className="text-xs text-center text-gray-400 mt-1.5">스마트스코어 결과 화면 또는 스코어카드 사진을 올리세요</p>
      </div>

      <div className="px-4 pt-4">
        {/* 파 설정 / 스코어 입력 탭 */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setParMode(true)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold ${parMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            파 설정
          </button>
          <button onClick={() => setParMode(false)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold ${!parMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            스코어 입력
          </button>
        </div>

        {/* 전반/후반 탭 */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setHoleGroup('front')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold ${holeGroup === 'front' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
            전반 (1~9홀)
          </button>
          <button onClick={() => setHoleGroup('back')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold ${holeGroup === 'back' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
            후반 (10~18홀)
          </button>
        </div>
      </div>

      {/* 파 설정 모드 */}
      {parMode && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <p className="text-sm font-black text-gray-500">홀별 파 설정</p>
              <p className="text-sm text-gray-400 mt-1">총 파: {getTotalPar()}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {holes.map((holeIndex) => (
                <div key={holeIndex} className="flex items-center justify-between px-4 py-3">
                  <span className="font-bold text-gray-700 w-16">{holeIndex + 1}홀</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => updatePar(holeIndex, pars[holeIndex] - 1)}
                      className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-600 text-lg flex items-center justify-center">−</button>
                    <span className="text-xl font-black text-green-600 w-8 text-center">{pars[holeIndex]}</span>
                    <button onClick={() => updatePar(holeIndex, pars[holeIndex] + 1)}
                      className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-600 text-lg flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 스코어 입력 모드 */}
      {!parMode && (
        <div className="px-4 pb-4 space-y-4">
          {/* 플레이어 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {players.map((p, i) => (
              <button key={i} onClick={() => setActivePlayer(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activePlayer === i ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}>
                {p.nickname || p.name}
              </button>
            ))}
          </div>

          {players.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                <p className="font-black text-gray-700">{players[activePlayer].nickname || players[activePlayer].name}</p>
                <p className="text-sm text-gray-400">
                  {holeGroup === 'front' ? '전반' : '후반'} 합계:
                  <span className="font-black text-gray-700 ml-1">
                    {players[activePlayer].scores.slice(holeStart, holeStart + 9).reduce((a, b) => a + b, 0) || '-'}
                  </span>
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {holes.map((holeIndex) => {
                  const score = players[activePlayer].scores[holeIndex];
                  const par = pars[holeIndex];
                  const { label, color } = getScoreLabel(score, par);
                  return (
                    <div key={holeIndex} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="font-bold text-gray-700">{holeIndex + 1}홀</span>
                        <span className="text-sm text-gray-400 ml-2">파{par}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-12 text-center ${color}`}>{label}</span>
                        <button onClick={() => updateScore(activePlayer, holeIndex, score - 1)}
                          className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-600 text-lg flex items-center justify-center">−</button>
                        <span className="text-xl font-black text-gray-800 w-8 text-center">{score || '-'}</span>
                        <button onClick={() => updateScore(activePlayer, holeIndex, score + 1)}
                          className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-600 text-lg flex items-center justify-center">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 순위표 */}
          {getRanking().length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                <p className="font-black text-gray-700">📊 현재 순위</p>
                <p className="text-sm text-gray-400">총 파: {getTotalPar()}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {getRanking().map((p, rank) => (
                  <div key={p.index} className="flex items-center gap-4 px-4 py-3">
                    <span className={`text-lg font-black w-8 text-center ${
                      rank === 0 ? 'text-yellow-500' : rank === 1 ? 'text-gray-400' : rank === 2 ? 'text-orange-400' : 'text-gray-300'
                    }`}>
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`}
                    </span>
                    <span className="flex-1 font-bold text-gray-800">{p.nickname || p.name}</span>
                    <span className="text-lg font-black text-gray-800">{p.total}타</span>
                    <span className={`text-sm font-bold w-12 text-right ${
                      p.total - getTotalPar() < 0 ? 'text-blue-500' :
                      p.total - getTotalPar() === 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {getScoreDiff(p.scores)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScorecardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <ScorecardContent />
    </Suspense>
  );
}