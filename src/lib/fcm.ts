// src/lib/fcm.ts
// FCM 토큰 관리 및 푸시 알림 유틸

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// FCM 토큰 요청 및 Firestore에 저장
export async function requestNotificationPermission(userName: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    // 1. 브라우저 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('알림 권한 거부됨');
      return false;
    }

    // 2. FCM 토큰 발급
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (!token) return false;

    // 3. Firestore에 토큰 저장 (사용자별)
    await setDoc(doc(db, 'fcm_tokens', userName), {
      token,
      userName,
      updatedAt: new Date().toISOString(),
      platform: navigator.userAgent,
    });

    // 4. 로컬에도 저장
    localStorage.setItem('fcm_token', token);
    localStorage.setItem('notification_enabled', 'true');

    console.log('FCM 토큰 저장 완료:', token);
    return true;
  } catch (error) {
    console.error('FCM 토큰 발급 실패:', error);
    return false;
  }
}

// 포그라운드 메시지 수신 리스너
export function setupForegroundNotification() {
  if (typeof window === 'undefined') return;

  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      console.log('[FCM] 포그라운드 메시지:', payload);

      const { title, body } = payload.notification || {};

      // 브라우저 알림 표시
      if (Notification.permission === 'granted') {
        new Notification(title || '우동골 알림', {
          body: body || '새로운 알림이 있습니다.',
          icon: '/icons/icon-192.png',
        });
      }
    });
  } catch (error) {
    console.error('포그라운드 알림 설정 실패:', error);
  }
}

// 알림 활성화 상태 확인
export function isNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('notification_enabled') === 'true';
}

// 알림 비활성화
export async function disableNotification(userName: string): Promise<void> {
  localStorage.removeItem('fcm_token');
  localStorage.setItem('notification_enabled', 'false');

  try {
    await setDoc(doc(db, 'fcm_tokens', userName), {
      token: null,
      userName,
      updatedAt: new Date().toISOString(),
      disabled: true,
    });
  } catch (error) {
    console.error('알림 비활성화 실패:', error);
  }
}

// 특정 사용자에게 알림 전송 (Firestore에 알림 큐 추가 방식)
// 실제 FCM 전송은 Firebase Functions 또는 서버에서 처리
export async function sendNotificationToUser({
  toUserName,
  title,
  body,
  url = '/',
}: {
  toUserName: string;
  title: string;
  body: string;
  url?: string;
}) {
  try {
    // Firestore의 notification_queue 컬렉션에 추가
    // → Firebase Functions가 감지해서 FCM 전송
    await setDoc(
      doc(db, 'notification_queue', `${toUserName}_${Date.now()}`),
      {
        toUserName,
        title,
        body,
        url,
        createdAt: new Date().toISOString(),
        sent: false,
      }
    );
  } catch (error) {
    console.error('알림 큐 추가 실패:', error);
  }
}

// 전체 멤버에게 알림 전송
export async function sendNotificationToAll({
  title,
  body,
  url = '/',
  excludeUserName,
}: {
  title: string;
  body: string;
  url?: string;
  excludeUserName?: string;
}) {
  try {
    await setDoc(
      doc(db, 'notification_queue', `broadcast_${Date.now()}`),
      {
        broadcast: true,
        excludeUserName: excludeUserName || null,
        title,
        body,
        url,
        createdAt: new Date().toISOString(),
        sent: false,
      }
    );
  } catch (error) {
    console.error('전체 알림 큐 추가 실패:', error);
  }
}
