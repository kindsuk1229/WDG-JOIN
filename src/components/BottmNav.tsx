'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-white border-t border-gray-100 flex justify-around p-3 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      <Link href="/" className={`flex flex-col items-center gap-1 ${pathname === '/' ? 'text-green-600' : 'text-gray-400'}`}>
        <span className="text-2xl">⛳</span>
        <span className="text-[10px] font-bold">홈</span>
      </Link>
      
      {/* 마이페이지 경로를 /my-meetups로 확실히 지정했습니다 */}
      <Link href="/my-meetups" className={`flex flex-col items-center gap-1 ${pathname === '/my-meetups' ? 'text-green-600' : 'text-gray-400'}`}>
        <span className="text-2xl">📝</span>
        <span className="text-[10px] font-bold">내 벙개</span>
      </Link>

      <Link href="/profile" className={`flex flex-col items-center gap-1 ${pathname === '/profile' ? 'text-green-600' : 'text-gray-400'}`}>
        <span className="text-2xl">👤</span>
        <span className="text-[10px] font-bold">마이</span>
      </Link>
    </nav>
  );
}