'use client';

import React from 'react';
import Link from 'next/link'; // Next.js 전용 이동 부품
import { getAvatarColor, cn } from '@/lib/utils';

// ── Avatar (사용자 프로필 이미지) ──
export function Avatar({ name, size = 36, highlight = false }: {
  name: string; size?: number; highlight?: boolean;
}) {
  const c = getAvatarColor(name);
  const initials = name.length <= 2 ? name : name.slice(-2);
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 font-semibold"
      style={{
        width: size, height: size, backgroundColor: c.bg, color: c.text,
        fontSize: Math.max(size * 0.36, 10),
        border: highlight ? '2px solid #1D9E75' : `1px solid ${c.bg}`,
      }}
    >
      {initials}
    </div>
  );
}

// ── EmptySlot (빈자리 표시) ──
export function EmptySlot({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 border-[1.5px] border-dashed border-gray-300 text-gray-400"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >+</div>
  );
}

// ── Badge (상태 표시 태그) ──
const BADGE = {
  green:  'bg-golf-50 text-golf-800',
  amber:  'bg-warn-50 text-warn-600',
  red:    'bg-danger-50 text-danger-600',
  blue:   'bg-info-50 text-info-600',
  teal:   'bg-golf-50 text-golf-600',
  gray:   'bg-gray-100 text-gray-500',
};

export function Badge({ children, color = 'gray' }: {
  children: React.ReactNode; color?: keyof typeof BADGE;
}) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', BADGE[color])}>
      {children}
    </span>
  );
}

// ── CartGrid (카트별 인원 배치) ──
export function CartGrid({ players, maxPlayers, compact = false, myUid }: {
  players: { displayName: string; uid: string }[];
  maxPlayers: number; compact?: boolean; myUid?: string;
}) {
  const carts = Math.ceil(maxPlayers / 4);
  const sz = compact ? 22 : 28;
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: carts }).map((_, ci) => {
        const start = ci * 4;
        const filled = players.slice(start, start + 4);
        const empty = 4 - filled.length;
        return (
          <div key={ci} className="bg-white border border-gray-100 rounded-lg p-1.5 flex flex-col items-center gap-1">
            <div className="grid grid-cols-2 gap-0.5">
              {filled.map((p, i) => <Avatar key={i} name={p.displayName} size={sz} highlight={p.uid === myUid} />)}
              {Array.from({ length: empty }).map((_, i) => <EmptySlot key={i} size={sz} />)}
            </div>
            <span className="text-[9px] text-gray-400 font-medium">{ci + 1}카트</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Toast Container (알림창) ──
export function ToastContainer({ toasts }: {
  toasts: { id: number; text: string; type: string }[];
}) {
  const colorMap: Record<string, string> = {
    success: 'bg-golf-50 text-golf-800 border-golf-200',
    warn: 'bg-warn-50 text-warn-600 border-yellow-300',
    info: 'bg-info-50 text-info-600 border-blue-200',
  };
  return (
    <div className="fixed top-2 left-2 right-2 z-50 flex flex-col gap-1.5 pointer-events-none max-w-lg mx-auto">
      {toasts.map(t => (
        <div key={t.id} className={cn('px-4 py-3 rounded-xl text-[13px] font-medium border animate-slide-down', colorMap[t.type] || colorMap.info)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── BottomNav (강력 플로팅 버전) ──
export function BottomNav({ active }: { active: 'home' | 'my' }) {
  return (
    <div 
      style={{ 
        position: 'fixed', 
        bottom: '20px', // 바닥에서 20px 띄움
        left: '50%', 
        transform: 'translateX(-50%)', 
        width: '90%', // 화면 너비의 90%
        maxWidth: '400px',
        backgroundColor: 'white',
        height: '70px',
        borderRadius: '20px',
        display: 'flex',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', // 그림자 강하게
        zIndex: 999999, // 어떤 것보다 위에 배치
        border: '1px solid #eee'
      }}
    >
      <Link 
        href="/" 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
      >
        <span style={{ fontSize: '24px' }}>⛳</span>
        <span style={{ fontSize: '12px', color: active === 'home' ? '#16a34a' : '#9ca3af', fontWeight: 'bold' }}>홈</span>
      </Link>
      
      <Link 
        href="/mypage" 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
      >
        <span style={{ fontSize: '24px' }}>👤</span>
        <span style={{ fontSize: '12px', color: active === 'my' ? '#16a34a' : '#9ca3af', fontWeight: 'bold' }}>마이</span>
      </Link>
    </div>
  );
}