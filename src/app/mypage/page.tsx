'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Avatar } from '@/components/UI'; 
import BottomNav from '@/components/BottmNav';

export default function MyPage() {
  const router = useRouter();
  
  // 상태 관리: 이름, 참여 수, 이번달 수
  const [userName, setUserName] = useState('회원');
  const [stats, setStats] = useState({
    totalCount: 0,
    monthlyCount: 0,
    totalAmount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 로컬에서 유저 정보 가져오기
    const savedName = localStorage.getItem('user_name');
    const savedId = localStorage.getItem('user_id');
    if (savedName) setUserName(savedName);

    // 2. 파이어베이스에서 내 통계 가져오기
    const fetchMyStats = async () => {
      try {
        const q = query(collection(db, "meetups"));
        const querySnapshot = await getDocs(q);
        
        let total = 0;
        let monthly = 0;
        const currentMonth = new Date().toISOString().substring(0, 7); // "2026-03"

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // 참여자 명단(participants)에 내 ID가 있는지 확인
          const isJoined = data.participants?.some((p: any) => p.name === savedName);
          
          if (isJoined) {
            total++;
            // 이번 달 날짜인지 확인
            if (data.date && data.date.includes(currentMonth)) {
              monthly++;
            }
          }
        });

        setStats({
          totalCount: total,
          monthlyCount: monthly,
          totalAmount: 0 // 정산 기능 연동 시 업데이트 가능
        });
      } catch (error) {
        console.error("통계 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyStats();
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
        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-5 mb-6">
          <Avatar name={userName} size={56} />
          <div>
            <p className="text-lg font-semibold">{userName} {userName === '김근석' ? '사장님' : '멤버님'}</p>
            <p className="text-[13px] text-gray-400 mt-0.5">우동골 {userName === '김근석' ? '관리자' : '정회원'}</p>
          </div>
        </div>

        {/* Stats - 이제 숫자가 실시간으로 바뀝니다! */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: '참여 벙개', value: loading ? '-' : stats.totalCount },
            { label: '이번 달', value: loading ? '-' : stats.monthlyCount },
            { label: '총 정산', value: '0원' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className="text-[18px] font-semibold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div>
          {menus.map((item, i) => (
            <div 
              key={i} 
              onClick={() => {
                if (item.href !== '#') {
                  router.push(item.href);
                } else {
                  alert(`${item.label} 기능은 준비 중입니다.`);
                }
              }} 
              className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50"
            >
              <span className="text-lg w-7">{item.icon}</span>
              <span className="flex-1 text-[15px]">{item.label}</span>
              <span className="text-gray-300 text-lg">〉</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-gray-300 mt-8">우동골 v1.0.0</p>
      </div>

      <BottomNav active="my" />
    </div>
  );
}