'use client';

import KakaoLogin from 'react-kakao-login';

export default function KakaoLoginButton() {
  // ⚠️ 카카오 개발자 센터에서 복사한 'JavaScript 키'를 아래에 넣으세요
  const kakaoJavascriptKey = '여기에_복사한_키를_붙여넣으세요';

  const successKakao = (res: any) => {
    // 로그인 성공 시 카카오에서 준 정보를 브라우저에 저장합니다.
    const { nickname, profile_image } = res.profile.properties;
    localStorage.setItem('user_name', nickname);
    localStorage.setItem('user_img', profile_image);
    localStorage.setItem('isLoggedIn', 'true');
    
    // 메인 화면으로 새로고침 이동
    window.location.href = '/';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-10 text-center">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-green-600 italic mb-2">WDG</h1>
        <p className="text-gray-400 font-medium">우리동네 골프 클럽</p>
      </div>
      
      <div className="w-full max-w-xs space-y-4">
        <p className="text-gray-600 text-sm leading-relaxed">
          반갑습니다! 서비스를 이용하시려면<br/>
          카카오 계정으로 로그인이 필요합니다.
        </p>
        
        <KakaoLogin
          token={kakaoJavascriptKey}
          onSuccess={successKakao}
          onFail={(err) => console.error(err)}
          render={({ onClick }) => (
            <button
              onClick={onClick}
              className="w-full bg-[#FEE500] text-[#3c1e1e] p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <span className="text-lg">💬</span> 카카오로 시작하기
            </button>
          )}
        />
      </div>
    </div>
  );
}