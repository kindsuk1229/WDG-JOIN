'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 1. active 속성을 받을 수 있게 타입을 정의합니다.
interface BottomNavProps {
  active?: string;
}

// 2. 함수 괄호 안에 { active }를 넣어 데이터를 받게 합니다.
export default function BottomNav({ active }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md w-full bg-white border-t border-gray-100 flex justify-around p-3 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      <Link href="/" className={`flex flex-col items-center gap-1 ${(pathname === '/' || active === 'home') ? 'text-green-600' : 'text-gray-400'}`}>
        <span className="text-2xl">⛳</span>
        <span className="text-[10px] font-bold">홈</span>
      </Link>
      
      <Link href="/my-meetups" className={`flex flex-col items-center gap-1 ${(pathname === '/my-meetups' || active === 'meetups') ? 'text-green-600' : 'text-gray-400'}`}>
        <span className="text-2xl">📝</span>
        <span className="text-[10px] font-bold">내 벙개</span>
      </Link>

      {/* 마이페이지 경로 수정 완료! */}
      <Link href="/mypage" className={`flex flex-col items-center gap-1 ${(pathname === '/mypage' || active === 'my') ? 'text-green-600' : 'text-gray-400'}`}>
        <span className="text-2xl">👤</span>
        <span className="text-[10px] font-bold">마이</span>
      </Link>
    </nav>
  );
}