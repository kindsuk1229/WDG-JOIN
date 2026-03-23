// ── 우동골 타입 정의 ──

export interface User {
  uid: string;
  displayName: string;
  profileImage?: string;
  phone?: string;
  createdAt: number;
}

export interface Meetup {
  id: string;
  course: string;        // 골프장 이름 (직접 입력)
  date: string;          // "2026-03-25"
  teeTime: string;       // "07:00"
  carts: number;         // 카트 수 (1~20)
  greenFee: number;      // 그린피 1인 (원)
  memo?: string;

  hostId: string;
  hostName: string;

  players: Player[];
  waitlist: Player[];

  status: 'open' | 'full' | 'closed' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface Player {
  uid: string;
  displayName: string;
  joinedAt: number;
  status: 'confirmed' | 'waiting';
}

export interface ChatMessage {
  id: string;
  meetupId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  meetupId: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  payerId: string;
  payerName: string;
  createdAt: number;
}

export type ExpenseCategory = 'meal' | 'cart' | 'caddy' | 'drink' | 'etc';

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export const EXPENSE_CATEGORIES = [
  { key: 'meal' as const, label: '식사', icon: '🍚' },
  { key: 'cart' as const, label: '카트비', icon: '🏎' },
  { key: 'caddy' as const, label: '캐디피', icon: '⛳' },
  { key: 'drink' as const, label: '음료', icon: '🥤' },
  { key: 'etc' as const, label: '기타', icon: '📦' },
];
