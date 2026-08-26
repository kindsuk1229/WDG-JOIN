'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const OWNER_NAME = '김근석';

interface Team {
  id: string;
  teamName: string;
  members: { name: string; nickname: string }[];
  registeredAt: string;
}

interface Match {
  id: string;
  round: number;       // 1=16강, 2=8강, 3=4강, 4=결승
  matchNumber: number; // 해당 라운드에서 몇 번째 경기
  teamA?: Team | null;
  teamB?: Team | null;
  scoreA?: string;
  scoreB?: string;
  winnerId?: string;   // 승리 팀 id
  confirmed?: boolean;
  date?: string;
}

function getRoundLabel(round: number, totalRounds: number): string {
  const labels: Record<number, string> = { 1: '결승', 2: '4강', 3: '8강', 4: '16강', 5: '32강' };
  return labels[totalRounds - round + 1] || `${round}라운드`;
}

function initBracket(teams: Team[], totalSlots: number): Match[] {
  const matches: Match[] = [];
  const rounds = Math.log2(totalSlots);

  // 1라운드 매치 생성 (추첨 순서대로)
  for (let i = 0; i < totalSlots / 2; i++) {
    matches.push({
      id: `r1-m${i + 1}`,
      round: 1,
      matchNumber: i + 1,
      teamA: teams[i * 2] || null,
      teamB: teams[i * 2 + 1] || null,
      confirmed: false,
    });
  }

  // 이후 라운드 빈 매치 생성
  for (let r = 2; r <= rounds; r++) {
    const matchCount = totalSlots / Math.pow(2, r);
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `r${r}-m${i + 1}`,
        round: r,
        matchNumber: i + 1,
        teamA: null,
        teamB: null,
        confirmed: false,
      });
    }
  }

  return matches;
}

export default function TournamentBracketPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 팀 신청
  const [teams, setTeams] = useState<Team[]>([]);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamMembers, setNewTeamMembers] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);

  // 대진표
  const [bracket, setBracket] = useState<Match[]>([]);
  const [showBracket, setShowBracket] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [editScoreA, setEditScoreA] = useState('');
  const [editScoreB, setEditScoreB] = useState('');
  const [editDate, setEditDate] = useState('');

  const totalSlots = tournament?.maxPlayers || 16;
  const totalRounds = Math.log2(totalSlots);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    const nickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(name);
    setMyNickname(nickname || name);
    setIsOwner(name === OWNER_NAME);
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
        setTeams(data.teams || []);
        setBracket(data.bracket || []);
        setShowBracket((data.bracket || []).length > 0);
      }
    } catch (err) {
      console.error('로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 팀 신청
  const handleTeamRegister = async () => {
    if (!newTeamName.trim()) return alert('팀명을 입력해주세요.');
    const validMembers = newTeamMembers.filter(m => m.trim());
    const memberCount = tournament?.teamMemberCount || 2;
    if (validMembers.length < memberCount) return alert(`팀원 ${memberCount}명을 모두 입력해주세요.`);
    if (teams.some(t => t.teamName === newTeamName.trim())) return alert('이미 사용 중인 팀명이에요.');

    setSaving(true);
    try {
      const newTeam: Team = {
        id: Date.now().toString(),
        teamName: newTeamName.trim(),
        members: validMembers.map(m => ({ name: m.trim(), nickname: m.trim() })),
        registeredAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        teams: arrayUnion(newTeam),
      });
      setTeams(prev => [...prev, newTeam]);
      setNewTeamName('');
      setNewTeamMembers(['', '']);
      setShowTeamForm(false);
      alert('팀 신청이 완료되었습니다! 🎉');
    } catch {
      alert('신청 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 팀 취소 (관리자 or 본인 팀)
  const handleTeamCancel = async (team: Team) => {
    const isMyTeam = team.members.some(m => m.name === myName);
    if (!isMyTeam && !isAdmin) return;
    if (!window.confirm(`"${team.teamName}" 팀을 취소하시겠습니까?`)) return;
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      teams: arrayRemove(team),
    });
    setTeams(prev => prev.filter(t => t.id !== team.id));
  };

  // 추첨 & 대진표 생성 (관리자)
  const handleDrawBracket = async () => {
    if (teams.length < 2) return alert('팀이 2개 이상 필요해요.');
    if (!window.confirm(`${teams.length}개 팀으로 추첨하여 대진표를 생성할까요?`)) return;

    // 랜덤 셔플
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    // 부전승 처리 (BYE)
    while (shuffled.length < totalSlots) {
      shuffled.push({ id: 'bye-' + shuffled.length, teamName: 'BYE', members: [], registeredAt: '' });
    }

    const newBracket = initBracket(shuffled, totalSlots);
    await updateDoc(doc(db, 'tournaments', tournamentId), { bracket: newBracket });
    setBracket(newBracket);
    setShowBracket(true);
    alert('대진표가 생성되었습니다! 🏆');
  };

  // 경기 결과 입력
  const handleSaveMatch = async () => {
    if (!editMatch) return;
    const updatedMatch = {
      ...editMatch,
      scoreA: editScoreA,
      scoreB: editScoreB,
      date: editDate,
      winnerId: editScoreA !== '' && editScoreB !== ''
        ? (Number(editScoreA) > Number(editScoreB) ? editMatch.teamA?.id : editMatch.teamB?.id)
        : undefined,
    };

    // 다음 라운드 매치에 승자 배정
    let newBracket = bracket.map(m => m.id === editMatch.id ? updatedMatch : m);

    if (updatedMatch.winnerId) {
      const winner = updatedMatch.winnerId === editMatch.teamA?.id ? editMatch.teamA : editMatch.teamB;
      const nextRound = editMatch.round + 1;
      const nextMatchNumber = Math.ceil(editMatch.matchNumber / 2);
      const nextMatchId = `r${nextRound}-m${nextMatchNumber}`;
      const isTeamA = editMatch.matchNumber % 2 === 1;

      newBracket = newBracket.map(m => {
        if (m.id === nextMatchId) {
          return isTeamA ? { ...m, teamA: winner } : { ...m, teamB: winner };
        }
        return m;
      });
    }

    await updateDoc(doc(db, 'tournaments', tournamentId), { bracket: newBracket });
    setBracket(newBracket);
    setEditMatch(null);
  };

  // 결과 확정 (관리자)
  const handleConfirmMatch = async (match: Match) => {
    if (!match.winnerId) return alert('먼저 결과를 입력해주세요.');
    const newBracket = bracket.map(m => m.id === match.id ? { ...m, confirmed: true } : m);
    await updateDoc(doc(db, 'tournaments', tournamentId), { bracket: newBracket });
    setBracket(newBracket);
  };

  const myTeam = teams.find(t => t.members.some(m => m.name === myName));
  const memberCount = tournament?.teamMemberCount || 2;

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <div>
          <h1 className="text-xl font-black text-gray-800">대진표</h1>
          <p className="text-xs text-gray-400">{tournament?.title}</p>
        </div>
      </header>

      <div className="p-4 space-y-4">

        {/* 대회 기본 정보 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">
              {totalSlots}강 토너먼트
            </span>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
              {memberCount}인 1팀
            </span>
            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">
              {teams.length}/{totalSlots}팀 신청
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            {tournament?.date && (
              <p>📅 {tournament.date}{tournament.endDate ? ` ~ ${tournament.endDate}` : ''}</p>
            )}
            <p>📍 {tournament?.venue || '일정 조율'}</p>
            <p>💰 참가비 {tournament?.entryFee?.toLocaleString()}원/인 (팀당 {(tournament?.entryFee * memberCount)?.toLocaleString()}원)</p>
          </div>
        </div>

        {/* 팀 신청 섹션 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-50">
            <p className="font-black text-gray-700">참가 팀 ({teams.length}팀)</p>
            {!myTeam && tournament?.status === 'open' && (
              <button onClick={() => setShowTeamForm(!showTeamForm)}
                className="text-sm font-bold px-3 py-1.5 bg-green-600 text-white rounded-xl">
                + 팀 신청
              </button>
            )}
            {myTeam && (
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-xl font-bold">
                ✅ {myTeam.teamName} 신청완료
              </span>
            )}
          </div>

          {/* 팀 신청 폼 */}
          {showTeamForm && (
            <div className="p-4 space-y-3 bg-green-50 border-b border-green-100">
              <p className="text-sm font-bold text-green-700">팀 신청</p>
              <input type="text" placeholder="팀명 (예: 낭빠팀)" value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                className="w-full p-3 bg-white rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" />
              {Array.from({ length: memberCount }, (_, i) => (
                <input key={i} type="text"
                  placeholder={memberCount === 1 ? '닉네임 (본인)' : `${i + 1}번 팀원 닉네임`}
                  value={newTeamMembers[i] || ''}
                  onChange={e => {
                    const updated = [...newTeamMembers];
                    updated[i] = e.target.value;
                    setNewTeamMembers(updated);
                  }}
                  className="w-full p-3 bg-white rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => setShowTeamForm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold">취소</button>
                <button onClick={handleTeamRegister} disabled={saving}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold">
                  {saving ? '신청중...' : '신청하기'}
                </button>
              </div>
            </div>
          )}

          {/* 팀 목록 */}
          <div className="divide-y divide-gray-50">
            {teams.length === 0 ? (
              <p className="text-center text-gray-300 py-8 text-sm">아직 신청한 팀이 없어요</p>
            ) : (
              teams.map((team, i) => {
                const isMyTeam = team.members.some(m => m.name === myName);
                return (
                  <div key={team.id} className={`flex items-center gap-3 px-4 py-3 ${isMyTeam ? 'bg-green-50' : ''}`}>
                    <span className="text-sm font-black text-gray-400 w-6">{i + 1}</span>
                    <div className="flex-1">
                      <p className={`font-black ${isMyTeam ? 'text-green-700' : 'text-gray-800'}`}>
                        {team.teamName}
                        {isMyTeam && <span className="text-xs text-green-500 ml-1">(내 팀)</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {team.members.map(m => m.nickname || m.name).join(' · ')}
                      </p>
                    </div>
                    {(isMyTeam || isAdmin) && tournament?.status === 'open' && (
                      <button onClick={() => handleTeamCancel(team)}
                        className="text-xs text-red-400 font-bold px-2 py-1 bg-red-50 rounded-lg">취소</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 관리자 — 추첨 버튼 */}
        {isAdmin && !showBracket && teams.length >= 2 && (
          <button onClick={handleDrawBracket}
            className="w-full py-4 rounded-2xl font-bold text-base bg-purple-600 text-white shadow-lg shadow-purple-200 active:scale-95 transition-all">
            🎰 추첨하여 대진표 생성
          </button>
        )}

        {/* 대진표 */}
        {showBracket && bracket.length > 0 && (
          <div className="space-y-4">
            {Array.from({ length: totalRounds }, (_, ri) => {
              const round = ri + 1;
              const roundMatches = bracket.filter(m => m.round === round);
              const label = getRoundLabel(round, totalRounds);
              return (
                <div key={round} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
                    <p className="font-black text-white">{label}</p>
                    <p className="text-xs text-gray-400">{roundMatches.length}경기</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {roundMatches.map((match, mi) => {
                      const isMyMatch = match.teamA?.members?.some(m => m.name === myName) ||
                        match.teamB?.members?.some(m => m.name === myName);
                      const hasResult = match.scoreA !== undefined && match.scoreB !== undefined && match.scoreA !== '' && match.scoreB !== '';
                      return (
                        <div key={match.id} className={`p-4 ${isMyMatch ? 'bg-blue-50' : ''}`}>
                          <div className="flex items-center gap-3">
                            {/* 팀 A */}
                            <div className={`flex-1 text-center py-2 px-3 rounded-xl ${
                              match.winnerId === match.teamA?.id ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                            }`}>
                              <p className={`font-black text-sm ${match.teamA?.teamName === 'BYE' ? 'text-gray-300' : 'text-gray-800'}`}>
                                {match.teamA?.teamName || '미정'}
                              </p>
                              {match.teamA?.members && match.teamA.teamName !== 'BYE' && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {match.teamA.members.map(m => m.nickname || m.name).join(' · ')}
                                </p>
                              )}
                              {hasResult && (
                                <p className={`text-lg font-black mt-1 ${match.winnerId === match.teamA?.id ? 'text-yellow-600' : 'text-gray-400'}`}>
                                  {match.scoreA}
                                </p>
                              )}
                            </div>

                            <div className="text-center flex-shrink-0">
                              <p className="text-xs text-gray-400 font-bold">VS</p>
                              {match.date && <p className="text-xs text-gray-300">{match.date}</p>}
                              {match.confirmed && <p className="text-xs text-green-500 font-bold">✅ 확정</p>}
                            </div>

                            {/* 팀 B */}
                            <div className={`flex-1 text-center py-2 px-3 rounded-xl ${
                              match.winnerId === match.teamB?.id ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                            }`}>
                              <p className={`font-black text-sm ${match.teamB?.teamName === 'BYE' ? 'text-gray-300' : 'text-gray-800'}`}>
                                {match.teamB?.teamName || '미정'}
                              </p>
                              {match.teamB?.members && match.teamB.teamName !== 'BYE' && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {match.teamB.members.map(m => m.nickname || m.name).join(' · ')}
                                </p>
                              )}
                              {hasResult && (
                                <p className={`text-lg font-black mt-1 ${match.winnerId === match.teamB?.id ? 'text-yellow-600' : 'text-gray-400'}`}>
                                  {match.scoreB}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 결과 입력 버튼 */}
                          {isAdmin && match.teamA && match.teamB &&
                            match.teamA.teamName !== 'BYE' && match.teamB.teamName !== 'BYE' && !match.confirmed && (
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => {
                                setEditMatch(match);
                                setEditScoreA(match.scoreA || '');
                                setEditScoreB(match.scoreB || '');
                                setEditDate(match.date || '');
                              }}
                                className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold">
                                📝 결과 입력
                              </button>
                              {hasResult && (
                                <button onClick={() => handleConfirmMatch(match)}
                                  className="flex-1 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-bold">
                                  ✅ 확정
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* 관리자 — 대진표 재추첨 */}
            {isAdmin && (
              <button onClick={handleDrawBracket}
                className="w-full py-3 rounded-2xl text-sm font-bold text-gray-500 bg-white border border-gray-200">
                🔄 대진표 재추첨
              </button>
            )}
          </div>
        )}
      </div>

      {/* 결과 입력 모달 */}
      {editMatch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-[32px] p-6 space-y-4">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />
            <p className="text-lg font-black text-gray-800">경기 결과 입력</p>
            <p className="text-sm text-gray-500 text-center">
              {editMatch.teamA?.teamName} vs {editMatch.teamB?.teamName}
            </p>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">경기 날짜</label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex-1 text-center">
                <p className="text-xs font-bold text-gray-400 mb-1">{editMatch.teamA?.teamName}</p>
                <input type="number" inputMode="numeric" value={editScoreA}
                  onChange={e => setEditScoreA(e.target.value)}
                  placeholder="0"
                  className="w-full p-3 bg-gray-50 rounded-xl text-xl font-black text-center focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <span className="text-gray-400 font-black text-lg">:</span>
              <div className="flex-1 text-center">
                <p className="text-xs font-bold text-gray-400 mb-1">{editMatch.teamB?.teamName}</p>
                <input type="number" inputMode="numeric" value={editScoreB}
                  onChange={e => setEditScoreB(e.target.value)}
                  placeholder="0"
                  className="w-full p-3 bg-gray-50 rounded-xl text-xl font-black text-center focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
            </div>
            {editScoreA !== '' && editScoreB !== '' && (
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-yellow-700">
                  승자: {Number(editScoreA) > Number(editScoreB)
                    ? editMatch.teamA?.teamName
                    : Number(editScoreB) > Number(editScoreA)
                    ? editMatch.teamB?.teamName
                    : '동점 (재경기 필요)'}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setEditMatch(null)}
                className="flex-1 py-3 bg-gray-100 rounded-2xl font-bold text-gray-500">취소</button>
              <button onClick={handleSaveMatch}
                className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-bold">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}