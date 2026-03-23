'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { shareToKakao } from '@/lib/kakao';

interface Settlement {
  id: string;
  userName: string;
  totalAmount: number;
  perPerson: number;
  memo: string;
  status: 'pending' | 'completed';
  playerCount: number;
  paidMembers?: string[]; // 입금 완료한 사람 명단 (아이디 또는 순번)
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

      const q = query(
        collection(db, "settlements"),
        where("userName", "==", savedName),
        orderBy("createdAt", "desc")
      );
      
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        paidMembers: doc.data().paidMembers || [] 
      } as Settlement));
      setHistory(docs);
    } catch (error: any) {
      console.error("로딩 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // ✅ 1. 정산 내역 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 정산 내역을 완전히 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, "settlements", id));
      alert('삭제되었습니다.');
      fetchHistory();
    } catch (e) {
      alert('삭제에 실패했습니다.');
    }
  };

  // ✅ 2. 입금자 체크 (명단 관리)
  const togglePaid = async (item: Settlement, index: number) => {
    const memberId = `member_${index}`;
    let newPaidMembers = [...(item.paidMembers || [])];

    if (newPaidMembers.includes(memberId)) {
      newPaidMembers = newPaidMembers.filter(m => m !== memberId);
    } else {
      newPaidMembers.push(memberId);
    }

    try {
      await updateDoc(doc(db, "settlements", item.id), {
        paidMembers: newPaidMembers
      });
      fetchHistory(); // 화면 갱신
    } catch (e) {
      alert('업데이트 실패');
    }
  };

  const handleComplete = async (id: string) => {
    if (!confirm('모든 인원이 입금 완료했나요? 완료 시 총액에서 제외됩니다.')) return;
    await updateDoc(doc(db, "settlements", id), { status: 'completed' });
    fetchHistory();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push('/mypage')} className="p-2 text-gray-600 font-bold text-lg">〈</button>
        <h1 className="font-bold text-lg text-green-800">정산 및 명단 관리</h1>
        <button onClick={() => router.push('/settlement')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">새 정산</button>
      </header>

      <div className="p-4 space-y-5">
        {loading ? (
          <div className="text-center py-20 text-gray-400">내역을 불러오는 중...</div>
        ) : history.map((item) => (
          <div key={item.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${item.status === 'completed' ? 'opacity-60' : 'border-green-100'}`}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg">{item.memo}</h3>
                  <p className="text-[11px] text-gray-400">{item.createdAt?.toDate().toLocaleString()}</p>
                </div>
                <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 text-sm">삭제</button>
              </div>

              {/* 👥 입금 명단 체크 섹션 */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-[11px] font-bold text-gray-400 mb-3">입금 확인 명단 ({item.paidMembers?.length}/{item.playerCount})</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: item.playerCount }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => togglePaid(item, i)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        item.paidMembers?.includes(`member_${i}`)
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      {i === 0 ? '나(결제)' : `${i + 1}번 멤버`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-end border-t pt-4">
                <div>
                  <p className="text-[10px] text-gray-400">1인당 금액</p>
                  <p className="text-xl font-black text-green-700">{item.perPerson.toLocaleString()}원</p>
                </div>
                <div className="flex gap-2">
                  {item.status === 'pending' && (
                    <button 
                      onClick={() => handleComplete(item.id)}
                      className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      전체 완료
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}