'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const OWNER_NAME = '김근석';

const FORMAT_OPTIONS = [
  { group: '개인전', options: [
    { value: 'stroke', label: '스트로크 (타수)' },
    { value: 'shinperio', label: '신페리오 (Net)' },
  ]},
  { group: '팀전', options: [
    { value: 'team2', label: '2인1조 합산' },
    { value: 'team4', label: '4인1조 합산' },
    { value: 'teamCustom', label: '직접설정' },
    { value: 'teamPoint', label: '팀 포인트 (이글+5/버디+3/파+1/보기0/더블-1/트리플-2)' },
  ]},
  { group: '2:2', options: [
    { value: 'matchplay', label: '베스트볼 매치플레이 (업&다운)' },
    { value: 'highlow', label: '하이로우' },
  ]},
];

const INDIVIDUAL_FORMATS = ['stroke', 'shinperio'];

export default function TournamentEditPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'screen' | 'field'>('screen');
  const [formats, setFormats] = useState<string[]>(['stroke']);
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [round, setRound] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('open');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    if (name !== OWNER_NAME) { router.replace('/tournament'); return; }
    fetchData();
  }, [tournamentId]);

  const fetchData = async () => {
    try {
      const snap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!snap.exists()) return;
      const d = snap.data();
      setTitle(d.title || '');
      setType(d.type || 'screen');
      setFormats(d.formats || (d.format ? d.format.split('+') : ['stroke']));
      setDate(d.date || '');
      setVenue(d.venue || '');
      setEntryFee(String(d.entryFee || ''));
      setMaxPlayers(String(d.maxPlayers || ''));
      setTeamSize(String(d.teamSize || ''));
      setRound(String(d.round || ''));
      setDescription(d.description || '');
      setStatus(d.status || 'open');
    } catch (err) {
      console.error('로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFormat = (value: string) => {
    if (INDIVIDUAL_FORMATS.includes(value)) {
      setFormats(prev =>
        prev.includes(value)
          ? prev.filter(f => f !== value)
          : [...prev.filter(f => INDIVIDUAL_FORMATS.includes(f)), value]
      );
    } else {
      setFormats([value]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return alert('대회명을 입력해주세요.');
    if (!date) return alert('날짜를 입력해주세요.');
    if (!venue.trim()) return alert('장소를 입력해주세요.');

    setSaving(true);
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        title: title.trim(),
        type,
        format: formats.join('+'),
        formats,
        date,
        venue: venue.trim(),
        entryFee: Number(entryFee) || 0,
        maxPlayers: Number(maxPlayers) || 0,
        teamSize: formats.includes('teamCustom') ? Number(teamSize) : null,
        round: Number(round) || 0,
        description: description.trim(),
        status,
        updatedAt: new Date().toISOString(),
      });
      alert('수정되었습니다! ✅');
      router.back();
    } catch (err) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <h1 className="text-xl font-black text-gray-800">대회 수정</h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${saving ? 'bg-gray-400' : 'bg-green-600'}`}>
          {saving ? '저장중...' : '저장'}
        </button>
      </header>

      <div className="p-4 space-y-4">

        {/* 기본 정보 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700">기본 정보</p>

          <div className="flex gap-2">
            <div className="w-24">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">회차</label>
              <input type="number" inputMode="numeric" value={round}
                onChange={e => setRound(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl text-center font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">대회명</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>

          {/* 대회 종류 */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">대회 종류</label>
            <div className="flex gap-2">
              {[
                { value: 'screen', label: '🖥️ 스크린' },
                { value: 'field', label: '🏌️ 필드' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setType(opt.value as any)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm ${
                    type === opt.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 경기 방식 */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">경기 방식</label>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map(group => (
                <div key={group.group}>
                  <p className="text-xs text-gray-400 mb-1">
                    {group.group}
                    {group.group === '개인전' && <span className="ml-1 text-green-500">(중복 선택 가능)</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(opt => (
                      <button key={opt.value} onClick={() => toggleFormat(opt.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold ${
                          formats.includes(opt.value) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {formats.length > 0 && (
              <p className="text-xs text-green-600 mt-2 font-bold">
                선택됨: {formats.map(f => FORMAT_OPTIONS.flatMap(g => g.options).find(o => o.value === f)?.label).join(' + ')}
              </p>
            )}
          </div>

          {/* 상태 */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">상태</label>
            <div className="flex gap-2">
              {[
                { value: 'open', label: '모집중' },
                { value: 'closed', label: '마감' },
                { value: 'completed', label: '완료' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setStatus(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                    status === opt.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 일정/장소 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700">일정 · 장소</p>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5">장소</label>
            <input type="text" value={venue} onChange={e => setVenue(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        </div>

        {/* 참가비/인원 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700">참가비 · 인원</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">참가비 (원)</label>
              <input type="number" inputMode="numeric" value={entryFee}
                onChange={e => setEntryFee(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">최대 인원</label>
              <input type="number" inputMode="numeric" value={maxPlayers}
                onChange={e => setMaxPlayers(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>
        </div>

        {/* 설명 */}
        <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700">대회 설명</p>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full p-3 bg-gray-50 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-green-500 outline-none resize-none" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className={`w-full py-4 rounded-2xl font-bold text-white text-base ${
            saving ? 'bg-gray-400' : 'bg-green-600 shadow-lg shadow-green-200 active:scale-95 transition-all'
          }`}>
          {saving ? '저장중...' : '✅ 수정 완료'}
        </button>
      </div>
    </div>
  );
}