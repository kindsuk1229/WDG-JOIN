'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { shareToKakao } from '@/lib/kakao';

interface MemberItem {
  name: string;
  nickname: string;
  amount: number;
}

interface Settlement {
  id: string;
  userName: string;
  totalAmount: number;
  perPerson: number;
  memo: string;
  status: 'pending' | 'completed';
  playerCount: number;
  members?: MemberItem[];
  paidMembers?: string[];
  accountNumber?: string;
  createdAt: any;
}

export default function SettlementHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');

  useEffect(() => {
    setMyName((localStorage.getItem('user_name') || '').trim());
    setMyNickname((localStorage.getItem('user_nickname') || '').trim());
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const rawName = (localStorage.getItem('user_name') || '').trim();
      const q = query(
        collection(db, "settlements"),
        where("userName", "==", rawName),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        paidMembers: d.data().paidMembers || []
      } as Settlement));
      setHistory(docs);
    } catch (error: any) {
      console.error("로딩 에러:", error);
      if (error.message?.includes("index")) {
        alert("데이터 정렬을 위한 색인 설정이 필요합니다. F12 콘솔의 링크를 클릭해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 내역을 삭제할까요?')) return;
    await deleteDoc(doc(db, "settlements", id));
    fetchHistory();
  };

  // ✅ 멤버 이름 기준으로 입금 토글
  const togglePaid = async (item: Settlement, memberName: string) => {
    let newPaidMembers = [...(item.paidMembers || [])];
    if (newPaidMembers.includes(memberName)) {
      newPaidMembers = newPaidMembers.filter(m => m !== memberName);
    } else {
      newPaidMembers.push(memberName);
    }
    await updateDoc(doc(db, "settlements", item.id), { paidMembers: newPaidMembers });
    fetchHistory();
  };

  const handleComplete = async (id: string) => {
    if (!confirm('모든 인원이 입금했나요? 완료 처리됩니다.')) return;
    await updateDoc(doc(db, "settlements", id), { status: 'completed' });
    fetchHistory();
  };

  // ✅ 재공유 시 이름+금액 포함
  const reShare = (item: Settlement) => {
    const accountLine = item.accountNumber
      ? `\n💳 계좌: ${item.accountNumber} (${myNickname || myName})`
      : '';

    let memberLines = '';
    if (item.members && item.members.length > 0) {
      // 미입금자만 표시
      const unpaid = item.members.filter(m =>
        m.name !== myName && !(item.paidMembers || []).includes(m.name)
      );
      if (unpaid.length > 0) {
        memberLines = '\n\n⚠️ 미입금자:\n' + unpaid
          .map(m => `• ${m.nickname || m.name}: ${m.amount.toLocaleString()}원`)
          .join('\n');
      }
    } else {
      memberLines = `\n1인당: ${item.perPerson.toLocaleString()}원`;
    }

    const title = '⛳ WDG 라운딩 정산 재요청';
    const description = `📋 ${item.memo}\n💰 총 ${item.totalAmount.toLocaleString()}원${memberLines}${accountLine}\n\n입금 부탁드립니다! 🙏`;
    shareToKakao(window.location.origin + '/settlement', title, description);
  };

  // 받아야 할 금액 계산
  const getReceivableAmount = (item: Settlement) => {
    if (item.members && item.members.length > 0) {
      return item.members
        .filter(m => m.name !== myName)
        .reduce((sum, m) => sum + m.amount, 0);
    }
    return item.totalAmount - item.perPerson;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.push('/mypage')} className="p-2 text-gray-600 font-bold text-lg">〈</button>
        <h1 className="font-bold text-lg text-green-800">정산 내역</h1>
        <button onClick={() => router.push('/settlement')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">새 정산</button>
      </header>

      <div className="p-4 space-y-5">
        {loading ? (
          <div className="text-center py-20 text-gray-400">내역 로딩 중...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400">정산 내역이 없어요.</p>
          </div>
        ) : history.map((item) => (
          <div key={item.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${
            item.status === 'completed' ? 'opacity-50' : 'border-green-100'
          }`}>
            <div className="p-5">
              {/* 헤더 */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg text-gray-800">{item.memo}</h3>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {item.createdAt ? item.createdAt.toDate().toLocaleString() : '방금 전'}
                  </p>
                  {item.accountNumber && (
                    <p className="text-[11px] text-gray-500 mt-1">💳 {item.accountNumber}</p>
                  )}
                </div>
                <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 text-xs font-bold p-1">삭제</button>
              </div>

              {/* ✅ 멤버별 입금 확인 */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                <p className="text-[11px] font-black text-gray-400 mb-3 uppercase tracking-wider">
                  입금 확인 ({(item.paidMembers || []).length}/{item.members ? item.members.length - 1 : item.playerCount - 1})
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.members && item.members.length > 0 ? (
                    // ✅ 새 방식: 실제 멤버 이름으로 표시
                    item.members
                      .filter(m => m.name !== myName) // 본인 제외
                      .map((m, i) => {
                        const isPaid = (item.paidMembers || []).includes(m.name);
                        return (
                          <button
                            key={i}
                            onClick={() => togglePaid(item, m.name)}
                            className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${
                              isPaid
                                ? 'bg-green-600 text-white shadow-md'
                                : 'bg-white text-gray-400 border border-gray-200'
                            }`}
                          >
                            {m.nickname || m.name}
                            <span className="ml-1 opacity-70">{m.amount.toLocaleString()}원</span>
                          </button>
                        );
                      })
                  ) : (
                    // 구버전 데이터 호환
                    Array.from({ length: item.playerCount }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => togglePaid(item, `member_${i}`)}
                        className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${
                          (item.paidMembers || []).includes(`member_${i}`)
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-white text-gray-400 border border-gray-200'
                        }`}
                      >
                        {i === 0 ? '나(결제)' : `${i + 1}번 멤버`}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 받을 금액 + 버튼 */}
              <div className="flex justify-between items-end border-t border-dashed pt-4">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold">받아야 할 금액</p>
                  <p className="text-xl font-black text-green-700">
                    {getReceivableAmount(item).toLocaleString()}원
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => reShare(item)}
                    className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded-xl text-[11px] font-black border border-yellow-100"
                  >
                    재공유
                  </button>
                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="bg-gray-900 text-white px-3 py-2 rounded-xl text-[11px] font-black shadow-lg"
                    >
                      완료
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