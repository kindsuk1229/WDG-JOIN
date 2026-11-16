'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc, deleteField,
} from 'firebase/firestore';
import { fm } from '@/lib/utils';

// 회계 수정 권한 (대회 참가비 확인 담당과 동일). 나머지 회원은 열람만 가능
const ACCOUNTING_MANAGERS = ['김근석', '양영빈'];

const INCOME_CATS = ['이월금', '찬조금', '기타 수입'];
const EXPENSE_CATS = ['스크린 게임비', '참가선물', '시상품·트로피', '식사·음료', '현수막·제작', '기타 지출'];

interface Settings { monthlyDues: number; openingBalance: number; startMonth: string; }
interface Member { id: string; name: string; nickname: string; status: 'active' | 'rest' | 'left'; }
interface PaidInfo { amount: number; paidAt: string; by: string; }
type Payments = Record<string, Record<string, PaidInfo>>; // 회원id → 월 → 납부 정보
interface Entry {
  id: string; date: string; type: 'income' | 'expense';
  category: string; amount: number; memo: string; createdBy: string;
}

// 이월금 9,130원 = 8회 정라 준비금 사용내역 공지의 남은 금액
const DEFAULT_SETTINGS: Settings = { monthlyDues: 15000, openingBalance: 9130, startMonth: '2026-12' };
const STATUS_LABEL = { active: '정회원', rest: '휴회', left: '탈퇴' } as const;

// 문서 ID에는 '/'를 쓸 수 없어서 바꿔 쓴다
const memberId = (name: string) => name.replace(/\//g, '_');
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const addMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  return ym(new Date(y, mo - 1 + n, 1));
};
const todayStr = () => {
  const d = new Date();
  return `${ym(d)}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthLabel = (m: string) => `${Number(m.split('-')[1])}월`;

export default function AccountingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [tab, setTab] = useState<'summary' | 'dues' | 'ledger'>('summary');

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payments>({});
  const [entries, setEntries] = useState<Entry[]>([]);

  // 입력 폼 상태
  const [draftSettings, setDraftSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [newName, setNewName] = useState('');
  const [newNick, setNewNick] = useState('');
  const [eType, setEType] = useState<'income' | 'expense'>('expense');
  const [eDate, setEDate] = useState(todayStr());
  const [eCat, setECat] = useState(EXPENSE_CATS[0]);
  const [eAmount, setEAmount] = useState('');
  const [eMemo, setEMemo] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = ACCOUNTING_MANAGERS.includes(myName);
  const nowMonth = ym(new Date());

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    load();
  }, []);

  const load = async () => {
    try {
      const [sSnap, mSnap, pSnap, eSnap] = await Promise.all([
        getDoc(doc(db, 'accounting_settings', 'main')),
        getDocs(collection(db, 'dues_members')),
        getDocs(collection(db, 'dues_payments')),
        getDocs(collection(db, 'ledger_entries')),
      ]);
      const s: Settings = sSnap.exists() ? { ...DEFAULT_SETTINGS, ...(sSnap.data() as Partial<Settings>) } : DEFAULT_SETTINGS;
      setSettings(s);
      setDraftSettings(s);

      const mList: Member[] = mSnap.docs.map(d => {
        const x = d.data();
        return { id: d.id, name: x.name || d.id, nickname: x.nickname || x.name || d.id, status: x.status || 'active' };
      }).sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
      setMembers(mList);

      const pMap: Payments = {};
      pSnap.docs.forEach(d => { pMap[d.id] = (d.data().months || {}) as Record<string, PaidInfo>; });
      setPayments(pMap);

      const eList: Entry[] = eSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Entry, 'id'>) }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setEntries(eList);
    } catch (err) {
      console.error('회계 장부 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 화면에 보여줄 월 (시작월부터 이번 달까지, 최근 12개월)
  const months = useMemo(() => {
    const list: string[] = [];
    const end = settings.startMonth > nowMonth ? settings.startMonth : nowMonth;
    let m = settings.startMonth;
    while (m <= end && list.length < 120) { list.push(m); m = addMonth(m, 1); }
    return list.slice(-12);
  }, [settings.startMonth, nowMonth]);

  // 집계
  const stats = useMemo(() => {
    let duesTotal = 0;
    const perMonth: Record<string, { count: number; amount: number }> = {};
    Object.values(payments).forEach(byMonth => {
      Object.entries(byMonth).forEach(([m, p]) => {
        duesTotal += p.amount || 0;
        perMonth[m] = perMonth[m] || { count: 0, amount: 0 };
        perMonth[m].count += 1;
        perMonth[m].amount += p.amount || 0;
      });
    });
    const otherIncome = entries.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
    const balance = settings.openingBalance + duesTotal + otherIncome - expense;
    const active = members.filter(m => m.status === 'active');
    const unpaid = active.filter(m => !payments[m.id]?.[nowMonth]);
    return { duesTotal, perMonth, otherIncome, expense, balance, active, unpaid };
  }, [payments, entries, members, settings.openingBalance, nowMonth]);

  // ── 회비 납부 체크 ──
  const togglePaid = async (m: Member, month: string) => {
    if (!canEdit || busy) return;
    const paid = payments[m.id]?.[month];
    if (paid && !window.confirm(`${m.nickname}님의 ${month} 납부 기록을 취소할까요?`)) return;
    const info: PaidInfo = { amount: settings.monthlyDues, paidAt: new Date().toISOString(), by: myName };
    setBusy(true);
    try {
      await setDoc(doc(db, 'dues_payments', m.id), {
        name: m.name,
        months: { [month]: paid ? deleteField() : info },
      }, { merge: true });
      setPayments(prev => {
        const next: Payments = { ...prev, [m.id]: { ...(prev[m.id] || {}) } };
        if (paid) delete next[m.id][month]; else next[m.id][month] = info;
        return next;
      });
    } catch (err) {
      console.error(err);
      alert('저장하지 못했어요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  // ── 회원 관리 ──
  const saveMember = async (name: string, nickname: string, status: Member['status'] = 'active') => {
    const id = memberId(name);
    await setDoc(doc(db, 'dues_members', id), { name, nickname: nickname || name, status, createdAt: new Date().toISOString() }, { merge: true });
  };

  const handleAddMember = async () => {
    const name = newName.trim();
    if (!name) return alert('이름을 입력해주세요.');
    if (members.some(m => m.id === memberId(name))) return alert('이미 등록된 회원이에요.');
    setBusy(true);
    try {
      await saveMember(name, newNick.trim());
      setNewName(''); setNewNick('');
      await load();
    } catch { alert('회원을 추가하지 못했어요.'); } finally { setBusy(false); }
  };

  const handleImport = async () => {
    if (!window.confirm('8회 필드 정라 참가자를 회비 대상 회원으로 불러올까요?\n이미 등록된 회원은 건너뜁니다.')) return;
    setBusy(true);
    try {
      const tSnap = await getDocs(collection(db, 'tournaments'));
      const t8 = tSnap.docs.map(d => d.data()).find(t => Number(t.round) === 8 && t.type !== 'screen');
      if (!t8) { alert('8회 필드 대회를 찾지 못했어요.'); return; }
      const list: { name: string; nickname?: string }[] = t8.participants || [];
      let added = 0;
      for (const p of list) {
        if (!p.name || members.some(m => m.id === memberId(p.name))) continue;
        await saveMember(p.name, p.nickname || p.name);
        added += 1;
      }
      alert(`${added}명을 불러왔어요.`);
      await load();
    } catch (err) {
      console.error(err);
      alert('참가자를 불러오지 못했어요.');
    } finally { setBusy(false); }
  };

  const handleStatus = async (m: Member, status: Member['status']) => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'dues_members', m.id), { status }, { merge: true });
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status } : x));
    } catch { alert('상태를 바꾸지 못했어요.'); } finally { setBusy(false); }
  };

  // ── 설정 ──
  const handleSaveSettings = async () => {
    const s: Settings = {
      monthlyDues: Number(draftSettings.monthlyDues) || 0,
      openingBalance: Number(draftSettings.openingBalance) || 0,
      startMonth: /^\d{4}-\d{2}$/.test(draftSettings.startMonth) ? draftSettings.startMonth : settings.startMonth,
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

  const pct = stats.active.length ? Math.round(((stats.active.length - stats.unpaid.length) / stats.active.length) * 100) : 0;

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
          {([['summary', '요약'], ['dues', '회비 납부'], ['ledger', '수입·지출']] as const).map(([k, label]) => (
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

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '월회비 수입', v: stats.duesTotal, c: 'text-golf-600' },
                { label: '기타 수입', v: stats.otherIncome, c: 'text-info-600' },
                { label: '지출', v: stats.expense, c: 'text-danger-600' },
              ].map(x => (
                <div key={x.label} className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
                  <p className="text-[11px] text-gray-400 font-bold">{x.label}</p>
                  <p className={`text-base font-black mt-1 ${x.c}`}>{fm(x.v)}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="font-black text-gray-800">{monthLabel(nowMonth)} 월회비 ({fm(settings.monthlyDues)}원)</p>
                <p className="text-sm font-bold text-golf-600">{stats.active.length - stats.unpaid.length}/{stats.active.length}명 · {pct}%</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-golf-400" style={{ width: `${pct}%` }} />
              </div>
              {stats.unpaid.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 font-bold mb-1.5">미납 {stats.unpaid.length}명</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.unpaid.map(m => (
                      <span key={m.id} className="text-xs bg-warn-50 text-warn-600 font-bold px-2 py-1 rounded-full">{m.nickname}</span>
                    ))}
                  </div>
                </div>
              ) : stats.active.length > 0 ? (
                <p className="mt-3 text-xs text-golf-600 font-bold">이번 달은 모두 납부했어요.</p>
              ) : (
                <p className="mt-3 text-xs text-gray-400">회비 납부 탭에서 회원을 먼저 등록해주세요.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="font-black text-gray-800 mb-2">월별 월회비 수입</p>
              {Object.keys(stats.perMonth).length === 0 ? (
                <p className="text-sm text-gray-400">아직 납부 기록이 없어요.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(stats.perMonth).sort(([a], [b]) => b.localeCompare(a)).map(([m, v]) => (
                    <div key={m} className="flex justify-between py-2 text-sm">
                      <span className="font-bold text-gray-700">{m}</span>
                      <span className="text-gray-500">{v.count}명 · <b className="text-gray-800">{fm(v.amount)}원</b></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canEdit && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                <p className="font-black text-gray-800">장부 설정</p>
                <label className="block text-xs text-gray-400 font-bold">월회비 (원)
                  <input type="number" inputMode="numeric" value={draftSettings.monthlyDues}
                    onChange={e => setDraftSettings({ ...draftSettings, monthlyDues: Number(e.target.value) })}
                    className="mt-1 w-full p-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-golf-400" />
                </label>
                <label className="block text-xs text-gray-400 font-bold">이월금 (원)
                  <input type="number" inputMode="numeric" value={draftSettings.openingBalance}
                    onChange={e => setDraftSettings({ ...draftSettings, openingBalance: Number(e.target.value) })}
                    className="mt-1 w-full p-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-golf-400" />
                </label>
                <label className="block text-xs text-gray-400 font-bold">월회비 시작월
                  <input type="month" value={draftSettings.startMonth}
                    onChange={e => setDraftSettings({ ...draftSettings, startMonth: e.target.value })}
                    className="mt-1 w-full p-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-golf-400" />
                </label>
                <button onClick={handleSaveSettings} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-golf-500 text-white text-sm font-bold disabled:bg-gray-300">설정 저장</button>
                <p className="text-[11px] text-gray-400">월회비를 바꿔도 이미 납부 처리된 달의 금액은 그대로 남아요.</p>
              </div>
            )}
          </>
        )}

        {/* ───────── 회비 납부 ───────── */}
        {tab === 'dues' && (
          <>
            {canEdit && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                <button onClick={handleImport} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-golf-500 text-white text-sm font-bold disabled:bg-gray-300">
                  8회 참가자 불러오기
                </button>
                <div className="flex gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="이름(앱 이름)"
                    className="flex-1 min-w-0 p-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-golf-400" />
                  <input value={newNick} onChange={e => setNewNick(e.target.value)} placeholder="닉네임(선택)"
                    className="flex-1 min-w-0 p-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-golf-400" />
                  <button onClick={handleAddMember} disabled={busy}
                    className="px-4 rounded-xl bg-gray-800 text-white text-sm font-bold disabled:bg-gray-300">추가</button>
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-4xl mb-3">📒</p>
                <p className="text-gray-400 text-sm">{canEdit ? '위 버튼으로 회원을 불러오거나 추가해주세요.' : '아직 등록된 회원이 없어요.'}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
                <table className="text-sm border-collapse min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 text-xs text-gray-400 font-bold min-w-[110px]">회원</th>
                      {months.map(m => (
                        <th key={m} className="px-2 py-2 text-xs text-gray-400 font-bold whitespace-nowrap min-w-[44px]">{monthLabel(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="sticky left-0 bg-white px-3 py-1.5">
                          <p className={`font-bold ${m.status === 'active' ? 'text-gray-800' : 'text-gray-400'}`}>{m.nickname}</p>
                          {canEdit ? (
                            <select value={m.status} onChange={e => handleStatus(m, e.target.value as Member['status'])}
                              className="text-[11px] text-gray-400 bg-transparent outline-none">
                              {(['active', 'rest', 'left'] as const).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          ) : (
                            m.status !== 'active' && <p className="text-[11px] text-gray-400">{STATUS_LABEL[m.status]}</p>
                          )}
                        </td>
                        {months.map(mo => {
                          const paid = !!payments[m.id]?.[mo];
                          return (
                            <td key={mo} className="px-1 py-1 text-center">
                              <button onClick={() => togglePaid(m, mo)} disabled={!canEdit || busy}
                                className={`w-9 h-9 rounded-lg text-sm font-black ${paid ? 'bg-golf-400 text-white' : m.status === 'active' ? 'bg-gray-100 text-transparent' : 'bg-gray-50 text-transparent'} ${canEdit ? '' : 'cursor-default'}`}>
                                ✓
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="sticky left-0 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">납부 인원</td>
                      {months.map(mo => (
                        <td key={mo} className="px-1 py-2 text-center text-xs font-black text-golf-600">{stats.perMonth[mo]?.count ?? 0}</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="text-[11px] text-gray-400">휴회·탈퇴 회원은 미납 인원에서 빠져요. 칸을 누르면 납부(✓)가 기록되고 다시 누르면 취소돼요.</p>
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
            <p className="text-[11px] text-gray-400">월회비 수입은 회비 납부 탭의 체크에서 자동으로 집계돼서 여기에는 따로 적지 않아요.</p>
          </>
        )}
      </div>
    </div>
  );
}
