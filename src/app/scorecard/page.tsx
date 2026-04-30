'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface PlayerScore {
  name: string;
  nickname: string;
  scores: number[]; // 18홀
  totalOverride?: number; // 간편 입력 총타수
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
  const [inputMode, setInputMode] = useState<'simple' | 'detail'>('simple'); // 간편/상세
  const [holeGroup, setHoleGroup] = useState<'front' | 'back'>('front');
  const [activePlayer, setActivePlayer] = useState(0);
  const [players, setPlayers] = useState<PlayerScore[]>([]);

  // 1박2일 전용
  const [roundDay, setRoundDay] = useState<'day1' | 'day2'>('day1');
  const [day2Players, setDay2Players] = useState<PlayerScore[]>([]);
  const [day2Pars, setDay2Pars] = useState<number[]>(Array(18).fill(4));
  const isOvernight = meetup?.meetupType === 'overnight' || meetup?.isOvernight;

  useEffect(() => {
    if (!meetupId) return;
    const fetchMeetup = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'meetups', meetupId));
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setMeetup(data);

          const participants = (data as any).participants || [];
          const initPlayers = participants.map((p: any) => ({
            name: p.name,
            nickname: p.nickname || '',
            scores: Array(18).fill(0),
            totalOverride: 0,
          }));
          setPlayers(initPlayers);
          setDay2Players(initPlayers.map((p: any) => ({ ...p, scores: Array(18).fill(0), totalOverride: 0 })));

          // 기존 성적표 불러오기
          const scorecardSnap = await getDoc(doc(db, 'scorecards', meetupId));
          if (scorecardSnap.exists()) {
            const sc = scorecardSnap.data();
            if (sc.pars) setPars(sc.pars);
            if (sc.players) setPlayers(sc.players);
            if (sc.day2Pars) setDay2Pars(sc.day2Pars);
            if (sc.day2Players) setDay2Players(sc.day2Players);
            setInputMode(sc.inputMode || 'simple');
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

  const currentPlayers = roundDay === 'day1' ? players : day2Players;
  const setCurrentPlayers = roundDay === 'day1' ? setPlayers : setDay2Players;
  const currentPars = roundDay === 'day1' ? pars : day2Pars;
  const setCurrentPars = roundDay === 'day1' ? setPars : setDay2Pars;

  // ✅ 사진으로 스코어 자동 입력
  const handlePhotoAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const playerNames = currentPlayers.map(p => p.nickname || p.name).join(', ');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
              {
                type: 'text',
                text: `이 골프 스코어카드에서 각 플레이어의 홀별 타수를 추출해주세요.
플레이어 목록: ${playerNames}
반드시 아래 JSON 형식으로만 응답하세요:
{"pars":[4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],"players":[{"name":"이름","scores":[5,4,3,4,5,4,3,4,5,4,5,4,3,4,5,4,3,4]}]}
주의: pars와 scores는 반드시 18개 숫자, 읽기 어려운 홀은 0`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');
      const result = JSON.parse(jsonMatch[0]);

      if (result.pars?.length === 18) setCurrentPars(result.pars);
      if (result.players?.length > 0) {
        setCurrentPlayers(prev => prev.map(player => {
          const found = result.players.find((p: any) =>
            p.name === player.name || p.name === player.nickname ||
            player.name.includes(p.name) || p.name.includes(player.name)
          );
          if (found?.scores?.length === 18) {
            const total = found.scores.reduce((a: number, b: number) => a + b, 0);
            return { ...player, scores: found.scores, totalOverride: total };
          }
          return player;
        }));
      }
      setInputMode('detail');
      alert(`✅ ${isOvernight ? (roundDay === 'day1' ? '1일차' : '2일차') : ''} 스코어 분석 완료!\n확인 후 수정하세요.`);
    } catch (error) {
      alert('분석에 실패했어요. 직접 입력해주세요.');
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updatePar = (holeIndex: number, value: number) => {
    const newPars = [...currentPars];
    newPars[holeIndex] = Math.min(6, Math.max(3, value));
    setCurrentPars(newPars);
  };

  const updateScore = (playerIndex: number, holeIndex: number, value: number) => {
    const newPlayers = [...currentPlayers];
    newPlayers[playerIndex].scores[holeIndex] = Math.min(15, Math.max(0, value));
    setCurrentPlayers(newPlayers);
  };

  const updateTotalOverride = (playerIndex: number, value: number) => {
    const newPlayers = [...currentPlayers];
    newPlayers[playerIndex].totalOverride = Math.max(0, value);
    setCurrentPlayers(newPlayers);
  };

  const getPlayerTotal = (player: PlayerScore) => {
    if (inputMode === 'simple') return player.totalOverride || 0;
    return player.scores.reduce((a, b) => a + b, 0);
  };

  const getOvernightTotal = (name: string) => {
    const p1 = players.find(p => p.name === name);
    const p2 = day2Players.find(p => p.name === name);
    const t1 = inputMode === 'simple' ? (p1?.totalOverride || 0) : (p1?.scores.reduce((a, b) => a + b, 0) || 0);
    const t2 = inputMode === 'simple' ? (p2?.totalOverride || 0) : (p2?.scores.reduce((a, b) => a + b, 0) || 0);
    return t1 + t2;
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

  const getTotalPar = () => currentPars.reduce((a, b) => a + b, 0);

  const getRanking = () => {
    if (isOvernight) {
      return players.map(p => ({
        ...p,
        total: getOvernightTotal(p.name),
      })).filter(p => p.total > 0).sort((a, b) => a.total - b.total);
    }
    return currentPlayers.map((p, i) => ({
      ...p, index: i, total: getPlayerTotal(p)
    })).filter(p => p.total > 0).sort((a, b) => a.total - b.total);
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
        totalPar: pars.reduce((a, b) => a + b, 0),
        inputMode,
        ...(isOvernight ? { day2Pars, day2Players } : {}),
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
            <h1 className="text-lg font-black text-gray-800">성적표 {isOvernight ? '(1박2일)' : ''}</h1>
            <p className="text-sm text-gray-400">{meetup.golfCourse} | {meetup.date}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${saving ? 'bg-gray-400' : 'bg-green-600'}`}>
          {saving ? '저장중...' : '저장'}
        </button>
      </header>

      <div className="px-4 pt-4 space-y-3">

        {/* 1박2일 탭 */}
        {isOvernight && (
          <div className="flex gap-2">
            <button onClick={() => setRoundDay('day1')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${roundDay === 'day1' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              🌅 1일차
            </button>
            <button onClick={() => setRoundDay('day2')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${roundDay === 'day2' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              🌙 2일차
            </button>
          </div>
        )}

        {/* 입력 방식 선택 */}
        <div className="flex gap-2">
          <button onClick={() => setInputMode('simple')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold ${inputMode === 'simple' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            ✏️ 간편 입력
          </button>
          <button onClick={() => setInputMode('detail')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold ${inputMode === 'detail' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            📋 홀별 입력
          </button>
        </div>

        {/* 사진 분석 버튼 */}
        <button onClick={() => fileInputRef.current?.click()} disabled={analyzing}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${
            analyzing ? 'bg-gray-200 text-gray-400' : 'bg-purple-600 text-white shadow-lg shadow-purple-200 active:scale-95'
          }`}>
          {analyzing ? <><span className="animate-spin">⏳</span> AI 분석 중...</> : <><span>📸</span> 사진으로 자동 입력 {isOvernight ? `(${roundDay === 'day1' ? '1일차' : '2일차'})` : ''}</>}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoAnalysis} className="hidden" />
      </div>

      {/* 간편 입력 모드 */}
      {inputMode === 'simple' && (
        <div className="p-4">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <p className="text-sm font-black text-gray-500">
                총타수 입력 {isOvernight ? `- ${roundDay === 'day1' ? '1일차' : '2일차'}` : ''}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {currentPlayers.map((player, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3">
                  <span className="font-bold text-gray-700">{player.nickname || player.name}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateTotalOverride(idx, (player.totalOverride || 0) - 1)}
                      className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-600 text-lg flex items-center justify-center">−</button>
                    <span className="text-xl font-black text-gray-800 w-12 text-center">
                      {player.totalOverride || '-'}
                    </span>
                    <button onClick={() => updateTotalOverride(idx, (player.totalOverride || 0) + 1)}
                      className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-600 text-lg flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 홀별 입력 모드 */}
      {inputMode === 'detail' && (
        <div className="px-4 pt-2 space-y-4">
          {/* 전반/후반 탭 */}
          <div className="flex gap-2">
            <button onClick={() => setHoleGroup('front')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold ${holeGroup === 'front' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
              전반 (1~9홀)
            </button>
            <button onClick={() => setHoleGroup('back')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold ${holeGroup === 'back' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
              후반 (10~18홀)
            </button>
          </div>

          {/* 플레이어 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {currentPlayers.map((p, i) => (
              <button key={i} onClick={() => setActivePlayer(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold ${
                  activePlayer === i ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}>
                {p.nickname || p.name}
              </button>
            ))}
          </div>

          {/* 홀별 스코어 */}
          {currentPlayers.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                <p className="font-black text-gray-700">{currentPlayers[activePlayer]?.nickname || currentPlayers[activePlayer]?.name}</p>
                <p className="text-sm text-gray-400">
                  {holeGroup === 'front' ? '전반' : '후반'}:
                  <span className="font-black text-gray-700 ml-1">
                    {currentPlayers[activePlayer]?.scores.slice(holeStart, holeStart + 9).reduce((a, b) => a + b, 0) || '-'}
                  </span>
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {holes.map((holeIndex) => {
                  const score = currentPlayers[activePlayer]?.scores[holeIndex] || 0;
                  const par = currentPars[holeIndex];
                  const { label, color } = getScoreLabel(score, par);
                  return (
                    <div key={holeIndex} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="font-bold text-gray-700">{holeIndex + 1}홀</span>
                        <span className="text-sm text-gray-400 ml-2">파{par}</span>
                        <button onClick={() => updatePar(holeIndex, par - 1)} className="ml-2 text-xs text-gray-300">▼</button>
                        <button onClick={() => updatePar(holeIndex, par + 1)} className="text-xs text-gray-300">▲</button>
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
        </div>
      )}

      {/* 순위표 */}
      <div className="p-4">
        {getRanking().length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <p className="font-black text-gray-700">📊 {isOvernight ? '합산 순위' : '현재 순위'}</p>
              {isOvernight && <p className="text-sm text-gray-400 mt-0.5">1일차 + 2일차 합산</p>}
            </div>
            <div className="divide-y divide-gray-50">
              {getRanking().map((p, rank) => (
                <div key={rank} className="flex items-center gap-4 px-4 py-3">
                  <span className={`text-lg font-black w-8 text-center ${
                    rank === 0 ? 'text-yellow-500' : rank === 1 ? 'text-gray-400' : rank === 2 ? 'text-orange-400' : 'text-gray-300'
                  }`}>
                    {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`}
                  </span>
                  <span className="flex-1 font-bold text-gray-800">{p.nickname || p.name}</span>
                  <span className="text-lg font-black text-gray-800">{p.total}타</span>
                  {isOvernight && (
                    <span className="text-sm text-gray-400">
                      {(inputMode === 'simple' ? (players.find(pl => pl.name === p.name)?.totalOverride || 0) : players.find(pl => pl.name === p.name)?.scores.reduce((a, b) => a + b, 0) || 0)}+
                      {(inputMode === 'simple' ? (day2Players.find(pl => pl.name === p.name)?.totalOverride || 0) : day2Players.find(pl => pl.name === p.name)?.scores.reduce((a, b) => a + b, 0) || 0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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