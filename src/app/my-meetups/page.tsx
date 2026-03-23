'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function MyMeetupsPage() {
  const [myMeetups, setMyMeetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMyMeetups = async () => {
      // 지금은 테스트용 아이디(admin_test)로 만든 벙개만 가져옵니다.
      const q = query(collection(db, "meetups"), where("creatorId", "==", "admin_test"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyMeetups(data);
      setLoading(false);
    };
    fetchMyMeetups();
  }, []);

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen">
      <header className="p-4 bg-white border-b flex items-center">
        <button onClick={() => router.back()} className="mr-4 text-xl">←</button>
        <h1 className="text-xl font-bold">내 벙개 내역</h1>
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-center py-10">불러오는 중...</p>
        ) : myMeetups.length === 0 ? (
          <p className="text-center py-10 text-gray-500">내가 만든 벙개가 없습니다.</p>
        ) : (
          myMeetups.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg">{item.title}</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">진행중</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">{item.date}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}