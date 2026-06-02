'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/UI';
import { fm, calculateTransfers, cn } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/types';

interface Exp { id: string; desc: string; amount: number; cat: string; payer: string; }

const MEMBERS = ['나', '김민준', '이서연', '박지호'];

export default function PayPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Exp[]>([
    { id: '1', desc: '점심 식사', amount: 120000, cat: 'meal', payer: '김민준' },
    { id: '2', desc: '카트비', amount: 80000, cat: 'cart', payer: '이서연' },
  ]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('meal');
  const [payer, setPayer] = useState('나');

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const perPerson = MEMBERS.length ? Math.round(total / MEMBERS.length) : 0;

  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  MEMBERS.forEach(n => { paid[n] = 0; owed[n] = 0; });
  expenses.forEach(e => {
    const share = Math.round(e.amount / MEMBERS.length);
    if (paid[e.payer] !== undefined) paid[e.payer] += e.amount;
    MEMBERS.forEach(n => { owed[n] += share; });
  });

  const transfers = calculateTransfers(
    MEMBERS,
    expenses.map(e => ({ payerName: e.payer, amount: e.amount }))
  );

  const addExpense = () => {
    if (!desc.trim() || !amount || +amount <= 0) return;
    setExpenses(p => [...p, { id: String(Date.now()), desc: desc.trim(), amount: +amount, cat, payer }]);
    setDesc(''); setAmount('');
  };

  const removeExpense = (id: string) => {
    setExpenses(p => p.filter(e => e.id !== id));
  };

  const catIcon = (key: string) => EXPENSE_CATEGORIES.find(c => c.key === key)?.icon || '📦';

  return (
    <div className="min-h-screen bg-white safe-top pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="text-gray-400 text-[13px]">← 뒤로</button>
        <h1 className="text-[16px] font-semibold">더치페이</h1>
      </div>

      <div className="px-4 mt-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: '총 비용', value: total > 0 ? `${fm(total)}원` : '—' },
            { label: '1인당', value: perPerson > 0 ? `${fm(perPerson)}원` : '—' },
            { label: '참가자', value: `${MEMBERS.length}명` },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className="text-[18px] font-semibold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Expense list */}
        {expenses.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[14px] font-semibold mb-2">비용 내역</h3>
            <div className="space-y-1.5">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 group">
                  <span className="text-lg w-8 text-center">{catIcon(e.cat)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{e.desc}</p>
                    <p className="text-[11px] text-gray-400">{e.payer} 결제 · 1인 {fm(Math.round(e.amount / MEMBERS.length))}원</p>
                  </div>
                  <p className="text-[15px] font-semibold shrink-0">{fm(e.amount)}원</p>
                  <button onClick={() => removeExpense(e.id)} className="text-gray-300 hover:text-red-400 text-[18px] leading-none shrink-0 ml-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add expense */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="text-[14px] font-semibold mb-3">비용 추가</h3>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {EXPENSE_CATEGORIES.map(c => (
              <button key={c.key}
                onClick={() => { setCat(c.key); if (!desc.trim()) setDesc(c.label); }}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] border transition-colors',
                  cat === c.key
                    ? 'bg-golf-50 border-golf-200 text-golf-700 font-semibold'
                    : 'bg-white border-gray-200 text-gray-500'
                )}>
                <span className="text-[13px]">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div className="flex gap-2 mb-2">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="항목명"
              className="flex-[2] border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] bg-white min-w-0" />
            <div className="flex-1 relative">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="금액"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] bg-white pr-7" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">원</span>
            </div>
          </div>

          {/* Payer */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3">
            {MEMBERS.map(n => (
              <button key={n} onClick={() => setPayer(n)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] shrink-0 transition-colors',
                  payer === n ? 'border-golf-200 bg-golf-50' : 'border-gray-200 bg-white'
                )}>
                <Avatar name={n} size={20} />{n}
              </button>
            ))}
          </div>

          <button onClick={addExpense}
            disabled={!desc.trim() || !amount || +amount <= 0}
            className={cn(
              'w-full py-3 rounded-xl text-[14px] font-semibold transition-all',
              desc.trim() && amount && +amount > 0
                ? 'bg-golf-600 text-white active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}>
            추가하기
          </button>
        </div>

        {/* Settlement result */}
        {total > 0 && (
          <>
            <h3 className="text-[14px] font-semibold mb-2">정산 요약</h3>
            <div className="space-y-1.5 mb-5">
              {MEMBERS.map(name => {
                const balance = (paid[name] || 0) - (owed[name] || 0);
                return (
                  <div key={name} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <Avatar name={name} size={34} />
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold">{name}</p>
                      <p className="text-[11px] text-gray-400">지불 {fm(paid[name]||0)}원 · 부담 {fm(owed[name]||0)}원</p>
                    </div>
                    <p className={cn(
                      'text-[16px] font-semibold min-w-[80px] text-right',
                      balance > 0 ? 'text-golf-600' : balance < 0 ? 'text-danger-600' : 'text-gray-400'
                    )}>
                      {balance > 0 ? '+' : ''}{fm(balance)}원
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Transfer instructions */}
            {transfers.length > 0 && (
              <div className="mb-5">
                <h3 className="text-[14px] font-semibold mb-2">송금 안내</h3>
                <div className="space-y-1.5">
                  {transfers.map((tr, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3.5">
                      <Avatar name={tr.from} size={30} />
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[14px] font-semibold">{tr.from}</span>
                        <svg width="20" height="12" viewBox="0 0 20 12" className="shrink-0">
                          <path d="M2 6h14M13 2l4 4-4 4" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-[14px] font-semibold">{tr.to}</span>
                      </div>
                      <Avatar name={tr.to} size={30} />
                      <p className="text-[16px] font-semibold text-golf-600 min-w-[70px] text-right">{fm(tr.amount)}원</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[12px] text-gray-400 text-center">+는 돌려받을 금액 · -는 보내야 할 금액</p>
          </>
        )}

        {total === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-3 opacity-40">💰</p>
            <p className="text-[14px] text-gray-400">비용을 추가하면 자동으로 정산됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
