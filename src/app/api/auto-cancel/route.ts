import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Vercel Cron 요청 검증
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const now = new Date();
    let cancelledCount = 0;
    let completedCount = 0;

    // open 상태인 벙개만 조회
    const snap = await db.collection('meetups')
      .where('status', 'in', ['open', null])
      .get();

    // status 필드가 없는 것도 포함
    const allSnap = await db.collection('meetups').get();

    for (const docSnap of allSnap.docs) {
      const data = docSnap.data();

      // 이미 처리된 것 제외
      if (data.status === 'completed' || data.status === 'cancelled') continue;

      // 날짜 + 시작 시간 파싱
      if (!data.date) continue;
      const rawTime = data.cartTimes?.[0];
      const timeStr = (!rawTime || rawTime === 'TBD') ? '23:59' : rawTime;
      const [h, m] = timeStr.split(':').map(Number);
      const meetupDateTime = new Date(`${data.date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);

      // ✅ closed, manually_closed: 시작시간 지나면 completed
      if (data.status === 'closed' || data.status === 'manually_closed') {
        if (now >= meetupDateTime) {
          await docSnap.ref.update({ status: 'completed' });
          completedCount++;
        }
        continue;
      }

      // ✅ open: 시작시간 + 2시간 지나면 처리
      const twoHoursAfter = new Date(meetupDateTime.getTime() + 2 * 60 * 60 * 1000);
      if (now < twoHoursAfter) continue;

      // 정원 확인
      const participants = data.participants || [];
      const maxPlayers = (data.meetupType === 'screen' || data.meetupType === 'etc')
        ? data.playerCount
        : (data.cartCount || 0) * 4;
      const isFull = participants.length >= maxPlayers;

      if (isFull) {
        await docSnap.ref.update({ status: 'completed' });
        completedCount++;
      } else {
        await docSnap.ref.update({ status: 'cancelled' });
        cancelledCount++;
      }
    }

    console.log(`Auto cancel 완료: completed ${completedCount}, cancelled ${cancelledCount}`);
    return NextResponse.json({ success: true, completedCount, cancelledCount });

  } catch (error) {
    console.error('Auto cancel 오류:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}