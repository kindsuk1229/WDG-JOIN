'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestNotificationPermission,
  disableNotification,
  isNotificationEnabled,
} from '@/lib/fcm';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('user_name') || '회원';
    setUserName(name.trim());
    setEnabled(isNotificationEnabled());
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        // 알림 끄기
        await disableNotification(userName);
        setEnabled(false);
        alert('알림이 꺼졌습니다.');
      } else {
        // 알림 켜기
        const success = await requestNotificationPermission(userName);
        if (success) {
          setEnabled(true);
          alert('✅ 알림이 설정되었습니다!\n벙개 등록 및 정산 요청 시 알림을 받습니다.');
        } else {
          alert('알림 권한이 거부되었습니다.\n브라우저 설정에서 알림을 허용해주세요.');
        }
      }
    } catch (error) {
      alert('설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-full">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">알림 설정</h1>
      </header>

      <div className="p-5 space-y-4">
        {/* 알림 메인 토글 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-gray-800">푸시 알림</p>
              <p className="text-[12px] text-gray-400 mt-1">
                벙개 등록 및 정산 요청 시 알림
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                enabled ? 'bg-green-500' : 'bg-gray-200'
              }`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${
                enabled ? 'left-7' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* 알림 종류 안내 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <p className="font-black text-gray-700 text-sm">알림 받는 항목</p>
          {[
            { icon: '⛳', label: '새 벙개 등록', desc: '새로운 라운딩 일정이 열릴 때' },
            { icon: '💰', label: '정산 요청', desc: '정산 공유가 나에게 왔을 때' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-2xl w-8">{item.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-sm">{item.label}</p>
                <p className="text-[11px] text-gray-400">{item.desc}</p>
              </div>
              <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-400' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>

        {/* 안내 메시지 */}
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-[12px] text-green-700 leading-relaxed">
            💡 알림을 받으려면 브라우저에서 알림 권한을 허용해야 합니다.<br />
            홈 화면에 앱을 추가(PWA 설치)하면 더 안정적으로 알림을 받을 수 있어요!
          </p>
        </div>
      </div>
    </div>
  );
}
