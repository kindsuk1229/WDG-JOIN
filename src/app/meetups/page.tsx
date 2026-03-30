'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

export default function MeetupsPage() {
  const router = useRouter();
  const [meetups, setMeetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'field' | 'screen'>('all');

  useEffect(() => {
    const fetchMeetups = async () => {
      try {
        const q = query(collection(db, 'meetups'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMeetups(data);
      } catch (error) {
        console.error('벙개 목록 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetups();
  }, []);

  const filtered = meetups.filter(m => {
    // ✅ cancelled, completed 제외
    if (m.status === 'cancelled' || m.status === 'completed') return false;
    if (filter === 'all') return true;
    if (filter === 'field') return m.meetupType !== 'screen';
    if (filter === 'screen') return m.meetupType === 'screen';
    return true;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateStr} (${days[d.getDay()]})`;
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 mb-3">벙개 목록</h1>

        {/* 필터 탭 */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: '전체' },
            { key: 'field', label: '⛳ 필드' },
            { key: 'screen', label: '🖥️ 스크린' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === f.key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400">벙개 목록을 불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400 text-sm">등록된 벙개가 없어요.<br />새로운 벙개를 만들어보세요!</p>
          </div>
        ) : (
          filtered.map((item) => {
            const participants = item.participants || [];
            const maxPlayers = item.meetupType === 'screen'
              ? item.playerCount
              : (item.cartCount || 0) * 4;
            const isFull = participants.length >= maxPlayers;

            return (
              <div
                key={item.id}
                onClick={() => router.push(`/meetup-detail?id=${item.id}`)}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50 transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-gray-800">{item.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.meetupType === 'screen'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-green-50 text-green-600'
                    }`}>
                      {item.meetupType === 'screen' ? '스크린' : '필드'}
                    </span>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold flex-shrink-0 ${
                    isFull ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                  }`}>
                    {isFull ? '마감' : '모집중'}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm text-gray-500 mb-3">
                  <p>📍 {item.golfCourse}</p>
                  <p>📅 {formatDate(item.date)}</p>
                  {item.meetupType === 'screen' ? (
                    <p>👥 {item.playerCount}명 모집</p>
                  ) : (
                    <p>🛒 {item.cartCount}카트 ({item.cartCount * 4}명 정원)</p>
                  )}
                </div>

                {/* 참여 현황 바 */}
                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>참여 현황</span>
                    <span className="font-bold">{participants.length} / {maxPlayers}명</span>
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
  );
}