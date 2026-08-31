'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove, onSnapshot
} from 'firebase/firestore';
import { calcRoundRating, getInitialRating, RATING_MIN } from '@/lib/rating';
import { initKakao, shareToKakao } from '@/lib/kakao';

const OWNER_NAME = '김근석';
const PAYMENT_MANAGERS = ['김근석', '양영빈'];

// ✅ 팀 신청 섹션 컴포넌트
function TeamRegistrationSection({
  tournament, tournamentId, myName, myNickname, isAdmin, onRefresh, onViewBracket
}: {
  tournament: any; tournamentId: string; myName: string; myNickname: string;
  isAdmin: boolean; onRefresh: () => void; onViewBracket: () => void;
}) {
  const [teams, setTeams] = useState<any[]>(tournament.teams || []);
  const [showForm, setShowForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<string[]>(Array(tournament.teamMemberCount || 2).fill(''));
  const [saving, setSaving] = useState(false);

  const myTeam = teams.find((t: any) => t.members?.some((m: any) => m.name === myName || m.nickname === myNickname));
  const memberCount = tournament.teamMemberCount || 2;

  const handleRegister = async () => {
    if (!teamName.trim()) return alert('팀명을 입력해주세요.');
    const validMembers = members.filter(m => m.trim());
    if (validMembers.length < memberCount) return alert(`팀원 ${memberCount}명을 모두 입력해주세요.`);
    if (teams.some((t: any) => t.teamName === teamName.trim())) return alert('이미 사용 중인 팀명이에요.');

    setSaving(true);
    try {
      const newTeam = {
        id: Date.now().toString(),
        teamName: teamName.trim(),
        members: validMembers.map(m => ({ name: m.trim(), nickname: m.trim() })),
        registeredAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        teams: arrayUnion(newTeam),
      });
      setTeams(prev => [...prev, newTeam]);
      setTeamName('');
      setMembers(Array(memberCount).fill(''));
      setShowForm(false);
      alert('팀 신청 완료! 🎉');
      onRefresh();
    } catch { alert('신청 중 오류가 발생했습니다.'); }
    finally { setSaving(false); }
  };

  const handleCancel = async (team: any) => {
    const isMyTeam = team.members?.some((m: any) => m.name === myName || m.nickname === myNickname);
    if (!isMyTeam && !isAdmin) return;
    if (!window.confirm(`"${team.teamName}" 팀을 취소하시겠습니까?`)) return;
    await updateDoc(doc(db, 'tournaments', tournamentId), { teams: arrayRemove(team) });
    setTeams(prev => prev.filter((t: any) => t.id !== team.id));
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {/* 내 팀 상태 */}
      {myTeam ? (
        <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
          <p className="text-xs text-green-500 font-bold mb-1">✅ 신청 완료</p>
          <p className="font-black text-green-800 text-lg">{myTeam.teamName}</p>
          <p className="text-sm text-green-600 mt-1">
            {myTeam.members?.map((m: any) => m.nickname || m.name).join(' · ')}
          </p>
          {tournament.status === 'open' && (
            <button onClick={() => handleCancel(myTeam)}
              className="mt-3 text-xs text-red-400 font-bold px-3 py-1.5 bg-red-50 rounded-lg">
              신청 취소
            </button>
          )}
        </div>
      ) : tournament.status === 'open' ? (
        <button onClick={() => setShowForm(!showForm)}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 ${
            showForm ? 'bg-gray-200 text-gray-600' : 'bg-green-600 text-white shadow-lg shadow-green-200'
          }`}>
          {showForm ? '취소' : `👥 ${memberCount}인 팀 신청하기`}
        </button>
      ) : null}

      {/* 팀 신청 폼 */}
      {showForm && !myTeam && (
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100 space-y-3">
          <p className="text-sm font-black text-green-700">팀 신청 ({memberCount}인 1팀)</p>
          <input type="text" placeholder="팀명 (예: 낭빠팀)" value={teamName}
            onChange={e => setTeamName(e.target.value)}
            className="w-full p-3 bg-white rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" />
          {Array.from({ length: memberCount }, (_, i) => (
            <input key={i} type="text"
              placeholder={`${i + 1}번 팀원 닉네임`}
              value={members[i] || ''}
              onChange={e => {
                const updated = [...members];
                updated[i] = e.target.value;
                setMembers(updated);
              }}
              className="w-full p-3 bg-white rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
          ))}
          <button onClick={handleRegister} disabled={saving}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm">
            {saving ? '신청중...' : '신청하기'}
          </button>
        </div>
      )}

      {/* 팀 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <p className="font-black text-gray-700">참가 팀 ({teams.length}팀)</p>
          <button onClick={onViewBracket}
            className="text-xs text-purple-600 font-bold px-3 py-1.5 bg-purple-50 rounded-lg">
            🏆 대진표
          </button>
        </div>
        {teams.length === 0 ? (
          <p className="text-center text-gray-300 py-8 text-sm">아직 신청한 팀이 없어요</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {teams.map((team: any, i: number) => {
              const isMyTeam = team.members?.some((m: any) => m.name === myName || m.nickname === myNickname);
              return (
                <div key={team.id} className={`flex items-center gap-3 px-4 py-3 ${isMyTeam ? 'bg-green-50' : ''}`}>
                  <span className="text-sm font-black text-gray-300 w-6">{i + 1}</span>
                  <div className="flex-1">
                    <p className={`font-black ${isMyTeam ? 'text-green-700' : 'text-gray-800'}`}>
                      {team.teamName}
                      {isMyTeam && <span className="text-xs text-green-500 ml-1">(내 팀)</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {team.members?.map((m: any) => m.nickname || m.name).join(' · ')}
                    </p>
                  </div>
                  {(isMyTeam || isAdmin) && tournament.status === 'open' && (
                    <button onClick={() => handleCancel(team)}
                      className="text-xs text-red-400 font-bold px-2 py-1 bg-red-50 rounded-lg">취소</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} // ✅ 입금 확인 권한자

const FORMAT_LABEL: Record<string, string> = {
  stroke: '개인전 · 스트로크',
  shinperio: '개인전 · 신페리오',
  team2: '팀전 · 2인1조',
  team4: '팀전 · 4인1조',
  teamCustom: '팀전 · 직접설정',
  matchplay: '2:2 · 매치플레이 (업&다운)',
  highlow: '2:2 · 하이로우',
};

interface Participant {
  name: string;
  nickname: string;
  handicap?: number;
  gHandicap?: number;
  paid?: boolean;
}

interface Award {
  id: string;
  rank: string;   // "1위" | "2위" | "3위" | "니어리스트" 등
  winner: string; // 수상자 이름
  prize: string;  // 상금/상품
}

interface Group {
  id: string;
  groupNumber: number;
  label: string;
  members: Participant[];
}

interface Tournament {
  id: string;
  title: string;
  type: 'field' | 'screen';
  format: string;
  formats: string[];
  date: string;
  endDate?: string;
  dateType?: 'single' | 'range';
  venue: string;
  entryFee: number;
  status: 'open' | 'closed' | 'completed';
  maxPlayers: number;
  teamSize?: number;
  registrationType?: 'individual' | 'team';
  teamMemberCount?: number;
  tournamentType?: 'league' | 'knockout';
  hasAward: boolean;
  awardDesc: string;
  round: number;
  description: string;
  participants: Participant[];
  groups: Group[];
  results: { rank: number; name: string; nickname: string; score: string }[];
  awards: Award[];
  createdBy: string;
}

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'standings'>('info');
  const [liveScores, setLiveScores] = useState<Record<string, any>>({});
  const [allMembers, setAllMembers] = useState<Participant[]>([]);

  // 참가자 추가
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // 결과 입력
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ rank: number; name: string; nickname: string; score: string }[]>([]);

  // 시상 입력
  const [showAwards, setShowAwards] = useState(false);
  const [awards, setAwards] = useState<Award[]>([]);
  const [newAwardRank, setNewAwardRank] = useState('');
  const [newAwardWinner, setNewAwardWinner] = useState('');
  const [newAwardPrize, setNewAwardPrize] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    const nickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(name);
    setMyNickname(nickname);
    setIsOwner(name === OWNER_NAME);
    fetchData();
  }, [tournamentId]);

  const fetchData = async () => {
    try {
      const [tSnap, usersSnap, adminsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId)),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
      ]);

      const myNameLocal = (localStorage.getItem('user_name') || '').trim();
      const isAdminUser = myNameLocal === OWNER_NAME || adminsSnap.docs.some(d => d.id === myNameLocal);
      setIsAdmin(isAdminUser);

      if (tSnap.exists()) {
        const data = { id: tSnap.id, ...tSnap.data() } as Tournament;
        setTournament(data);
        setResults(data.results || []);
        setAwards(data.awards || []);
      }

      setAllMembers(usersSnap.docs.map(d => ({
        name: d.data().name || d.id,
        nickname: d.data().nickname || '',
        handicap: d.data().handicap || 0,
        gHandicap: d.data().gHandicap ?? null,
      })));
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 실시간 성적 구독
  useEffect(() => {
    const scoresRef = collection(db, 'tournaments', tournamentId, 'scores');
    const unsub = onSnapshot(scoresRef, snap => {
      const scores: Record<string, any> = {};
      snap.docs.forEach(d => { scores[d.id] = d.data(); });
      setLiveScores(scores);
    });
    return () => unsub();
  }, [tournamentId]);

  // 참가 신청 / 취소
  const handleJoin = async () => {
    if (!tournament) return;
    const tRef = doc(db, 'tournaments', tournamentId);
    const isJoined = tournament.participants.some(p => p.name === myName);

    if (isJoined) {
      if (!window.confirm('참가를 취소하시겠습니까?')) return;
      await updateDoc(tRef, {
        participants: arrayRemove(tournament.participants.find(p => p.name === myName)),
      });
    } else {
      if (tournament.participants.length >= tournament.maxPlayers) {
        return alert('정원이 마감되었습니다.');
      }
      await updateDoc(tRef, {
        participants: arrayUnion({ name: myName, nickname: myNickname, paid: false }),
      });
    }
    fetchData();
  };

  // 관리자: 회원 추가
  const handleAddMember = async (member: Participant) => {
    if (!tournament) return;
    if (tournament.participants.some(p => p.name === member.name)) {
      return alert('이미 참가 중인 회원이에요.');
    }
    if (tournament.participants.length >= tournament.maxPlayers) {
      return alert('정원이 마감되었습니다.');
    }
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      participants: arrayUnion({ name: member.name, nickname: member.nickname, paid: false }),
    });
    setMemberSearch('');
    fetchData();
  };

  // 관리자: 참가자 제거
  const handleRemoveMember = async (p: Participant) => {
    if (!window.confirm(`${p.nickname || p.name}님을 제거하시겠습니까?`)) return;
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      participants: arrayRemove(p),
    });
    fetchData();
  };

  // 관리자: 입금 확인 토글
  const handleTogglePaid = async (p: Participant) => {
    if (!tournament) return;
    const updated = tournament.participants.map(pp =>
      pp.name === p.name ? { ...pp, paid: !pp.paid } : pp
    );
    await updateDoc(doc(db, 'tournaments', tournamentId), { participants: updated });
    fetchData();
  };

  // 관리자: 대회 상태 변경
  const handleStatusChange = async (status: string) => {
    await updateDoc(doc(db, 'tournaments', tournamentId), { status });
    fetchData();
  };

  // ✅ Rating 업데이트 함수
  const updateRatingsFromTournament = async (
    sortedResults: { name: string; nickname: string; score: string }[],
    playerCount: number,
  ) => {
    try {
      // 전체 성적표에서 평균타수 계산 (Smart-Score 초기값용)
      const scorecardsSnap = await getDocs(collection(db, 'scorecards'));
      const allScoresMap: Record<string, number[]> = {};
      scorecardsSnap.docs.forEach(d => {
        const sc = d.data();
        (sc.players || []).forEach((p: any) => {
          const total = (p.totalOverride || 0) > 0
            ? p.totalOverride
            : (p.scores || []).reduce((a: number, b: number) => a + b, 0);
          if (total > 0) {
            if (!allScoresMap[p.name]) allScoresMap[p.name] = [];
            allScoresMap[p.name].push(total);
          }
        });
      });

      // 각 플레이어 현재 Rating 불러오기
      const playerData = await Promise.all(
        sortedResults.map(async (r, idx) => {
          const snap = await getDoc(doc(db, 'users', r.name));
          const data = snap.exists() ? snap.data() : {};
          let rating: number = data.rating ?? -1;
          const rounds: number = data.ratingRounds ?? 0;

          if (rating === -1) {
            const scores = allScoresMap[r.name] || [];
            const avg = scores.length > 0
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
              : null;
            rating = getInitialRating(avg, rounds).rating;
          }

          // 대회 점수를 타수로 변환 (숫자면 그대로, 아니면 순위 기반 가상 타수)
          const scoreNum = Number(r.score);
          const virtualScore = isNaN(scoreNum)
            ? 72 + idx * 2  // 순위 기반 가상 타수 (1위=72, 2위=74, ...)
            : scoreNum;

          return { name: r.name, rating, rounds, score: virtualScore };
        })
      );

      // Rating 변동 계산 (참가인원 가중 자동 적용)
      const deltas = calcRoundRating(playerData);

      // Firebase 업데이트
      await Promise.all(
        deltas.map(async ({ name, delta }) => {
          const current = playerData.find(p => p.name === name)!;
          const newRating = Math.max(RATING_MIN, Math.round(current.rating + delta));
          const newRounds = current.rounds + 1;

          const userRef = doc(db, 'users', name);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            await updateDoc(userRef, {
              rating: newRating,
              ratingRounds: newRounds,
              ratingDelta: delta,
              ratingUpdatedAt: new Date().toISOString(),
            });
          }
        })
      );

      console.log('✅ 대회 Rating 업데이트 완료');
    } catch (err) {
      console.error('Rating 업데이트 실패:', err);
    }
  };

  // ✅ 결과 확정 — scores 컬렉션 기반으로 최종 순위 계산 후 저장
  const handleFinalizeResults = async () => {
    if (!tournament) return;
    if (!window.confirm('성적 입력 현황을 기반으로 최종 결과를 확정하시겠습니까?\n확정 후 Rating이 자동으로 반영됩니다.')) return;

    try {
      const scoresSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'scores'));
      const scoresMap: Record<string, any> = {};
      scoresSnap.docs.forEach(d => { scoresMap[d.id] = d.data(); });

      const formats = tournament.formats || [];
      const groups = (tournament as any).groups || [];
      let finalResults: { rank: number; name: string; nickname: string; score: string }[] = [];

      // 개인전 결과
      if (formats.includes('stroke') || formats.includes('shinperio')) {
        const individualScores = Object.entries(scoresMap)
          .map(([name, s]: [string, any]) => {
            const p = tournament.participants.find(pp => pp.name === name);
            return { name, nickname: p?.nickname || name, score: String(s.total ?? 0) };
          })
          .sort((a, b) => Number(a.score) - Number(b.score))
          .map((r, idx) => ({ ...r, rank: idx + 1 }));
        finalResults = [...finalResults, ...individualScores];
      }

      // 팀포인트 결과
      if (formats.includes('teamPoint')) {
        const teamMap: Record<string, number> = {};
        groups.forEach((g: any) => {
          if (g.useSubTeams && g.subTeams) {
            g.subTeams.forEach((team: any) => {
              const key = `${g.label} ${team.label}`;
              teamMap[key] = 0;
              team.members?.forEach((m: any) => {
                teamMap[key] += scoresMap[m.name]?.totalTeamPoints ?? 0;
              });
            });
          }
        });
        const teamResults = Object.entries(teamMap)
          .sort(([, a], [, b]) => b - a)
          .map(([name, pts], idx) => ({ rank: idx + 1, name, nickname: name, score: String(pts) }));
        finalResults = [...finalResults, ...teamResults];
      }

      // 결과 저장 + Rating 반영
      const sorted = [...finalResults].sort((a, b) => Number(a.score) - Number(b.score));
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        results: finalResults,
        status: 'completed',
      });

      // Rating 반영 (개인전만)
      if (formats.includes('stroke') || formats.includes('shinperio')) {
        await updateRatingsFromTournament(sorted, tournament.participants.length);
      }

      alert('✅ 결과가 확정되었습니다! Rating이 반영되었어요.');
      fetchData();
    } catch (err) {
      alert('오류가 발생했습니다.');
      console.error(err);
    }
  };

  // 관리자: 결과 저장 + Rating 반영
  const handleSaveResults = async () => {
    if (results.length === 0) return alert('결과를 입력해주세요.');

    // 점수 기준 정렬
    const sorted = [...results].sort((a, b) => Number(a.score) - Number(b.score));
    const rankedResults = sorted.map((r, idx) => ({ ...r, rank: idx + 1 }));

    await updateDoc(doc(db, 'tournaments', tournamentId), {
      results: rankedResults,
      status: 'completed',
    });

    // ✅ Rating 반영 (참가인원 가중 포함)
    await updateRatingsFromTournament(sorted, tournament?.participants?.length ?? 0);

    alert('결과가 저장되고 Rating이 반영되었습니다! 🏆');
    setShowResults(false);
    fetchData();
  };

  // 관리자: 시상 추가
  const handleAddAward = () => {
    if (!newAwardRank.trim() || !newAwardWinner.trim()) return alert('시상 구분과 수상자를 입력해주세요.');
    const newAward: Award = {
      id: Date.now().toString(),
      rank: newAwardRank.trim(),
      winner: newAwardWinner.trim(),
      prize: newAwardPrize.trim(),
    };
    setAwards(prev => [...prev, newAward]);
    setNewAwardRank('');
    setNewAwardWinner('');
    setNewAwardPrize('');
  };

  const handleSaveAwards = async () => {
    await updateDoc(doc(db, 'tournaments', tournamentId), { awards });
    alert('시상 내역이 저장되었습니다!');
    setShowAwards(false);
    fetchData();
  };

  const handleRemoveAward = (id: string) => {
    setAwards(prev => prev.filter(a => a.id !== id));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateStr} (${days[d.getDay()]})`;
  };

  // ✅ 실시간 순위 계산
  const calcStandings = () => {
    if (!tournament) return { individual: [], teams: [] };
    const formats = tournament.formats || [];
    const groups = (tournament as any).groups || [];

    // 개인 순위 (스트로크/신페리오)
    const individual = Object.entries(liveScores)
      .map(([name, score]: [string, any]) => {
        const p = tournament.participants.find(pp => pp.name === name);
        return {
          name,
          nickname: p?.nickname || name,
          total: score.total ?? 0,
          holes: score.holes || [],
          submitted: score.submitted,
          myGroup: score.myGroup || '',
          myTeam: score.myTeam || '',
          totalTeamPoints: score.totalTeamPoints ?? 0,
        };
      })
      .sort((a, b) => a.total - b.total);

    // 팀 순위 계산
    const teamMap: Record<string, { label: string; groupLabel: string; members: any[]; totalPoints: number; totalStrokes: number }> = {};

    if (formats.includes('teamPoint')) {
      // 팀포인트: 조편성 subTeams 기반
      groups.forEach((g: any) => {
        if (g.useSubTeams && g.subTeams) {
          g.subTeams.forEach((team: any) => {
            const key = `${g.label}-${team.label}`;
            if (!teamMap[key]) teamMap[key] = { label: team.label, groupLabel: g.label, members: [], totalPoints: 0, totalStrokes: 0 };
            team.members?.forEach((m: any) => {
              const score = liveScores[m.name];
              if (score) {
                teamMap[key].members.push({ name: m.name, nickname: m.nickname || m.name, totalPoints: score.totalTeamPoints ?? 0, total: score.total ?? 0 });
                teamMap[key].totalPoints += score.totalTeamPoints ?? 0;
                teamMap[key].totalStrokes += score.total ?? 0;
              }
            });
          });
        } else {
          // subTeams 없으면 조 전체를 하나의 팀으로
          const key = g.id;
          if (!teamMap[key]) teamMap[key] = { label: g.label, groupLabel: '', members: [], totalPoints: 0, totalStrokes: 0 };
          g.members?.forEach((m: any) => {
            const score = liveScores[m.name];
            if (score) {
              teamMap[key].members.push({ name: m.name, nickname: m.nickname || m.name, totalPoints: score.totalTeamPoints ?? 0, total: score.total ?? 0 });
              teamMap[key].totalPoints += score.totalTeamPoints ?? 0;
              teamMap[key].totalStrokes += score.total ?? 0;
            }
          });
        }
      });
    } else if (formats.includes('highlow') || formats.includes('matchplay')) {
      // 하이로우/매치플레이: subTeams 기반 홀별 계산
      groups.forEach((g: any) => {
        if (!g.useSubTeams || !g.subTeams || g.subTeams.length < 2) return;
        const [teamA, teamB] = g.subTeams;

        const getTeamHoles = (team: any) => {
          const holes = Array(18).fill(0);
          team.members?.forEach((m: any) => {
            const score = liveScores[m.name];
            if (score?.holes) {
              score.holes.forEach((h: number, i: number) => { holes[i] += h; });
            }
          });
          return holes;
        };

        const holesA = getTeamHoles(teamA);
        const holesB = getTeamHoles(teamB);

        if (formats.includes('highlow')) {
          // 하이로우: 하이끼리, 로우끼리 비교
          let pointsA = 0, pointsB = 0;
          for (let i = 0; i < 18; i++) {
            const membersA = teamA.members?.map((m: any) => liveScores[m.name]?.holes?.[i] ?? 0) || [];
            const membersB = teamB.members?.map((m: any) => liveScores[m.name]?.holes?.[i] ?? 0) || [];
            if (membersA.length >= 2 && membersB.length >= 2) {
              const highA = Math.max(...membersA), lowA = Math.min(...membersA);
              const highB = Math.max(...membersB), lowB = Math.min(...membersB);
              if (highA < highB) pointsA += 1; else if (highB < highA) pointsB += 1;
              if (lowA < lowB) pointsA += 1; else if (lowB < lowA) pointsB += 1;
            }
          }
          const keyA = `${g.id}-A`, keyB = `${g.id}-B`;
          teamMap[keyA] = { label: teamA.label, groupLabel: g.label, members: teamA.members || [], totalPoints: pointsA, totalStrokes: holesA.reduce((a: number, b: number) => a + b, 0) };
          teamMap[keyB] = { label: teamB.label, groupLabel: g.label, members: teamB.members || [], totalPoints: pointsB, totalStrokes: holesB.reduce((a: number, b: number) => a + b, 0) };
        } else {
          // 매치플레이: 홀별 합산 비교 → 업다운
          let updown = 0; // 양수=A팀 리드
          for (let i = 0; i < 18; i++) {
            if (holesA[i] < holesB[i]) updown++;
            else if (holesB[i] < holesA[i]) updown--;
          }
          const keyA = `${g.id}-A`, keyB = `${g.id}-B`;
          teamMap[keyA] = { label: teamA.label, groupLabel: g.label, members: teamA.members || [], totalPoints: updown, totalStrokes: holesA.reduce((a: number, b: number) => a + b, 0) };
          teamMap[keyB] = { label: teamB.label, groupLabel: g.label, members: teamB.members || [], totalPoints: -updown, totalStrokes: holesB.reduce((a: number, b: number) => a + b, 0) };
        }
      });
    }

    const teams = Object.values(teamMap).sort((a, b) => b.totalPoints - a.totalPoints);
    return { individual, teams };
  };

  const standings = calcStandings();
  const hasTeamFormat = tournament?.formats?.some(f => ['teamPoint', 'highlow', 'matchplay', 'team2', 'team4', 'teamCustom'].includes(f));
  const hasIndividualFormat = tournament?.formats?.some(f => ['stroke', 'shinperio'].includes(f));

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;
  if (!tournament) return <div className="p-10 text-center text-gray-400">대회를 찾을 수 없습니다.</div>;

  const isJoined = tournament.participants.some(p => p.name === myName);
  const isFull = tournament.participants.length >= tournament.maxPlayers;
  const paidCount = tournament.participants.filter(p => p.paid).length;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <h1 className="text-lg font-black text-gray-800 truncate">{tournament.title}</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {/* 카카오톡 공유 — 오너만 */}
            {isOwner && (
              <button
                onClick={() => {
                  if (!tournament) return;
                  initKakao();
                  const url = window.location.href;
                  const title = `🏆 제${tournament.round}회 ${tournament.title}`;
                  const desc = `📅 ${tournament.date} | 📍 ${tournament.venue}\n💰 참가비 ${tournament.entryFee?.toLocaleString()}원 | 👥 ${tournament.participants?.length}/${tournament.maxPlayers}명`;
                  shareToKakao(url, title, desc);
                }}
                className="text-sm font-bold px-3 py-1.5 bg-yellow-400 text-white rounded-lg"
              >
                💬 공유
              </button>
            )}
            {/* 수정 — 오너만 */}
            {isOwner && (
              <button onClick={() => router.push(`/tournament/${tournamentId}/edit`)}
                className="text-sm font-bold px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg">
                수정
              </button>
            )}
            {/* 조 편성 — 매니저 이상 */}
            {isAdmin && (
              <button onClick={() => router.push(`/tournament/${tournamentId}/group-assign`)}
                className="text-sm font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg">
                조 편성
              </button>
            )}
          </div>
        )}
      </header>

      {/* ✅ 탭 네비게이션 */}
      <div className="flex border-b border-gray-100 bg-white sticky top-[73px] z-10">
        {[
          { key: 'info', label: '대회 정보' },
          { key: 'participants', label: `참가자 ${tournament.participants.length}명` },
          { key: 'standings', label: '📊 실시간 순위' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === tab.key ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">

        {/* ════ 대회 정보 탭 ════ */}
        {activeTab === 'info' && (<>

        {/* 대회 정보 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tournament.round > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">제{tournament.round}회</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              tournament.type === 'screen' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
            }`}>
              {tournament.type === 'screen' ? '🖥️ 스크린' : '🏌️ 필드'}
            </span>
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">
              {FORMAT_LABEL[tournament.format] || tournament.format}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-auto ${
              tournament.status === 'open' ? 'bg-green-50 text-green-600' :
              tournament.status === 'closed' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
            }`}>
              {tournament.status === 'open' ? '모집중' : tournament.status === 'closed' ? '마감' : '완료'}
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-600 border-t pt-3">
            <div className="flex gap-2"><span>📅</span><span>{formatDate(tournament.date)}</span></div>
            <div className="flex gap-2"><span>📍</span><span>{tournament.venue}</span></div>
            <div className="flex gap-2"><span>💰</span><span className="font-bold text-green-600">{tournament.entryFee.toLocaleString()}원</span></div>
            <div className="flex items-center gap-2 bg-yellow-50 rounded-xl px-3 py-2">
              <span>🏦</span>
              <div>
                <p className="font-bold text-gray-700">카카오뱅크 3333-23-4366122</p>
                <p className="text-xs text-gray-400">예금주: 양영빈</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('3333234366122');
                  alert('계좌번호가 복사되었습니다!');
                }}
                className="ml-auto text-xs bg-yellow-400 text-white px-2 py-1 rounded-lg font-bold flex-shrink-0"
              >
                복사
              </button>
            </div>
            {tournament.hasAward && tournament.awardDesc && (
              <div className="flex gap-2"><span>🎁</span><span>{tournament.awardDesc}</span></div>
            )}
          </div>

          {tournament.description && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3 leading-relaxed">{tournament.description}</p>
          )}

          {/* 인원 진행바 */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>참가 현황</span>
              <span className="font-bold">{tournament.participants.length} / {tournament.maxPlayers}명</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full ${isFull ? 'bg-red-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, (tournament.participants.length / tournament.maxPlayers) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* 관리자 도구 — 오너 + 매니저 */}
        {isAdmin && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <p className="font-black text-gray-500 text-sm">🔧 관리자 도구</p>
            <div className="flex flex-wrap gap-2">
              {tournament.status === 'open' && (
                <button onClick={() => handleStatusChange('closed')}
                  className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-bold">
                  🔒 모집 마감
                </button>
              )}
              {tournament.status === 'closed' && (
                <button onClick={() => handleStatusChange('open')}
                  className="px-3 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-bold">
                  🔓 모집 재개
                </button>
              )}
              <button onClick={() => setShowResults(!showResults)}
                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold">
                📊 결과 입력
              </button>
              {/* ✅ 결과 확정 버튼 */}
              <button onClick={handleFinalizeResults}
                className="px-3 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-bold">
                ✅ 결과 확정
              </button>
              <button onClick={() => setShowAwards(!showAwards)}
                className="px-3 py-2 bg-yellow-50 text-yellow-600 rounded-xl text-sm font-bold">
                🏅 시상 입력
              </button>
              <button onClick={() => setShowAddMember(!showAddMember)}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold">
                👤 참가자 추가
              </button>
            </div>

            {/* 입금 현황 */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">입금 현황:</span>
              <span className="font-bold text-green-600">{paidCount}명</span>
              <span className="text-gray-400">/ {tournament.participants.length}명</span>
              <span className="text-gray-400 text-xs">(미납 {tournament.participants.length - paidCount}명)</span>
            </div>

            {/* 참가자 추가 */}
            {showAddMember && (
              <div className="space-y-2 border-t pt-3">
                <input type="text" placeholder="이름 또는 닉네임 검색"
                  value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allMembers
                    .filter(m => !tournament.participants.some(p => p.name === m.name))
                    .filter(m => !memberSearch || m.name.includes(memberSearch) || m.nickname.includes(memberSearch))
                    .map(m => (
                      <button key={m.name} onClick={() => handleAddMember(m)}
                        className="w-full text-left px-3 py-2.5 bg-gray-50 rounded-xl text-sm hover:bg-green-50 flex justify-between items-center">
                        <span className="font-bold">{m.nickname || m.name}</span>
                        <span className="text-gray-400 text-xs">{m.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* 결과 입력 */}
            {showResults && (
              <div className="space-y-3 border-t pt-3">
                {/* ✅ 팀 포인트 방식 */}
                {tournament?.formats?.includes('teamPoint') ? (
                  <>
                    <p className="text-sm font-bold text-gray-600">🏆 팀 포인트 입력</p>
                    <div className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700 font-bold">
                      이글+5 / 버디+3 / 파+1 / 보기0 / 더블-1 / 트리플이상-2
                    </div>
                    {Array.from({ length: 6 }, (_, i) => {
                      const teamName = `${i + 1}팀`;
                      const existing = results.find(r => r.name === teamName);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm font-black text-white w-12 text-center bg-green-600 rounded-lg py-1.5 flex-shrink-0">{teamName}</span>
                          <input type="number" inputMode="numeric" placeholder="팀 포인트 합계"
                            value={existing?.score || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setResults(prev => {
                                const filtered = prev.filter(r => r.name !== teamName);
                                if (val) return [...filtered, { rank: 0, name: teamName, nickname: teamName, score: val }];
                                return filtered;
                              });
                            }}
                            className="flex-1 p-2.5 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none font-bold text-center" />
                          <span className="text-xs text-gray-400 flex-shrink-0">포인트</span>
                        </div>
                      );
                    })}
                    {/* 개인전도 있으면 개인 성적 입력 */}
                    {(tournament?.formats?.includes('stroke') || tournament?.formats?.includes('shinperio')) && (
                      <>
                        <p className="text-sm font-bold text-gray-600 mt-2">⛳ 개인전 성적 입력</p>
                        {tournament.participants.map((p) => {
                          const existing = results.find(r => r.name === p.name);
                          return (
                            <div key={p.name} className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-500 w-20 truncate">{p.nickname || p.name}</span>
                              <input type="number" inputMode="numeric" placeholder="타수"
                                value={existing?.score || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setResults(prev => {
                                    const filtered = prev.filter(r => r.name !== p.name);
                                    if (val) return [...filtered, { rank: 0, name: p.name, nickname: p.nickname, score: val }];
                                    return filtered;
                                  });
                                }}
                                className="flex-1 p-2.5 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                              <span className="text-xs text-gray-400">타</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </>
                ) : (
                  /* 기존 개인전/팀전 결과 입력 */
                  <>
                    <p className="text-sm font-bold text-gray-600">순위 입력 (타수/점수)</p>
                    {tournament.participants.map((p, idx) => {
                      const existing = results.find(r => r.name === p.name);
                      return (
                        <div key={p.name} className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-500 w-16">{p.nickname || p.name}</span>
                          <input type="text" placeholder="타수/점수"
                            value={existing?.score || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setResults(prev => {
                                const filtered = prev.filter(r => r.name !== p.name);
                                if (val) return [...filtered, { rank: 0, name: p.name, nickname: p.nickname, score: val }];
                                return filtered;
                              });
                            }}
                            className="flex-1 p-2.5 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                      );
                    })}
                  </>
                )}
                <button onClick={handleSaveResults}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm">
                  결과 저장
                </button>
              </div>
            )}

            {/* 시상 입력 */}
            {showAwards && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-sm font-bold text-gray-600">시상 내역</p>
                {awards.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                    <span className="text-sm font-bold text-yellow-600 w-20 flex-shrink-0">{a.rank}</span>
                    <span className="text-sm flex-1">{a.winner}</span>
                    <span className="text-sm text-gray-400">{a.prize}</span>
                    <button onClick={() => handleRemoveAward(a.id)} className="text-red-400 font-bold ml-1">×</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input type="text" placeholder="시상구분 (예: 1위)" value={newAwardRank}
                    onChange={e => setNewAwardRank(e.target.value)}
                    className="w-28 p-2.5 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                  <input type="text" placeholder="수상자" value={newAwardWinner}
                    onChange={e => setNewAwardWinner(e.target.value)}
                    className="flex-1 p-2.5 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                  <input type="text" placeholder="상금/상품" value={newAwardPrize}
                    onChange={e => setNewAwardPrize(e.target.value)}
                    className="w-24 p-2.5 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-yellow-400 outline-none" />
                  <button onClick={handleAddAward}
                    className="px-3 bg-yellow-400 text-white rounded-xl font-bold text-sm">+</button>
                </div>
                <button onClick={handleSaveAwards}
                  className="w-full py-3 bg-yellow-500 text-white rounded-xl font-bold text-sm">
                  시상 저장
                </button>
              </div>
            )}
          </div>
        )}

        {/* 결과 (완료된 대회) */}
        {tournament.status === 'completed' && tournament.results.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="font-black text-gray-700 mb-3">📊 대회 결과</p>
            <div className="space-y-2">
              {/* 팀 포인트 방식 — 포인트 높을수록 좋음 */}
              {tournament.formats?.includes('teamPoint') ? (
                <>
                  <p className="text-xs font-bold text-gray-400 mb-2">🏆 팀 포인트 순위</p>
                  {[...tournament.results]
                    .filter(r => ['1팀','2팀','3팀','4팀','5팀','6팀'].includes(r.name))
                    .sort((a, b) => Number(b.score) - Number(a.score))
                    .map((r, idx) => (
                      <div key={r.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
                        <span className={`text-lg font-black w-8 text-center ${
                          idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                        }`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
                        <span className="flex-1 font-bold text-gray-700">{r.name}</span>
                        <span className="font-black text-green-600">{Number(r.score) > 0 ? '+' : ''}{r.score}pt</span>
                      </div>
                    ))}
                  {/* 개인전 결과도 있으면 표시 */}
                  {tournament.results.filter(r => !['1팀','2팀','3팀','4팀','5팀','6팀'].includes(r.name)).length > 0 && (
                    <>
                      <p className="text-xs font-bold text-gray-400 mt-4 mb-2">⛳ 개인전 순위</p>
                      {[...tournament.results]
                        .filter(r => !['1팀','2팀','3팀','4팀','5팀','6팀'].includes(r.name))
                        .sort((a, b) => Number(a.score) - Number(b.score))
                        .map((r, idx) => (
                          <div key={r.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                            <span className={`text-base font-black w-8 text-center ${
                              idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                            }`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
                            <span className="flex-1 font-bold text-gray-700">{r.nickname || r.name}</span>
                            <span className="font-black text-gray-800">{r.score}타</span>
                          </div>
                        ))}
                    </>
                  )}
                </>
              ) : (
                /* 기존 개인전/팀전 결과 */
                [...tournament.results]
                  .sort((a, b) => Number(a.score) - Number(b.score))
                  .map((r, idx) => (
                    <div key={r.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
                      <span className={`text-lg font-black w-8 text-center ${
                        idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                      }`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
                      <span className="flex-1 font-bold text-gray-700">{r.nickname || r.name}</span>
                      <span className="font-black text-gray-800">{r.score}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* 시상 내역 — 수상자 입력된 것만 표시 */}
        {tournament.awards.filter((a: any) => a.winner?.trim()).length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="font-black text-gray-700 mb-3">🏅 시상 내역</p>
            <div className="space-y-2">
              {tournament.awards
                .filter((a: any) => a.winner?.trim())
                .map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-yellow-50">
                    {a.category && (
                      <span className="text-xs text-gray-400 font-bold">
                        {a.category === 'stroke' ? '스트로크' : a.category === 'shinperio' ? '신페리오' : a.category === 'team' ? '팀전' : '특별'}
                      </span>
                    )}
                    <span className="text-sm font-black text-yellow-600 w-16 flex-shrink-0">{a.rank}</span>
                    <span className="flex-1 font-bold text-gray-700">{a.winner}</span>
                    {a.prize && <span className="text-sm text-gray-500">{a.prize}</span>}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 대진표 버튼 — 토너먼트 방식일 때 */}
        {tournament?.tournamentType === 'knockout' && (
          <button onClick={() => router.push(`/tournament/${tournamentId}/bracket`)}
            className="w-full py-4 rounded-2xl font-bold text-base bg-purple-600 text-white shadow-lg shadow-purple-200 active:scale-95 transition-all">
            🏆 대진표 보기
          </button>
        )}

        {tournament?.groups?.length > 0 && (
          <button onClick={() => router.push(`/tournament/${tournamentId}/groups`)}
            className="w-full py-4 rounded-2xl font-bold text-base bg-green-50 text-green-700 border border-green-200 active:scale-95 transition-all">
            👥 조 편성 결과 보기
          </button>
        )}

        {isAdmin && (
          <button onClick={() => router.push(`/tournament/${tournamentId}/group-assign`)}
            className="w-full py-4 rounded-2xl font-bold text-base bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-95 transition-all">
            👥 조 편성하기
          </button>
        )}

        {/* ✅ 팀 신청 현황 — 대회 정보 탭에 표시 */}
        {tournament?.registrationType === 'team' && (tournament as any).teams?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="font-black text-gray-700">참가 팀 현황 ({(tournament as any).teams?.length}팀)</p>
              {PAYMENT_MANAGERS.includes(myName) && (
                <span className="text-xs text-gray-400">탭하면 입금 확인</span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {(tournament as any).teams?.map((team: any, i: number) => {
                const isMyTeam = team.members?.some((m: any) => m.name === myName || m.nickname === myNickname);
                return (
                  <div key={team.id} className={`px-4 py-3 ${isMyTeam ? 'bg-green-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-gray-300 w-6">{i + 1}</span>
                      <div className="flex-1">
                        <p className={`font-black ${isMyTeam ? 'text-green-700' : 'text-gray-800'}`}>
                          {team.teamName}
                          {isMyTeam && <span className="text-xs text-green-500 ml-1">(내 팀)</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {team.members?.map((m: any) => m.nickname || m.name).join(' · ')}
                        </p>
                      </div>
                      {/* 입금 확인 — 낭빠/양영빈만 */}
                      {PAYMENT_MANAGERS.includes(myName) && (
                        <button
                          onClick={async () => {
                            const updatedTeams = (tournament as any).teams.map((t: any) =>
                              t.id === team.id ? { ...t, paid: !t.paid } : t
                            );
                            await updateDoc(doc(db, 'tournaments', tournamentId), { teams: updatedTeams });
                            fetchData();
                          }}
                          className={`text-lg ${team.paid ? 'text-green-500' : 'text-gray-200'}`}>
                          {team.paid ? '✅' : '○'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </>)}

        {/* ════ 참가자 탭 ════ */}
        {activeTab === 'participants' && (<>

          {/* 토너먼트 팀 신청 방식 */}
          {tournament?.registrationType === 'team' ? (
            <TeamRegistrationSection
              tournament={tournament}
              tournamentId={tournamentId}
              myName={myName}
              myNickname={myNickname}
              isAdmin={isAdmin}
              onRefresh={fetchData}
              onViewBracket={() => router.push(`/tournament/${tournamentId}/bracket`)}
            />
          ) : (
            /* 개인 신청 방식 — 기존 참가자 목록 */
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="font-black text-gray-700">참가자 ({tournament.participants.length}명)</p>
                <p className="text-sm text-green-600 font-bold">입금 {paidCount}/{tournament.participants.length}</p>
              </div>
              <div className="space-y-2">
                {tournament.participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    {PAYMENT_MANAGERS.includes(myName) && (
                      <span onClick={() => handleTogglePaid(p)}
                        className={`text-lg cursor-pointer ${p.paid ? 'text-green-500' : 'text-gray-200'}`}>
                        {p.paid ? '✅' : '○'}
                      </span>
                    )}
                    <span className={`flex-1 font-bold ${p.name === myName ? 'text-green-700' : 'text-gray-700'}`}>
                      {p.nickname || p.name}
                      {p.name === myName && <span className="text-xs text-green-500 ml-1">(나)</span>}
                    </span>
                    {liveScores[p.name] && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        liveScores[p.name].submitted ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {liveScores[p.name].submitted ? '제출완료' : '입력중'}
                      </span>
                    )}
                    {!liveScores[p.name] && (
                      <span className="text-xs text-gray-300 font-bold">미입력</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleRemoveMember(p)}
                        className="text-gray-300 hover:text-red-400 font-black">×</button>
                    )}
                  </div>
                ))}
              </div>
              {isAdmin && showAddMember && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <input type="text" placeholder="이름 또는 닉네임 검색"
                    value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allMembers
                      .filter(m => !tournament.participants.some(p => p.name === m.name))
                      .filter(m => !memberSearch || m.name.includes(memberSearch) || m.nickname.includes(memberSearch))
                      .map(m => (
                        <button key={m.name} onClick={() => handleAddMember(m)}
                          className="w-full text-left px-3 py-2.5 bg-gray-50 rounded-xl text-sm hover:bg-green-50 flex justify-between items-center">
                          <span className="font-bold">{m.nickname || m.name}</span>
                          <span className="text-gray-400 text-xs">{m.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* 참가 신청/취소 버튼 */}
              {tournament.status === 'open' && (
                <button onClick={handleJoin} disabled={isFull && !isJoined}
                  className={`w-full py-3 rounded-2xl font-bold text-sm mt-3 transition-all active:scale-95 ${
                    isJoined ? 'bg-gray-200 text-gray-600' : isFull ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white'
                  }`}>
                  {isJoined ? '참가 취소' : isFull ? '정원 마감' : '🏆 참가 신청하기'}
                </button>
              )}
            </div>
          )}
        </>)}

        {/* ════ 실시간 순위 탭 ════ */}
        {activeTab === 'standings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {Object.values(liveScores).filter((s: any) => s.submitted).length}/{tournament.participants.length}명 제출
              </p>
              <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-bold">🔴 실시간</span>
            </div>

            {/* 팀 순위 */}
            {hasTeamFormat && standings.teams.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="font-black text-gray-700 mb-3">
                  {tournament.formats?.includes('teamPoint') ? '🏆 팀 포인트 순위' :
                   tournament.formats?.includes('matchplay') ? '⚔️ 매치플레이 순위' : '🎯 하이로우 순위'}
                </p>
                <div className="space-y-2">
                  {standings.teams.map((team, idx) => (
                    <div key={team.label} className="rounded-xl bg-gray-50 overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className={`text-lg font-black w-8 text-center ${
                          idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                        }`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
                        <div className="flex-1">
                          <p className="font-black text-gray-800">{team.label}</p>
                          {team.groupLabel && <p className="text-xs text-gray-400">{team.groupLabel}</p>}
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${team.totalPoints > 0 ? 'text-green-600' : team.totalPoints < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                            {team.totalPoints > 0 ? `+${team.totalPoints}` : team.totalPoints}
                            {tournament.formats?.includes('teamPoint') ? 'pt' : ''}
                          </p>
                        </div>
                      </div>
                      {/* 팀원 목록 */}
                      <div className="px-3 pb-2 flex flex-wrap gap-1">
                        {team.members.map((m: any) => {
                          const s = liveScores[m.name];
                          return (
                            <span key={m.name} className="text-xs bg-white border border-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-bold">
                              {m.nickname || m.name}
                              {s && <span className={`ml-1 ${s.total < 0 ? 'text-blue-500' : s.total > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                ({s.total > 0 ? '+' : ''}{s.total})
                              </span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 개인 순위 */}
            {hasIndividualFormat && standings.individual.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="font-black text-gray-700 mb-3">⛳ 개인 순위</p>
                <div className="space-y-2">
                  {standings.individual.map((p, idx) => (
                    <div key={p.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
                      <span className={`text-lg font-black w-8 text-center ${
                        idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                      }`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
                      <div className="flex-1">
                        <p className={`font-bold ${p.name === myName ? 'text-green-700' : 'text-gray-700'}`}>
                          {p.nickname}
                          {p.name === myName && <span className="text-xs text-green-500 ml-1">(나)</span>}
                        </p>
                        {p.myGroup && <p className="text-xs text-gray-400">{p.myGroup} {p.myTeam && `· ${p.myTeam}`}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black ${p.total < 0 ? 'text-blue-500' : p.total > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                          {p.total > 0 ? `+${p.total}` : p.total === 0 ? 'E' : p.total}
                        </p>
                        {!p.submitted && <p className="text-xs text-yellow-500">입력중</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {standings.individual.length === 0 && standings.teams.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-4xl mb-3">⛳</p>
                <p className="text-gray-400 text-sm">아직 입력된 성적이 없어요.</p>
                <p className="text-gray-300 text-xs mt-1">참가자들이 성적을 입력하면 실시간으로 표시돼요!</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}