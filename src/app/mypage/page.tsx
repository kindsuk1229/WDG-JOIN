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
  const [handicap, setHandicap] = useState(0);
  const [gHandicap, setGHandicap] = useState<number | null>(null);
  const [tempHandicap, setTempHandicap] = useState<string>('');
  const [tempGHandicapAbs, setTempGHandicapAbs] = useState<string>('');
  const [tempGHandicapSign, setTempGHandicapSign] = useState<1 | -1>(1);

  const [stats, setStats] = useState({
    totalCount: 0,
    monthlyCount: 0,
    pendingAmount: 0,
    owingAmount: 0,
    seasonScore: 0,
    yearlyScore: 0,
  });
  const [loading, setLoading] = useState(true);

  const getFinalGHandicap = (): number | null => {
    if (tempGHandicapAbs === '') return null;
    return tempGHandicapSign * Number(tempGHandicapAbs);
  };

  useEffect(() => {
    const rawName = localStorage.getItem('user_name') || '회원';
    const rawNickname = localStorage.getItem('user_nickname') || '';
    setUserName(rawName.trim());
    setUserNickname(rawNickname.trim());
    setTempNickname(rawNickname.trim());

    const loadHandicap = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', rawName.trim()));
        if (userSnap.exists()) {
          const h = userSnap.data().handicap || 0;
          const gh = userSnap.data().gHandicap;
          setHandicap(h);
          setGHandicap(gh !== undefined && gh !== null ? gh : null);
          setTempHandicap(h > 0 ? String(h) : '');
          if (gh !== undefined && gh !== null) {
            setTempGHandicapSign(gh < 0 ? -1 : 1);
            setTempGHandicapAbs(String(Math.abs(gh)));
          }
        }
      } catch {}
    };
    loadHandicap();

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
          query(collection(db, "settlements"), where("userName", "==", savedName), where("status", "==", "pending"))
        );
        let pendingTotal = 0;
        settlementSnap.forEach((doc) => {
          const data = doc.data();
          pendingTotal += (data.totalAmount || 0) - (data.perPerson || 0);
        });

        const owingSnap = await getDocs(
          query(collection(db, "settlement_members"), where("fromName", "==", savedName), where("status", "==", "pending"))
        );
        let owingTotal = 0;
        owingSnap.forEach((doc) => { owingTotal += doc.data().amount || 0; });

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
          if (data.status === 'cancelled' || data.status === 'open') return;
          if (data.status === 'closed' || data.status === 'manually_closed') {
            const timeStrS = (data.cartTimes?.[0] === 'TBD' || !data.cartTimes?.[0]) ? '23:59' : data.cartTimes[0];
            if (new Date() < new Date(`${data.date}T${timeStrS}:00`)) return;
          }
          const isJoined = data.participants?.some((p: any) => p.name === savedName);
          if (!isJoined) return;
          if (data.meetupType === 'etc' || data.isEtc) return;
          const point = data.meetupType === 'overnight' || data.isOvernight ? 4 : data.meetupType === 'field' ? 2 : 1;
          yearlyScore += point;
          if (data.date >= seasonStart && data.date <= `${seasonEnd}-31`) seasonScore += point;
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
    const finalHandicap = tempHandicap === '' ? 0 : Number(tempHandicap);
    const finalGHandicap = getFinalGHandicap();

    localStorage.setItem('user_nickname', trimmedNickname);
    setUserNickname(trimmedNickname);
    setHandicap(finalHandicap);
    setGHandicap(finalGHandicap);

    try {
      const userRef = doc(db, 'users', userName.trim());
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await setDoc(userRef, { ...userSnap.data(), nickname: trimmedNickname, handicap: finalHandicap, gHandicap: finalGHandicap, updatedAt: new Date().toISOString() });
      } else {
        await setDoc(userRef, { name: userName.trim(), nickname: trimmedNickname, handicap: finalHandicap, gHandicap: finalGHandicap, joinedAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Firebase 저장 실패:', error);
    }

    setIsEditing(false);
    alert('프로필이 저장되었습니다! ⛳');
  };

  const menus = [
    { label: '내 벙개 내역', icon: '📋', href: '/my-meetups' },
    { label: '필드 벙개 히스토리', icon: '🏌️', href: '/meetup-history' },
    { label: '벙 점수 랭킹', icon: '🏅', href: '/bung-ranking' },  // ✅ 추가
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

        <div className="bg-gray-50 rounded-3xl p-5 mb-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <Avatar name={userName} size={60} />
            <div>
              <p className="text-lg font-black text-gray-800">{userNickname || userName}</p>
              <p className="text-[16px] text-gray-400 mt-0.5 font-medium italic">
                {userName === '김근석' ? '우동골 관리자' : '우동골 정회원'}
                {userNickname && <span className="ml-1.5 not-italic opacity-70">({userName})</span>}
              </p>
              {(handicap > 0 || gHandicap !== null) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {handicap > 0 && <span className="text-sm font-bold text-blue-500">필드핸디 {handicap}</span>}
                  {gHandicap !== null && (
                    <span className="text-sm font-bold text-purple-500">
                      G핸디 {gHandicap >= 0 ? `+${gHandicap}` : gHandicap}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

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
              <p className={`text-[17px] font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {menus.map((item, i) => (
            <div key={i}
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" style={{ bottom: '64px' }}>
          <div className="w-full max-w-md bg-white rounded-t-[32px] flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: 'calc(100vh - 128px)' }}
            onTouchMove={e => e.stopPropagation()}>
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
                  <input type="text" value={tempNickname} onChange={(e) => setTempNickname(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    className="w-full mt-2 p-4 bg-gray-100 rounded-2xl border-none font-bold text-gray-800 focus:ring-2 focus:ring-green-500" />
                  <p className="text-[16px] text-green-600 mt-3 font-medium bg-green-50 p-2 rounded-lg">
                    💡 닉네임은 모든 기기에서 자동으로 동기화됩니다. 벙개 명단에는 닉네임이 우선 표시되며, 정산은 실명({userName}) 기준으로 처리됩니다.
                  </p>
                </div>
                <div>
                  <label className="text-[17px] font-black text-gray-400 uppercase tracking-wider">핸디캡 (필드)</label>
                  <input type="number" inputMode="numeric" value={tempHandicap}
                    onChange={(e) => setTempHandicap(e.target.value)}
                    placeholder="예: 15" min="0" max="54"
                    className="w-full mt-2 p-4 bg-gray-100 rounded-2xl border-none font-bold text-gray-800 focus:ring-2 focus:ring-green-500" />
                  <p className="text-sm text-gray-400 mt-1">성적 기록이 쌓이면 자동으로 반영돼요</p>
                </div>
                <div>
                  <label className="text-[17px] font-black text-gray-400 uppercase tracking-wider">스크린 핸디캡 (G핸디)</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button type="button"
                      onClick={() => setTempGHandicapSign(prev => prev === 1 ? -1 : 1)}
                      className="w-14 h-14 rounded-2xl bg-gray-200 text-2xl font-black text-gray-700 flex-shrink-0 flex items-center justify-center active:bg-gray-300">
                      {tempGHandicapSign === 1 ? '+' : '−'}
                    </button>
                    <input type="number" inputMode="numeric" value={tempGHandicapAbs}
                      onChange={(e) => setTempGHandicapAbs(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="숫자만" min="0" max="54"
                      className="flex-1 p-4 bg-gray-100 rounded-2xl border-none font-black text-xl text-center text-gray-800 focus:ring-2 focus:ring-green-500" />
                    <div className="w-14 text-center flex-shrink-0">
                      {tempGHandicapAbs !== '' ? (
                        <span className={`text-lg font-black ${tempGHandicapSign === -1 ? 'text-purple-500' : 'text-blue-500'}`}>
                          {tempGHandicapSign === 1 ? '+' : '−'}{tempGHandicapAbs}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">미입력</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">왼쪽 버튼으로 +/− 부호를 바꿀 수 있어요. 스크린 벙개 조 편성 시 사용돼요</p>
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