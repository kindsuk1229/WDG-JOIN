'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottmNav';

// 1. 데이터의 모양(Type)을 미리 알려줍니다.
interface MeetupData {
  id: string;
  title: string;
  date: string;
  creatorId: string;
  [key: string]: any; // 다른 데이터가 더 있어도 괜찮다는 뜻
}

export default function MyMeetupsPage() {
  const [myMeetups, setMyMeetups] = useState<MeetupData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMyMeetups = async () => {
      try {
        const q = query(collection(db, "meetups"), where("creatorId", "==", "admin_test"));
        const querySnapshot = await getDocs(q);
        
        // 2. 가져온 데이터를 MeetupData 형식으로 명확하게 지정합니다.
        const data = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as MeetupData[];
        
        // 3. 이제 'date'가 있다는 걸 알기 때문에 에러 없이 정렬됩니다.
        const sortedData = data.sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return b.date.localeCompare(a.date);
        });
        
        setMyMeetups(sortedData);
      } catch (error) {
        console.error("데이터 로딩 에러:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyMeetups();
  }, []);

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10">
        <button onClick={() => router.back()} className="mr-4 text-xl p-1 font-bold">←</button>
        <h1 className="text-xl font-bold">내 벙개 내역</h1>
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500">불러오는 중...</p>
          </div>
        ) : myMeetups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
            <p className="text-gray-400">내가 만든 벙개가 없습니다. ⛳</p>
          </div>
        ) : (
          myMeetups.map((item) => (
            <div 
              key={item.id} 
              onClick={() => router.push(`/create-meetup?id=${item.id}`)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-800">{item.title}</h3>
                <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold">
                  진행중
                </span>
              </div>
              
              <div className="flex items-center text-gray-500 text-sm gap-3">
                <span>📅 {item.date}</span>
                <span className="text-gray-200">|</span>
                <span className="text-blue-500 font-medium">상세 수정 〉</span>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav active="meetups" />
    </main>
  );
}