'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import KakaoLoginButton from '@/components/KakaoLogin';

export default function Home() {
  const router = useRouter();
  const [meetups, setMeetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('회원');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const status = localStorage.getItem('isLoggedIn');
    const savedName = localStorage.getItem('user_name');
    if (status === 'true') {
      setIsLoggedIn(true);
      setUserName(savedName || '회원');
    }
    setCheckingAuth(false);

    const fetchMeetups = async () => {
      try {
        const q = query(
          collection(db, "meetups"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMeetups(data);
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetups();
  }, []);

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (checkingAuth) {
    return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  }

  if (!isLoggedIn) {
    return <KakaoLoginButton />;
  }

  return (
    // ✅ 핵심 수정:
    // - max-w-md, min-h-screen 제거 (layout.tsx가 이미 처리)
    // - pb-24 제거 (layout의 pb-20이 처리)
    // - BottomNav 임포트/렌더링 완전 제거 (layout.tsx에서만 렌더링)
    <div className="bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="p-4 bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <h1 className="text-2xl font-black text-green-600 italic">WDG</h1>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">
            {userName}님
          </div>
          <button
            onClick={handleLogout}
            className="text-[11px] text-gray-400 underline decoration-gray-300"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="p-5 space-y-8">
        {/* Welcome Msg */}
        <div>
          <h2 className="text-xl font-bold leading-tight">
            반갑습니다, {userName}님!<br />
            오늘의 골프 일정은 어떠신가요? ⛳
          </h2>
        </div>

        {/* Quick Action */}
        <div
          onClick={() => router.push('/settlement')}
          className="bg-green-600 p-6 rounded-3xl shadow-lg shadow-green-100 flex justify-between items-center cursor-pointer active:scale-95 transition-all"
        >
          <div>
            <p className="text-green-100 text-xs font-bold mb-1">라운딩 후 복잡한 계산은 그만!</p>
            <p className="text-white text-xl font-black">💰 초간편 정산하기</p>
          </div>
          <span className="text-white text-2xl">→</span>
        </div>

        {/* My Meetups List */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-bold">나의 벙개 일정</h3>
            <button
              onClick={() => router.push('/create-meetup')}
              className="text-green-600 text-sm font-bold"
            >
              + 벙개 만들기
            </button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                일정을 불러오는 중...
              </div>
            ) : meetups.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-gray-200 text-center">
                <p className="text-gray-400 text-sm">아직 예정된 라운딩이 없어요.<br />새로운 벙개를 만들어보세요!</p>
              </div>
            ) : (
              meetups.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/meetup-detail?id=${item.id}`)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer active:bg-gray-50"
                >
                  <div>
                    <p className="font-bold text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.golfCourse} | {item.date} {item.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-600 font-bold text-sm">{item.cartCount}카트</p>
                    <p className="text-[10px] text-gray-300 font-bold">참여하기</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notice */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📢</span>
            <h3 className="font-bold">우동골 공지사항</h3>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            매너 골프가 즐거운 모임을 만듭니다! ⛳<br />
            노쇼 방지를 위해 최소 3일 전 취소 부탁드립니다.
          </p>
        </div>
      </div>
    </div>
  );
}