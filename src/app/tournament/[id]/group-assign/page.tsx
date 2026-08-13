'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface Group {
  id: string;
  groupNumber: number;
  label: string; // 예: "A조", "1조"
  members: Participant[];
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
  const [groupSize, setGroupSize] = useState(4);
  const [dragPlayer, setDragPlayer] = useState<{ player: Participant; fromGroup: string | null } | null>(null);

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

      // 기존 조 편성 불러오기
      if (data.groups && data.groups.length > 0) {
        setGroups(data.groups);
        const assignedNames = new Set(data.groups.flatMap((g: Group) => g.members.map((m: Participant) => m.name)));
        setUnassigned(parts.filter(p => !assignedNames.has(p.name)));
      } else {
        setUnassigned(parts);
        const total = parts.length;
        const size = total <= 16 ? 4 : total <= 24 ? 4 : 4;
        setGroupSize(size);
        setGroupCount(Math.ceil(total / size));
      }
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 자동 조 편성 (핸디캡 밸런스)
  const handleAutoAssign = () => {
    if (!window.confirm(`${groupCount}개 조로 자동 편성할까요?\n핸디캡 기준으로 균형있게 배정됩니다.`)) return;

    const sorted = [...participants].sort((a, b) => (a.handicap || 0) - (b.handicap || 0));
    const newGroups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
      id: `group-${i + 1}`,
      groupNumber: i + 1,
      label: `${i + 1}조`,
      members: [],
    }));

    // 뱀 방식 배정 (1→2→3→4→4→3→2→1→...)
    sorted.forEach((player, idx) => {
      const cycle = Math.floor(idx / groupCount);
      const pos = idx % groupCount;
      const groupIdx = cycle % 2 === 0 ? pos : groupCount - 1 - pos;
      newGroups[groupIdx].members.push(player);
    });

    setGroups(newGroups);
    setUnassigned([]);
  };

  // ✅ 조 초기화
  const handleReset = () => {
    if (!window.confirm('조 편성을 초기화할까요?')) return;
    setGroups([]);
    setUnassigned([...participants]);
  };

  // ✅ 빈 조 추가
  const handleAddGroup = () => {
    const newNum = groups.length + 1;
    setGroups(prev => [...prev, {
      id: `group-${Date.now()}`,
      groupNumber: newNum,
      label: `${newNum}조`,
      members: [],
    }]);
  };

  // ✅ 조 삭제 (멤버 미배정으로 이동)
  const handleRemoveGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setUnassigned(prev => [...prev, ...group.members]);
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  // ✅ 조 라벨 수정
  const handleLabelChange = (groupId: string, label: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, label } : g));
  };

  // ✅ 플레이어 이동
  const movePlayer = (player: Participant, fromGroupId: string | null, toGroupId: string | null) => {
    // 출발지에서 제거
    if (fromGroupId === null) {
      setUnassigned(prev => prev.filter(p => p.name !== player.name));
    } else {
      setGroups(prev => prev.map(g =>
        g.id === fromGroupId
          ? { ...g, members: g.members.filter(m => m.name !== player.name) }
          : g
      ));
    }
    // 목적지에 추가
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

  // ✅ 저장
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

  const PlayerCard = ({
    player,
    fromGroupId,
    compact = false,
  }: {
    player: Participant;
    fromGroupId: string | null;
    compact?: boolean;
  }) => (
    <div className={`flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-gray-800 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          {player.nickname || player.name}
        </p>
        {getHandicapLabel(player) && (
          <p className="text-xs text-gray-400">{getHandicapLabel(player)}</p>
        )}
      </div>
      {/* 이동 버튼 */}
      <div className="flex gap-1 flex-shrink-0">
        {groups.map(g => (
          g.id !== fromGroupId && (
            <button
              key={g.id}
              onClick={() => movePlayer(player, fromGroupId, g.id)}
              className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded-lg font-bold active:bg-green-100"
              title={`${g.label}로 이동`}
            >
              {g.label}
            </button>
          )
        ))}
        {fromGroupId !== null && (
          <button
            onClick={() => movePlayer(player, fromGroupId, null)}
            className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-lg font-bold active:bg-gray-200"
            title="미배정으로"
          >
            ✕
          </button>
        )}
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

        {/* 자동 편성 컨트롤 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <p className="font-black text-gray-700 text-sm">⚙️ 자동 조 편성 설정</p>
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
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold active:scale-95 transition-all">
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

        {/* 미배정 인원 */}
        {unassigned.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-sm font-black text-red-500 mb-2">
              ⚠️ 미배정 ({unassigned.length}명)
            </p>
            <div className="space-y-2">
              {unassigned.map(p => (
                <PlayerCard key={p.name} player={p} fromGroupId={null} />
              ))}
            </div>
          </div>
        )}

        {/* 조별 목록 */}
        {groups.map(group => (
          <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 조 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 bg-green-600">
              <input
                type="text"
                value={group.label}
                onChange={e => handleLabelChange(group.id, e.target.value)}
                className="flex-1 bg-transparent text-white font-black text-base outline-none placeholder:text-green-200"
                placeholder="조 이름"
              />
              <span className="text-green-200 text-sm">{group.members.length}명</span>
              <button onClick={() => handleRemoveGroup(group.id)}
                className="text-green-200 hover:text-white font-black text-lg ml-1">×</button>
            </div>

            {/* 멤버 목록 */}
            <div className="p-3 space-y-2">
              {group.members.length === 0 ? (
                <p className="text-center text-gray-300 text-sm py-4">아직 배정된 인원이 없어요</p>
              ) : (
                group.members.map(player => (
                  <PlayerCard key={player.name} player={player} fromGroupId={group.id} />
                ))
              )}
            </div>
          </div>
        ))}

        {groups.length === 0 && unassigned.length > 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            위에서 자동 편성하거나 조를 추가해주세요.
          </div>
        )}

        {/* 최종 저장 */}
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