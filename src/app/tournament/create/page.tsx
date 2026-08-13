'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

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
  ]},
  { group: '2:2', options: [
    { value: 'matchplay', label: '베스트볼 매치플레이 (업&다운)' },
    { value: 'highlow', label: '하이로우' },
  ]},
];

export default function TournamentCreatePage() {
  const router = useRouter();
  const [myName, setMyName] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'screen' | 'field'>('screen');
  const [format, setFormat] = useState('stroke');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [teamSize, setTeamSize] = useState(''); // 직접설정 팀 인원
  const [hasAward, setHasAward] = useState(false);
  const [awardDesc, setAwardDesc] = useState('');
  const [round, setRound] = useState(''); // 회차
  const [description, setDescription] = useState('');
  const [nextRound, setNextRound] = useState(1);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    if (name !== OWNER_NAME) {
      router.replace('/tournament');
      return;
    }
    // 자동 회차 계산
    const fetchLastRound = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('round', 'desc'), limit(1)));
        if (!snap.empty) {
          setNextRound((snap.docs[0].data().round || 0) + 1);
          setRound(String((snap.docs[0].data().round || 0) + 1));
        } else {
          setRound('1');
        }
      } catch {
        setRound('1');
      }
    };
    fetchLastRound();
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return alert('대회명을 입력해주세요.');
    if (!date) return alert('날짜를 입력해주세요.');
    if (!venue.trim()) return alert('장소를 입력해주세요.');
    if (!maxPlayers) return alert('최대 인원을 입력해주세요.');

    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        title: title.trim(),
        type,
        format,
        date,
        venue: venue.trim(),
        entryFee: Number(entryFee) || 0,
        maxPlayers: Number(maxPlayers),
        teamSize: format === 'teamCustom' ? Number(teamSize) : null,
        hasAward,
        awardDesc: awardDesc.trim(),
        round: Number(round) || nextRound,
        description: description.trim(),
        status: 'open',
        participants: [],
        groups: [],
        results: [],
        awards: [],
        createdBy: myName,
        createdAt: new Date().toISOString(),
      });

      alert('대회가 생성되었습니다! 🏆');
      router.push(`/tournament/${docRef.id}`);
    } catch (err) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <h1 className="text-xl font-black text-gray-800">대회 만들기</h1>
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

          {/* 회차 + 대회명 */}
          <div className="flex gap-2">
            <div className="w-24">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">회차</label>
              <input type="number" inputMode="numeric" value={round}
                onChange={e => setRound(e.target.value)} placeholder="7"
                className="w-full p-3 bg-gray-50 rounded-xl text-center font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">대회명</label>
              <input type="text" value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: WDG 스크린골프 대회"
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
                  <p className="text-xs text-gray-400 mb-1">{group.group}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(opt => (
                      <button key={opt.value} onClick={() => setFormat(opt.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold ${
                          format === opt.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* 직접설정 팀 인원 */}
            {format === 'teamCustom' && (
              <div className="mt-3">
                <label className="text-xs font-bold text-gray-400 block mb-1.5">팀당 인원 수</label>
                <input type="number" inputMode="numeric" value={teamSize}
                  onChange={e => setTeamSize(e.target.value)}
                  placeholder="예: 6"
                  className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
            )}
          </div>
        </div>

        {/* 일정 / 장소 */}
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
              placeholder="예: 골프존파크 장안온천점"
              className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
        </div>

        {/* 참가비 / 인원 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700">참가비 · 인원</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">참가비 (원)</label>
              <input type="number" inputMode="numeric" value={entryFee}
                onChange={e => setEntryFee(e.target.value)}
                placeholder="35000"
                className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-400 block mb-1.5">최대 인원</label>
              <input type="number" inputMode="numeric" value={maxPlayers}
                onChange={e => setMaxPlayers(e.target.value)}
                placeholder="44"
                className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>
        </div>

        {/* 시상 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="font-black text-gray-700">시상 설정</p>
            <button onClick={() => setHasAward(!hasAward)}
              className={`w-12 h-6 rounded-full transition-all ${hasAward ? 'bg-green-500' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${hasAward ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          {hasAward && (
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1.5">시상 내용 (간단히)</label>
              <textarea value={awardDesc} onChange={e => setAwardDesc(e.target.value)}
                placeholder="예: 1위 상금 10만원, 니어리스트 1만원 등"
                rows={3}
                className="w-full p-3 bg-gray-50 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-green-500 outline-none resize-none" />
            </div>
          )}
        </div>

        {/* 대회 설명 */}
        <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm border border-gray-100">
          <p className="font-black text-gray-700">대회 설명 (선택)</p>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="대회 안내 사항을 입력하세요"
            rows={4}
            className="w-full p-3 bg-gray-50 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-green-500 outline-none resize-none" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className={`w-full py-4 rounded-2xl font-bold text-white text-base ${saving ? 'bg-gray-400' : 'bg-green-600 shadow-lg shadow-green-200 active:scale-95 transition-all'}`}>
          {saving ? '저장중...' : '🏆 대회 만들기'}
        </button>
      </div>
    </div>
  );
}