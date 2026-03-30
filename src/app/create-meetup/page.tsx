'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { sendNotificationToAll } from '@/lib/fcm';

function CreateMeetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetupId = searchParams.get('id');

  const [meetupType, setMeetupType] = useState<'field' | 'screen'>('field');
  const [title, setTitle] = useState('');
  const [golfCourse, setGolfCourse] = useState('');
  const [date, setDate] = useState('');
  const [cartCount, setCartCount] = useState(1);
  const [cartTimes, setCartTimes] = useState<string[]>(['']);
  const [playerCount, setPlayerCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [creatorId, setCreatorId] = useState('');

  // ✅ 현재 로그인한 사람 실명 + 관리자 여부
  const [myName, setMyName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const savedName = (localStorage.getItem('user_name') || '').trim();
    setMyName(savedName);

    // 관리자 여부 확인
    const checkAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', savedName));
        setIsAdmin(adminDoc.exists());
      } catch (error) {
        console.error('관리자 확인 실패:', error);
      }
    };
    checkAdmin();

    if (meetupId) {
      const fetchMeetup = async () => {
        try {
          const docRef = doc(db, 'meetups', meetupId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.title || '');
            setGolfCourse(data.golfCourse || '');
            setDate(data.date || '');
            setMeetupType(data.meetupType || 'field');
            setCartCount(data.cartCount || 1);
            setCartTimes(data.cartTimes || Array(data.cartCount || 1).fill(''));
            setPlayerCount(data.playerCount || 4);
            setCreatorId(data.creatorId || '');

            // ✅ 등록자 or 관리자만 수정 가능
            const adminDoc = await getDoc(doc(db, 'admins', savedName));
            const isAdminUser = adminDoc.exists();
            setCanEdit(data.creatorId === savedName || isAdminUser);
          }
        } catch (error) {
          console.error("데이터 불러오기 실패:", error);
        }
      };
      fetchMeetup();
    }
  }, [meetupId]);

  const handleCartCountChange = (count: number) => {
    setCartCount(count);
    const newTimes = Array(count).fill('').map((_, i) => cartTimes[i] || '');
    setCartTimes(newTimes);
  };

  const updateCartTime = (index: number, timeValue: string) => {
    const newTimes = [...cartTimes];
    newTimes[index] = timeValue;
    setCartTimes(newTimes);
  };

  const handleDelete = async () => {
    // ✅ 등록자 or 관리자만 삭제 가능
    if (!canEdit) {
      alert('삭제 권한이 없습니다.');
      return;
    }
    if (!window.confirm('정말로 이 벙개를 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'meetups', meetupId!));
      alert('⛳ 벙개가 삭제되었습니다.');
      router.push('/my-meetups');
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    // ✅ 수정 시 권한 체크
    if (meetupId && !canEdit) {
      alert('수정 권한이 없습니다.');
      return;
    }

    setLoading(true);
    try {
      const meetupData: any = {
        title: title || 'WDG 벙개',
        golfCourse,
        date,
        meetupType,
        authorName: myName,
        updatedAt: new Date().toISOString(),
      };

      if (meetupType === 'field') {
        meetupData.cartCount = cartCount;
        meetupData.cartTimes = cartTimes;
        meetupData.maxPlayers = cartCount * 4;
      } else {
        meetupData.playerCount = playerCount;
        meetupData.cartTimes = cartTimes;
        meetupData.cartCount = 0;
        meetupData.maxPlayers = playerCount;
      }

      if (meetupId) {
        await updateDoc(doc(db, 'meetups', meetupId), meetupData);
        alert('⛳ 벙개가 수정되었습니다!');
      } else {
        // ✅ 등록자 ID를 실명으로 저장
        const myNickname = (localStorage.getItem('user_nickname') || '').trim();
        const newDoc = await addDoc(collection(db, 'meetups'), {
          ...meetupData,
          creatorId: myName,
          createdAt: new Date().toISOString(),
          players: 1,
          participants: [{ name: myName, nickname: myNickname }],
        });

        await sendNotificationToAll({
          title: `⛳ 새로운 ${meetupType === 'screen' ? '스크린' : '필드'} 벙개가 열렸어요!`,
          body: `${golfCourse} | ${date} | ${meetupType === 'field' ? `${cartCount}카트` : `${playerCount}명`}`,
          url: `/meetup-detail?id=${newDoc.id}`,
          excludeUserName: myName,
        });

        alert('⛳ 새로운 벙개가 등록되었습니다!');
      }
      router.push('/meetups');
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 수정 페이지인데 권한 없으면 접근 차단
  if (meetupId && creatorId && !canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-10 text-center">
        <p className="text-4xl mb-4">🚫</p>
        <p className="font-black text-gray-800 mb-2">접근 권한이 없어요</p>
        <p className="text-sm text-gray-400 mb-6">벙개 등록자 또는 관리자만 수정할 수 있어요.</p>
        <button onClick={() => router.back()} className="px-6 py-3 bg-green-600 text-white rounded-2xl font-bold">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full">
      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-4 text-xl font-bold text-gray-600">←</button>
          <h1 className="text-xl font-bold text-green-700">
            {meetupId ? '벙개 정보 수정' : '새로운 벙개 만들기'}
          </h1>
        </div>
        {/* ✅ 수정 페이지에서 권한 있을 때만 삭제 버튼 표시 */}
        {meetupId && canEdit && (
          <button type="button" onClick={handleDelete} className="text-red-500 text-sm font-bold px-2 py-1 bg-red-50 rounded-lg">삭제</button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="p-5 space-y-6 pb-6">

        {/* 벙개 타입 선택 (등록 시에만) */}
        {!meetupId && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <label className="text-xs font-bold text-gray-400 block mb-3 uppercase tracking-wide">벙개 종류</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMeetupType('field')}
                className={`p-4 rounded-2xl border-2 text-center transition-all ${
                  meetupType === 'field' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <p className="text-2xl mb-1">⛳</p>
                <p className={`text-sm font-black ${meetupType === 'field' ? 'text-green-700' : 'text-gray-500'}`}>필드</p>
                <p className="text-[10px] text-gray-400 mt-0.5">카트 단위 모집</p>
              </button>
              <button
                type="button"
                onClick={() => setMeetupType('screen')}
                className={`p-4 rounded-2xl border-2 text-center transition-all ${
                  meetupType === 'screen' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <p className="text-2xl mb-1">🖥️</p>
                <p className={`text-sm font-black ${meetupType === 'screen' ? 'text-green-700' : 'text-gray-500'}`}>스크린</p>
                <p className="text-[10px] text-gray-400 mt-0.5">인원 단위 모집</p>
              </button>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6 border border-gray-100">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">벙개 제목</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예: [WDG] 주말 정기 라운딩"
              className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-green-500 transition-all text-gray-900" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">
              {meetupType === 'screen' ? '스크린 골프장 이름' : '골프장 이름'}
            </label>
            <input type="text" required value={golfCourse} onChange={(e) => setGolfCourse(e.target.value)}
              placeholder={meetupType === 'screen' ? '예: 골프존 강남점' : '예: 샤인데일 CC'}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-green-500 transition-all text-gray-900" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">날짜 선택</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-green-500 transition-all text-gray-900" />
          </div>

          {/* 필드: 카트 수 (최대 15카트) */}
          {meetupType === 'field' && (
            <div className="border-t pt-6">
              <label className="text-xs font-bold text-gray-400 block mb-3 uppercase tracking-wide">모집 규모 및 조별 티타임</label>
              <select value={cartCount} onChange={(e) => handleCartCountChange(Number(e.target.value))}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-lg mb-4 focus:ring-2 focus:ring-green-500 text-gray-900">
                {[...Array(15)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}카트 ({(i+1)*4}명)</option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-3">
                {cartTimes.map((time, index) => {
                  const ampm = time && parseInt(time.split(':')[0]) >= 12 ? 'PM' : 'AM';
                  const hhmm = time ? time : '';
                  return (
                    <div key={index} className="flex items-center gap-2 bg-green-50/50 p-3 rounded-2xl border border-green-100">
                      <span className="text-[11px] font-black text-green-700 w-10 text-center flex-shrink-0">{index + 1}조</span>
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={ampm}
                          onChange={(e) => {
                            const currentTime = cartTimes[index] || '07:00';
                            const [h, m] = currentTime.split(':');
                            let hour = parseInt(h);
                            if (e.target.value === 'AM' && hour >= 12) hour -= 12;
                            if (e.target.value === 'PM' && hour < 12) hour += 12;
                            updateCartTime(index, `${String(hour).padStart(2,'0')}:${m || '00'}`);
                          }}
                          className="bg-white border border-green-200 rounded-xl px-2 py-1.5 text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500"
                        >
                          <option value="AM">오전</option>
                          <option value="PM">오후</option>
                        </select>
                        <input
                          type="text"
                          required
                          value={hhmm ? (() => {
                            const [h, m] = hhmm.split(':');
                            const hour = parseInt(h) % 12 || 12;
                            return `${hour}:${m || '00'}`;
                          })() : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9:]/g, '');
                            const parts = val.split(':');
                            if (parts.length === 2) {
                              let hour = parseInt(parts[0]) || 0;
                              const min = parts[1].substring(0, 2);
                              if (ampm === 'PM' && hour < 12) hour += 12;
                              if (ampm === 'AM' && hour === 12) hour = 0;
                              updateCartTime(index, `${String(hour).padStart(2,'0')}:${min.padStart(2,'0')}`);
                            } else {
                              updateCartTime(index, val);
                            }
                          }}
                          placeholder="7:30"
                          className="flex-1 bg-white border border-green-200 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-green-500 w-20"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 스크린: 시간 + 인원 */}
          {meetupType === 'screen' && (
            <div className="border-t pt-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-2 uppercase tracking-wide">시작 시간</label>
                <div className="flex items-center gap-2 bg-green-50/50 p-3 rounded-2xl border border-green-100">
                  <span className="text-[11px] font-black text-green-700 flex-shrink-0">시작</span>
                  <select
                    value={cartTimes[0] && parseInt(cartTimes[0].split(':')[0]) >= 12 ? 'PM' : 'AM'}
                    onChange={(e) => {
                      const currentTime = cartTimes[0] || '07:00';
                      const [h, m] = currentTime.split(':');
                      let hour = parseInt(h);
                      if (e.target.value === 'AM' && hour >= 12) hour -= 12;
                      if (e.target.value === 'PM' && hour < 12) hour += 12;
                      setCartTimes([`${String(hour).padStart(2,'0')}:${m || '00'}`]);
                    }}
                    className="bg-white border border-green-200 rounded-xl px-2 py-1.5 text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="AM">오전</option>
                    <option value="PM">오후</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={cartTimes[0] ? (() => {
                      const [h, m] = cartTimes[0].split(':');
                      const hour = parseInt(h) % 12 || 12;
                      return `${hour}:${m || '00'}`;
                    })() : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9:]/g, '');
                      const parts = val.split(':');
                      const ampm = cartTimes[0] && parseInt(cartTimes[0].split(':')[0]) >= 12 ? 'PM' : 'AM';
                      if (parts.length === 2) {
                        let hour = parseInt(parts[0]) || 0;
                        const min = parts[1].substring(0, 2);
                        if (ampm === 'PM' && hour < 12) hour += 12;
                        if (ampm === 'AM' && hour === 12) hour = 0;
                        setCartTimes([`${String(hour).padStart(2,'0')}:${min.padStart(2,'0')}`]);
                      }
                    }}
                    placeholder="7:30"
                    className="flex-1 bg-white border border-green-200 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-3 uppercase tracking-wide">
                  모집 인원 <span className="font-normal text-gray-400 normal-case">(최대 50명)</span>
                </label>
                <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-lg focus:ring-2 focus:ring-green-500 text-gray-900">
                  {[...Array(50)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1}명</option>
                  ))}
                </select>
                <div className="mt-3 bg-green-50 rounded-2xl p-3 border border-green-100">
                  <p className="text-[12px] text-green-700 font-bold text-center">
                    🖥️ 스크린 {playerCount}명 모집
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading}
          className={`w-full p-4 rounded-2xl font-black text-lg text-white transition-all active:scale-95 ${
            loading ? 'bg-gray-400' : 'bg-green-600 shadow-lg shadow-green-200 hover:bg-green-700'
          }`}>
          {loading ? '처리 중...' : meetupId ? '수정 완료하기 ⛳' : '벙개 등록하기 ⛳'}
        </button>
      </form>
    </div>
  );
}

export default function CreateMeetupPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-gray-400">데이터를 불러오는 중...</div>}>
      <CreateMeetupContent />
    </Suspense>
  );
}