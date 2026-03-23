import './globals.css';
import Script from 'next/script';
import BottomNav from '@/components/BottmNav';

export const metadata = {
  title: 'WDG - 우리동네골프', //
  description: '골프 벙개 및 정기 라운드 관리', //
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
        
        {/* PC 접속 시 중앙 정렬을 위한 컨테이너 */}
        <div className="flex justify-center min-h-screen">
          {/* 모바일 화면 규격 고정 및 스크롤 제어 */}
          <div className="relative w-full max-w-md bg-white shadow-2xl min-h-screen flex flex-col overflow-hidden">
            
            {/* 실제 페이지 컨텐츠가 들어가는 영역 */}
            {/* flex-1과 overflow-y-auto를 통해 이 영역만 스크롤됩니다. */}
            <main className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </main>
            
            {/* 모든 페이지 공통 하단 네비게이션 */}
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}