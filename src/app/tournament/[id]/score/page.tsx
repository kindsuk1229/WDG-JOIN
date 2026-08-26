'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';

const OWNER_NAME = '김근석';

// 홀 점수 → 팀포인트 변환
function toTeamPoint(score: number): number {
  if (score <= -2) return 5;  // 이글 이상
  if (score === -1) return 3; // 버디
  if (score === 0)  return 1; // 파
  if (score === 1)  return 0; // 보기
  if (score === 2)  return -1; // 더블
  return -2;                   // 트리플 이상
}

function getScoreLabel(score: number) {
  if (score <= -2) return { label: '이글↓', color: 'text-yellow-500' };
  if (score === -1) return { label: '버디', color: 'text-blue-500' };
  if (score === 0)  return { label: '파', color: 'text-green-500' };
  if (score === 1)  return { label: '보기', color: 'text-gray-500' };
  if (score === 2)  return { label: '더블', color: 'text-orange-500' };
  return { label: '트리플↑', color: 'text-red-500' };
}

export default function TournamentScoreInputPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myName, setMyName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // 내 성적
  const [holes, setHoles] = useState<number[]>(Array(18).fill(0));
  const [submitted, setSubmitted] = useState(false);

  // 전체 성적 현황 (관리자용)
  const [allScores, setAllScores] = useState<Record<string, { holes: number[]; submitted: boolean; total: number; totalTeamPoints: number }>>({});

  // 팀 정보 (조편성에서)
  const [myTeam, setMyTeam] = useState<string>('');
  const [myGroup, setMyGroup] = useState<string>('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchData(name);
  }, [tournamentId]);

  const fetchData = async (name: string) => {
    try {
      const [tSnap, adminsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId)),
        getDoc(doc(db, 'admins', name)),
      ]);

      const isAdminUser = name === OWNER_NAME || adminsSnap.exists();
      setIsAdmin(isAdminUser);

      if (tSnap.exists()) {
        const data = tSnap.data();
        setTournament(data);

        // 내 조/팀 찾기
        const groups = data.groups || [];
        for (const group of groups) {
          const member = group.members?.find((m: any) => m.name === name);
          if (member) {
            setMyGroup(group.label);
            // 팀 나누기 있으면 팀도 찾기
            if (group.useSubTeams && group.subTeams) {
              for (const team of group.subTeams) {
                if (team.members?.find((m: any) => m.name === name)) {
                  setMyTeam(team.label);
                  break;
                }
              }
            }
            break;
          }
        }
      }

      // 내 성적 불러오기
      const myScoreSnap = await getDoc(doc(db, 'tournaments', tournamentId, 'scores', name));
      if (myScoreSnap.exists()) {
        const data = myScoreSnap.data();
        setHoles(data.holes || Array(18).fill(0));
        setSubmitted(data.submitted || false);
      }

      // 관리자면 전체 성적 실시간 구독
      if (isAdminUser) {
        const scoresRef = collection(db, 'tournaments', tournamentId, 'scores');
        onSnapshot(scoresRef, (snap) => {
          const scores: Record<string, any> = {};
          snap.docs.forEach(d => { scores[d.id] = d.data(); });
          setAllScores(scores);
        });
      }
    } catch (err) {
      console.error('로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateHole = (holeIdx: number, delta: number) => {
    if (submitted) return;
    setHoles(prev => {
      const next = [...prev];
      next[holeIdx] = Math.max(-4, Math.min(5, next[holeIdx] + delta));
      return next;
    });
  };

  const handleSave = async (isSubmit = false) => {
    setSaving(true);
    try {
      const total = holes.reduce((a, b) => a + b, 0);
      const teamPoints = holes.map(h => toTeamPoint(h));
      const totalTeamPoints = teamPoints.reduce((a, b) => a + b, 0);

      await setDoc(doc(db, 'tournaments', tournamentId, 'scores', myName), {
        name: myName,
        holes,
        total,
        teamPoints,
        totalTeamPoints,
        myGroup,
        myTeam,
        submitted: isSubmit,
        updatedAt: new Date().toISOString(),
      });

      if (isSubmit) {
        setSubmitted(true);
        alert('성적이 제출되었습니다! ✅');
      } else {
        alert('저장되었습니다!');
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const total = holes.reduce((a, b) => a + b, 0);
  const front9 = holes.slice(0, 9).reduce((a, b) => a + b, 0);
  const back9 = holes.slice(9).reduce((a, b) => a + b, 0);
  const totalTeamPoints = holes.map(h => toTeamPoint(h)).reduce((a, b) => a + b, 0);

  const isTeamPointFormat = tournament?.formats?.includes('teamPoint');
  const isParticipant = tournament?.participants?.some((p: any) => p.name === myName);

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;
  if (!isParticipant && !isAdmin) return (
    <div className="p-10 text-center text-gray-400">
      <p className="text-4xl mb-3">⛳</p>
      <p>대회 참가자만 성적을 입력할 수 있어요.</p>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <div>
            <h1 className="text-lg font-black text-gray-800">성적 입력</h1>
            <p className="text-xs text-gray-400">{tournament?.title}</p>
          </div>
        </div>
        {!submitted && (
          <button onClick={() => handleSave(false)} disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${saving ? 'bg-gray-400' : 'bg-blue-500'}`}>
            임시저장
          </button>
        )}
      </header>

      <div className="p-4 space-y-4">

        {/* 내 정보 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-gray-800">{myName}</p>
              <div className="flex gap-2 mt-1">
                {myGroup && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">{myGroup}</span>}
                {myTeam && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">{myTeam}</span>}
              </div>
            </div>
            {submitted && (
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold">✅ 제출완료</span>
            )}
          </div>
        </div>

        {/* 성적 요약 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400">전반</p>
            <p className={`text-xl font-black ${front9 < 0 ? 'text-blue-500' : front9 > 0 ? 'text-red-500' : 'text-gray-800'}`}>
              {front9 > 0 ? `+${front9}` : front9}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400">후반</p>
            <p className={`text-xl font-black ${back9 < 0 ? 'text-blue-500' : back9 > 0 ? 'text-red-500' : 'text-gray-800'}`}>
              {back9 > 0 ? `+${back9}` : back9}
            </p>
          </div>
          <div className="bg-green-600 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xs text-green-200">합계</p>
            <p className="text-xl font-black text-white">
              {total > 0 ? `+${total}` : total}
            </p>
          </div>
        </div>

        {/* 팀포인트 합계 */}
        {isTeamPointFormat && (
          <div className="bg-yellow-50 rounded-2xl p-3 border border-yellow-100 flex items-center justify-between">
            <p className="text-sm font-bold text-yellow-700">팀 포인트 합계</p>
            <p className="text-xl font-black text-yellow-600">{totalTeamPoints > 0 ? `+${totalTeamPoints}` : totalTeamPoints}pt</p>
          </div>
        )}

        {/* 홀별 입력 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-5 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-400 border-b">
            <span>홀</span>
            <span className="col-span-2 text-center">점수</span>
            <span className="text-center">결과</span>
            {isTeamPointFormat && <span className="text-center">포인트</span>}
          </div>

          {holes.map((score, idx) => {
            const { label, color } = getScoreLabel(score);
            const pt = toTeamPoint(score);
            return (
              <div key={idx} className={`grid grid-cols-5 items-center px-3 py-2.5 border-b border-gray-50 ${submitted ? 'opacity-60' : ''}`}>
                <span className="text-sm font-bold text-gray-500">{idx + 1}홀{idx === 8 && <span className="text-xs text-gray-300 ml-1">전반</span>}{idx === 17 && <span className="text-xs text-gray-300 ml-1">후반</span>}</span>
                <div className="col-span-2 flex items-center justify-center gap-3">
                  <button onClick={() => updateHole(idx, -1)} disabled={submitted}
                    className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-black text-lg flex items-center justify-center active:bg-blue-100 disabled:opacity-40">
                    −
                  </button>
                  <span className={`text-lg font-black w-8 text-center ${score < 0 ? 'text-blue-500' : score > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {score > 0 ? `+${score}` : score === 0 ? 'E' : score}
                  </span>
                  <button onClick={() => updateHole(idx, 1)} disabled={submitted}
                    className="w-9 h-9 rounded-full bg-red-50 text-red-500 font-black text-lg flex items-center justify-center active:bg-red-100 disabled:opacity-40">
                    +
                  </button>
                </div>
                <span className={`text-xs font-bold text-center ${color}`}>{label}</span>
                {isTeamPointFormat && (
                  <span className={`text-xs font-black text-center ${pt > 0 ? 'text-green-600' : pt < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {pt > 0 ? `+${pt}` : pt}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 제출 버튼 */}
        {!submitted ? (
          <button onClick={() => {
            if (window.confirm('성적을 제출하시겠습니까?\n제출 후에는 수정할 수 없습니다.')) {
              handleSave(true);
            }
          }} disabled={saving}
            className={`w-full py-4 rounded-2xl font-bold text-base text-white ${saving ? 'bg-gray-400' : 'bg-green-600 shadow-lg shadow-green-200 active:scale-95 transition-all'}`}>
            ✅ 성적 제출하기
          </button>
        ) : (
          <div className="w-full py-4 rounded-2xl bg-gray-100 text-gray-400 text-center font-bold">
            성적이 제출되었습니다
          </div>
        )}

        {/* 관리자 전체 현황 */}
        {isAdmin && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="font-black text-gray-700 mb-3">
              📊 전체 입력 현황
              <span className="text-sm font-normal text-gray-400 ml-2">
                {Object.values(allScores).filter(s => s.submitted).length}/{tournament?.participants?.length}명 제출
              </span>
            </p>
            <div className="space-y-2">
              {(tournament?.participants || []).map((p: any) => {
                const score = allScores[p.name];
                return (
                  <div key={p.name} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-bold text-gray-700 flex-1">{p.nickname || p.name}</span>
                    {score ? (
                      <>
                        <span className={`text-sm font-black ${score.total < 0 ? 'text-blue-500' : score.total > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                          {score.total > 0 ? `+${score.total}` : score.total}
                        </span>
                        {isTeamPointFormat && (
                          <span className="text-xs text-yellow-600 font-bold">{score.totalTeamPoints}pt</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${score.submitted ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {score.submitted ? '제출' : '임시'}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-300 font-bold">미입력</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}