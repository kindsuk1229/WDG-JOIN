'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tomorrow } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TIMES = ['05:30','06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00'];

export default function CreatePage() {
  const router = useRouter();
  const [course, setCourse] = useState('');
  const [date, setDate] = useState(tomorrow());
  const [tee, setTee] = useState('07:00');
  const [carts, setCarts] = useState(1);
  const [gf, setGf] = useState('180000');
  const [memo, setMemo] = useState('');

  const valid = course.trim().length > 0;

  const handleCreate = () => {
    if (!valid) return;
    // TODO: meetupService.create() 연동
    alert('벙개가 개설되었습니다!');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-white safe-top">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-5">
        <button onClick={() => router.back()} className="text-gray-400 text-[13px]">← 뒤로</button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-golf-600 flex items-center justify-center text-sm">⛳</div>
          <div>
            <h1 className="text-lg font-semibold">벙개 개설</h1>
            <p className="text-[11px] text-gray-400">우동골 · 새 벙개 만들기</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5 pb-10">
        {/* 골프장 */}
        <div>
          <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">골프장 이름</label>
          <input
            value={course} onChange={e => setCourse(e.target.value)}
            placeholder="예: 남서울CC, 블루원용인 등"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] bg-gray-50"
          />
        </div>

        {/* 날짜 + 시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-[14px] bg-gray-50" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">티오프 시간</label>
            <select value={tee} onChange={e => setTee(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-[14px] bg-gray-50 appearance-none">
              {TIMES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* 그린피 */}
        <div>
          <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">그린피 (1인)</label>
          <div className="flex items-center gap-2">
            <input type="number" value={gf} onChange={e => setGf(e.target.value)} step="10000"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-[15px] bg-gray-50" />
            <span className="text-[13px] text-gray-400">원</span>
          </div>
        </div>

        {/* 카트 수 */}
        <div>
          <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">
            카트 수 <span className="font-normal text-gray-400">(1카트 = 4명)</span>
          </label>
          <div className="flex items-center justify-center gap-5 py-3">
            <button onClick={() => setCarts(Math.max(1, carts - 1))}
              className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-xl text-gray-600">−</button>
            <div className="text-center min-w-[60px]">
              <div className="text-[36px] font-bold text-golf-600 leading-none">{carts}</div>
              <div className="text-[11px] text-gray-400 mt-1">카트 · {carts * 4}명</div>
            </div>
            <button onClick={() => setCarts(Math.min(20, carts + 1))}
              className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-xl text-gray-600">+</button>
          </div>
          <input type="range" min="1" max="20" value={carts} onChange={e => setCarts(+e.target.value)}
            className="w-full accent-golf-600" />
          {carts > 1 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Array.from({ length: carts }).map((_, i) => (
                <div key={i} className="w-8 h-5 rounded bg-golf-50 border border-golf-200 flex items-center justify-center text-[9px] text-golf-600 font-medium">{i + 1}</div>
              ))}
            </div>
          )}
        </div>

        {/* 메모 */}
        <div>
          <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block">
            한줄 메모 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          <input value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="초보 환영, 식사 포함, 카트비 별도 등"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] bg-gray-50" />
        </div>

        {/* Submit */}
        <button onClick={handleCreate} disabled={!valid}
          className={cn(
            'w-full py-3.5 rounded-xl text-[15px] font-semibold transition-all',
            valid ? 'bg-golf-600 text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}>
          개설하기
        </button>
      </div>
    </div>
  );
}
