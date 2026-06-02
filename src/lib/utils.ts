import type { Transfer } from '@/types';

// 아바타 컬러
const AVATAR_COLORS = [
  { bg: '#E1F5EE', text: '#085041' },
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#FAECE7', text: '#712B13' },
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#FBEAF0', text: '#72243E' },
];

export function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// 날짜 포맷
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]})`;
}

// 금액 포맷
export function fm(n: number): string {
  return n.toLocaleString('ko-KR');
}

// 현재 시간
export function timeNow(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

// 내일 날짜 string
export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// 정산 계산 (최소 송금 횟수)
export function calculateTransfers(
  participants: string[],
  expenses: { payerName: string; amount: number }[]
): Transfer[] {
  if (!participants.length || !expenses.length) return [];

  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  participants.forEach(n => { paid[n] = 0; owed[n] = 0; });

  expenses.forEach(e => {
    const share = Math.round(e.amount / participants.length);
    if (paid[e.payerName] !== undefined) paid[e.payerName] += e.amount;
    participants.forEach(n => { owed[n] += share; });
  });

  const debtors = participants
    .map(n => ({ name: n, remaining: owed[n] - paid[n] }))
    .filter(b => b.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const creditors = participants
    .map(n => ({ name: n, remaining: paid[n] - owed[n] }))
    .filter(b => b.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: Transfer[] = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amt = Math.min(debtors[di].remaining, creditors[ci].remaining);
    if (amt > 0) transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount: amt });
    debtors[di].remaining -= amt;
    creditors[ci].remaining -= amt;
    if (debtors[di].remaining <= 0) di++;
    if (creditors[ci].remaining <= 0) ci++;
  }

  return transfers;
}

// 클래스 유틸
export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
