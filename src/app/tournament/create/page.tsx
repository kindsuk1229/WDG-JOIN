'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

const OWNER_NAME = '김근석';

// ✅ 시상 항목 타입
interface AwardItem {
  id: string;
  rank: string;   // "1위", "니어리스트" 등
  winner: string; // 수상자 (생성 시 비워도 됨)
  prize: string;  // 상금/상품
}

// ✅ 시상 섹션 컴포넌트
function AwardSection({
  title,
  awards,
  setAwards,
  isSpecial = false,
}: {
  title: string;
  awards: AwardItem[];
  setAwards: React.Dispatch<React.SetStateAction<AwardItem[]>>;
  isSpecial?: boolean;
}) {
  const addRow = () => {
    const defaultRank = isSpecial ? '' : `${awards.length + 1}위`;
    setAwards(prev => [...prev, { id: Date.now().toString(), rank: defaultRank, winner: '', prize: '' }]);
  };

  const removeRow = (id: string) => {
    setAwards(prev => prev.filter(a => a.id !== id));
  };

  const updateRow = (id: string, field: keyof AwardItem, value: string) => {
    setAwards(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-black text-gray-600">{title}</p>
      {/* 헤더 */}
      {awards.length > 0 && (
        <div className="grid grid-cols-12 gap-1 px-1">
          <p className="col-span-3 text-xs text-gray-400 font-bold">순위/구분</p>
          <p className="col-span-4 text-xs text-gray-400 font-bold">수상자</p>
          <p className="col-span-4 text-xs text-gray-400 font-bold">상금/상품</p>
          <p className="col-span-1"></p>
        </div>
      )}
      {/* 행 목록 */}
      {awards.map(a => (
        <div key={a.id} className="grid grid-cols-12 gap-1 items-center">
          <input
            type="text"
            value={a.rank}
            onChange={e => updateRow(a.id, 'rank', e.target.value)}
            placeholder={isSpecial ? "니어리스트" : "1위"}
            className="col-span-3 p-2 bg-gray-50 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none text-center font-bold"
          />
          <input
            type="text"
            value={a.winner}
            onChange={e => updateRow(a.id, 'winner', e.target.value)}
            placeholder="수상자"
            className="col-span-4 p-2 bg-gray-50 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none"
          />
          <input
            type="text"
            value={a.prize}
            onChange={e => updateRow(a.id, 'prize', e.target.value)}
            placeholder="5만원"
            className="col-span-4 p-2 bg-gray-50 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none"
          />
          <button
            onClick={() => removeRow(a.id)}
            className="col-span-1 text-red-400 font-black text-base flex items-center justify-center h-9"
          >×</button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 font-bold active:bg-gray-50"
      >
        + 항목 추가
      </button>
    </div>
  );
}

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

// 개인전 포맷
const INDIVIDUAL_FORMATS = ['stroke', 'shinperio'];
// 팀전 포맷
const TEAM_FORMATS = ['team2', 'team4', 'teamCustom', 'teamPoint', 'matchplay', 'highlow'];

export default function TournamentCreatePage() {
  const router = useRouter();
  const [myName, setMyName] = useState('');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'screen' | 'field'>('screen');
  const [formats, setFormats] = useState<string[]>(['stroke']); // ✅ 복수 선택
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [teamSize, setTeamSize] = useState(''); // 직접설정 팀 인원
  const [hasAward, setHasAward] = useState(false);
  const [strokeAwards, setStrokeAwards] = useState<AwardItem[]>([
    { id: '1', rank: '1위', winner: '', prize: '' },
    { id: '2', rank: '2위', winner: '', prize: '' },
    { id: '3', rank: '3위', winner: '', prize: '' },
  ]);
  const [shinperioAwards, setShinperioAwards] = useState<AwardItem[]>([
    { id: '1', rank: '1위', winner: '', prize: '' },
    { id: '2', rank: '2위', winner: '', prize: '' },
    { id: '3', rank: '3위', winner: '', prize: '' },
  ]);
  const [teamAwards, setTeamAwards] = useState<AwardItem[]>([
    { id: '1', rank: '1위', winner: '', prize: '' },
    { id: '2', rank: '2위', winner: '', prize: '' },
  ]);
  const [specialAwards, setSpecialAwards] = useState<AwardItem[]>([]);
  const [round, setRound] = useState(''); // 회차
  const [description, setDescription] = useState('');
  const [nextRound, setNextRound] = useState(1);

  const toggleFormat = (value: string) => {
    setFormats(prev => {
      if (prev.includes(value)) {
        // 이미 선택된 거면 제거 (최소 1개는 유지)
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== value);
      }
      // 팀전끼리는 하나만 선택 (개인전과는 동시 선택 가능)
      if (TEAM_FORMATS.includes(value)) {
        return [...prev.filter(f => !TEAM_FORMATS.includes(f)), value];
      }
      // 개인전은 중복 선택 가능
      return [...prev, value];
    });
  };

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
    if (formats.length === 0) return alert('경기 방식을 선택해주세요.');

    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        title: title.trim(),
        type,
        format: formats.join('+'), // ✅ 복수면 'stroke+shinperio'
        formats,                    // ✅ 배열도 저장
        date,
        venue: venue.trim(),
        entryFee: Number(entryFee) || 0,
        maxPlayers: Number(maxPlayers),
        teamSize: formats.includes('teamCustom') ? Number(teamSize) : null,
        hasAward,
        awardDesc: '',
        awardsByCategory: {
          stroke: strokeAwards.filter(a => a.rank),
          shinperio: shinperioAwards.filter(a => a.rank),
          team: teamAwards.filter(a => a.rank),
          special: specialAwards.filter(a => a.rank),
        },
        awards: [
          ...strokeAwards.filter(a => a.rank).map(a => ({ ...a, category: 'stroke' })),
          ...shinperioAwards.filter(a => a.rank).map(a => ({ ...a, category: 'shinperio' })),
          ...teamAwards.filter(a => a.rank).map(a => ({ ...a, category: 'team' })),
          ...specialAwards.filter(a => a.rank).map(a => ({ ...a, category: 'special' })),
        ],
        round: Number(round) || nextRound,
        description: description.trim(),
        status: 'open',
        participants: [],
        groups: [],
        results: [],
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
                  <p className="text-xs text-gray-400 mb-1">
                    {group.group}
                    {group.group === '개인전' && <span className="ml-1 text-green-500">(중복 선택 가능)</span>}
                    {group.group === '팀전' && <span className="ml-1 text-blue-500">(개인전과 동시 선택 가능)</span>}
                    {group.group === '2:2' && <span className="ml-1 text-blue-500">(개인전과 동시 선택 가능)</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(opt => (
                      <button key={opt.value} onClick={() => toggleFormat(opt.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold ${
                          formats.includes(opt.value) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {formats.includes(opt.value) && INDIVIDUAL_FORMATS.includes(opt.value) ? '✅ ' : ''}{opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* 선택된 방식 표시 */}
            {formats.length > 0 && (
              <p className="text-xs text-green-600 mt-2 font-bold">
                선택됨: {formats.map(f => FORMAT_OPTIONS.flatMap(g => g.options).find(o => o.value === f)?.label).join(' + ')}
              </p>
            )}
            {/* 직접설정 팀 인원 */}
            {formats.includes('teamCustom') && (
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

        {/* 시상 설정 */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="font-black text-gray-700">시상 설정</p>
            <button onClick={() => setHasAward(!hasAward)}
              className={`w-12 h-6 rounded-full transition-all relative ${hasAward ? 'bg-green-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hasAward ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {hasAward && (
            <div className="space-y-3">
              {/* 스트로크 시상 */}
              {(formats.includes('stroke')) && (
                <AwardSection
                  title="🏌️ 스트로크 시상"
                  awards={strokeAwards}
                  setAwards={setStrokeAwards}
                />
              )}
              {/* 신페리오 시상 */}
              {formats.includes('shinperio') && (
                <AwardSection
                  title="📊 신페리오 시상"
                  awards={shinperioAwards}
                  setAwards={setShinperioAwards}
                />
              )}
              {/* 팀전 시상 */}
              {(formats.includes('team2') || formats.includes('team4') || formats.includes('teamCustom') || formats.includes('matchplay') || formats.includes('highlow')) && (
                <AwardSection
                  title="👥 팀전 시상"
                  awards={teamAwards}
                  setAwards={setTeamAwards}
                />
              )}
              {/* 특별상 */}
              <AwardSection
                title="⭐ 특별상"
                awards={specialAwards}
                setAwards={setSpecialAwards}
                isSpecial
              />
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