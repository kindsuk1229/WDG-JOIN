import { NextRequest, NextResponse } from 'next/server';

// ✅ 빌드 타임에 실행되지 않도록 동적 렌더링 강제
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { title, body, url, excludeUserName, toUserName } = await req.json();

    // ✅ 런타임에만 Admin SDK 초기화
    const admin = (await import('firebase-admin')).default;

    if (!admin.apps.length) {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
      const formattedKey = privateKey.includes('\\n')
        ? privateKey.replace(/\\n/g, '\n')
        : privateKey;

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: formattedKey,
        }),
      });
    }

    const db = admin.firestore();
    let tokens: string[] = [];

    if (toUserName) {
      const tokenDoc = await db.collection('fcm_tokens').doc(toUserName).get();
      if (tokenDoc.exists && tokenDoc.data()?.token) {
        tokens.push(tokenDoc.data()!.token);
      }
    } else {
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

    console.log(`FCM 전송: 성공 ${succeeded}, 실패 ${failed}`);
    return NextResponse.json({ success: true, succeeded, failed });

  } catch (error) {
    console.error('FCM 전송 오류:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}