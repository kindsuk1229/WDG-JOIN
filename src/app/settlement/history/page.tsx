'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { shareToKakao } from '@/lib/kakao';

// ✅ 데이터 타입 정의
interface Settlement {
  id: string;
  userName: string;
  totalAmount: number;
  perPerson: number;
  memo: string;
  status: 'pending' | 'completed';
  createdAt: any;
}

export default function SettlementHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const rawName = localStorage.getItem('user_name') || '회원';
      const savedName = rawName.trim();
      
      // ✅ 쿼리 실행
      const q = query(
        collection(db, "settlements"),
        where("userName", "==", savedName),
        orderBy("createdAt", "desc") // 👈 이 부분 때문에 인덱스 생성이 필요합니다.
      );
      
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement));
      setHistory(docs);
    } catch (error: any) {
      console.error("데이터 로딩 에러:", error);
      
      // ✅ 인덱스 에러 발생 시 알림 (F12 콘솔창 확인 유도)
      if (error.message.includes("index")) {
        alert("데이터 정렬을 위한 색인(Index) 설정이 필요합니다. 개발자 도구(F12)의 링크를 클릭해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // ✅ 정산 완료 처리
  const handleComplete = async (id: string) => {
    if (!confirm('정산이 완료되었나요? 완료 시 "받아야 할 금액"에서 제외됩니다.')) return;
    try {
      await updateDoc(doc(db, "settlements", id), { status: 'completed' });
      alert('정산 완료 처리되었습니다.');
      fetchHistory(); 
    } catch (e) {
      alert('상태 업데이트에 실패했습니다.');
    }
  };

  // ✅ 카톡 다시 공유
  const reShare = (item: Settlement) => {
    const title = '⛳ WDG 라운딩 정산 재요청';
    const description = `내용: ${item.memo}\n1인당: ${item.perPerson.toLocaleString()}원\n아직 입금 전이신 분들은 확인 부탁드려요!`;
    // 공유 시 현재 history 주소를 떼고 보냄
    shareToKakao(window.location.origin + '/settlement', title, description);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900 font-sans">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push('/mypage')} className="p-2 text-gray-600 font-bold text-lg">〈</button>
        <h1 className="font-bold text-lg text-green-800">정산 히스토리</h1>
        <button 
          onClick={() => router.push('/settlement')} 
          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
        >
          새 정산
        </button>
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">내역을 불러오는 중...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 text-gray-400">기록된 정산 내역이 없습니다.</div>
        ) : (
          history.map((item) => (
            <div key={item.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${item.status === 'completed' ? 'border-gray-100 opacity-60' : 'border-green-100'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-extrabold text-gray-800 text-base">{item.memo}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {/* ✅ createdAt이 null일 경우를 대비한 안전장치 */}
                    {item.createdAt ? item.createdAt.toDate().toLocaleDateString() : '방금 전'}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                  item.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {item.status === 'pending' ? '미정산' : '정산 완료'}
                </span>
              </div>
              
              <div className="flex justify-between items-end border-t pt-4 mt-2">
                <div>
                  <p className="text-[10px] text-gray-400">총 정산액</p>
                  <p className="text-xl font-black text-gray-800">{item.totalAmount.toLocaleString()}원</p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => reShare(item)}
                    className="text-[12px] bg-yellow-50 px-3 py-2 rounded-xl text-yellow-700 font-bold border border-yellow-100"
                  >
                    다시 공유
                  </button>
                  {item.status === 'pending' && (
                    <button 
                      onClick={() => handleComplete(item.id)}
                      className="text-[12px] bg-green-600 px-3 py-2 rounded-xl text-white font-bold"
                    >
                      완료 처리
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}