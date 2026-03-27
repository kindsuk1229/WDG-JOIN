'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

function MeetupDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('id');

  const [meetup, setMeetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).substr(2, 9);
    const savedName = localStorage.getItem('user_name') || '익명';
    const savedNickname = localStorage.getItem('user_nickname') || '';
    setMyId(savedId);
    setMyName(savedName.trim());
    setMyNickname(savedNickname.trim());
    if (!localStorage.getItem('user_id')) localStorage.setItem('user_id', savedId);

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

  const handleJoin = async () => {
    if (!meetupId) return;
    const isJoined = meetup.participants?.some((p: any) => p.id === myId);

    try {
      const meetupRef = doc(db, 'meetups', meetupId);
      if (isJoined) {
        // ✅ 취소 시 id 기준으로 제거 (닉네임 변경돼도 안전하게)
        const updatedParticipants = meetup.participants.filter((p: any) => p.id !== myId);
        await updateDoc(meetupRef, { participants: updatedParticipants });
        alert('참여가 취소되었습니다. ⛳');
      } else {
        // ✅ 참여 시 닉네임도 함께 저장
        await updateDoc(meetupRef, {
          participants: arrayUnion({
            id: myId,
            name: myName,
            nickname: myNickname, // 닉네임 추가
          })
        });
        alert('참여 신청이 완료되었습니다! ⛳');
      }
      window.location.reload();
    } catch (error) {
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="p-10 text-center">로딩 중...</div>;
  if (!meetup) return <div className="p-10 text-center">존재하지 않는 벙개입니다.</div>;

  const participants = meetup.participants || [];
  const isJoined = participants.some((p: any) => p.id === myId);

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold">←</button>
        <h1 className="text-xl font-bold">벙개 상세 정보</h1>
      </header>

      <div className="p-5 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <h2 className="text-2xl font-black text-gray-800 mb-2">{meetup.title}</h2>
          <p className="text-green-600 font-bold mb-4">{meetup.golfCourse}</p>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 border-t pt-4">
            <div>📅 {meetup.date}</div>
            <div>⏰ {meetup.time}</div>
            <div>🛒 {meetup.cartCount}카트 ({meetup.cartCount * 4}명 정원)</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold mb-4 flex justify-between">
            <span>참여 멤버 ({participants.length}명)</span>
            <span className="text-gray-400 font-normal text-sm">
              최대 {meetup.cartCount * 4}명
            </span>
          </h3>

          <div className="flex flex-wrap gap-2">
            {participants.length === 0 ? (
              <p className="text-gray-400 text-sm py-2">가장 먼저 참여해보세요! ⛳</p>
            ) : (
              participants.map((p: any, idx: number) => (
                <span key={idx} className="px-4 py-2 bg-gray-100 rounded-full text-sm font-bold">
                  {/* ✅ 닉네임 있으면 닉네임, 없으면 실명 표시 */}
                  {p.nickname || p.name}
                </span>
              ))
            )}
          </div>
        </div>

        <button
          onClick={handleJoin}
          className={`w-full p-5 rounded-2xl font-bold shadow-xl transition-all ${
            isJoined ? 'bg-gray-200 text-gray-600' : 'bg-green-600 text-white'
          }`}
        >
          {isJoined ? '참여 취소하기' : '나도 갈래요! ⛳'}
        </button>
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