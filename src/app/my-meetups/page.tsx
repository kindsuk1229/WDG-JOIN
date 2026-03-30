'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function MyMeetupsPage() {
  const [createdMeetups, setCreatedMeetups] = useState<any[]>([]);
  const [joinedMeetups, setJoinedMeetups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'created' | 'joined'>('created');
  const router = useRouter();

  useEffect(() => {
    // ✅ 실명으로 가져오기
    const myName = (localStorage.getItem('user_name') || '').trim();

    const fetchMyMeetups = async () => {
      try {
        const snap = await getDocs(collection(db, "meetups"));
        const allMeetups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // 내가 만든 벙개 (creatorId === 실명)
        const created = allMeetups.filter(m => m.creatorId === myName);

        // 내가 참여한 벙개 (participants 배열에 내 실명 있는 것)
        const joined = allMeetups.filter(m =>
          m.participants?.some((p: any) => p.name === myName) &&
          m.creatorId !== myName // 내가 만든 건 제외
        );

        // 날짜 최신순 정렬
        const sortByDate = (arr: any[]) => arr.sort((a, b) => {
          const dateA = a.date ? String(a.date) : "";
          const dateB = b.date ? String(b.date) : "";
          return dateB.localeCompare(dateA);
        });

        setCreatedMeetups(sortByDate(created));
        setJoinedMeetups(sortByDate(joined));
      } catch (error) {
        console.error("데이터 로딩 에러:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyMeetups();
  }, []);

  const currentList = tab === 'created' ? createdMeetups : joinedMeetups;

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b sticky top-0 z-10">
        <div className="flex items-center mb-3">
          <button onClick={() => router.back()} className="mr-4 text-xl p-1 font-bold text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-800">내 벙개 내역</h1>
        </div>

        {/* 탭 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('created')}
            className={`flex-1 py-2 rounded-xl text-base font-bold transition-all ${
              tab === 'created' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            내가 만든 벙개 ({createdMeetups.length})
          </button>
          <button
            onClick={() => setTab('joined')}
            className={`flex-1 py-2 rounded-xl text-base font-bold transition-all ${
              tab === 'joined' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            참여한 벙개 ({joinedMeetups.length})
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500">데이터를 불러오고 있습니다...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-400">
              {tab === 'created' ? '내가 만든 벙개가 없네요. ⛳' : '참여한 벙개가 없네요. ⛳'}
            </p>
          </div>
        ) : (
          currentList.map((item: any) => (
            <div
              key={item.id}
              onClick={() => router.push(
                tab === 'created'
                  ? `/create-meetup?id=${item.id}`
                  : `/meetup-detail?id=${item.id}`
              )}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gray-800">{item.title || '제목 없음'}</h3>
                  {item.meetupType === 'screen' && (
                    <span className="text-[16px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold">스크린</span>
                  )}
                </div>
                <span className="text-[17px] bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold flex-shrink-0">
                  진행중
                </span>
              </div>
              <div className="flex items-center text-gray-500 text-base gap-3">
                <span>📍 {item.golfCourse || '-'}</span>
                <span className="text-gray-200">|</span>
                <span>📅 {item.date || '날짜 미정'}</span>
              </div>
              <div className="mt-2 text-right">
                <span className="text-blue-500 text-base font-medium">
                  {tab === 'created' ? '상세 수정 〉' : '상세 보기 〉'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}