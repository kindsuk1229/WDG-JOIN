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
  paidMembers?: string[]; 
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
      if (error.message.includes("index")) {
        alert("데이터 정렬을 위한 색인 설정이 필요합니다. F12 콘솔의 링크를 클릭해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 내역을 삭제할까요? 마이페이지 합계에서도 제외됩니다.')) return;
    await deleteDoc(doc(db, "settlements", id));
    fetchHistory();
  };

  const togglePaid = async (item: Settlement, index: number) => {
    const memberId = `member_${index}`;
    let newPaidMembers = [...(item.paidMembers || [])];
    if (newPaidMembers.includes(memberId)) {
      newPaidMembers = newPaidMembers.filter(m => m !== memberId);
    } else {
      newPaidMembers.push(memberId);
    }
    await updateDoc(doc(db, "settlements", item.id), { paidMembers: newPaidMembers });
    fetchHistory();
  };

  const handleComplete = async (id: string) => {
    if (!confirm('모든 인원이 입금했나요? 완료 시 리스트가 흐려지며 합계에서 제외됩니다.')) return;
    await updateDoc(doc(db, "settlements", id), { status: 'completed' });
    fetchHistory();
  };

  const reShare = (item: Settlement) => {
    const title = '⛳ WDG 라운딩 정산 재요청';
    const description = `내용: ${item.memo}\n1인당: ${item.perPerson.toLocaleString()}원\n미입금하신 분들은 확인 부탁드려요!`;
    shareToKakao(window.location.origin + '/settlement', title, description);
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
          <div className="text-center py-20 text-gray-400">내역 로딩 중...</div>
        ) : history.map((item) => (
          <div key={item.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${item.status === 'completed' ? 'opacity-50' : 'border-green-100'}`}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg text-gray-800">{item.memo}</h3>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {item.createdAt ? item.createdAt.toDate().toLocaleString() : '방금 전'}
                  </p>
                </div>
                <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 text-xs font-bold p-1">삭제</button>
              </div>

              {/* 👥 입금 명단 체크 섹션 */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
                <p className="text-[11px] font-black text-gray-400 mb-3 uppercase tracking-wider">입금 확인 ({item.paidMembers?.length}/{item.playerCount})</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: item.playerCount }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => togglePaid(item, i)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${
                        item.paidMembers?.includes(`member_${i}`)
                          ? 'bg-green-600 text-white shadow-md border-green-600'
                          : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      {i === 0 ? '나(결제)' : `${i + 1}번 멤버`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-dashed pt-4">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold">받을 금액 (나 제외)</p>
                  {/* ✅ (전체 - 1인분) 금액 표시 */}
                  <p className="text-xl font-black text-green-700">
                    {(item.totalAmount - item.perPerson).toLocaleString()}원
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => reShare(item)} className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded-xl text-[11px] font-black border border-yellow-100">재공유</button>
                  {item.status === 'pending' && (
                    <button onClick={() => handleComplete(item.id)} className="bg-gray-900 text-white px-3 py-2 rounded-xl text-[11px] font-black shadow-lg">전체 완료</button>
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