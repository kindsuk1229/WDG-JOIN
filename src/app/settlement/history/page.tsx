'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function SettlementHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const savedName = localStorage.getItem('user_name') || '';
      const q = query(
        collection(db, "settlements"),
        where("userName", "==", savedName),
        orderBy("createdAt", "desc") // 최신순 정렬
      );
      
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(docs);
      setLoading(false);
    };
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0">
        <button onClick={() => router.back()}>〈</button>
        <h1 className="font-bold">정산 히스토리</h1>
        <button 
          onClick={() => router.push('/settlement')} 
          className="text-green-600 text-sm font-bold"
        >
          새 정산
        </button>
      </header>

      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-center py-10 text-gray-400">내역 불러오는 중...</p>
        ) : history.length === 0 ? (
          <p className="text-center py-10 text-gray-400">정산 내역이 없습니다.</p>
        ) : (
          history.map((item: any) => (
            <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800">{item.memo}</p>
                  <p className="text-[11px] text-gray-400">
                    {item.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                  item.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                }`}>
                  {item.status === 'pending' ? '미정산' : '완료'}
                </span>
              </div>
              <div className="flex justify-between items-end mt-4">
                <p className="text-lg font-bold">{item.totalAmount?.toLocaleString()}원</p>
                <button 
                  onClick={() => {/* 카톡 다시 공유 함수 호출 */}}
                  className="text-[12px] bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600"
                >
                  다시 공유
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}