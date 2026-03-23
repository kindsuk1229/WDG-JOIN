// src/lib/kakao.ts

export const initKakao = () => {
  if (typeof window !== 'undefined' && (window as any).Kakao) {
    const Kakao = (window as any).Kakao;
    if (!Kakao.isInitialized()) {
      Kakao.init('1782e23ec6181fc57d6c4395f3a06f56');
      console.log("✅ 카카오 초기화 완료");
    }
  }
};

export const shareToKakao = (title: string, description: string) => {
  if (typeof window !== 'undefined' && (window as any).Kakao) {
    const Kakao = (window as any).Kakao;
    if (!Kakao.isInitialized()) {
      Kakao.init('1782e23ec6181fc57d6c4395f3a06f56');
    }

    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;

    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: title,
        description: description,
        imageUrl: 'https://ifh.cc/g/H0Y9pX.png',
        link: {
          mobileWebUrl: baseUrl + currentPath,
          webUrl: baseUrl + currentPath,
        },
      },
      buttons: [
        {
          title: '벙개 확인하기',
          link: {
            mobileWebUrl: baseUrl + currentPath,
            webUrl: baseUrl + currentPath,
          },
        },
      ],
    });
  }
};