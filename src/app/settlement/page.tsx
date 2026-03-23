'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shareToKakao } from '@/lib/kakao'; // 공유 함수 불러오기

export default function SettlementPage() {
  const router = useRouter();
  
  const [totalAmount, setTotalAmount] = useState<number>(0); 
  const [playerCount, setPlayerCount] = useState<number>(4); 
  const [memo, setMemo] = useState<string>('');
  const [perPerson, setPerPerson] = useState<number>(0);

  useEffect(() => {
    if (totalAmount > 0 && playerCount > 0) {
      setPerPerson(Math.floor(totalAmount / playerCount));
    } else {
      setPerPerson(0);
    }
  }, [totalAmount, playerCount]);

  const personOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  // 카톡 공유 버튼 클릭 시 실행될 함수
  const handleKakaoShare = () => {
    if(totalAmount <= 0) return alert('금액을 입력해주세요!');
    
    const title = '⛳ WDG 라운딩 정산 요청';
    const description = `내용: ${memo || '모임 비용'}\n1인당: ${perPerson.toLocaleString()}원 입니다.\n입금 부탁드려요!`;
    
    shareToKakao(window.location.href, title, description);
  };

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-50">
        <button onClick={() => router.back()} className="mr-4 text-xl">←</button>
        <h1 className="text-xl font-bold text-green-700">모임 비용 정산</h1>
      </header>

      <div className="p-5 space-y-6">
        <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-lg">
          <p className="text-xs opacity-70 mb-1 font-bold">우리 멤버 1인당</p>
          <h2 className="text-3xl font-bold text-green-400">
            {perPerson.toLocaleString()}원
          </h2>
          <div className="mt-4 pt-4 border-t border-gray-700 text-xs flex justify-between opacity-80">
            <span>총 지출: {totalAmount.toLocaleString()}원</span>
            <span>{playerCount}명 기준</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">지출 내용</label>
            <input 
              type="text" 
              placeholder="예: 그늘집 및 저녁 식사" 
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">총 결제 금액 (원)</label>
            <input 
              type="number" 
              placeholder="0" 
              value={totalAmount === 0 ? '' : totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 text-lg font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">나눌 인원 ({playerCount}명)</label>
            <select 
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 font-bold text-lg"
            >
              {personOptions.map((num) => (
                <option key={num} value={num}>
                  {num}명
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 카카오톡 공유 버튼 */}
        <button 
          onClick={handleKakaoShare}
          className="w-full bg-[#FEE500] text-[#191919] p-5 rounded-2xl font-bold shadow-xl active:scale-95 transition-all text-lg flex items-center justify-center gap-2"
        >
          <span className="text-2xl">💬</span> 카톡으로 정산 공유
        </button>
      </div>
    </main>
  );
}