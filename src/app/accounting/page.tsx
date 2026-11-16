'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc,
} from 'firebase/firestore';
import { fm } from '@/lib/utils';

// 회계 수정 권한. 나머지 회원은 열람만 가능
const ACCOUNTING_MANAGERS = ['김근석', '양영빈'];

const INCOME_CATS = ['이월금', '찬조금', '기타 수입'];
const EXPENSE_CATS = ['스크린 게임비', '참가선물', '시상품·트로피', '식사·음료', '현수막·제작', '기타 지출'];

interface Settings { openingBalance: number; }
interface Entry {
  id: string; date: string; type: 'income' | 'expense';
  category: string; amount: number; memo: string; createdBy: string;
}

const DEFAULT_SETTINGS: Settings = { openingBalance: 9130 };

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function AccountingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [tab, setTab] = useState<'summary' | 'ledger'>('summary');

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [entries, setEntries] = useState<Entry[]>([]);

  // 입력 폼 상태
  const [draftSettings, setDraftSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [eType, setEType] = useState<'income' | 'expense'>('expense');
  const [eDate, setEDate] = useState(todayStr());
  const [eCat, setECat] = useState(EXPENSE_CATS[0]);
  const [eAmount, setEAmount] = useState('');
  const [eMemo, setEMemo] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = ACCOUNTING_MANAGERS.includes(myName);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    load();
  }, []);

  const load = async () => {
    try {
      const [sSnap, eSnap] = await Promise.all([
        getDoc(doc(db, 'accounting_settings', 'main')),
        getDocs(collection(db, 'ledger_entries')),
      ]);
      const s: Settings = sSnap.exists() ? { ...DEFAULT_SETTINGS, ...(sSnap.data() as Partial<Settings>) } : DEFAULT_SETTINGS;
      setSettings(s);
      setDraftSettings(s);

      const eList: Entry[] = eSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Entry, 'id'>) }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setEntries(eList);
    } catch (err) {
      console.error('회계 장부 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 집계
  const stats = useMemo(() => {
    const income = entries.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
    const balance = settings.openingBalance + income - expense;
    return { income, expense, balance };
  }, [entries, settings.openingBalance]);

  // ── 설정 ──
  const handleSaveSettings = async () => {
    const s: Settings = {
      openingBalance: Number(draftSettings.openingBalance) || 0,
    };
    setBusy(true);
    try {
      await setDoc(doc(db, 'accounting_settings', 'main'), s);
      setSettings(s);
      alert('저장했어요.');
    } catch { alert('저장하지 못했어요.'); } finally { setBusy(false); }
  };

  // ── 수입·지출 장부 ──
  const handleAddEntry = async () => {
    const amount = Number(eAmount);
    if (!amount || amount <= 0) return alert('금액을 입력해주세요.');
    if (!eDate) return alert('날짜를 입력해주세요.');
    setBusy(true);
    try {
      await addDoc(collection(db, 'ledger_entries'), {
        date: eDate, type: eType, category: eCat, amount, memo: eMemo.trim(),
        createdBy: myName, createdAt: new Date().toISOString(),
      });
      setEAmount(''); setEMemo('');
      await load();
    } catch { alert('저장하지 못했어요.'); } finally { setBusy(false); }
  };

  const handleDeleteEntry = async (e: Entry) => {
    if (!window.confirm(`${e.date} ${e.category} ${fm(e.amount)}원 기록을 삭제할까요?`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'ledger_entries', e.id));
      setEntries(prev => prev.filter(x => x.id !== e.id));
    } catch { alert('삭제하지 못했어요.'); } finally { setBusy(false); }
  };

  const changeType = (t: 'income' | 'expense') => {
    setEType(t);
    setECat(t === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]);
  };

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 pb-24">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <div>
          <h1 className="text-lg font-black text-gray-800">우동골 회계장부</h1>
          <p className="text-xs text-gray-400">{canEdit ? '총무 권한으로 수정할 수 있어요' : '모든 회원이 볼 수 있는 공개 장부예요'}</p>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          {([['summary', '요약'], ['ledger', '수입·지출']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold ${tab === k ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ───────── 요약 ───────── */}
        {tab === 'summary' && (
          <>
            <div className="bg-golf-800 text-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-golf-100 font-bold">현재 잔액</p>
              <p className="text-3xl font-black mt-1">{fm(stats.balance)}원</p>
              <p className="text-xs text-golf-100 mt-2">이월금 {fm(settings.openingBalance)}원 + 수입 − 지출</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '총 수입', v: stats.income, c: 'text-info-600' },
                { label: '총 지출', v: stats.expense, c: 'text-danger-600' },
              ].map(x => (
                <div key={x.label} className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
                  <p className="text-[11px] text-gray-400 font-bold">{x.label}</p>
                  <p className={`text-base font-black mt-1 ${x.c}`}>{fm(x.v)}</p>
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                <p className="font-black text-gray-800">장부 설정</p>
                <label className="block text-xs text-gray-400 font-bold">이월금 (원)
                  <input type="number" inputMode="numeric" value={draftSettings.openingBalance}
                    onChange={e => setDraftSettings({ ...draftSettings, openingBalance: Number(e.target.value) })}
                    className="mt-1 w-full p-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-golf-400" />
                </label>
                <button onClick={handleSaveSettings} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-golf-500 text-white text-sm font-bold disabled:bg-gray-300">설정 저장</button>
              </div>
            )}
          </>
        )}

        {/* ───────── 수입·지출 ───────── */}
        {tab === 'ledger' && (
          <>
            {canEdit && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex gap-2">
                  {(['expense', 'income'] as const).map(t => (
                    <button key={t} onClick={() => changeType(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold ${eType === t ? (t === 'income' ? 'bg-info-600 text-white' : 'bg-danger-600 text-white') : 'bg-gray-100 text-gray-500'}`}>
                      {t === 'income' ? '수입' : '지출'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
                    className="flex-1 min-w-0 p-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-golf-400" />
                  <select value={eCat} onChange={e => setECat(e.target.value)}
                    className="flex-1 min-w-0 p-2.5 bg-gray-50 rounded-xl text-sm outline-none">
                    {(eType === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <input type="number" inputMode="numeric" value={eAmount} onChange={e => setEAmount(e.target.value)} placeholder="금액(원)"
                  className="w-full p-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-golf-400" />
                <input value={eMemo} onChange={e => setEMemo(e.target.value)} placeholder="내용 (예: 8회 정라 참가선물)"
                  className="w-full p-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-golf-400" />
                <button onClick={handleAddEntry} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-golf-500 text-white text-sm font-bold disabled:bg-gray-300">기록 추가</button>
              </div>
            )}

            {entries.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-4xl mb-3">🧾</p>
                <p className="text-gray-400 text-sm">아직 기록이 없어요.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                {entries.map(e => (
                  <div key={e.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-bold">{e.date} · {e.category}</p>
                      <p className="text-sm text-gray-800 font-bold truncate">{e.memo || '-'}</p>
                    </div>
                    <p className={`text-base font-black whitespace-nowrap ${e.type === 'income' ? 'text-info-600' : 'text-danger-600'}`}>
                      {e.type === 'income' ? '+' : '−'}{fm(e.amount)}
                    </p>
                    {canEdit && (
                      <button onClick={() => handleDeleteEntry(e)} disabled={busy}
                        className="text-gray-300 text-lg font-bold px-1" aria-label="삭제">×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
