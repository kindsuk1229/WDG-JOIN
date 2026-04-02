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
  const [joining, setJoining] = useState(false);

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
    if (!meetupId || joining) return;
    setJoining(true);

    const participants = meetup.participants || [];
    const waitlist = meetup.waitlist || [];
    const maxPlayers = meetup.meetupType === 'screen'
      ? meetup.playerCount
      : (meetup.cartCount || 0) * 4;

    const isJoined = participants.some((p: any) => p.name === myName);
    const isWaiting = waitlist.some((p: any) => p.name === myName);
    const isFull = participants.length >= maxPlayers;

    try {
      const meetupRef = doc(db, 'meetups', meetupId);

      if (isJoined) {
        // ✅ 참여 취소 → 대기자 1번 자동 승격
        const updatedParticipants = participants.filter((p: any) => p.name !== myName);
        const updatedWaitlist = [...waitlist];
        let promoted = null;

        if (updatedWaitlist.length > 0) {
          promoted = updatedWaitlist.shift(); // 대기 1번 꺼내기
          updatedParticipants.push(promoted);
        }

        await updateDoc(meetupRef, {
          participants: updatedParticipants,
          waitlist: updatedWaitlist,
          status: updatedParticipants.length >= maxPlayers ? 'closed' : 'open',
        });

        // 대기자 승격 알림
        if (promoted) {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserName: promoted.name,
              title: '⛳ 벙개 참여 확정!',
              body: `"${meetup.title}" 대기에서 참여로 확정됐어요!`,
              url: `/meetup-detail?id=${meetupId}`,
            }),
          });
        }

        // 등록자 알림
        if (meetup.creatorId && meetup.creatorId !== myName) {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserName: meetup.creatorId,
              title: '⛳ 참여 취소 알림',
              body: `${myNickname || myName}님이 "${meetup.title}" 참여를 취소했어요.${promoted ? ` (${promoted.nickname || promoted.name}님 대기 → 참여 승격)` : ''}`,
              url: `/meetup-detail?id=${meetupId}`,
            }),
          });
        }
        alert('참여가 취소되었습니다. ⛳');

      } else if (isWaiting) {
        // ✅ 대기 취소
        const updatedWaitlist = waitlist.filter((p: any) => p.name !== myName);
        await updateDoc(meetupRef, { waitlist: updatedWaitlist });
        alert('대기가 취소되었습니다.');

      } else if (isFull) {
        // ✅ 대기 신청
        const updatedWaitlist = [...waitlist, { name: myName, nickname: myNickname, joinedAt: new Date().toISOString() }];
        await updateDoc(meetupRef, { waitlist: updatedWaitlist });

        // 등록자에게 대기 알림
        if (meetup.creatorId && meetup.creatorId !== myName) {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserName: meetup.creatorId,
              title: '⛳ 대기 신청 알림',
              body: `${myNickname || myName}님이 "${meetup.title}" 대기를 신청했어요!`,
              url: `/meetup-detail?id=${meetupId}`,
            }),
          });
        }
        alert(`대기 신청 완료! 현재 대기 ${updatedWaitlist.length}번이에요.`);

      } else {
        // ✅ 참여 신청
        const updatedParticipants = [...participants, { name: myName, nickname: myNickname }];
        const newIsFull = updatedParticipants.length >= maxPlayers;

        await updateDoc(meetupRef, {
          participants: updatedParticipants,
          ...(newIsFull ? { status: 'closed' } : {}),
        });

        if (meetup.creatorId && meetup.creatorId !== myName) {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserName: meetup.creatorId,
              title: newIsFull ? '⛳ 벙개 마감!' : '⛳ 새 참여자 알림',
              body: newIsFull
                ? `"${meetup.title}" 정원이 모두 찼어요!`
                : `${myNickname || myName}님이 "${meetup.title}"에 참여했어요!`,
              url: `/meetup-detail?id=${meetupId}`,
            }),
          });
        }
        alert(newIsFull ? '참여 완료! 벙개가 마감되었습니다 ⛳' : '참여 신청이 완료되었습니다! ⛳');
      }

      window.location.reload();
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setJoining(false);
    }
  };

  const handleManualClose = async () => {
    if (!window.confirm('벙개를 마감 처리하시겠습니까?\n정원 미달이어도 진행하는 경우 사용하세요.')) return;
    try {
      await updateDoc(doc(db, 'meetups', meetupId!), { status: 'manually_closed' });
      alert('벙개가 마감 처리되었습니다! ⛳');
      window.location.reload();
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const handleShare = () => {
    if (!meetup) return;

    const shortDate = meetup.date ? (() => {
      const d = new Date(meetup.date + 'T00:00:00');
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
    })() : '';

    const timeStr = meetup.cartTimes?.[0] ? (() => {
      const [h, m] = meetup.cartTimes[0].split(':').map(Number);
      const isPM = h >= 12;
      const hour12 = h % 12 || 12;
      return `${isPM ? '오후' : '오전'} ${hour12}:${String(m).padStart(2, '0')}`;
    })() : '';

    const title = `${meetup.title} ! ${meetup.golfCourse}`;
    const participantNames = (meetup.participants || [])
      .map((p: any) => p.nickname || p.name)
      .join(', ');
    const description = [
      `${shortDate}${timeStr ? ` ${timeStr}` : ''}`,
      participantNames ? `참 : ${participantNames}` : '',
      `👉 벙개 참여하기`,
    ].filter(Boolean).join('\n');

    shareToKakao(window.location.href, title, description);
  };

  if (loading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!meetup) return <div className="p-10 text-center">존재하지 않는 벙개입니다.</div>;

  const participants = meetup.participants || [];
  const waitlist = meetup.waitlist || [];
  const isJoined = participants.some((p: any) => p.name === myName);
  const isWaiting = waitlist.some((p: any) => p.name === myName);
  const isParticipant = isJoined;
  const maxPlayers = meetup.meetupType === 'screen' ? meetup.playerCount : (meetup.cartCount || 0) * 4;
  const isFull = participants.length >= maxPlayers;

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const isPM = h >= 12;
    const hour12 = h % 12 || 12;
    return `${isPM ? '오후' : '오전'} ${hour12}:${String(m).padStart(2, '0')}`;
  };

  const myWaitPosition = waitlist.findIndex((p: any) => p.name === myName) + 1;

  // 버튼 텍스트/색상 결정
  const getButtonStyle = () => {
    if (joining) return { text: '처리 중...', className: 'bg-gray-300 text-gray-400' };
    if (isJoined) return { text: '참여 취소하기', className: 'bg-gray-200 text-gray-600' };
    if (isWaiting) return { text: `대기 취소 (${myWaitPosition}번)`, className: 'bg-orange-100 text-orange-600' };
    if (isFull) return { text: '대기 신청하기', className: 'bg-orange-500 text-white shadow-lg shadow-orange-200' };
    return { text: '나도 갈래요! ⛳', className: 'bg-green-600 text-white shadow-lg shadow-green-200' };
  };

  const buttonStyle = getButtonStyle();

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-xl font-bold">←</button>
          <h1 className="text-xl font-bold">벙개 상세 정보</h1>
        </div>
        <div className="flex gap-2">
          {(isAdmin || meetup?.creatorId === myName || isParticipant) && (
            <button onClick={() => router.push(`/create-meetup?id=${meetup?.id}`)}
              className="text-green-600 text-sm font-bold px-3 py-1.5 bg-green-50 rounded-lg">수정</button>
          )}
          {(isAdmin || meetup?.creatorId === myName) && (
            <button onClick={handleDelete}
              className="text-red-500 text-sm font-bold px-3 py-1.5 bg-red-50 rounded-lg">삭제</button>
          )}
        </div>
      </header>

      <div className="p-5 space-y-5">
        {/* 기본 정보 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-black text-gray-800">{meetup.title}</h2>
            {meetup.meetupType === 'screen' && (
              <span className="text-[13px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">스크린</span>
            )}
            {isFull && (
              <span className="text-[13px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold">마감</span>
            )}
          </div>
          <p className="text-green-600 font-bold mb-4">{meetup.golfCourse}</p>

          <div className="space-y-2 text-base text-gray-600 border-t pt-4">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span>{meetup.date ? (() => {
                const d = new Date(meetup.date + 'T00:00:00');
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                return `${meetup.date} (${days[d.getDay()]})`;
              })() : '-'}</span>
            </div>
            {meetup.meetupType === 'screen' ? (
              <>
                {meetup.cartTimes?.[0] && (
                  <div className="flex items-center gap-2"><span>⏰</span><span>{formatTime(meetup.cartTimes[0])}</span></div>
                )}
                <div className="flex items-center gap-2"><span>👥</span><span>{meetup.playerCount}명 모집</span></div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2"><span>🛒</span><span>{meetup.cartCount}카트 ({meetup.cartCount * 4}명 정원)</span></div>
                {meetup.greenFee > 0 && (
                  <div className="flex items-center gap-2"><span>💰</span><span className="font-bold text-green-600">그린피 {meetup.greenFee.toLocaleString()}원 (1인)</span></div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 조별 티타임 */}
        {meetup.meetupType !== 'screen' && meetup.cartTimes?.length > 0 && (
          <div className="bg-white p-5 rounded-3xl shadow-sm">
            <h3 className="font-bold text-base text-gray-500 mb-3">조별 티오프 시간</h3>
            <div className="grid grid-cols-2 gap-2">
              {meetup.cartTimes.map((time: string, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-2xl border border-green-100">
                  <span className="text-[13px] font-black text-green-700">{idx + 1}조</span>
                  <span className="text-base font-black text-gray-800">{formatTime(time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 참여 현황 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base">참여 멤버 ({participants.length}명)</h3>
            <span className="text-gray-400 text-base">최대 {maxPlayers}명</span>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[13px] text-gray-400 mb-1">
              <span>참여 현황</span>
              <span className="font-bold">{participants.length} / {maxPlayers}명</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full ${isFull ? 'bg-red-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min((participants.length / maxPlayers) * 100, 100)}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {participants.length === 0 ? (
              <p className="text-gray-400 text-base py-2">가장 먼저 참여해보세요! ⛳</p>
            ) : (
              participants.map((p: any, idx: number) => (
                <span key={idx} className={`px-4 py-2 rounded-full text-base font-bold ${
                  p.name === myName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {p.nickname || p.name}
                </span>
              ))
            )}
          </div>
        </div>

        {/* ✅ 대기자 목록 */}
        {waitlist.length > 0 && (
          <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100">
            <h3 className="font-bold text-base text-orange-700 mb-3">
              대기자 ({waitlist.length}명)
            </h3>
            <div className="space-y-2">
              {waitlist.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-[13px] font-black text-orange-500 w-6">{idx + 1}</span>
                  <span className={`text-base font-bold ${p.name === myName ? 'text-orange-600' : 'text-gray-700'}`}>
                    {p.nickname || p.name}
                    {p.name === myName && <span className="ml-1 text-[13px]">(나)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          <button onClick={handleShare}
            className="flex items-center justify-center gap-2 px-5 py-4 bg-[#FEE500] rounded-2xl font-bold text-[#191919] active:scale-95 transition-all">
            <span className="text-lg">💬</span>
            <span className="text-base">카톡 공유</span>
          </button>

          <button onClick={handleJoin} disabled={joining}
            className={`flex-1 p-4 rounded-2xl font-bold transition-all active:scale-95 ${buttonStyle.className}`}>
            {buttonStyle.text}
          </button>
        </div>

        {/* ✅ 관리자/등록자만 수동 마감 버튼 표시 */}
        {(isAdmin || meetup?.creatorId === myName) && meetup?.status !== 'closed' && meetup?.status !== 'manually_closed' && meetup?.status !== 'completed' && meetup?.status !== 'cancelled' && (
          <button
            onClick={handleManualClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gray-800 text-white active:scale-95 transition-all"
          >
            🔒 벙개 수동 마감하기
          </button>
        )}
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