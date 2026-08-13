'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { calcRoundRating, getInitialRating, RATING_MIN } from '@/lib/rating';

const OWNER_NAME = '김근석';

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
  date: string;
  venue: string;
  entryFee: number;
  status: 'open' | 'closed' | 'completed';
  maxPlayers: number;
  teamSize?: number;
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
      const [tSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId)),
        getDocs(collection(db, 'users')),
      ]);

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
        {isOwner && (
          <button onClick={() => router.push(`/tournament/${tournamentId}/group-assign`)}
            className="text-sm font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg">
            조 편성
          </button>
        )}
      </header>

      <div className="p-4 space-y-4">

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

        {/* 관리자 도구 */}
        {isOwner && (
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
              {[...tournament.results]
                .sort((a, b) => Number(a.score) - Number(b.score))
                .map((r, idx) => (
                  <div key={r.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
                    <span className={`text-lg font-black w-8 text-center ${
                      idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </span>
                    <span className="flex-1 font-bold text-gray-700">{r.nickname || r.name}</span>
                    <span className="font-black text-gray-800">{r.score}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 시상 내역 */}
        {tournament.awards.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="font-black text-gray-700 mb-3">🏅 시상 내역</p>
            <div className="space-y-2">
              {tournament.awards.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-yellow-50">
                  <span className="text-sm font-black text-yellow-600 w-24 flex-shrink-0">{a.rank}</span>
                  <span className="flex-1 font-bold text-gray-700">{a.winner}</span>
                  {a.prize && <span className="text-sm text-gray-500">{a.prize}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 참가자 목록 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700 mb-3">
            참가자 ({tournament.participants.length}명)
            {isOwner && <span className="text-sm font-normal text-gray-400 ml-2">· 탭하면 입금 확인</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {tournament.participants.map((p, i) => (
              <div key={i} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                p.name === myName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {isOwner && (
                  <span onClick={() => handleTogglePaid(p)}
                    className={`text-xs cursor-pointer ${p.paid ? 'text-green-500' : 'text-gray-300'}`}>
                    {p.paid ? '✅' : '○'}
                  </span>
                )}
                <span>{p.nickname || p.name}</span>
                {isOwner && (
                  <button onClick={() => handleRemoveMember(p)}
                    className="text-gray-400 hover:text-red-400 ml-1 font-black">×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 참가 신청 버튼 */}
        {tournament.status === 'open' && (
          <button onClick={handleJoin}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 ${
              isJoined
                ? 'bg-gray-200 text-gray-600'
                : isFull
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white shadow-lg shadow-green-200'
            }`}
            disabled={isFull && !isJoined}
          >
            {isJoined ? '참가 취소' : isFull ? '정원 마감' : '🏆 참가 신청하기'}
          </button>
        )}

        {/* 조 편성 보기 버튼 */}
        {tournament?.groups?.length > 0 && (
          <button onClick={() => router.push(`/tournament/${tournamentId}/groups`)}
            className="w-full py-4 rounded-2xl font-bold text-base bg-green-50 text-green-700 border border-green-200 active:scale-95 transition-all">
            👥 조 편성 결과 보기
          </button>
        )}

        {/* 조 편성 버튼 */}
        {isOwner && (
          <button onClick={() => router.push(`/tournament/${tournamentId}/group-assign`)}
            className="w-full py-4 rounded-2xl font-bold text-base bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-95 transition-all">
            👥 조 편성하기
          </button>
        )}
      </div>
    </div>
  );
}