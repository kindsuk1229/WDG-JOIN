import './globals.css';
import Script from 'next/script';
import BottomNav from '@/components/BottmNav';

export const metadata = {
  title: 'WDG - 우리동네골프',
  description: '골프 벙개 및 정기 라운드 관리',
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
        
        {/* PC 접속 시 중앙 정렬 */}
        <div className="flex justify-center min-h-screen">
          {/* ✅ 핵심 수정: overflow-hidden 제거 → 스크롤 막는 주범이었음 */}
          <div className="relative w-full max-w-md bg-white shadow-2xl min-h-screen flex flex-col">
            
            {/* ✅ pb-20: 하단 탭바(80px) 높이만큼 여백 확보 */}
            <main className="flex-1 overflow-y-auto pb-20">
              {children}
            </main>
            
            {/* 탭바는 layout에서만 한 번 렌더링 */}
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}