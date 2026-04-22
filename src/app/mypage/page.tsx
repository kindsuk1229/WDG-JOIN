'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { Avatar } from '@/components/UI';

export default function MyPage() {
  const router = useRouter();

  const [userName, setUserName] = useState('회원');
  const [userNickname, setUserNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempNickname, setTempNickname] = useState('');

  const [stats, setStats] = useState({
    totalCount: 0,
    monthlyCount: 0,
    pendingAmount: 0,
    owingAmount: 0,
    seasonScore: 0,
    yearlyScore: 0,
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
            // ✅ completed 또는 날짜가 지난 closed/manually_closed만 카운트
            const nowCheck = new Date();
            const timeStrCheck = (data.cartTimes?.[0] === 'TBD' || !data.cartTimes?.[0]) ? '23:59' : data.cartTimes[0];
            const meetupDTCheck = new Date(`${data.date}T${timeStrCheck}:00`);
            const isPastCheck = nowCheck >= meetupDTCheck;
            const isCountable = data.status === 'completed' ||
              ((data.status === 'closed' || data.status === 'manually_closed') && isPastCheck);
            if (isCountable) total++;
            if (data.date && data.date.includes(currentMonth) && isCountable) monthly++;
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

        // ✅ 내가 내야 할 금액 (settlement_members)
        const owingSnap = await getDocs(
          query(
            collection(db, "settlement_members"),
            where("fromName", "==", savedName),
            where("status", "==", "pending")
          )
        );
        let owingTotal = 0;
        owingSnap.forEach((doc) => {
          owingTotal += doc.data().amount || 0;
        });

        // ✅ 시즌/연간 점수 계산
        const nowDate = new Date();
        const scoreYear = nowDate.getFullYear().toString();
        const scoreMonth = nowDate.getMonth() + 1;
        const seasonStartMonth = Math.floor((scoreMonth - 1) / 2) * 2 + 1;
        const seasonStart = `${scoreYear}-${String(seasonStartMonth).padStart(2, '0')}`;
        const seasonEnd = `${scoreYear}-${String(seasonStartMonth + 1).padStart(2, '0')}`;

        let seasonScore = 0;
        let yearlyScore = 0;

        meetupSnap.forEach((d) => {
          const data = d.data();
          if (!data.date || !data.date.startsWith(scoreYear)) return;
          // ✅ completed 또는 날짜가 지난 closed/manually_closed만 점수 카운트
          const nowScore = new Date();
          if (data.status === 'cancelled' || data.status === 'open') return;
          if (data.status === 'closed' || data.status === 'manually_closed') {
            const timeStrS = (data.cartTimes?.[0] === 'TBD' || !data.cartTimes?.[0]) ? '23:59' : data.cartTimes[0];
            const meetupDTS = new Date(`${data.date}T${timeStrS}:00`);
            if (nowScore < meetupDTS) return;
          }
          const isJoined = data.participants?.some((p: any) => p.name === savedName);
          if (!isJoined) return;
          if (data.meetupType === 'etc' || data.isEtc) return; // 기타벙 점수 제외
          const point = data.meetupType === 'overnight' || data.isOvernight ? 4 : data.meetupType === 'field' ? 2 : 1;
          yearlyScore += point;
          if (data.date >= seasonStart && data.date <= `${seasonEnd}-31`) {
            seasonScore += point;
          }
        });

        setStats({ totalCount: total, monthlyCount: monthly, pendingAmount: pendingTotal, owingAmount: owingTotal, seasonScore, yearlyScore });
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyData();
  }, []);

  const handleSaveProfile = async () => {
    const trimmedNickname = tempNickname.trim();

    // 1. 로컬스토리지에 저장
    localStorage.setItem('user_nickname', trimmedNickname);
    setUserNickname(trimmedNickname);

    // ✅ 2. Firebase users 컬렉션에도 저장
    try {
      const userRef = doc(db, 'users', userName.trim());
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await setDoc(userRef, {
          ...userSnap.data(),
          nickname: trimmedNickname,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await setDoc(userRef, {
          name: userName.trim(),
          nickname: trimmedNickname,
          joinedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Firebase 닉네임 저장 실패:', error);
    }

    setIsEditing(false);
    alert('닉네임이 설정되었습니다! ⛳');
  };

  const menus = [
    { label: '내 벙개 내역', icon: '📋', href: '/my-meetups' },
    { label: '내 성적 히스토리', icon: '⛳', href: '/my-scores' },
    { label: '성적 랭킹', icon: '🏆', href: '/score-ranking' },
    { label: '정산 내역', icon: '💰', href: '/settlement/history' },
    { label: '알림 설정', icon: '🔔', href: '/notification-settings' },
    { label: '프로필 수정', icon: '✏️', onClick: () => setIsEditing(true) },
    { label: '앱 정보', icon: 'ℹ️', href: '#' },
  ];

  return (
    <div className="bg-white">
      <div className="px-5 pt-6 pb-6">
        <h1 className="text-2xl font-bold mb-6">마이페이지</h1>

        {/* Profile Card */}
        <div className="bg-gray-50 rounded-3xl p-5 mb-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Avatar name={userName} size={60} />
            <div>
              <p className="text-lg font-black text-gray-800">
                {userNickname || userName}
              </p>
              <p className="text-[16px] text-gray-400 mt-0.5 font-medium italic">
                {userName === '김근석' ? '우동골 관리자' : '우동골 정회원'}
                {userNickname && <span className="ml-1.5 not-italic opacity-70">({userName})</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { label: '참여 벙개', value: loading ? '-' : `${stats.totalCount}회`, color: 'text-gray-800' },
            { label: '이번 달', value: loading ? '-' : `${stats.monthlyCount}회`, color: 'text-gray-800' },
            { label: '시즌 점수', value: loading ? '-' : `${stats.seasonScore}점`, color: 'text-blue-500' },
            { label: '연간 점수', value: loading ? '-' : `${stats.yearlyScore}점`, color: 'text-green-600' },
            { label: '받아야 할 금액', value: loading ? '-' : `${stats.pendingAmount.toLocaleString()}원`, color: 'text-green-600' },
            { label: '보내야 할 금액', value: loading ? '-' : `${stats.owingAmount.toLocaleString()}원`, color: 'text-red-500' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-[15px] text-gray-400 font-medium">{s.label}</p>
              <p className={`text-[17px] font-bold mt-0.5 ${s.color}`}>
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
              <span className="flex-1 text-[17px] text-gray-700 font-medium">{item.label}</span>
              <span className="text-gray-300 text-lg font-light">〉</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[16px] text-gray-300 mt-12 font-light italic">우동골 v1.0.0</p>
      </div>

      {/* 프로필 수정 바텀 시트 */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          style={{ bottom: '64px' }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-[32px] flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: 'calc(100vh - 128px)' }}
            onTouchMove={e => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-4 shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-black">프로필 수정</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="space-y-6">
                <div>
                  <label className="text-[17px] font-black text-gray-400 uppercase tracking-wider">정산용 실명 (수정 불가)</label>
                  <input type="text" value={userName} disabled className="w-full mt-2 p-4 bg-gray-50 rounded-2xl border-none text-gray-400 font-bold" />
                </div>
                <div>
                  <label className="text-[17px] font-black text-gray-400 uppercase tracking-wider">활동 닉네임 설정</label>
                  <input
                    type="text"
                    value={tempNickname}
                    onChange={(e) => setTempNickname(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    className="w-full mt-2 p-4 bg-gray-100 rounded-2xl border-none font-bold text-gray-800 focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-[16px] text-green-600 mt-3 font-medium bg-green-50 p-2 rounded-lg">
                    💡 닉네임은 모든 기기에서 자동으로 동기화됩니다. 벙개 명단에는 닉네임이 우선 표시되며, 정산은 실명({userName}) 기준으로 처리됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-8 pt-4 pb-8 shrink-0 border-t border-gray-100">
              <button onClick={() => setIsEditing(false)} className="flex-1 p-4 bg-gray-100 rounded-2xl font-bold text-gray-500">취소</button>
              <button onClick={handleSaveProfile} className="flex-1 p-4 bg-green-600 rounded-2xl font-bold text-white shadow-lg shadow-green-100">저장하기 ⛳</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}