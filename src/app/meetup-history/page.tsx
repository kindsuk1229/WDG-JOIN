'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

interface MeetupHistory {
  id: string;
  title: string;
  golfCourse: string;
  date: string;
  meetupType: string;
  status: string;
  participants: any[];
  cartCount?: number;
  greenFee?: number;
  creatorId: string;
  isCreator: boolean;
  cartTimes?: string[];
}

export default function MeetupHistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'joined' | 'created'>('joined');
  const [history, setHistory] = useState<MeetupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchHistory(name);
  }, []);

  const fetchHistory = async (name: string) => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'meetups'), orderBy('date', 'desc')));
      const all: MeetupHistory[] = snap.docs
        .map(d => ({
          id: d.id,
          ...d.data(),
          isCreator: d.data().creatorId === name,
        } as MeetupHistory))
        .filter(m => {
          // 필드/1박2일 벙개만
          if (m.meetupType !== 'field' && m.meetupType !== 'overnight') return false;
          // 내가 참여했거나 만든 벙개
          if (!m.participants?.some((p: any) => p.name === name) && m.creatorId !== name) return false;
          // 지난 벙개만
          const now = new Date();
          if (['completed', 'cancelled'].includes(m.status)) return true;
          if (m.date) {
            const timeStr = (m.cartTimes?.[0] === 'TBD' || !m.cartTimes?.[0]) ? '23:59' : m.cartTimes[0];
            const meetupDateTime = new Date(`${m.date}T${timeStr}:00`);
            return now > meetupDateTime;
          }
          return false;
        });

      setHistory(all);
    } catch (error) {
      console.error('히스토리 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = history.filter(m =>
    tab === 'created' ? m.isCreator : m.participants?.some((p: any) => p.name === myName)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return { label: '완료', className: 'bg-green-50 text-green-600' };
      case 'cancelled': return { label: '취소', className: 'bg-red-50 text-red-400' };
      default: return { label: '종료', className: 'bg-gray-100 text-gray-500' };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateStr} (${days[d.getDay()]})`;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr || timeStr === 'TBD') return '시간 미정';
    const [h, m] = timeStr.split(':').map(Number);
    const isPM = h >= 12;
    const hour12 = h % 12 || 12;
    return `${isPM ? '오후' : '오전'} ${hour12}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
        <h1 className="text-xl font-bold text-gray-800">필드 벙개 히스토리</h1>
      </header>

      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('joined')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'joined' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            참여한 벙개
          </button>
          <button
            onClick={() => setTab('created')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'created' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            만든 벙개
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">⛳</p>
            <p className="text-gray-400">히스토리가 없어요.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const statusBadge = getStatusBadge(item.status);
            const participants = item.participants || [];
            const maxPlayers = (item.cartCount || 0) * 4;

            return (
              <div
                key={item.id}
                onClick={() => router.push(`/meetup-detail?id=${item.id}`)}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-black text-gray-800">{item.title}</h3>
                      {item.meetupType === 'overnight' && (
                        <span className="text-[13px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">1박2일</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{item.golfCourse}</p>
                  </div>
                  <span className={`text-sm px-2.5 py-1 rounded-lg font-bold flex-shrink-0 ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-500 mb-3">
                  <p>📅 {formatDate(item.date)}</p>
                  {item.cartTimes?.[0] && (
                    <p>⏰ {formatTime(item.cartTimes[0])}</p>
                  )}
                  <p>🛒 {item.cartCount}카트 ({maxPlayers}명 정원)</p>
                  {item.greenFee && item.greenFee > 0 && (
                    <p>💰 {item.meetupType === 'overnight' ? '패키지' : '그린피'} {item.greenFee.toLocaleString()}원</p>
                  )}
                </div>

                {/* 참여 멤버 */}
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-50">
                  {participants.slice(0, 6).map((p: any, idx: number) => (
                    <span key={idx} className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      p.name === myName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.nickname || p.name}
                    </span>
                  ))}
                  {participants.length > 6 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 font-bold">
                      +{participants.length - 6}명
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}