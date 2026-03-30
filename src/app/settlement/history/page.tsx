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

interface SettlementMember {
  id: string;
  settlementId: string;
  fromName: string;
  fromNickname: string;
  toName: string;
  toNickname: string;
  amount: number;
  memo: string;
  accountNumber?: string;
  status: 'pending' | 'completed';
  createdAt: any;
}

export default function SettlementHistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'send' | 'receive'>('receive');
  const [history, setHistory] = useState<Settlement[]>([]);
  const [myBills, setMyBills] = useState<SettlementMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    const nickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(name);
    setMyNickname(nickname);
    fetchAll(name);
  }, []);

  const fetchAll = async (name: string) => {
    try {
      setLoading(true);

      // 내가 만든 정산 (받아야 할 돈)
      const q1 = query(
        collection(db, "settlements"),
        where("userName", "==", name),
        orderBy("createdAt", "desc")
      );
      const snap1 = await getDocs(q1);
      const settlements = snap1.docs.map(d => ({
        id: d.id,
        ...d.data(),
        paidMembers: d.data().paidMembers || []
      } as Settlement));
      setHistory(settlements);

      // 내가 내야 할 돈 (settlement_members)
      const q2 = query(
        collection(db, "settlement_members"),
        where("fromName", "==", name),
        orderBy("createdAt", "desc")
      );
      const snap2 = await getDocs(q2);
      const bills = snap2.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as SettlementMember));
      setMyBills(bills);

    } catch (error: any) {
      console.error("로딩 에러:", error);
      if (error.message?.includes("index")) {
        alert("색인 설정이 필요합니다. F12 콘솔의 링크를 클릭해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 내역을 삭제할까요?')) return;
    await deleteDoc(doc(db, "settlements", id));
    fetchAll(myName);
  };

  const togglePaid = async (item: Settlement, memberName: string) => {
    let newPaidMembers = [...(item.paidMembers || [])];
    if (newPaidMembers.includes(memberName)) {
      newPaidMembers = newPaidMembers.filter(m => m !== memberName);
    } else {
      newPaidMembers.push(memberName);
    }
    await updateDoc(doc(db, "settlements", item.id), { paidMembers: newPaidMembers });
    fetchAll(myName);
  };

  const handleComplete = async (id: string) => {
    if (processing) return;
    if (!confirm('완료 처리하시겠습니까?')) return;
    setProcessing(id);
    try {
      await updateDoc(doc(db, "settlements", id), { status: 'completed' });
      fetchAll(myName);
    } finally {
      setProcessing(null);
    }
  };

  // 내가 내야 할 돈 완료 처리
  const handleMyBillComplete = async (id: string) => {
    if (processing) return;
    if (!confirm('입금 완료 처리하시겠습니까?')) return;
    setProcessing(id);
    try {
      await updateDoc(doc(db, "settlement_members", id), { status: 'completed' });
      fetchAll(myName);
    } finally {
      setProcessing(null);
    }
  };

  const reShare = (item: Settlement) => {
    const accountLine = item.accountNumber
      ? `\n💳 계좌: ${item.accountNumber} (${myNickname || myName})`
      : '';
    const unpaid = (item.members || []).filter(m =>
      m.name !== myName && !(item.paidMembers || []).includes(m.name)
    );
    const memberLines = unpaid.length > 0
      ? '\n\n⚠️ 미입금자:\n' + unpaid.map(m => `• ${m.nickname || m.name}: ${m.amount.toLocaleString()}원`).join('\n')
      : '';

    shareToKakao(
      window.location.origin + '/settlement',
      '⛳ WDG 라운딩 정산 재요청',
      `📋 ${item.memo}\n💰 총 ${item.totalAmount.toLocaleString()}원${memberLines}${accountLine}\n\n입금 부탁드립니다! 🙏`
    );
  };

  const getReceivableAmount = (item: Settlement) => {
    if (item.members && item.members.length > 0) {
      return item.members.filter(m => m.name !== myName).reduce((sum, m) => sum + m.amount, 0);
    }
    return item.totalAmount - item.perPerson;
  };

  const pendingBillsTotal = myBills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => router.push('/mypage')} className="p-2 text-gray-600 font-bold text-lg">〈</button>
          <h1 className="font-bold text-lg text-green-800">정산 내역</h1>
          <button onClick={() => router.push('/settlement')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-base font-bold">새 정산</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('receive')}
            className={`flex-1 py-2 rounded-xl text-base font-bold transition-all ${tab === 'receive' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            받아야 할 돈
          </button>
          <button
            onClick={() => setTab('send')}
            className={`flex-1 py-2 rounded-xl text-base font-bold transition-all ${tab === 'send' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            내야 할 돈 {pendingBillsTotal > 0 && `(${pendingBillsTotal.toLocaleString()}원)`}
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : tab === 'receive' ? (
          // ✅ 받아야 할 돈 탭
          history.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400">정산 내역이 없어요.</p>
            </div>
          ) : history.map((item) => (
            <div key={item.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${item.status === 'completed' ? 'opacity-50' : 'border-green-100'}`}>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg text-gray-800">{item.memo}</h3>
                    <p className="text-[16px] text-gray-400 mt-1">
                      {item.createdAt ? item.createdAt.toDate().toLocaleString() : '방금 전'}
                    </p>
                    {item.accountNumber && <p className="text-[17px] text-gray-500 mt-1">💳 {item.accountNumber}</p>}
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 text-base font-bold p-1">삭제</button>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                  <p className="text-[17px] font-black text-gray-400 mb-3 uppercase tracking-wider">
                    입금 확인 ({(item.paidMembers || []).length}/{(item.members || []).filter(m => m.name !== myName).length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.members && item.members.length > 0 ? (
                      item.members.filter(m => m.name !== myName).map((m, i) => {
                        const isPaid = (item.paidMembers || []).includes(m.name);
                        return (
                          <button key={i} onClick={() => togglePaid(item, m.name)}
                            className={`px-3 py-2 rounded-xl text-[17px] font-black transition-all ${isPaid ? 'bg-green-600 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}>
                            {m.nickname || m.name}
                            <span className="ml-1 opacity-70">{m.amount.toLocaleString()}원</span>
                          </button>
                        );
                      })
                    ) : (
                      Array.from({ length: item.playerCount }).map((_, i) => (
                        <button key={i} onClick={() => togglePaid(item, `member_${i}`)}
                          className={`px-3 py-2 rounded-xl text-[17px] font-black transition-all ${(item.paidMembers || []).includes(`member_${i}`) ? 'bg-green-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
                          {i === 0 ? '나(결제)' : `${i + 1}번 멤버`}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-dashed pt-4">
                  <div>
                    <p className="text-[16px] text-gray-500 font-bold">받아야 할 금액</p>
                    <p className="text-xl font-black text-green-700">{getReceivableAmount(item).toLocaleString()}원</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => reShare(item)} className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded-xl text-[17px] font-black border border-yellow-100">재공유</button>
                    {item.status === 'pending' && (
                      <button onClick={() => handleComplete(item.id)} disabled={!!processing} className={`px-3 py-2 rounded-xl text-[17px] font-black ${processing ? 'bg-gray-300 text-gray-400' : 'bg-gray-900 text-white'}`}>{processing === item.id ? '처리중' : '완료'}</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          // ✅ 내야 할 돈 탭
          myBills.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400">내야 할 정산이 없어요! 😊</p>
            </div>
          ) : myBills.map((bill) => (
            <div key={bill.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${bill.status === 'completed' ? 'opacity-50 border-gray-100' : 'border-red-100'}`}>
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-black text-lg text-gray-800">{bill.memo}</h3>
                    <p className="text-[16px] text-gray-400 mt-1">
                      {bill.createdAt ? bill.createdAt.toDate().toLocaleString() : '방금 전'}
                    </p>
                  </div>
                  <span className={`text-[17px] px-2 py-1 rounded-lg font-bold ${bill.status === 'completed' ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-500'}`}>
                    {bill.status === 'completed' ? '완료' : '미납'}
                  </span>
                </div>

                <div className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100">
                  <p className="text-[17px] text-red-400 font-bold mb-1">보내야 할 곳</p>
                  <p className="font-black text-gray-800">{bill.toNickname || bill.toName}</p>
                  {bill.accountNumber && (
                    <p className="text-base text-gray-600 mt-1 font-medium">💳 {bill.accountNumber}</p>
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-dashed pt-4">
                  <div>
                    <p className="text-[16px] text-gray-500 font-bold">내야 할 금액</p>
                    <p className="text-xl font-black text-red-500">{bill.amount.toLocaleString()}원</p>
                  </div>
                  {bill.status === 'pending' && (
                    <button
                      onClick={() => handleMyBillComplete(bill.id)}
                      disabled={!!processing}
                      className={`px-4 py-2 rounded-xl text-base font-black ${processing ? 'bg-gray-300 text-gray-400' : 'bg-green-600 text-white'}`}
                    >
                      {processing === bill.id ? '처리중...' : '입금 완료'}
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