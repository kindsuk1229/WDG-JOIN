'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavProps {
  active?: string;
}

export default function BottomNav({ active }: BottomNavProps) {
  const pathname = usePathname();

  return (
    // ✅ 핵심 수정: fixed → sticky
    // fixed는 layout의 max-w-md 컨테이너를 벗어나 PC에서 화면 전체 하단에 붙음
    // sticky는 부모 컨테이너(max-w-md) 안에서 하단에 고정됨
    <nav className="sticky bottom-0 w-full bg-white border-t border-gray-100 flex justify-around p-3 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      <Link
        href="/"
        className={`flex flex-col items-center gap-1 ${
          pathname === '/' || active === 'home' ? 'text-green-600' : 'text-gray-400'
        }`}
      >
        <span className="text-2xl">⛳</span>
        <span className="text-[10px] font-bold">홈</span>
      </Link>

      <Link
        href="/my-meetups"
        className={`flex flex-col items-center gap-1 ${
          pathname === '/my-meetups' || active === 'meetups' ? 'text-green-600' : 'text-gray-400'
        }`}
      >
        <span className="text-2xl">📝</span>
        <span className="text-[10px] font-bold">내 벙개</span>
      </Link>

      <Link
        href="/mypage"
        className={`flex flex-col items-center gap-1 ${
          pathname === '/mypage' || active === 'my' ? 'text-green-600' : 'text-gray-400'
        }`}
      >
        <span className="text-2xl">👤</span>
        <span className="text-[10px] font-bold">마이</span>
      </Link>
    </nav>
  );
}