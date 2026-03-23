import './globals.css';
import Script from 'next/script';

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
        {/* 카카오 SDK를 가장 먼저, 가장 빠르게 로드하도록 설정합니다. */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          strategy="beforeInteractive" // 페이지 상호작용 전에 미리 로드
        />
        {children}
      </body>
    </html>
  );
}