# ⛳ 우동골 (우리동네골프모임)

소규모 동호회용 골프 벙개 참여 PWA 웹앱입니다.

카카오톡으로 링크 공유 → 바로 사용 가능. 앱스토어 설치 불필요.
홈 화면에 추가하면 네이티브 앱처럼 사용할 수 있습니다.

---

## 🏗 기술 스택

| 항목 | 기술 | 이유 |
|------|------|------|
| 프레임워크 | **Next.js 14** (App Router) | SSR + 정적 생성, SEO |
| 스타일 | **Tailwind CSS** | 빠른 개발, 일관된 디자인 |
| 상태관리 | **Zustand** | 가볍고 간단 |
| 백엔드/DB | **Firebase** (Firestore) | 실시간 동기화, 서버 불필요 |
| 인증 | **Firebase Auth** | 익명/카카오 로그인 |
| 배포 | **Vercel** | Next.js 최적화, 무료 |
| PWA | **Service Worker** | 오프라인 지원, 홈 화면 추가 |

---

## 📱 주요 기능

### 1. 벙개 개설
- 골프장 이름 직접 입력
- 날짜, 티오프 시간, 그린피 설정
- **카트 단위 인원** (1카트=4명, 최대 20카트=80명)

### 2. 실시간 참여 + 대기열
- 선착순 참가 확정
- 마감 시 자동 대기 등록
- 취소 발생 → 대기자 자동 승격 (Firestore Transaction)

### 3. 벙개별 채팅
- 참가자 간 실시간 대화
- Firestore 실시간 구독

### 4. 더치페이 정산
- 식사/카트비/캐디피/음료/기타 카테고리
- 누가 얼마 결제했는지 입력
- **자동 정산 계산** + 최소 송금 횟수 안내
- ⚠️ 그린피는 정산에 포함하지 않음 (개별 납부)

---

## 🚀 시작하기

### 사전 준비

1. **Node.js 18+** 설치: https://nodejs.org
2. **Firebase 프로젝트** 생성: https://console.firebase.google.com

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 Firebase 설정값 입력

# 3. 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
```

### Firebase 설정 방법

1. [Firebase 콘솔](https://console.firebase.google.com) 에서 새 프로젝트 생성
2. **Authentication** 활성화 → "익명" 로그인 사용 설정
3. **Firestore Database** 생성 → `firestore.rules` 내용 붙여넣기
4. 프로젝트 설정 > 일반 > 웹 앱 추가 > 설정값을 `.env.local`에 입력

---

## 🌐 배포 (Vercel)

가장 쉬운 배포 방법입니다. 무료 플랜으로 충분합니다.

### 방법 1: Vercel 대시보드

1. https://vercel.com 가입 (GitHub 계정 연동)
2. "New Project" → GitHub 저장소 연결
3. Environment Variables 에 `.env.local` 값 입력
4. "Deploy" 클릭 → 완료!

### 방법 2: CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 배포 후

- `https://your-project.vercel.app` 주소가 생성됩니다
- 이 URL을 카카오톡으로 공유하면 끝!
- **커스텀 도메인**: Vercel 대시보드 > Settings > Domains 에서 설정

---

## 📲 PWA 설치 안내 (동호회원에게 공유)

### iPhone
1. Safari로 링크 접속
2. 하단 공유 버튼 탭
3. "홈 화면에 추가" 선택

### Android
1. Chrome으로 링크 접속
2. "홈 화면에 추가" 배너 탭
3. 또는 메뉴(⋮) > "앱 설치"

---

## 📁 프로젝트 구조

```
udonggol-pwa/
├── public/
│   ├── manifest.json          # PWA 설정
│   ├── sw.js                  # Service Worker (오프라인)
│   └── icons/                 # 앱 아이콘 (직접 추가)
├── src/
│   ├── app/                   # Next.js App Router 페이지
│   │   ├── layout.tsx         # 루트 레이아웃 (PWA 메타태그)
│   │   ├── page.tsx           # 홈 (벙개 목록)
│   │   ├── create/page.tsx    # 벙개 개설
│   │   ├── meetup/[id]/
│   │   │   ├── page.tsx       # 벙개 상세
│   │   │   ├── chat/page.tsx  # 채팅
│   │   │   └── pay/page.tsx   # 더치페이
│   │   └── mypage/page.tsx    # 마이페이지
│   ├── components/
│   │   └── UI.tsx             # 공통 컴포넌트 (Avatar, Badge 등)
│   ├── lib/
│   │   ├── firebase.ts        # Firebase 설정 + 모든 서비스
│   │   ├── store.ts           # Zustand 상태관리
│   │   └── utils.ts           # 유틸 함수
│   └── types/
│       └── index.ts           # TypeScript 타입
├── firestore.rules            # Firestore 보안 규칙
├── .env.example               # 환경변수 템플릿
├── tailwind.config.js         # Tailwind 커스텀 테마
└── package.json
```

---

## 🔧 Firebase → 실서비스 연동 체크리스트

현재 각 페이지는 **샘플 데이터**로 동작합니다.
Firebase를 연동하려면 아래 TODO 주석을 따라가세요:

- [ ] `.env.local` 에 Firebase 설정값 입력
- [ ] `src/app/page.tsx` — `useSampleMeetups()` → `meetupService.subscribeAll()`
- [ ] `src/app/meetup/[id]/page.tsx` — `useMeetup()` → `meetupService.subscribeOne()`
- [ ] `src/app/meetup/[id]/chat/page.tsx` — 로컬 state → `chatService.subscribe()`
- [ ] `src/app/meetup/[id]/pay/page.tsx` — 로컬 state → `expenseService.subscribe()`
- [ ] `src/app/create/page.tsx` — `alert()` → `meetupService.create()`
- [ ] 인증: 익명 로그인 또는 카카오 로그인 연동

---

## 💡 향후 확장 아이디어

- 카카오 로그인 연동
- 푸시 알림 (Firebase Cloud Messaging)
- 카카오톡 공유 (Kakao JS SDK)
- 스코어 기록 기능
- 참석률 / 매너 평가
- 캘린더 연동

---

## 📝 외주 시 참고사항

이 프로젝트를 외주 개발자에게 전달할 때:

1. 이 README와 프로젝트 코드 전체를 전달
2. Firebase 프로젝트는 직접 생성 후 설정값 공유
3. "TODO" 주석이 있는 부분을 Firebase 실연동으로 교체 요청
4. 디자인은 프로토타입 (golf-meetup.jsx) 참고

**예상 외주 비용**: 100~300만원 (Firebase 연동 + 카카오 로그인 + 배포)
**예상 기간**: 2~4주

---

MIT License
