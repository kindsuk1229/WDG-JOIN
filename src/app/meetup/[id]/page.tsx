'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Badge } from '@/components/UI';
import { initKakao, shareToKakao } from '@/lib/kakao';

export default function MeetupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [meetup, setMeetup] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]); 
  const [loading, setLoading] = useState(true);

  const myName = "김근석"; 

  useEffect(() => {
    if (typeof initKakao === 'function') initKakao();

    const savedMeetups = localStorage.getItem('meetups');
    const savedParticipants = localStorage.getItem(`participants_${params.id}`);

    if (savedMeetups) {
      const list = JSON.parse(savedMeetups);
      const found = list.find((m: any) => String(m.id) === String(params.id));
      
      if (found) {
        setMeetup(found);
        const pList = savedParticipants ? JSON.parse(savedParticipants) : [found.author || "운영진"];
        setParticipants(pList);
        setJoined(pList.includes(myName));
      }
    }
    setLoading(false);
  }, [params.id]);

  const handleDelete = () => {
    if (!confirm("이 벙개를 정말 삭제하시겠습니까?")) return;

    const savedMeetups = localStorage.getItem('meetups');
    if (savedMeetups) {
      const list = JSON.parse(savedMeetups);
      const filteredList = list.filter((m: any) => String(m.id) !== String(params.id));
      localStorage.setItem('meetups', JSON.stringify(filteredList));
      localStorage.removeItem(`participants_${params.id}`);
      
      alert("벙개가 삭제되었습니다.");
      router.push('/');
    }
  };

  const toggleJoin = () => {
    let newParticipants = [...participants];
    if (joined) {
      newParticipants = newParticipants.filter(p => p !== myName);
    } else {
      if (!newParticipants.includes(myName)) newParticipants.push(myName);
    }
    setParticipants(newParticipants);
    setJoined(!joined);
    localStorage.setItem(`participants_${params.id}`, JSON.stringify(newParticipants));
  };

  const handleShare = () => {
    if (!meetup) return;
    const title = `⛳ [WDG] 벙개: ${meetup.title}`;
    const desc = `📍 장소: ${meetup.golfCourse}\n📅 일시: ${meetup.date} ${meetup.time}\n👥 참여: ${participants.length}명`;
    shareToKakao(window.location.href, title, desc);
  };

  if (loading) {
    return <div className="p-20 text-center font-bold text-gray-400">정보 확인 중...</div>;
  }

  if (!meetup) {
    return (
      <div className="p-20 text-center">
        <p className="text-gray-400 mb-4 font-bold">삭제되었거나 없는 벙개 정보입니다.</p>
        <button onClick={() => router.push('/')} className="text-green-600 font-bold underline">메인 리스트로 가기</button>
      </div>
    );
  }

  return (
    <main className="max-w-md mx-auto bg-white min-h-screen pb-32 text-gray-900 shadow-lg relative font-sans">
      <header className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-2 text-xl hover:bg-gray-100 rounded-full transition-all">←</button>
          <h1 className="text-lg font-bold">벙개 상세</h1>
        </div>
        <div className="flex items-center gap-2">
          {myName === "김근석" && (
            <button onClick={handleDelete} className="text-xs font-bold text-red-500 px-3 py-1.5 bg-red-50 rounded-lg">삭제</button>
          )}
          <button onClick={handleShare} className="text-sm font-bold text-green-600 px-3 py-1.5 bg-green-50 rounded-lg">공유</button>
        </div>
      </header>

      <div className="p-6 space-y-8">
        <section className="space-y-3">
          <Badge color="green">모집중</Badge>
          <h2 className="text-2xl font-black leading-tight">{meetup.title}</h2>
          <div className="bg-gray-50 p-5 rounded-3xl space-y-3 text-sm font-medium border border-gray-100 shadow-sm">
            <p>📍 {meetup.golfCourse}</p>
            <p>📅 {meetup.date} {meetup.time}</p>
            <p>👥 {meetup.cartCount} 카트 모집</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold">참가자 명단</h3>
            <span className="text-green-600 font-extrabold text-sm">{participants.length}명 참여 중</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {participants.map((name, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-xl border border-green-100 shadow-inner">👤</div>
                <span className="text-xs font-bold text-gray-600">{name}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 4 - participants.length) }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 opacity-20">
                <div className="w-12 h-12 bg-gray-100 rounded-full border-2 border-dashed border-gray-300" />
                <span className="text-xs font-medium text-gray-300">대기</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 max-w-md w-full p-5 bg-white border-t flex gap-3 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button onClick={handleShare} className="bg-yellow-400 p-4 rounded-2xl text-2xl active:scale-95 transition-all flex items-center justify-center min-w-[64px] shadow-sm">💬</button>
        <button 
          onClick={toggleJoin}
          className={`flex-1 p-4 rounded-2xl font-bold transition-all text-lg shadow-lg ${
            joined ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white shadow-green-100'
          }`}
        >
          {joined ? '참가 신청 취소' : '지금 참가 신청하기 ⛳'}
        </button>
      </div>
    </main>
  );
}