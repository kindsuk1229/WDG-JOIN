// src/lib/kakao.ts

export const initKakao = () => {
  if (typeof window !== "undefined" && window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      // 근석님의 JavaScript 키를 직접 입력했습니다.
      window.Kakao.init("1782e23ec6181fc57d6c4395f3a06f56");
      console.log("Kakao SDK Initialized:", window.Kakao.isInitialized());
    }
  }
};

export const shareToKakao = (url: string, title: string, description: string) => {
  if (typeof window !== "undefined" && window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      initKakao();
    }

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: title,
        description: description,
        imageUrl: 'https://wdg-join.vercel.app/og-image.png', // 실제 이미지 경로로 수정 가능
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: '벙개 참여하기',
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  }
};