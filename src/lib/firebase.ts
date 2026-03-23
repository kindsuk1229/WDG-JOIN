import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { getAuth, KakaoAuthProvider, signInWithCustomToken } from "firebase/auth";

// 1. Firebase 설정 (환경변수 사용)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 앱 초기화
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 2. 실제 데이터 서비스 (샘플 데이터 제거됨)
export const meetupService = {
  // 모든 벙개 목록 실시간 구독 (샘플 데이터 대신 실제 DB 사용)
  subscribeAll: (callback: (data: any[]) => void) => {
    const q = query(collection(db, "meetups"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const meetups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(meetups);
    });
  },

  // 벙개 개설 (0명부터 시작)
  create: async (meetupData: any) => {
    return await addDoc(collection(db, "meetups"), {
      ...meetupData,
      participants: [], // 3명 자동 참여 제거
      status: "모집중",
      createdAt: serverTimestamp(),
    });
  }
};

// 3. 카카오 로그인 관련 로직 (기본 구조)
export const loginWithKakao = async (kakaoToken: string) => {
  // 실제 서비스 시에는 서버(Cloud Functions 등)에서 
  // 카카오 토큰을 Firebase 토큰으로 교환하는 과정이 필요합니다.
  console.log("카카오 연동 준비 완료:", kakaoToken);
};