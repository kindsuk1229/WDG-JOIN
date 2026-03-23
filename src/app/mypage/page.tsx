'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Avatar } from '@/components/UI'; 
import BottomNav from '@/components/BottmNav';

export default function MyPage() {
  const router = useRouter();
  
  const [userName, setUserName] = useState('회원');
  const [stats, setStats] = useState({
    totalCount: 0,
    monthlyCount: 0,
    totalAmount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedName = localStorage.getItem('user_name');
    if (savedName) setUserName(savedName);

    const fetchMyData = async () => {
      try {
        // 1. 벙개 참여 정보 가져오기
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

        // 2. 정산 내역 합계 가져오기 (settlements 컬렉션이 있다고 가정)
        const settlementSnap = await getDocs(
          query(collection(db, "settlements"), where("userName", "==", savedName))
        );
        let amount = 0;
        settlementSnap.forEach((doc) => {
          amount += (doc.data().totalAmount || 0);
        });

        setStats({
          totalCount: total,
          monthlyCount: monthly,
          totalAmount: amount
        });
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyData();
  }, []);

  const menus = [
    { label: '내 벙개 내역', icon: '📋', href: '/my-meetups' },
    { label: '정산 내역', icon: '💰', href: '/settlement' },
    { label: '알림 설정', icon: '🔔', href: '#' },
    { label: '프로필 수정', icon: '✏️', href: '#' },
    { label: '앱 정보', icon: 'ℹ️', href: '#' },
  ];

  return (
    <div className="min-h-screen bg-white safe-top pb-20">
      <div className="px-5 pt-6">
        <h1 className="text-2xl font-bold mb-6">마이페이지</h1>

        {/* Profile */}
        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-5 mb-6 shadow-sm">
          <Avatar name={userName} size={56} />
          <div>
            <p className="text-lg font-semibold">{userName} {userName === '김근석' ? '사장님' : '멤버님'}</p>
            <p className="text-[13px] text-gray-400 mt-0.5">우동골 {userName === '김근석' ? '관리자' : '정회원'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: '참여 벙개', value: loading ? '-' : `${stats.totalCount}회` },
            { label: '이번 달', value: loading ? '-' : `${stats.monthlyCount}회` },
            { label: '총 정산', value: loading ? '-' : `${stats.totalAmount.toLocaleString()}원` },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className="text-[16px] font-bold mt-0.5 text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div className="space-y-1">
          {menus.map((item, i) => (
            <div 
              key={i} 
              onClick={() => item.href !== '#' ? router.push(item.href) : alert(`${item.label} 준비 중`)} 
              className="flex items-center gap-3 py-4 border-b border-gray-50 last:border-0 cursor-pointer active:bg-gray-50 px-2"
            >
              <span className="text-lg w-7">{item.icon}</span>
              <span className="flex-1 text-[15px] text-gray-700">{item.label}</span>
              <span className="text-gray-300 text-lg">〉</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-gray-300 mt-12 font-light">우동골 v1.0.0</p>
      </div>

      <BottomNav active="my" />
    </div>
  );
}