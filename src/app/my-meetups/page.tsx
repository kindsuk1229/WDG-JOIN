'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
// ✅ BottomNav 임포트 제거 - layout.tsx에서 이미 렌더링됨

export default function MyMeetupsPage() {
  const [myMeetups, setMyMeetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMyMeetups = async () => {
      try {
        const q = query(collection(db, "meetups"), where("creatorId", "==", "admin_test"));
        const querySnapshot = await getDocs(q);
        const fetchedData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        fetchedData.sort((a, b) => {
          const dateA = a && a.date ? String(a.date) : "";
          const dateB = b && b.date ? String(b.date) : "";
          return dateB.localeCompare(dateA);
        });

        setMyMeetups(fetchedData);
      } catch (error) {
        console.error("데이터 로딩 에러:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyMeetups();
  }, []);

  return (
    // ✅ 수정: max-w-md, min-h-screen, pb-24 제거 (layout이 처리)
    // ✅ BottomNav 렌더링 제거
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10">
        <button onClick={() => router.back()} className="mr-4 text-xl p-1 font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">내 벙개 내역</h1>
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500">데이터를 불러오고 있습니다...</p>
          </div>
        ) : myMeetups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-400">내가 만든 벙개가 없네요. ⛳</p>
          </div>
        ) : (
          myMeetups.map((item: any) => (
            <div
              key={item.id}
              onClick={() => router.push(`/create-meetup?id=${item.id}`)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-800">{item.title || '제목 없음'}</h3>
                <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold">
                  진행중
                </span>
              </div>
              <div className="flex items-center text-gray-500 text-sm gap-3">
                <span>📅 {item.date || '날짜 미정'}</span>
                <span className="text-gray-200">|</span>
                <span className="text-blue-500 font-medium">상세 수정 〉</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}