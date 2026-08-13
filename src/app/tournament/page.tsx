'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

const OWNER_NAME = '김근석';

interface Tournament {
  id: string;
  title: string;
  type: 'field' | 'screen';
  format: string;
  date: string;
  venue: string;
  entryFee: number;
  status: 'open' | 'closed' | 'completed';
  maxPlayers: number;
  participantCount: number;
  round: number; // 회차
}

const FORMAT_LABEL: Record<string, string> = {
  stroke: '개인전 · 스트로크',
  shinperio: '개인전 · 신페리오',
  team2: '팀전 · 2인1조',
  team4: '팀전 · 4인1조',
  teamCustom: '팀전 · 직접설정',
  matchplay: '2:2 · 매치플레이',
  highlow: '2:2 · 하이로우',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: '모집중', color: 'bg-green-50 text-green-600' },
  closed: { label: '마감', color: 'bg-red-50 text-red-500' },
  completed: { label: '완료', color: 'bg-gray-100 text-gray-500' },
};

export default function TournamentListPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [tab, setTab] = useState<'all' | 'screen' | 'field'>('all');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    setMyName(name);
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('date', 'desc')));
      const list: Tournament[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          type: data.type || 'screen',
          format: data.format || 'stroke',
          date: data.date || '',
          venue: data.venue || '',
          entryFee: data.entryFee || 0,
          status: data.status || 'open',
          maxPlayers: data.maxPlayers || 0,
          participantCount: (data.participants || []).length,
          round: data.round || 0,
        };
      }).filter(t => t.status !== 'completed'); // ✅ 완료된 대회 숨김
      setTournaments(list);
    } catch (err) {
      console.error('대회 목록 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOwner = myName === OWNER_NAME;

  const filtered = tournaments.filter(t =>
    tab === 'all' ? true : t.type === tab
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dateStr} (${days[d.getDay()]})`;
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <header className="p-4 bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-800">대회</h1>
            <p className="text-xs text-gray-400">WDG 골프 대회 현황</p>
          </div>
          {/* 오너 전용 대회 생성 버튼 */}
          {isOwner && (
            <button
              onClick={() => router.push('/tournament/create')}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all"
            >
              + 대회 만들기
            </button>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mt-3">
          {[
            { key: 'all', label: '전체' },
            { key: 'screen', label: '🖥️ 스크린' },
            { key: 'field', label: '🏌️ 필드' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                tab === t.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* 역대 랭킹 배너 */}
      <div
        onClick={() => router.push('/tournament/ranking')}
        className="mx-4 mt-4 p-4 bg-gradient-to-r from-green-700 to-green-500 rounded-2xl flex items-center justify-between cursor-pointer active:scale-95 transition-all"
      >
        <div>
          <p className="text-xs text-green-200 font-bold">명예의 전당</p>
          <p className="text-white font-black text-base mt-0.5">역대 대회 랭킹 보기</p>
        </div>
        <span className="text-3xl">🏆</span>
      </div>

      <div className="p-4 space-y-3 mt-2">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-400 text-sm">등록된 대회가 없어요.</p>
            {isOwner && (
              <button onClick={() => router.push('/tournament/create')}
                className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold">
                첫 대회 만들기
              </button>
            )}
          </div>
        ) : (
          filtered.map(t => {
            const status = STATUS_LABEL[t.status];
            return (
              <div
                key={t.id}
                onClick={() => router.push(`/tournament/${t.id}`)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer active:scale-95 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* 회차 + 타입 배지 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {t.round > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                          제{t.round}회
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        t.type === 'screen' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {t.type === 'screen' ? '🖥️ 스크린' : '🏌️ 필드'}
                      </span>
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">
                        {FORMAT_LABEL[t.format] || t.format}
                      </span>
                    </div>

                    <p className="font-black text-gray-800 text-base">{t.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{t.venue}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{formatDate(t.date)}</p>

                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-sm font-bold text-green-600">
                        💰 {t.entryFee.toLocaleString()}원
                      </span>
                      <span className="text-sm text-gray-400">
                        👥 {t.participantCount}/{t.maxPlayers}명
                      </span>
                    </div>
                  </div>

                  {/* 상태 배지 */}
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex-shrink-0 ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {/* 진행바 */}
                {t.maxPlayers > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${t.status === 'completed' ? 'bg-gray-400' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (t.participantCount / t.maxPlayers) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}