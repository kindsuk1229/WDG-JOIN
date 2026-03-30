'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavProps {
  active?: string;
}

export default function BottomNav({ active }: BottomNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: '/', icon: '⛳', label: '홈', key: 'home' },
    { href: '/meetups', icon: '📋', label: '벙개 목록', key: 'meetups' },
    { href: '/my-meetups', icon: '📝', label: '내 벙개', key: 'my-meetups' },
    { href: '/mypage', icon: '👤', label: '마이', key: 'my' },
  ];

  return (
    <nav className="sticky bottom-0 w-full bg-white border-t border-gray-100 flex justify-around p-3 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex flex-col items-center gap-1 flex-1 ${isActive ? 'text-green-600' : 'text-gray-400'}`}
          >
            <span className="text-2xl">{tab.icon}</span>
            <span className="text-[16px] font-bold">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}