'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

function CreateMeetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('id');

  const [title, setTitle] = useState('');
  const [golfCourse, setGolfCourse] = useState('');
  const [date, setDate] = useState('');
  const [cartCount, setCartCount] = useState(1);
  const [cartTimes, setCartTimes] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [creatorId, setCreatorId] = useState('');

  const myId = 'admin_test'; // 김근석 사장님 계정

  useEffect(() => {
    if (meetupId) {
      const fetchMeetup = async () => {
        try {
          const docRef = doc(db, 'meetups', meetupId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.title || '');
            setGolfCourse(data.golfCourse || '');
            setDate(data.date || '');
            setCartCount(data.cartCount || 1);
            setCartTimes(data.cartTimes || Array(data.cartCount || 1).fill(''));
            setCreatorId(data.creatorId || '');
          }
        } catch (error) {
          console.error("데이터 불러오기 실패:", error);
        }
      };
      fetchMeetup();
    }
  }, [meetupId]);

  // 카트/시간 핸들러 로직 (동일)
  const handleCartCountChange = (count: number) => {
    setCartCount(count);
    const newTimes = Array(count).fill('').map((_, i) => cartTimes[i] || '');
    setCartTimes(newTimes);
  };

  const updateCartTime = (index: number, timeValue: string) => {
    const newTimes = [...cartTimes];
    newTimes[index] = timeValue;
    setCartTimes(newTimes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const meetupData = {
        title: title || 'WDG 벙개',
        golfCourse,
        date,
        cartCount,
        cartTimes,
        creatorId: myId,
        authorName: '김근석 사장님',
        updatedAt: new Date().toISOString(),
      };

      if (meetupId) {
        await updateDoc(doc(db, 'meetups', meetupId), meetupData);
        alert('⛳ 벙개가 수정되었습니다!');
      } else {
        await addDoc(collection(db, 'meetups'), { ...meetupData, createdAt: new Date().toISOString(), players: 1 });
        alert('⛳ 새로운 벙개가 등록되었습니다!');
      }
      router.push('/my-meetups');
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 1. 전체 컨테이너: 헤더와 버튼을 제외한 영역만 스크롤되도록 flex 구조 잡기 */
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      
      {/* 2. 상단 헤더: 고정 */}
      <header className="p-4 bg-white border-b flex justify-between items-center shrink-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <h1 className="text-xl font-bold text-green-700">
            {meetupId ? '벙개 정보 수정' : '새로운 벙개 만들기'}
          </h1>
        </div>
        {meetupId && creatorId === myId && (
          <button type="button" onClick={handleDelete} className="text-red-500 text-sm font-bold">삭제</button>
        )}
      </header>

      {/* 3. 입력 폼 영역: 여기가 핵심입니다. 
          flex-1과 overflow-y-auto를 주어 이 영역만 스크롤되게 합니다. 
          pb-32를 넉넉히 주어 마지막 입력칸이 하단 버튼에 가려지지 않게 합니다. */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 pb-40 custom-scrollbar">
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">벙개 제목</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: [WDG] 주말 정기 라운딩" className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-green-500 transition-all" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">골프장 이름</label>
            <input type="text" required value={golfCourse} onChange={(e) => setGolfCourse(e.target.value)} placeholder="예: 샤인데일 CC" className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-green-500 transition-all" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">날짜 선택</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-green-500 transition-all" />
          </div>

          <div className="border-t pt-6">
            <label className="text-xs font-bold text-gray-400 block mb-3 uppercase tracking-wide">모집 규모 및 조별 티타임</label>
            <select 
              value={cartCount} 
              onChange={(e) => handleCartCountChange(Number(e.target.value))} 
              className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-lg mb-4 focus:ring-2 focus:ring-green-500"
            >
              {[...Array(10)].map((_, i) => <option key={i+1} value={i+1}>{i+1}카트 ({ (i+1)*4 }명)</option>)}
            </select>

            <div className="grid grid-cols-1 gap-3">
              {cartTimes.map((time, index) => (
                <div key={index} className="flex items-center gap-3 bg-green-50/50 p-3 rounded-2xl border border-green-100">
                  <span className="text-[11px] font-black text-green-700 w-10 text-center">{index + 1}조</span>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => updateCartTime(index, e.target.value)}
                    className="bg-transparent border-none focus:ring-0 font-bold text-gray-800 flex-1 p-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>

      {/* 4. 하단 고정 완료 버튼: 
          BottomNav 바로 위에 항상 떠 있도록 고정(Fixed/Absolute) 시킵니다. */}
      <div className="fixed bottom-[80px] max-w-md w-full p-5 bg-white/90 backdrop-blur-md border-t z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <button 
          type="submit" 
          onClick={(e) => handleSubmit(e as any)}
          disabled={loading} 
          className={`w-full p-4 rounded-2xl font-black text-lg text-white shadow-xl transition-all active:scale-95 ${loading ? 'bg-gray-400' : 'bg-green-600 shadow-green-100 hover:bg-green-700'}`}
        >
          {loading ? '처리 중...' : meetupId ? '수정 완료하기 ⛳' : '벙개 등록하기 ⛳'}
        </button>
      </div>
    </div>
  );

      {/* 3. 등록 버튼 고정 (BottomNav 바로 위에 띄움) */}
      <div className="absolute bottom-4 left-0 right-0 px-5 z-30">
        <button 
          onClick={(e) => handleSubmit(e as any)}
          disabled={loading}
          className="w-full p-4 bg-green-600 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
        >
          {loading ? '처리 중...' : meetupId ? '수정 완료 ⛳' : '벙개 등록 완료 ⛳'}
        </button>
      </div>
    </div>
  );
}

export default function CreateMeetupPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-gray-400">로딩 중...</div>}>
      <CreateMeetupContent />
    </Suspense>
  );
}