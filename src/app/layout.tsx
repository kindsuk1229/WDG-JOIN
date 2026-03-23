import './globals.css';
import Script from 'next/script';
import BottomNav from '@/components/BottomNav'; // 하단바 불러오기

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
      <body>
        {/* 카카오 SDK 로드 */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          strategy="beforeInteractive"
        />
        
        {/* 전체 앱의 최대 너비를 모바일 사이즈(max-w-md)로 잡고 중앙 정렬합니다 */}
        <div className="flex justify-center min-h-screen bg-gray-50">
          <div className="relative w-full max-w-md bg-white shadow-lg min-h-screen pb-20">
            {children}
            {/* 드디어 하단 버튼이 모든 페이지에 나타납니다! */}
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}