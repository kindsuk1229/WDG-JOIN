import { create } from 'zustand';
import type { User, Meetup } from '@/types';

// ── 유저 스토어 ──
interface AuthStore {
  user: User | null;
  setUser: (u: User | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// ── 토스트 스토어 ──
interface ToastItem {
  id: number;
  text: string;
  type: 'success' | 'warn' | 'info';
}

interface ToastStore {
  toasts: ToastItem[];
  notify: (text: string, type?: 'success' | 'warn' | 'info') => void;
}

let toastId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  notify: (text, type = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2500);
  },
}));
