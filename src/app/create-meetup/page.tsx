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
  const [time, setTime] = useState('');
  const [cartCount, setCartCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [creatorId, setCreatorId] = useState('');

  const myId = 'admin_test'; // 근석님 아이디

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
            setTime(data.time || '');
            setCartCount(data.cartCount || 1);
            setCreatorId(data.creatorId || '');
          }
        } catch (error) {
          console.error("데이터 불러오기 실패:", error);
        }
      };
      fetchMeetup();
    }
  }, [meetupId]);

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 벙개를 삭제하시겠습니까?')) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'meetups', meetupId!));
      alert('⛳ 벙개가 삭제되었습니다.');
      router.push('/my-meetups');
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
        creatorId: myId,
        authorName: '김근석 사장님',
        updatedAt: new Date().toISOString(),
      };

      if (meetupId) {
        await updateDoc(doc(db, 'meetups', meetupId), meetupData);
        alert('⛳ 벙개가 수정되었습니다!');
      } else {
        await addDoc(collection(db, 'meetups'), {
          ...meetupData,
          createdAt: new Date().toISOString(),
          players: 1,
        });
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
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20 text-gray-900">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <h1 className="text-xl font-bold text-green-700">
            {meetupId ? '벙개 정보 수정' : '새로운 벙개 만들기'}
          </h1>
        </div>
        
        {/* 본인이 올린 글일 때만 삭제 버튼 표시 */}
        {meetupId && creatorId === myId && (
          <button 
            type="button" 
            onClick={handleDelete}
            className="text-red-500 text-sm font-bold"
          >
            삭제
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">벙개 제목</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">골프장 이름</label>
            <input type="text" required value={golfCourse} onChange={(e) => setGolfCourse(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">날짜</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">티타임</label>
              <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">모집 규모</label>
            <select value={cartCount} onChange={(e) => setCartCount(Number(e.target.value))} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-lg">
              {[...Array(20)].map((_, i) => <option key={i+1} value={i+1}>{i+1}카트 ({ (i+1)*4 }명)</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className={`w-full text-white p-5 rounded-2xl font-bold shadow-xl ${loading ? 'bg-gray-400' : 'bg-green-600'}`}>
          {loading ? '처리 중...' : meetupId ? '수정 완료하기 ⛳' : '벙개 등록하기 ⛳'}
        </button>
      </form>
    </main>
  );
}

export default function CreateMeetupPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <CreateMeetupContent />
    </Suspense>
  );
}