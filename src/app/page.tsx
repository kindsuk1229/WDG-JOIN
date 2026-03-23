'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/UI';

export default function Home() {
  const [notice, setNotice] = useState<string>('매너 골프가 즐거운 모임을 만듭니다! ⛳');
  const [isEditingNotice, setIsEditingNotice] = useState<boolean>(false);
  const [tempNotice, setTempNotice] = useState<string>(notice);
  const [meetups, setMeetups] = useState<any[]>([]);

  // 핵심 수정: 페이지가 보일 때마다 저장소에서 최신 데이터를 새로고침함
  useEffect(() => {
    const loadData = () => {
      const saved = localStorage.getItem('meetups');
      if (saved) {
        try {
          const parsedData = JSON.parse(saved);
          // 데이터가 배열인지 확인 후 최신순으로 정렬해서 넣기
          setMeetups(Array.isArray(parsedData) ? parsedData : []);
        } catch (e) {
          console.error("데이터 읽기 오류:", e);
          setMeetups([]);
        }
      }
    };

    loadData();
    // 윈도우 포커스가 돌아올 때(창 전환 등) 다시 불러오기
    window.addEventListener('focus', loadData);
    return () => window.removeEventListener('focus', loadData);
  }, []);

  const saveNotice = () => {
    setNotice(tempNotice);
    setIsEditingNotice(false);
  };

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24 text-gray-900">
      <header className="p-5 flex justify-between items-center bg-white sticky top-0 z-30 border-b border-gray-100">
        <h1 className="text-2xl font-black text-green-700 italic tracking-tighter">WDG</h1>
        <div className="flex gap-3 items-center">
          <Avatar name="근석님" size={32} />
        </div>
      </header>

      <div className="p-5 space-y-8">
        <section>
          <h2 className="text-xl font-bold text-gray-800 leading-tight">
            반갑습니다, 근석님!<br />
            오늘의 골프 일정은 어떠신가요? ⛳
          </h2>
          <div className="mt-6">
            <Link href="/settlement" className="flex items-center justify-between bg-green-600 p-5 rounded-2xl shadow-lg active:scale-95 transition-all text-white">
              <div>
                <p className="text-xs opacity-80 mb-1 font-bold">라운딩 후 복잡한 계산은 그만!</p>
                <h3 className="text-lg font-bold">💰 초간편 정산하기</h3>
              </div>
              <span className="text-3xl">→</span>
            </Link>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-bold text-gray-800">나의 벙개 일정</h3>
            <Link href="/create-meetup" className="text-xs text-green-600 font-bold">+ 벙개 만들기</Link>
          </div>

          {meetups.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <span className="text-4xl mb-3">🕳️</span>
              <p className="text-gray-400 text-sm font-medium">아직 예정된 라운딩이 없어요.<br />새로운 벙개를 만들어보세요!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetups.map((m, idx) => (
                <div key={m.id || idx} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-lg font-bold">모집중</div>
                    <span className="text-xs text-gray-400 font-medium">{m.golfCourse}</span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-1">{m.title || '무제한 벙개'}</h4>
                  <p className="text-sm text-gray-500 font-medium">{m.date} · {m.time}</p>
                  <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-50">
                    <span className="text-sm font-extrabold text-green-600">{m.cartCount}카트 모집</span>
                    <Link 
                      href={`/meetup/${m.id}`} 
                      className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    >
                      상세보기
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4 text-gray-900">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">📢 우동골 공지사항</h3>
            {!isEditingNotice ? (
              <button onClick={() => setIsEditingNotice(true)} className="text-xs text-gray-400 font-medium">편집</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditingNotice(false)} className="text-xs text-gray-400 font-medium font-bold">취소</button>
                <button onClick={saveNotice} className="text-xs text-green-600 font-bold">저장</button>
              </div>
            )}
          </div>
          {!isEditingNotice ? (
            <p className="text-sm text-gray-600 leading-relaxed font-medium">{notice}</p>
          ) : (
            <textarea 
              value={tempNotice}
              onChange={(e) => setTempNotice(e.target.value)}
              className="w-full h-24 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
            />
          )}
        </section>
      </div>
    </main>
  );
}