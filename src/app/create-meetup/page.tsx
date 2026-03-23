'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateMeetupPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [golfCourse, setGolfCourse] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cartCount, setCartCount] = useState(1);

  const totalPlayers = cartCount * 4;
  const cartOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 데이터 객체 생성
    const newMeetup = {
      id: Date.now(),
      title: title || 'WDG 벙개',
      golfCourse,
      date,
      time,
      cartCount,
      players: 1,
    };

    // 로컬 스토리지 저장
    const savedMeetups = JSON.parse(localStorage.getItem('meetups') || '[]');
    localStorage.setItem('meetups', JSON.stringify([newMeetup, ...savedMeetups]));

    alert(`⛳ 벙개 등록 완료!\n${golfCourse} / ${cartCount}카트`);
    router.push('/'); 
  };

  return (
    <main className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-700">새로운 벙개 만들기</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">벙개 제목</label>
            <input 
              type="text" 
              required
              placeholder="예: WDG 정기 라운딩" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">골프장 이름</label>
            <input 
              type="text" 
              required
              placeholder="예: 샤인데일 CC" 
              value={golfCourse}
              onChange={(e) => setGolfCourse(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">날짜</label>
              <input 
                type="date" 
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">티타임</label>
              <input 
                type="time" 
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase">모집 규모</label>
            <div className="relative">
              <select 
                value={cartCount}
                onChange={(e) => setCartCount(Number(e.target.value))}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 font-bold text-lg appearance-none"
              >
                {cartOptions.map(num => (
                  <option key={num} value={num}>{num}카트 ({num * 4}명)</option>
                ))}
              </select>
              <div className="absolute right-4 top-4 pointer-events-none text-gray-400">▼</div>
            </div>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-green-600 text-white p-5 rounded-2xl font-bold shadow-xl active:scale-95 transition-all text-lg"
        >
          벙개 등록하기 ⛳
        </button>
      </form>
    </main>
  );
}