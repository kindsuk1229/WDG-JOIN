'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { initKakao, shareToKakao } from '@/lib/kakao';

function MeetupDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('id');

  const [meetup, setMeetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof initKakao === 'function') initKakao();

    const savedName = (localStorage.getItem('user_name') || '익명').trim();
    const savedNickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(savedName);
    setMyNickname(savedNickname);

    const checkAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', savedName));
        setIsAdmin(adminDoc.exists());
      } catch (error) {
        console.error('관리자 확인 실패:', error);
      }
    };
    checkAdmin();

    if (meetupId) {
      const fetchDetail = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'meetups', meetupId));
          if (docSnap.exists()) {
            setMeetup({ id: docSnap.id, ...docSnap.data() });
          }
        } catch (error) {
          console.error("데이터 로딩 실패:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    }
  }, [meetupId]);

  const handleDelete = async () => {
    if (!window.confirm('이 벙개를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'meetups', meetupId!));
      alert('벙개가 삭제되었습니다.');
      router.push('/meetups');
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleJoin = async () => {
    if (!meetupId) return;
    const isJoined = meetup.participants?.some((p: any) => p.name === myName);
    try {
      const meetupRef = doc(db, 'meetups', meetupId);
      if (isJoined) {
        const updatedParticipants = meetup.participants.filter((p: any) => p.name !== myName);
        await updateDoc(meetupRef, { participants: updatedParticipants });
        alert('참여가 취소되었습니다. ⛳');
      } else {
        const updatedParticipants = [...(meetup.participants || []), { name: myName, nickname: myNickname }];
        await updateDoc(meetupRef, { participants: updatedParticipants });
        alert('참여 신청이 완료되었습니다! ⛳');
      }
      window.location.reload();
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  // ✅ 카카오 공유
  const handleShare = () => {
    if (!meetup) return;

    const timeStr = meetup.cartTimes?.[0] ? (() => {
      const [h, m] = meetup.cartTimes[0].split(':').map(Number);
      const isPM = h >= 12;
      const hour12 = h % 12 || 12;
      return `${isPM ? '오후' : '오전'} ${hour12}:${String(m).padStart(2, '0')}`;
    })() : '';

    const greenFeeStr = meetup.greenFee > 0
      ? `\n💰 그린피: ${meetup.greenFee.toLocaleString()}원`
      : '';

    const title = `⛳ WDG 벙개 참여 안내`;
    const description = [
      `📍 ${meetup.golfCourse}`,
      `📅 ${meetup.date}${timeStr ? ` ${timeStr}` : ''}`,
      meetup.meetupType === 'screen'
        ? `👥 ${meetup.playerCount}명 모집`
        : `🛒 ${meetup.cartCount}카트 (${meetup.cartCount * 4}명 정원)`,
      greenFeeStr,
      `\n지금 참여하세요! ⛳`,
    ].filter(Boolean).join('\n');

    shareToKakao(window.location.href, title, description);
  };

  if (loading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!meetup) return <div className="p-10 text-center">존재하지 않는 벙개입니다.</div>;

  const participants = meetup.participants || [];
  const isJoined = participants.some((p: any) => p.name === myName);
  const isParticipant = participants.some((p: any) => p.name === myName);
  const maxPlayers = meetup.meetupType === 'screen' ? meetup.playerCount : (meetup.cartCount || 0) * 4;
  const isFull = participants.length >= maxPlayers;

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const isPM = h >= 12;
    const hour12 = h % 12 || 12;
    return `${isPM ? '오후' : '오전'} ${hour12}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold">←</button>
          <h1 className="text-xl font-bold">벙개 상세 정보</h1>
        </div>
        <div className="flex gap-2">
          {(isAdmin || meetup?.creatorId === myName || isParticipant) && (
            <button
              onClick={() => router.push(`/create-meetup?id=${meetup?.id}`)}
              className="text-green-600 text-sm font-bold px-3 py-1.5 bg-green-50 rounded-lg"
            >
              수정
            </button>
          )}
          {(isAdmin || meetup?.creatorId === myName) && (
            <button onClick={handleDelete} className="text-red-500 text-sm font-bold px-3 py-1.5 bg-red-50 rounded-lg">
              삭제
            </button>
          )}
        </div>
      </header>

      <div className="p-5 space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-black text-gray-800">{meetup.title}</h2>
            {meetup.meetupType === 'screen' && (
              <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">스크린</span>
            )}
          </div>
          <p className="text-green-600 font-bold mb-4">{meetup.golfCourse}</p>

          <div className="space-y-2 text-sm text-gray-600 border-t pt-4">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span>{meetup.date}</span>
            </div>
            {meetup.meetupType === 'screen' ? (
              <>
                {meetup.cartTimes?.[0] && (
                  <div className="flex items-center gap-2">
                    <span>⏰</span>
                    <span>{formatTime(meetup.cartTimes[0])}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span>👥</span>
                  <span>{meetup.playerCount}명 모집</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>🛒</span>
                  <span>{meetup.cartCount}카트 ({meetup.cartCount * 4}명 정원)</span>
                </div>
                {/* ✅ 그린피 표시 */}
                {meetup.greenFee > 0 && (
                  <div className="flex items-center gap-2">
                    <span>💰</span>
                    <span className="font-bold text-green-600">그린피 {meetup.greenFee.toLocaleString()}원 (1인)</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 조별 티타임 (필드) */}
        {meetup.meetupType !== 'screen' && meetup.cartTimes?.length > 0 && (
          <div className="bg-white p-5 rounded-3xl shadow-sm">
            <h3 className="font-bold text-sm text-gray-500 mb-3">조별 티오프 시간</h3>
            <div className="grid grid-cols-2 gap-2">
              {meetup.cartTimes.map((time: string, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-2xl border border-green-100">
                  <span className="text-[11px] font-black text-green-700">{idx + 1}조</span>
                  <span className="text-sm font-black text-gray-800">{formatTime(time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 참여 현황 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">참여 멤버 ({participants.length}명)</h3>
            <span className="text-gray-400 font-normal text-sm">최대 {maxPlayers}명</span>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>참여 현황</span>
              <span className="font-bold">{participants.length} / {maxPlayers}명</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${isFull ? 'bg-red-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min((participants.length / maxPlayers) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {participants.length === 0 ? (
              <p className="text-gray-400 text-sm py-2">가장 먼저 참여해보세요! ⛳</p>
            ) : (
              participants.map((p: any, idx: number) => (
                <span key={idx} className={`px-4 py-2 rounded-full text-sm font-bold ${
                  p.name === myName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {p.nickname || p.name}
                </span>
              ))
            )}
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="flex gap-3">
          {/* ✅ 카카오 공유 버튼 */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-5 py-4 bg-[#FEE500] rounded-2xl font-bold text-[#191919] active:scale-95 transition-all"
          >
            <span className="text-lg">💬</span>
            <span className="text-sm">카톡 공유</span>
          </button>

          {/* 참여/취소 버튼 */}
          <button
            onClick={handleJoin}
            className={`flex-1 p-4 rounded-2xl font-bold transition-all active:scale-95 ${
              isJoined ? 'bg-gray-200 text-gray-600' : 'bg-green-600 text-white shadow-lg shadow-green-200'
            }`}
          >
            {isJoined ? '참여 취소하기' : '나도 갈래요! ⛳'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MeetupDetailPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <MeetupDetailContent />
    </Suspense>
  );
}