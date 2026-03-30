import './globals.css';
import Script from 'next/script';
import BottomNav from '@/components/BottmNav';
import AuthGuard from '@/components/AuthGuard';

export const metadata = {
  title: 'WDG 우동골벙개앱',
  description: '골프 벙개 및 정기 라운드 관리',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-100">
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          strategy="beforeInteractive"
        />

        <div className="flex justify-center min-h-screen">
          <div className="relative w-full max-w-md bg-white shadow-2xl min-h-screen flex flex-col">

            {/* ✅ AuthGuard로 모든 페이지 감싸기 - 로그인 안 하면 접근 불가 */}
            <AuthGuard>
              <main className="flex-1 overflow-y-auto pb-20">
                {children}
              </main>
              <BottomNav />
            </AuthGuard>

          </div>
        </div>
      </body>
    </html>
  );
}