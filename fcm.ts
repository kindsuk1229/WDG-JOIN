// src/lib/fcm.ts
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
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
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (!token) return false;

    // Firestore에 토큰 저장
    await setDoc(doc(db, 'fcm_tokens', userName), {
      token,
      userName,
      updatedAt: new Date().toISOString(),
      disabled: false,
    });

    localStorage.setItem('fcm_token', token);
    localStorage.setItem('notification_enabled', 'true');
    return true;
  } catch (error) {
    console.error('FCM 토큰 발급 실패:', error);
    return false;
  }
}

// 포그라운드 메시지 수신
export function setupForegroundNotification() {
  if (typeof window === 'undefined') return;
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
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

export function isNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('notification_enabled') === 'true';
}

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

// ✅ 실제 FCM 전송 - Vercel API Route 호출
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
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url, excludeUserName }),
    });
  } catch (error) {
    console.error('알림 전송 실패:', error);
  }
}

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
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url, toUserName }),
    });
  } catch (error) {
    console.error('알림 전송 실패:', error);
  }
}
