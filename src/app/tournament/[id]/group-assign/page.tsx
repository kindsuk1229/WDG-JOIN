'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const OWNER_NAME = '김근석';

interface Participant {
  name: string;
  nickname: string;
  handicap?: number;
  gHandicap?: number;
}

// 조 안의 팀 (2:2매치, 하이로우, 팀포인트 등)
interface SubTeam {
  id: string;
  label: string; // "A팀", "B팀", "1팀" 등
  members: Participant[];
}

interface Group {
  id: string;
  groupNumber: number;
  label: string;
  members: Participant[];
  subTeams?: SubTeam[]; // ✅ 조 내 팀 나누기
  useSubTeams?: boolean;
}

export default function TournamentGroupAssignPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [unassigned, setUnassigned] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupCount, setGroupCount] = useState(4);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    if (name !== OWNER_NAME) { router.replace('/tournament'); return; }
    fetchData();
  }, [tournamentId]);

  const fetchData = async () => {
    try {
      const snap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!snap.exists()) return;
      const data = snap.data();
      setTournament(data);

      const parts: Participant[] = (data.participants || []).map((p: any) => ({
        name: p.name,
        nickname: p.nickname || p.name,
        handicap: p.handicap ?? 0,
        gHandicap: p.gHandicap ?? null,
      }));
      setParticipants(parts);

      if (data.groups && data.groups.length > 0) {
        setGroups(data.groups);
        const assignedNames = new Set(data.groups.flatMap((g: Group) => g.members.map((m: Participant) => m.name)));
        setUnassigned(parts.filter(p => !assignedNames.has(p.name)));
      } else {
        setUnassigned(parts);
      }
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 자동 조 편성 (핸디캡 뱀 방식)
  const handleAutoAssign = () => {
    if (!window.confirm(`${groupCount}개 조로 자동 편성할까요?\n핸디캡 기준으로 균형있게 배정됩니다.`)) return;

    const sorted = [...participants].sort((a, b) => (a.handicap || 0) - (b.handicap || 0));
    const newGroups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
      id: `group-${i + 1}`,
      groupNumber: i + 1,
      label: `${i + 1}조`,
      members: [],
      useSubTeams: false,
      subTeams: [],
    }));

    sorted.forEach((player, idx) => {
      const cycle = Math.floor(idx / groupCount);
      const pos = idx % groupCount;
      const groupIdx = cycle % 2 === 0 ? pos : groupCount - 1 - pos;
      newGroups[groupIdx].members.push(player);
    });

    setGroups(newGroups);
    setUnassigned([]);
  };

  const handleReset = () => {
    if (!window.confirm('조 편성을 초기화할까요?')) return;
    setGroups([]);
    setUnassigned([...participants]);
  };

  const handleAddGroup = () => {
    const newNum = groups.length + 1;
    setGroups(prev => [...prev, {
      id: `group-${Date.now()}`,
      groupNumber: newNum,
      label: `${newNum}조`,
      members: [],
      useSubTeams: false,
      subTeams: [],
    }]);
  };

  const handleRemoveGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setUnassigned(prev => [...prev, ...group.members]);
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleLabelChange = (groupId: string, label: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, label } : g));
  };

  const movePlayer = (player: Participant, fromGroupId: string | null, toGroupId: string | null) => {
    if (fromGroupId === null) {
      setUnassigned(prev => prev.filter(p => p.name !== player.name));
    } else {
      setGroups(prev => prev.map(g =>
        g.id === fromGroupId
          ? { ...g, members: g.members.filter(m => m.name !== player.name) }
          : g
      ));
    }
    if (toGroupId === null) {
      setUnassigned(prev => [...prev, player]);
    } else {
      setGroups(prev => prev.map(g =>
        g.id === toGroupId
          ? { ...g, members: [...g.members, player] }
          : g
      ));
    }
  };

  // ✅ 조 내 팀 나누기 토글
  const handleToggleSubTeams = (groupId: string, teamCount: number) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      if (!g.useSubTeams) {
        // 팀 나누기 활성화 — 기본 팀 생성
        const teamLabels = ['A팀', 'B팀', 'C팀', 'D팀'].slice(0, teamCount);
        const subTeams: SubTeam[] = teamLabels.map((label, i) => ({
          id: `team-${i}`,
          label,
          members: [],
        }));
        // 기존 멤버 팀에 균등 배분
        const members = [...g.members];
        members.forEach((m, idx) => {
          subTeams[idx % teamCount].members.push(m);
        });
        return { ...g, useSubTeams: true, subTeams };
      } else {
        // 팀 나누기 비활성화
        return { ...g, useSubTeams: false, subTeams: [] };
      }
    }));
  };

  // ✅ 팀 수 변경
  const handleChangeTeamCount = (groupId: string, teamCount: number) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const teamLabels = ['A팀', 'B팀', 'C팀', 'D팀'].slice(0, teamCount);
      const allMembers = g.subTeams?.flatMap(t => t.members) || g.members;
      const subTeams: SubTeam[] = teamLabels.map((label, i) => ({
        id: `team-${i}`,
        label,
        members: [],
      }));
      allMembers.forEach((m, idx) => {
        subTeams[idx % teamCount].members.push(m);
      });
      return { ...g, subTeams };
    }));
  };

  // ✅ 팀 내 멤버 이동
  const moveToSubTeam = (groupId: string, player: Participant, fromTeamId: string, toTeamId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const newSubTeams = (g.subTeams || []).map(t => {
        if (t.id === fromTeamId) return { ...t, members: t.members.filter(m => m.name !== player.name) };
        if (t.id === toTeamId) return { ...t, members: [...t.members, player] };
        return t;
      });
      return { ...g, subTeams: newSubTeams };
    }));
  };

  // ✅ 팀 라벨 변경
  const handleSubTeamLabelChange = (groupId: string, teamId: string, label: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? {
        ...g,
        subTeams: (g.subTeams || []).map(t => t.id === teamId ? { ...t, label } : t)
      } : g
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId), { groups });
      alert('조 편성이 저장되었습니다! 👥');
      router.back();
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getHandicapLabel = (p: Participant) => {
    if (p.gHandicap !== null && p.gHandicap !== undefined) return `G${p.gHandicap}`;
    if (p.handicap) return `H${p.handicap}`;
    return '';
  };

  const PlayerCard = ({ player, fromGroupId }: { player: Participant; fromGroupId: string | null }) => (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 truncate text-sm">{player.nickname || player.name}</p>
        {getHandicapLabel(player) && <p className="text-xs text-gray-400">{getHandicapLabel(player)}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* ✅ 드롭다운 선택 */}
        <select
          value=""
          onChange={e => {
            const val = e.target.value;
            if (val === '__unassign__') movePlayer(player, fromGroupId, null);
            else if (val) movePlayer(player, fromGroupId, val);
          }}
          className="text-xs px-2 py-1.5 bg-green-50 text-green-700 rounded-lg font-bold border border-green-100 outline-none cursor-pointer"
        >
          <option value="">이동 ▼</option>
          {groups
            .filter(g => g.id !== fromGroupId)
            .map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))
          }
          {fromGroupId !== null && (
            <option value="__unassign__">미배정으로</option>
          )}
        </select>
      </div>
    </div>
  );

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <div>
            <h1 className="text-xl font-black text-gray-800">조 편성</h1>
            <p className="text-xs text-gray-400">{tournament?.title} · {participants.length}명</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${saving ? 'bg-gray-400' : 'bg-green-600'}`}>
          {saving ? '저장중...' : '저장'}
        </button>
      </header>

      <div className="p-4 space-y-4">

        {/* 자동 편성 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <p className="font-black text-gray-700 text-sm">⚙️ 자동 조 편성</p>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-400 block mb-1">조 수</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setGroupCount(Math.max(1, groupCount - 1))}
                  className="w-8 h-8 rounded-lg bg-gray-100 font-black text-gray-600 flex items-center justify-center">−</button>
                <span className="font-black text-gray-800 w-8 text-center">{groupCount}</span>
                <button onClick={() => setGroupCount(groupCount + 1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 font-black text-gray-600 flex items-center justify-center">+</button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 block mb-1">조당 인원</label>
              <p className="text-sm font-bold text-gray-600">
                {Math.ceil(participants.length / groupCount)}~{Math.ceil(participants.length / groupCount) + 1}명
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAutoAssign}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold active:scale-95">
              🔀 핸디캡 밸런스 자동 편성
            </button>
            <button onClick={handleReset}
              className="px-4 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold">
              초기화
            </button>
          </div>
          <button onClick={handleAddGroup}
            className="w-full py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold border border-blue-100">
            + 조 추가
          </button>
        </div>

        {/* 미배정 */}
        {unassigned.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-sm font-black text-red-500 mb-2">⚠️ 미배정 ({unassigned.length}명)</p>
            <div className="space-y-2">
              {unassigned.map(p => <PlayerCard key={p.name} player={p} fromGroupId={null} />)}
            </div>
          </div>
        )}

        {/* 조별 목록 */}
        {groups.map(group => (
          <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 조 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 bg-green-600">
              <input type="text" value={group.label}
                onChange={e => handleLabelChange(group.id, e.target.value)}
                className="flex-1 bg-transparent text-white font-black text-base outline-none" />
              <span className="text-green-200 text-sm">{group.members.length}명</span>
              <button onClick={() => handleRemoveGroup(group.id)}
                className="text-green-200 hover:text-white font-black text-lg ml-1">×</button>
            </div>

            {/* 조 내 팀 나누기 설정 */}
            <div className="px-4 py-2 bg-green-50 border-b border-green-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-green-700">팀 나누기</span>
                <select
                  value={group.useSubTeams ? (group.subTeams?.length || 2) : 0}
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (val === 0) {
                      if (group.useSubTeams) handleToggleSubTeams(group.id, 2);
                    } else {
                      if (!group.useSubTeams) {
                        handleToggleSubTeams(group.id, val);
                      } else {
                        handleChangeTeamCount(group.id, val);
                      }
                    }
                  }}
                  className="text-xs px-2 py-1.5 bg-white text-green-700 rounded-lg font-bold border border-green-200 outline-none cursor-pointer"
                >
                  <option value={0}>없음</option>
                  <option value={2}>2팀</option>
                  <option value={3}>3팀</option>
                  <option value={4}>4팀</option>
                </select>
              </div>
            </div>

            {/* 팀 나누기 없을 때 — 일반 멤버 목록 */}
            {!group.useSubTeams && (
              <div className="p-3 space-y-2">
                {group.members.length === 0 ? (
                  <p className="text-center text-gray-300 text-sm py-4">아직 배정된 인원이 없어요</p>
                ) : (
                  group.members.map(player => (
                    <PlayerCard key={player.name} player={player} fromGroupId={group.id} />
                  ))
                )}
              </div>
            )}

            {/* 팀 나누기 있을 때 */}
            {group.useSubTeams && group.subTeams && (
              <div className="p-3 space-y-3">
                {group.subTeams.map(team => (
                  <div key={team.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* 팀 헤더 */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                      <input type="text" value={team.label}
                        onChange={e => handleSubTeamLabelChange(group.id, team.id, e.target.value)}
                        className="flex-1 bg-transparent font-black text-sm text-gray-700 outline-none" />
                      <span className="text-xs text-gray-400">{team.members.length}명</span>
                    </div>
                    {/* 팀 멤버 */}
                    <div className="p-2 space-y-1.5">
                      {team.members.length === 0 ? (
                        <p className="text-center text-gray-300 text-xs py-2">없음</p>
                      ) : (
                        team.members.map(player => (
                          <div key={player.name} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">
                            <p className="flex-1 text-sm font-bold text-gray-700 truncate">{player.nickname || player.name}</p>
                            <select
                              value=""
                              onChange={e => {
                                if (e.target.value) moveToSubTeam(group.id, player, team.id, e.target.value);
                              }}
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg font-bold border border-blue-100 outline-none cursor-pointer"
                            >
                              <option value="">이동 ▼</option>
                              {group.subTeams!.filter(t => t.id !== team.id).map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && unassigned.length > 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            위에서 자동 편성하거나 조를 추가해주세요.
          </div>
        )}

        {groups.length > 0 && (
          <button onClick={handleSave} disabled={saving}
            className={`w-full py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-95 ${
              saving ? 'bg-gray-400' : 'bg-green-600 shadow-lg shadow-green-200'
            }`}>
            {saving ? '저장중...' : '👥 조 편성 저장'}
          </button>
        )}
      </div>
    </div>
  );
}