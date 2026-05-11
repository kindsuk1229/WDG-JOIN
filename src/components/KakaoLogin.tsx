'use client';

import KakaoLogin from 'react-kakao-login';

export default function KakaoLoginButton() {
  const kakaoJavascriptKey = '1782e23ec6181fc57d6c4395f3a06f56';

  const successKakao = (res: any) => {
    const { nickname, profile_image } = res.profile.properties;
    localStorage.setItem('user_name', nickname);
    localStorage.setItem('user_img', profile_image);
    localStorage.setItem('isLoggedIn', 'true');

    // ✅ 액세스 토큰 저장
    if (res.response?.access_token) {
      localStorage.setItem('kakao_access_token', res.response.access_token);
    }

    // ✅ 캘린더 추가 권한 요청
    const Kakao = (window as any).Kakao;
    if (Kakao?.Auth) {
      Kakao.Auth.login({
        scope: 'talk_calendar',
        success: (authObj: any) => {
          if (authObj.access_token) {
            localStorage.setItem('kakao_access_token', authObj.access_token);
          }
          window.location.href = '/';
        },
        fail: () => {
          window.location.href = '/';
        }
      });
    } else {
      window.location.href = '/';
    }
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