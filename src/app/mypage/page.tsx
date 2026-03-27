'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Avatar } from '@/components/UI';
// ✅ BottomNav 임포트 제거 - layout.tsx에서 이미 렌더링됨

export default function MyPage() {
  const router = useRouter();

  const [userName, setUserName] = useState('회원');
  const [userNickname, setUserNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempNickname, setTempNickname] = useState('');

  const [stats, setStats] = useState({
    totalCount: 0,
    monthlyCount: 0,
    pendingAmount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawName = localStorage.getItem('user_name') || '회원';
    const rawNickname = localStorage.getItem('user_nickname') || '';

    setUserName(rawName.trim());
    setUserNickname(rawNickname.trim());
    setTempNickname(rawNickname.trim());

    const fetchMyData = async () => {
      try {
        setLoading(true);
        const savedName = rawName.trim();

        const meetupSnap = await getDocs(collection(db, "meetups"));
        let total = 0;
        let monthly = 0;
        const currentMonth = new Date().toISOString().substring(0, 7);

        meetupSnap.forEach((doc) => {
          const data = doc.data();
          const isJoined = data.participants?.some((p: any) => p.name === savedName);
          if (isJoined) {
            total++;
            if (data.date && data.date.includes(currentMonth)) monthly++;
          }
        });

        const settlementSnap = await getDocs(
          query(
            collection(db, "settlements"),
            where("userName", "==", savedName),
            where("status", "==", "pending")
          )
        );

        let pendingTotal = 0;
        settlementSnap.forEach((doc) => {
          const data = doc.data();
          const totalAmount = data.totalAmount || 0;
          const perPerson = data.perPerson || 0;
          pendingTotal += (totalAmount - perPerson);
        });

        setStats({ totalCount: total, monthlyCount: monthly, pendingAmount: pendingTotal });
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyData();
  }, []);

  const handleSaveProfile = () => {
    localStorage.setItem('user_nickname', tempNickname);
    setUserNickname(tempNickname);
    setIsEditing(false);
    alert('닉네임이 설정되었습니다! ⛳');
  };

  const menus = [
    { label: '내 벙개 내역', icon: '📋', href: '/my-meetups' },
    { label: '정산 내역', icon: '💰', href: '/settlement/history' },
    { label: '알림 설정', icon: '🔔', href: '#' },
    { label: '프로필 수정', icon: '✏️', onClick: () => setIsEditing(true) },
    { label: '앱 정보', icon: 'ℹ️', href: '#' },
  ];

  return (
    // ✅ 수정: min-h-screen 제거 (layout이 처리), pb-20 → layout pb-20이 처리
    // ✅ BottomNav 렌더링 제거
    <div className="bg-white">
      <div className="px-5 pt-6 pb-6">
        <h1 className="text-2xl font-bold mb-6">마이페이지</h1>

        {/* Profile Card */}
        <div className="bg-gray-50 rounded-3xl p-5 mb-6 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <Avatar name={userName} size={60} />
            <div>
              <p className="text-lg font-black text-gray-800">
                {userNickname || userName} {userName === '김근석' ? '사장님' : '멤버님'}
              </p>
              <p className="text-[12px] text-gray-400 mt-0.5 font-medium italic">
                {userName === '김근석' ? '우동골 관리자' : '우동골 정회원'}
                {userNickname && <span className="ml-1.5 not-italic opacity-70">({userName})</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-5 right-5 text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100"
          >
            수정
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: '참여 벙개', value: loading ? '-' : `${stats.totalCount}회` },
            { label: '이번 달', value: loading ? '-' : `${stats.monthlyCount}회` },
            { label: '받아야 할 금액', value: loading ? '-' : `${stats.pendingAmount.toLocaleString()}원` },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
              <p className={`text-[15px] font-bold mt-0.5 ${s.label === '받아야 할 금액' ? 'text-green-600' : 'text-gray-800'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Menu List */}
        <div className="space-y-1">
          {menus.map((item, i) => (
            <div
              key={i}
              onClick={() => {
                if (item.onClick) item.onClick();
                else if (item.href !== '#') router.push(item.href!);
                else alert(`${item.label} 준비 중`);
              }}
              className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 px-2 transition-all"
            >
              <span className="text-lg w-7">{item.icon}</span>
              <span className="flex-1 text-[15px] text-gray-700 font-medium">{item.label}</span>
              <span className="text-gray-300 text-lg font-light">〉</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-gray-300 mt-12 font-light italic">우동골 v1.0.0</p>
      </div>

      {/* 프로필 수정 바텀 시트 */}
      {isEditing && (
        {/* ✅ bottom-16: 탭바(64px) 높이만큼 위로 올림 */}
        <div className="fixed inset-0 bottom-16 bg-black/60 z-50 flex items-end justify-center">
          <div 
            className="w-full max-w-md bg-white rounded-t-[32px] flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300"
            onTouchMove={e => e.stopPropagation()}
          >
            
            {/* 고정 헤더 */}
            <div className="px-8 pt-8 pb-4 shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-black">프로필 수정</h3>
            </div>

            {/* ✅ 스크롤 되는 콘텐츠 영역 - iOS 터치 스크롤 강제 적용 */}
            <div className="flex-1 overflow-y-auto px-8 pb-4" style={{ WebkitOverflowScrolling: 'touch', overflowY: 'auto' }}>
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">정산용 실명 (수정 불가)</label>
                  <input
                    type="text"
                    value={userName}
                    disabled
                    className="w-full mt-2 p-4 bg-gray-50 rounded-2xl border-none text-gray-400 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">활동 닉네임 설정</label>
                  <input
                    type="text"
                    value={tempNickname}
                    onChange={(e) => setTempNickname(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    className="w-full mt-2 p-4 bg-gray-100 rounded-2xl border-none font-bold text-gray-800 focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-[10px] text-green-600 mt-3 font-medium bg-green-50 p-2 rounded-lg">
                    💡 벙개 명단에는 닉네임이 우선 표시되지만, 모든 정산 데이터는 실명({userName})을 기준으로 안전하게 처리됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* ✅ 버튼은 항상 하단에 고정 - pb-10으로 탭바 위 여백 확보 */}
            <div className="flex gap-3 px-8 pt-4 pb-10 shrink-0 border-t border-gray-100">
              <button onClick={() => setIsEditing(false)} className="flex-1 p-4 bg-gray-100 rounded-2xl font-bold text-gray-500">취소</button>
              <button onClick={handleSaveProfile} className="flex-1 p-4 bg-green-600 rounded-2xl font-bold text-white shadow-lg shadow-green-100">저장하기 ⛳</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}