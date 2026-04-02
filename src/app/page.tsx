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

  const [notice, setNotice] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [tempNotice, setTempNotice] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const status = localStorage.getItem('isLoggedIn');
    const savedName = localStorage.getItem('user_name') || '회원';

    if (status === 'true') {
      setIsLoggedIn(true);
      setUserName(savedName);

      const checkAdmin = async () => {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', savedName.trim()));
          setIsAdmin(adminDoc.exists());
        } catch (error) {
          console.error('관리자 확인 실패:', error);
        }
      };
      checkAdmin();

      const syncUserFromFirebase = async () => {
        try {
          const userRef = doc(db, 'users', savedName.trim());
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              name: savedName.trim(),
              nickname: localStorage.getItem('user_nickname') || '',
              joinedAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            });
          } else {
            const firebaseNickname = userSnap.data().nickname || '';
            localStorage.setItem('user_nickname', firebaseNickname);
            await setDoc(userRef, {
              ...userSnap.data(),
              lastLoginAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('유저 동기화 실패:', error);
        }
      };
      syncUserFromFirebase();

      const installGuideShown = localStorage.getItem('installGuideShown');
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!installGuideShown && !isStandalone) {
        setTimeout(() => setShowInstallGuide(true), 1000);
      }
    }
    setCheckingAuth(false);

    const unsubscribe = onSnapshot(doc(db, 'notice', 'main'), (docSnap) => {
      if (docSnap.exists()) setNotice(docSnap.data().content || '');
    });

    const fetchMeetups = async () => {
      try {
        const q = query(collection(db, "meetups"), orderBy("createdAt", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        // ✅ cancelled, completed 제외
        const data = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((m: any) => m.status !== 'cancelled' && m.status !== 'completed' && m.status !== 'closed' && m.status !== 'manually_closed');
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
      const installGuideShown = localStorage.getItem('installGuideShown');
      localStorage.clear();
      if (installGuideShown) localStorage.setItem('installGuideShown', installGuideShown);
      window.location.reload();
    }
  };

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

  const handleInstallGuideClose = (confirmed: boolean) => {
    setShowInstallGuide(false);
    if (confirmed) localStorage.setItem('installGuideShown', 'true');
  };

  if (checkingAuth) {
    return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  }

  if (!isLoggedIn) {
    return <KakaoLoginButton />;
  }

  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateStr} (${days[d.getDay()]})`;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="p-4 bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <h1 className="text-2xl font-black text-green-600 italic">WDG</h1>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-orange-100 rounded-full text-orange-600 font-bold text-base">
            {userName}님
          </div>
          <button onClick={handleLogout} className="text-[17px] text-gray-400 underline decoration-gray-300">
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => router.push('/settlement')}
            className="bg-green-600 p-5 rounded-3xl shadow-lg shadow-green-100 flex flex-col justify-between cursor-pointer active:scale-95 transition-all col-span-2"
          >
            <p className="text-green-100 text-base font-bold mb-1">라운딩 후 복잡한 계산은 그만!</p>
            <div className="flex justify-between items-center">
              <p className="text-white text-xl font-black">💰 초간편 정산하기</p>
              <span className="text-white text-2xl">→</span>
            </div>
          </div>

          <div
            onClick={() => router.push('/members')}
            className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-2xl">👥</span>
            <p className="font-black text-gray-800">멤버</p>
            <p className="text-[17px] text-gray-400">가입자 명단 보기</p>
          </div>

          <div
            onClick={() => router.push('/create-meetup')}
            className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-2xl">⛳</span>
            <p className="font-black text-gray-800">벙개 만들기</p>
            <p className="text-[17px] text-gray-400">새 라운딩 개설</p>
          </div>
        </div>

        {/* ✅ 현재 벙개 일정 (최근 3개 미리보기) */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-bold">현재 벙개 일정</h3>
            <button
              onClick={() => router.push('/meetups')}
              className="text-green-600 text-base font-bold"
            >
              전체보기 →
            </button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                일정을 불러오는 중...
              </div>
            ) : meetups.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-gray-200 text-center">
                <p className="text-gray-400 text-base">아직 예정된 라운딩이 없어요.<br />새로운 벙개를 만들어보세요!</p>
              </div>
            ) : (
              meetups.map((item) => {
                const participants = item.participants || [];
                const maxPlayers = item.meetupType === 'screen'
                  ? item.playerCount
                  : (item.cartCount || 0) * 4;
                const isFull = participants.length >= maxPlayers;
                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/meetup-detail?id=${item.id}`)}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-800">{item.title}</p>
                          {item.meetupType === 'screen' && (
                            <span className="text-[16px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold">스크린</span>
                          )}
                        </div>
                        <p className="text-base text-gray-400">{item.golfCourse} | {formatDateWithDay(item.date)}</p>
                      </div>
                      <span className={`text-[17px] px-2 py-1 rounded-lg font-bold flex-shrink-0 ${isFull ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                        {isFull ? '마감' : '모집중'}
                      </span>
                    </div>
                    {/* ✅ 그린피 표시 (필드 벙개만) */}
                    {item.meetupType !== 'screen' && item.greenFee > 0 && (
                      <p className="text-[17px] text-green-600 font-bold mt-1">
                        💰 그린피 {item.greenFee.toLocaleString()}원
                      </p>
                    )}
                    <div className="mt-3">
                      <div className="flex justify-between text-[17px] text-gray-400 mb-1">
                        <span>참여 현황</span>
                        <span className="font-bold text-gray-600">{participants.length} / {maxPlayers}명</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-red-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.min((participants.length / maxPlayers) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
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
            {isAdmin && !isEditingNotice && (
              <button
                onClick={() => { setTempNotice(notice); setIsEditingNotice(true); }}
                className="text-[17px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100"
              >
                ✏️ 수정
              </button>
            )}
          </div>
          {isEditingNotice ? (
            <div className="space-y-3">
              <textarea
                value={tempNotice}
                onChange={(e) => setTempNotice(e.target.value)}
                rows={4}
                className="w-full p-3 bg-gray-50 rounded-2xl text-base text-gray-700 leading-relaxed border border-gray-200 focus:ring-2 focus:ring-green-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setIsEditingNotice(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-base font-bold text-gray-500">취소</button>
                <button onClick={handleSaveNotice} disabled={savingNotice} className="flex-1 py-2.5 bg-green-600 rounded-xl text-base font-bold text-white">
                  {savingNotice ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-base text-gray-500 leading-relaxed whitespace-pre-line">
              {notice || '공지사항이 없습니다.'}
            </p>
          )}
        </div>
      </div>

      {/* PWA 설치 안내 팝업 */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-5">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-green-600 px-6 py-5 flex justify-between items-start">
              <div>
                <p className="text-[17px] text-green-200 font-bold mb-1">WDG 우동골</p>
                <p className="text-lg font-black text-white leading-snug">앱으로 설치하면<br />더 편리해요!</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">⛳</div>
            </div>
            <div className="px-6 py-5 border-b border-gray-100 space-y-4">
              {[
                { icon: '🔔', title: '푸시 알림 수신', desc: '벙개 & 정산 알림을 바로 받아요' },
                { icon: '⚡', title: '빠른 실행', desc: '홈 화면에서 바로 접속' },
                { icon: '📶', title: '오프라인 지원', desc: '인터넷 없어도 기본 기능 사용' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center text-base flex-shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-base font-bold text-gray-800">{item.title}</p>
                    <p className="text-[17px] text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-b border-gray-100 space-y-2">
              <p className="text-[17px] font-bold text-gray-400 uppercase tracking-wide">설치 방법</p>
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[17px] font-bold text-gray-700 mb-1">iPhone (Safari)</p>
                <p className="text-[16px] text-gray-500 leading-relaxed">① 하단 공유버튼(□↑) 탭<br />② 아래로 스크롤 → "홈 화면에 추가" 선택<br />③ 우측 상단 "추가" 탭</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[17px] font-bold text-gray-700 mb-1">Android (Chrome)</p>
                <p className="text-[16px] text-gray-500 leading-relaxed">① 우측 상단 메뉴(⋮) 탭<br />② "홈 화면에 추가" 선택<br />③ "추가" 버튼 탭</p>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-2">
              <button onClick={() => handleInstallGuideClose(false)} className="flex-1 py-3 bg-gray-100 rounded-2xl text-base font-bold text-gray-500 active:scale-95 transition-all">
                다음에 하기
              </button>
              <button onClick={() => handleInstallGuideClose(true)} className="flex-1 py-3 bg-green-600 rounded-2xl text-base font-bold text-white active:scale-95 transition-all">
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}