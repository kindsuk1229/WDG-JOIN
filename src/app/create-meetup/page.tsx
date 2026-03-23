'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, updateDoc } from 'firebase/firestore';

// URL 파라미터를 읽기 위해 필요한 컴포넌트입니다.
function CreateMeetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('id'); // URL에 id가 있으면 수정 모드

  // 입력 필드 상태 관리
  const [title, setTitle] = useState('');
  const [golfCourse, setGolfCourse] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cartCount, setCartCount] = useState(1);
  const [loading, setLoading] = useState(false);

  // 1. 수정 모드일 때 기존 데이터 불러오기
  useEffect(() => {
    if (meetupId) {
      const fetchMeetup = async () => {
        const docRef = doc(db, 'meetups', meetupId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title);
          setGolfCourse(data.golfCourse);
          setDate(data.date);
          setTime(data.time);
          setCartCount(data.cartCount);
        }
      };
      fetchMeetup();
    }
  }, [meetupId]);

  const cartOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const meetupData = {
        title: title || 'WDG 벙개',
        golfCourse,
        date,
        time,
        cartCount,
        creatorId: 'admin_test', // 근석님 관리자 아이디 고정
        authorName: '김근석 사장님', // 작성자 이름 고정
        updatedAt: new Date().toISOString(),
      };

      if (meetupId) {
        // 수정 모드: 기존 문서 업데이트
        await updateDoc(doc(db, 'meetups', meetupId), meetupData);
        alert('⛳ 벙개가 성공적으로 수정되었습니다!');
      } else {
        // 생성 모드: 새 문서 추가
        await addDoc(collection(db, 'meetups'), {
          ...meetupData,
          createdAt: new Date().toISOString(),
          players: 1, // 방장 포함 1명 시작
        });
        alert('⛳ 새로운 벙개가 등록되었습니다!');
      }
      
      router.push('/my-meetups'); // 완료 후 내 내역으로 이동
    } catch (error) {
      console.error("에러 발생:", error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-700">
          {meetupId ? '벙개 정보 수정' : '새로운 벙개 만들기'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">벙개 제목</label>
            <input 
              type="text" 
              required
              placeholder="예: WDG 정기 라운딩" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">골프장 이름</label>
            <input 
              type="text" 
              required
              placeholder="예: 샤인데일 CC" 
              value={golfCourse}
              onChange={(e) => setGolfCourse(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">날짜</label>
              <input 
                type="date" 
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">티타임</label>
              <input 
                type="time" 
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">모집 규모</label>
            <div className="relative">
              <select 
                value={cartCount}
                onChange={(e) => setCartCount(Number(e.target.value))}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 font-bold text-lg appearance-none"
              >
                {cartOptions.map(num => (
                  <option key={num} value={num}>{num}카트 ({num * 4}명)</option>
                ))}
              </select>
              <div className="absolute right-4 top-4 pointer-events-none text-gray-400">▼</div>
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className={`w-full text-white p-5 rounded-2xl font-bold shadow-xl active:scale-95 transition-all text-lg ${loading ? 'bg-gray-400' : 'bg-green-600'}`}
        >
          {loading ? '처리 중...' : meetupId ? '수정 완료하기 ⛳' : '벙개 등록하기 ⛳'}
        </button>
      </form>
    </main>
  );
}

// Next.js에서 useSearchParams를 사용하려면 Suspense로 감싸줘야 빌드 에러가 안 납니다.
export default function CreateMeetupPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <CreateMeetupContent />
    </Suspense>
  );
}