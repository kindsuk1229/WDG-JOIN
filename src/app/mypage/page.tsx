// @@@@@@@@@@ 이 글자가 화면에 보이나요? @@@@@@@@@@
'use client';

import { useRouter } from 'next/navigation';
// 1. UI에서 Avatar만 가져오고, BottomNav는 따로 가져옵니다.
import { Avatar } from '@/components/UI'; 
// 2. 경로를 정확히 지정합니다. (파일명이 BottomNav.tsx 일 때)
import BottomNav from '@/components/BottomNav';

export default function MyPage() {
  const router = useRouter();

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
          <Avatar name="김근석" size={56} />
          <div>
            <p className="text-lg font-semibold">김근석 사장님</p>
            <p className="text-[13px] text-gray-400 mt-0.5">우동골 관리자</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: '참여 벙개', value: '3' },
            { label: '이번 달', value: '1' },
            { label: '총 정산', value: '0원' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className="text-[18px] font-semibold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Menu - 여기가 핵심입니다! */}
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

        {/* Version */}
        <p className="text-center text-[12px] text-gray-300 mt-8">우동골 v1.0.0</p>
      </div>

      <BottomNav active="my" />
    </div>
  );
}