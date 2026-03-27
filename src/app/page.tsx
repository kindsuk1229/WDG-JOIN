'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import KakaoLoginButton from '@/components/KakaoLogin';

export default function Home() {
  const router = useRouter();
  const [meetups, setMeetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('회원');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 공지사항
  const [notice, setNotice] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [tempNotice, setTempNotice] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);

  useEffect(() => {
    const status = localStorage.getItem('isLoggedIn');
    const savedName = localStorage.getItem('user_name') || '회원';
    if (status === 'true') {
      setIsLoggedIn(true);
      setUserName(savedName);

      // 관리자 여부 확인
      const checkAdmin = async () => {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', savedName.trim()));
          setIsAdmin(adminDoc.exists());
        } catch (error) {
          console.error('관리자 확인 실패:', error);
        }
      };
      checkAdmin();
    }
    setCheckingAuth(false);

    // 공지사항 실시간 구독
    const unsubscribe = onSnapshot(doc(db, 'notice', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        setNotice(docSnap.data().content || '');
      }
    });

    // 벙개 목록
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

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // 공지사항 저장
  const handleSaveNotice = async () => {
    setSavingNotice(true);
    try {
      await setDoc(doc(db, 'notice', 'main'), {
        content: tempNotice,
        updatedAt: new Date().toISOString(),
        updatedBy: userName,
      });
      setIsEditingNotice(false);
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingNotice(false);
    }
  };

  if (checkingAuth) {
    return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  }

  if (!isLoggedIn) {
    return <KakaoLoginButton />;
  }

  return (
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
        {/* Welcome */}
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

        {/* Meetups */}
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

        {/* 공지사항 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📢</span>
              <h3 className="font-bold">우동골 공지사항</h3>
            </div>
            {/* ✅ 관리자만 수정 버튼 표시 */}
            {isAdmin && !isEditingNotice && (
              <button
                onClick={() => {
                  setTempNotice(notice);
                  setIsEditingNotice(true);
                }}
                className="text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100"
              >
                ✏️ 수정
              </button>
            )}
          </div>

          {isEditingNotice ? (
            // 수정 모드
            <div className="space-y-3">
              <textarea
                value={tempNotice}
                onChange={(e) => setTempNotice(e.target.value)}
                rows={4}
                className="w-full p-3 bg-gray-50 rounded-2xl text-sm text-gray-700 leading-relaxed border border-gray-200 focus:ring-2 focus:ring-green-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingNotice(false)}
                  className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-500"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveNotice}
                  disabled={savingNotice}
                  className="flex-1 py-2.5 bg-green-600 rounded-xl text-sm font-bold text-white"
                >
                  {savingNotice ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          ) : (
            // 표시 모드
            <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">
              {notice || '공지사항이 없습니다.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}