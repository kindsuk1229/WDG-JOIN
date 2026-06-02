'use client';

import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const handleFakeLogin = () => {
    // 임시로 '김근석' 사장님 이름으로 로그인된 척 설정합니다.
    alert('반갑습니다, 김근석 사장님! 테스트 모드로 입장합니다.');
    
    // 메인 페이지로 강제 이동
    router.push('/');
  };

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">⛳</div>
        <div className="text-3xl font-bold text-green-600">WDG 우동골</div>
        <p className="text-gray-400 mt-2">우리동네 골프 모임</p>
      </div>
      
      <button 
        onClick={handleFakeLogin}
        className="w-full bg-[#FEE500] text-[#191919] p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition"
      >
        <span className="text-lg">🟡</span> 카카오로 1초 만에 시작하기
      </button>

      <p className="mt-8 text-xs text-gray-400">
        로그인 시 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
      </p>
    </main>
  );
}