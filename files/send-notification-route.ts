import { NextRequest, NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { title, body, url, excludeUserName, toUserName } = await req.json();
    const db = getFirestore();

    let tokens: string[] = [];

    if (toUserName) {
      // 특정 유저에게만 전송
      const tokenDoc = await db.collection('fcm_tokens').doc(toUserName).get();
      if (tokenDoc.exists && tokenDoc.data()?.token) {
        tokens.push(tokenDoc.data()!.token);
      }
    } else {
      // 전체 유저에게 전송 (excludeUserName 제외)
      const tokenSnap = await db.collection('fcm_tokens').get();
      tokenSnap.forEach((doc) => {
        const data = doc.data();
        if (data.token && !data.disabled && doc.id !== excludeUserName) {
          tokens.push(data.token);
        }
      });
    }

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: '전송할 토큰 없음' });
    }

    // FCM 전송
    const results = await Promise.allSettled(
      tokens.map((token) =>
        admin.messaging().send({
          token,
          notification: { title, body },
          webpush: {
            fcmOptions: { link: url || '/' },
            notification: {
              title,
              body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
            },
          },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`FCM 전송 완료: 성공 ${succeeded}, 실패 ${failed}`);
    return NextResponse.json({ success: true, succeeded, failed });

  } catch (error) {
    console.error('FCM 전송 오류:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
