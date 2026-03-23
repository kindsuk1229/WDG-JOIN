'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shareToKakao } from '@/lib/kakao'; 
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

  // ✅ 개선된 저장 및 공유 함수
  const handleKakaoShare = async () => {
    if(totalAmount <= 0) return alert('금액을 입력해주세요!');
    
    try {
      // 1. 이름 매칭 오류 방지를 위해 trim() 적용
      const rawName = localStorage.getItem('user_name') || '회원';
      const savedName = rawName.trim(); 

      // 2. Firebase 'settlements' 컬렉션에 데이터 저장
      await addDoc(collection(db, "settlements"), {
        userName: savedName,        // 마이페이지 조회 키
        totalAmount: Number(totalAmount), // 확실하게 숫자 타입으로 저장
        memo: memo || '모임 비용',
        playerCount: Number(playerCount),
        perPerson: Number(perPerson),
        createdAt: serverTimestamp() 
      });

      // 3. 카카오톡 공유 실행
      const title = '⛳ WDG 라운딩 정산 요청';
      const description = `내용: ${memo || '모임 비용'}\n1인당: ${perPerson.toLocaleString()}원 입니다.\n입금 부탁드려요!`;
      
      shareToKakao(window.location.href, title, description);
      
      alert('정산 내역이 마이페이지에 기록되었습니다! ⛳');
      
    } catch (error) {
      console.error("정산 저장 에러:", error);
      alert('데이터 저장 중 오류가 발생했습니다.');
      
      // 저장 실패해도 공유는 시도
      shareToKakao(window.location.href, '⛳ WDG 라운딩 정산 요청', `1인당 ${perPerson.toLocaleString()}원`);
    }
  };

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl">←</button>
        <h1 className="text-xl font-bold text-green-700 font-sans">모임 비용 정산</h1>
      </header>

      <div className="p-5 space-y-6">
        {/* Result Card */}
        <div className="bg-slate-800 text-white p-7 rounded-3xl shadow-xl border-b-4 border-green-600">
          <p className="text-xs opacity-70 mb-1 font-bold tracking-tight">우리 멤버 1인당</p>
          <h2 className="text-4xl font-black text-green-400">
            {perPerson.toLocaleString()}원
          </h2>
          <div className="mt-5 pt-4 border-t border-gray-700 text-[11px] flex justify-between opacity-80">
            <span>총 지출: {totalAmount.toLocaleString()}원</span>
            <span>{playerCount}명 기준</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6 border border-gray-100">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 px-1">지출 내용</label>
            <input 
              type="text" 
              placeholder="예: 그늘집 및 저녁 식사" 
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 px-1">총 결제 금액 (원)</label>
            <input 
              type="number" 
              placeholder="0" 
              value={totalAmount === 0 ? '' : totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-xl font-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 px-1">나눌 인원 ({playerCount}명)</label>
            <select 
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 font-bold text-lg"
            >
              {personOptions.map((num) => (
                <option key={num} value={num}>
                  {num}명
                </option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={handleKakaoShare}
          className="w-full bg-[#FEE500] text-[#191919] p-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-3 border-b-4 border-yellow-600/30"
        >
          <span className="text-2xl">💬</span> 카톡으로 정산 공유
        </button>
        
        <p className="text-center text-[11px] text-gray-400 mt-2 font-medium">
          버튼 클릭 시 마이페이지 '총 정산'에 즉시 합산됩니다.
        </p>
      </div>
    </main>
  );
}