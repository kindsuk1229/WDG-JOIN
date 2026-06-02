'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import KakaoLoginButton from '@/components/KakaoLogin';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const status = localStorage.getItem('isLoggedIn');
    const userName = localStorage.getItem('user_name');
    setIsLoggedIn(status === 'true' && !!userName);
  }, [pathname]);

  // 체크 중
  if (isLoggedIn === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 font-bold">로딩 중...</p>
      </div>
    );
  }

  // 로그인 안 됐으면 로그인 화면
  if (!isLoggedIn) {
    return <KakaoLoginButton />;
  }

  return <>{children}</>;
}