'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const ADMIN_NAMES = ['김근석'];

interface Scorecard {
  id: string;
  meetupId: string;
  players: { name: string; nickname?: string; scores: number[]; totalOverride?: number }[];
  pars?: number[];
  savedAt?: string;
}

interface Meetup {
  id: string;
  date: string;
  courseName?: string;
  meetupType?: string;
  isOvernight?: boolean;
  participants?: { name: string; nickname?: string }[];
}

export default function FieldRecordsPage() {
  const router = useRouter();
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [scorecards, setScorecards] = useState<Record<string, Scorecard>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<{ meetupId: string; playerIdx: number } | null>(null);
  const [editScores, setEditScores] = useState<number[]>([]);
  const [editTotal, setEditTotal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    load();
  }, []);

  const load = async () => {
    try {
      const [meetupsSnap, scorecardsSnap] = await Promise.all([
        getDocs(collection(db, 'meetups')),
        getDocs(collection(db, 'scorecards')),
      ]);

      const mList: Meetup[] = meetupsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Meetup))
        .filter(m => m.meetupType === 'field' || m.meetupType === 'overnight' || m.isOvernight)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setMeetups(mList);

      const scMap: Record<string, Scorecard> = {};
      scorecardsSnap.docs.forEach(d => {
        const data = d.data();
        const mid = (data.meetupId || d.id).replace('_day2', '');
        scMap[mid] = { id: d.id, meetupId: mid, ...data } as Scorecard;
      });
      setScorecards(scMap);
    } catch (err) {
      console.error('로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = ADMIN_NAMES.includes(myName);
  const selected = meetups.find(m => m.id === selectedId);
  const selectedCard = selectedId ? scorecards[selectedId] : null;

  const calcTotal = (p: { scores: number[]; totalOverride?: number }) => {
    if (p.totalOverride) return p.totalOverride;
    return p.scores?.reduce((a, b) => a + (b || 0), 0) || 0;
  };

  const startEdit = (meetupId: string, playerIdx: number) => {
    const p = scorecards[meetupId]?.players[playerIdx];
    if (!p) return;
    setEditScores(p.scores?.length ? [...p.scores] : Array(18).fill(0));
    setEditTotal(p.totalOverride ? String(p.totalOverride) : '');
    setEditingPlayer({ meetupId, playerIdx });
  };

  const saveEdit = async () => {
    if (!editingPlayer) return;
    const { meetupId, playerIdx } = editingPlayer;
    const card = scorecards[meetupId];
    if (!card) return;
    setBusy(true);
    try {
      const updatedPlayers = card.players.map((p, i) => {
        if (i !== playerIdx) return p;
        const total = Number(editTotal);
        return total > 0
          ? { ...p, totalOverride: total, scores: editScores }
          : { ...p, scores: editScores, totalOverride: undefined };
      });
      await updateDoc(doc(db, 'scorecards', card.id), { players: updatedPlayers });
      setScorecards(prev => ({
        ...prev,
        [meetupId]: { ...card, players: updatedPlayers },
      }));
      setEditingPlayer(null);
    } catch {
      alert('저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const deleteCard = async (meetupId: string) => {
    const card = scorecards[meetupId];
    if (!card) return;
    if (!window.confirm('이 성적표를 삭제할까요?')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'scorecards', card.id));
      setScorecards(prev => {
        const next = { ...prev };
        delete next[meetupId];
        return next;
      });
      setSelectedId(null);
    } catch {
      alert('삭제하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 pb-24">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-black text-gray-800">필드 기록 관리</h1>
      </header>

      <div className="p-4 space-y-3">
        {meetups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-400">필드 벙개 기록이 없어요.</p>
          </div>
        ) : (
          meetups.map(m => {
            const card = scorecards[m.id];
            const isOpen = selectedId === m.id;
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* 벙개 헤더 */}
                <button
                  onClick={() => setSelectedId(isOpen ? null : m.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <p className="font-black text-gray-800">{m.date}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {m.courseName || '장소 미정'}
                      {(m.meetupType === 'overnight' || m.isOvernight) && (
                        <span className="ml-2 text-xs text-purple-600 font-bold">1박2일</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {card ? (
                      <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">성적표 있음</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-400 font-bold px-2 py-1 rounded-full">성적표 없음</span>
                    )}
                    <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* 성적표 상세 */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {!card ? (
                      <p className="text-sm text-gray-400 text-center py-4">성적표가 없어요.</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {card.players?.map((p, idx) => {
                            const total = calcTotal(p);
                            const isEditing = editingPlayer?.meetupId === m.id && editingPlayer?.playerIdx === idx;
                            return (
                              <div key={idx} className="bg-gray-50 rounded-xl p-3">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <p className="font-black text-gray-800">{p.nickname || p.name}</p>
                                    <div>
                                      <p className="text-xs text-gray-400 font-bold mb-1">총타수 (간편입력)</p>
                                      <input
                                        type="number" inputMode="numeric"
                                        value={editTotal}
                                        onChange={e => setEditTotal(e.target.value)}
                                        placeholder="예: 87"
                                        className="w-full p-2.5 bg-white rounded-xl text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-green-400"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={saveEdit} disabled={busy}
                                        className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-bold disabled:bg-gray-300">저장</button>
                                      <button onClick={() => setEditingPlayer(null)}
                                        className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">취소</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-black text-gray-800">{p.nickname || p.name}
                                        {p.nickname && <span className="text-xs text-gray-400 ml-1">({p.name})</span>}
                                      </p>
                                      <p className="text-sm text-gray-500 mt-0.5">총 <b className="text-gray-800">{total}타</b></p>
                                    </div>
                                    {isAdmin && (
                                      <button onClick={() => startEdit(m.id, idx)}
                                        className="text-xs text-blue-600 font-bold px-3 py-1.5 bg-blue-50 rounded-lg">수정</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {isAdmin && (
                          <button onClick={() => deleteCard(m.id)} disabled={busy}
                            className="w-full py-2 rounded-xl bg-red-50 text-red-500 text-sm font-bold">
                            성적표 삭제
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
