'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shareToKakao } from '@/lib/kakao';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

interface Member {
  name: string;
  nickname: string;
  amount: number;
}

interface AppMember {
  name: string;
  nickname: string;
}

export default function SettlementPage() {
  const router = useRouter();

  const [memo, setMemo] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [accountNumber, setAccountNumber] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [sharing, setSharing] = useState(false);

  // 앱 멤버 목록
  const [appMembers, setAppMembers] = useState<AppMember[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    const nickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(name);
    setMyNickname(nickname);

    const savedAccount = localStorage.getItem('settlement_account') || '';
    setAccountNumber(savedAccount);

    // 본인 자동 추가
    if (name) {
      setMembers([{ name, nickname, amount: 0 }]);
    }

    // 앱 멤버 목록 불러오기
    const fetchAppMembers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: AppMember[] = snap.docs.map(d => ({
          name: d.data().name || d.id,
          nickname: d.data().nickname || '',
        }));
        setAppMembers(list);
      } catch (error) {
        console.error('멤버 목록 로딩 실패:', error);
      }
    };
    fetchAppMembers();
  }, []);

  // 균등 분배
  const redistribute = (list: Member[], total: number) => {
    if (list.length === 0 || total <= 0) return list;
    const perPerson = Math.floor(total / list.length);
    const remainder = total - perPerson * list.length;
    return list.map((m, i) => ({
      ...m,
      amount: i === 0 ? perPerson + remainder : perPerson,
    }));
  };

  const handleTotalChange = (value: number) => {
    setTotalAmount(value);
    setMembers(prev => redistribute(prev, value));
  };

  // 멤버 선택/해제
  const toggleAppMember = (appMember: AppMember) => {
    const exists = members.some(m => m.name === appMember.name);
    let newMembers: Member[];
    if (exists) {
      if (appMember.name === myName) return; // 본인은 제거 불가
      newMembers = members.filter(m => m.name !== appMember.name);
    } else {
      newMembers = [...members, { name: appMember.name, nickname: appMember.nickname, amount: 0 }];
    }
    setMembers(redistribute(newMembers, totalAmount));
  };

  const updateAmount = (index: number, value: number) => {
    const newMembers = [...members];
    newMembers[index] = { ...newMembers[index], amount: value };
    setMembers(newMembers);
  };

  const totalAssigned = members.reduce((sum, m) => sum + m.amount, 0);
  const isBalanced = totalAmount === 0 || totalAssigned === totalAmount;

  const handleKakaoShare = async () => {
    if (sharing) return;
    if (totalAmount <= 0) return alert('금액을 입력해주세요!');
    if (members.length < 2) return alert('멤버를 1명 이상 추가해주세요!');
    if (!isBalanced) return alert(`금액 합계가 맞지 않아요!\n총액: ${totalAmount.toLocaleString()}원\n배분: ${totalAssigned.toLocaleString()}원`);

    setSharing(true);
    if (accountNumber) localStorage.setItem('settlement_account', accountNumber);

    try {
      // 1. 마스터 정산 문서 저장
      const masterDoc = await addDoc(collection(db, "settlements"), {
        userName: myName,
        totalAmount: Number(totalAmount),
        memo: memo || '모임 비용',
        playerCount: members.length,
        perPerson: Math.floor(totalAmount / members.length),
        members,
        accountNumber,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // ✅ 2. 멤버별 개별 문서 저장 (내가 내야 할 돈 추적용)
      const otherMembers = members.filter(m => m.name !== myName);
      await Promise.all(
        otherMembers.map(m =>
          addDoc(collection(db, "settlement_members"), {
            settlementId: masterDoc.id,
            fromName: m.name,        // 내야 하는 사람
            fromNickname: m.nickname,
            toName: myName,          // 받는 사람
            toNickname: myNickname,
            amount: m.amount,
            memo: memo || '모임 비용',
            accountNumber,
            status: 'pending',
            createdAt: serverTimestamp()
          })
        )
      );

      // ✅ 3. 각 멤버에게 푸시 알림 전송
      await Promise.all(
        otherMembers.map(m =>
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserName: m.name,
              title: '💰 정산 요청이 왔어요!',
              body: `${myNickname || myName} → ${m.nickname || m.name}: ${m.amount.toLocaleString()}원${accountNumber ? ` (${accountNumber})` : ''}`,
              url: '/settlement/history',
            }),
          })
        )
      );

      // 4. 카카오 공유
      const memberLines = otherMembers
        .map(m => `• ${m.nickname || m.name}: ${m.amount.toLocaleString()}원`)
        .join('\n');
      const accountLine = accountNumber
        ? `\n💳 계좌: ${accountNumber} (${myNickname || myName})`
        : '';

      const title = '⛳ WDG 라운딩 정산 요청';
      const description = [
        `📋 ${memo || '모임 비용'}`,
        `💰 총 ${totalAmount.toLocaleString()}원 / ${members.length}명`,
        ``,
        `💸 입금 부탁드립니다!`,
        memberLines,
        accountLine,
      ].join('\n');

      shareToKakao(window.location.href, title, description);
      alert('정산 내역이 기록되었습니다! ⛳');

    } catch (error) {
      console.error("정산 저장 에러:", error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="bg-gray-50 text-gray-900">
      <header className="p-4 bg-white border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="mr-4 text-xl">←</button>
        <h1 className="text-xl font-bold text-green-700">모임 비용 정산</h1>
      </header>

      <div className="p-5 space-y-5">

        {/* 요약 카드 */}
        <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-xl border-b-4 border-green-600">
          <p className="text-base opacity-70 mb-1 font-bold">총 지출</p>
          <h2 className="text-4xl font-black text-green-400">{totalAmount.toLocaleString()}원</h2>
          <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-[17px] opacity-80">
            <span>{members.length}명 기준</span>
            <span className={isBalanced ? 'text-green-400' : 'text-red-400'}>
              {isBalanced ? '✅ 배분 완료' : `⚠️ ${(totalAmount - totalAssigned).toLocaleString()}원 차이`}
            </span>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="text-base font-bold text-gray-400 block mb-2">지출 내용</label>
            <input
              type="text"
              placeholder="예: 그늘집 및 저녁 식사"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-base"
            />
          </div>
          <div>
            <label className="text-base font-bold text-gray-400 block mb-2">총 결제 금액 (원)</label>
            <input
              type="number"
              placeholder="0"
              value={totalAmount === 0 ? '' : totalAmount}
              onChange={(e) => handleTotalChange(Number(e.target.value))}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-xl font-black"
            />
          </div>
          <div>
            <label className="text-base font-bold text-gray-400 block mb-2">입금받을 계좌번호</label>
            <input
              type="text"
              placeholder="예: 카카오뱅크 1234-56-789012"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-base"
            />
          </div>
        </div>

        {/* ✅ 멤버 선택 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <label className="text-base font-bold text-gray-400 uppercase tracking-wide">
              참여 멤버 ({members.length}명)
            </label>
            <button
              onClick={() => setShowMemberPicker(true)}
              className="text-base font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100"
            >
              + 멤버 선택
            </button>
          </div>

          {members.length === 0 ? (
            <p className="text-center text-gray-400 text-base py-4">멤버를 추가해주세요</p>
          ) : (
            <div className="space-y-2">
              {members.map((member, index) => (
                <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-800">
                      {member.nickname || member.name}
                      {member.name === myName && <span className="ml-1 text-[16px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">나</span>}
                    </p>
                    {member.nickname && <p className="text-[16px] text-gray-400">{member.name}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={member.amount || ''}
                      onChange={(e) => updateAmount(index, Number(e.target.value))}
                      className="w-24 bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-base font-black text-green-700 text-right focus:ring-2 focus:ring-green-500"
                    />
                    <span className="text-gray-400 text-base">원</span>
                  </div>
                  {member.name !== myName && (
                    <button
                      onClick={() => {
                        const newMembers = redistribute(members.filter(m => m.name !== member.name), totalAmount);
                        setMembers(newMembers);
                      }}
                      className="text-gray-300 hover:text-red-400 text-lg font-bold"
                    >×</button>
                  )}
                </div>
              ))}

              {/* 균등 분배 버튼 */}
              <button
                onClick={() => setMembers(redistribute(members, totalAmount))}
                className="w-full py-2 bg-gray-100 rounded-xl text-base font-bold text-gray-500 mt-2"
              >
                🔄 균등 재분배
              </button>
            </div>
          )}

          {/* 합계 확인 */}
          {totalAmount > 0 && (
            <div className={`mt-3 p-3 rounded-xl text-[16px] font-bold text-center ${
              isBalanced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            }`}>
              배분 합계: {totalAssigned.toLocaleString()}원 / 총액: {totalAmount.toLocaleString()}원
              {!isBalanced && ` (${(totalAmount - totalAssigned) > 0 ? '+' : ''}${(totalAmount - totalAssigned).toLocaleString()}원)`}
            </div>
          )}
        </div>

        {/* 카톡 공유 버튼 */}
        <button
          onClick={handleKakaoShare}
          disabled={sharing}
          className={`w-full p-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-3 border-b-4 ${sharing ? 'bg-gray-300 text-gray-400 border-gray-400' : 'bg-[#FEE500] text-[#191919] border-yellow-600/30'}`}
        >
          <span className="text-2xl">💬</span> {sharing ? '처리 중...' : '카톡으로 정산 공유'}
        </button>

        <p className="text-center text-[17px] text-gray-400">
          공유 시 미정산 상태로 기록되며 마이페이지에 합산됩니다.
        </p>
      </div>

      {/* ✅ 멤버 선택 바텀시트 */}
      {showMemberPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" style={{ bottom: '64px' }}>
          <div
            className="w-full max-w-md bg-white rounded-t-[32px] flex flex-col"
            style={{ maxHeight: 'calc(100vh - 128px)' }}
            onTouchMove={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black">멤버 선택</h3>
                <button
                  onClick={() => setShowMemberPicker(false)}
                  className="text-base font-bold text-green-600 bg-green-50 px-4 py-2 rounded-xl"
                >
                  완료
                </button>
              </div>
              <p className="text-[17px] text-gray-400 mt-1">선택한 멤버가 정산에 포함됩니다</p>
            </div>

            <div
              className="flex-1 overflow-y-auto px-6 pb-8"
              style={{ WebkitOverflowScrolling: 'touch', overflowY: 'auto' }}
            >
              <div className="space-y-2">
                {appMembers.map((appMember, i) => {
                  const isSelected = members.some(m => m.name === appMember.name);
                  const isMe = appMember.name === myName;
                  return (
                    <div
                      key={i}
                      onClick={() => !isMe && toggleAppMember(appMember)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-100'
                      } ${isMe ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <span className="text-white text-base font-black">✓</span>}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 text-base">
                          {appMember.nickname || appMember.name}
                          {isMe && <span className="ml-1 text-[16px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">나</span>}
                        </p>
                        {appMember.nickname && <p className="text-[16px] text-gray-400">{appMember.name}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}