'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shareToKakao } from '@/lib/kakao';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface Member {
  name: string;
  nickname: string;
  amount: number;
}

export default function SettlementPage() {
  const router = useRouter();

  const [memo, setMemo] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [accountNumber, setAccountNumber] = useState('');
  const [members, setMembers] = useState<Member[]>([
    { name: '', nickname: '', amount: 0 }
  ]);
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    const nickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(name);
    setMyNickname(nickname);
    // 저장된 계좌번호 불러오기
    const savedAccount = localStorage.getItem('settlement_account') || '';
    setAccountNumber(savedAccount);
  }, []);

  // 총액 변경 시 균등 분배
  const handleTotalChange = (value: number) => {
    setTotalAmount(value);
    if (members.length > 0 && value > 0) {
      const perPerson = Math.floor(value / members.length);
      const remainder = value - perPerson * members.length;
      setMembers(prev => prev.map((m, i) => ({
        ...m,
        amount: i === 0 ? perPerson + remainder : perPerson, // 첫번째에 나머지 추가
      })));
    }
  };

  // 인원 추가/삭제 시 균등 재분배
  const redistributeAmounts = (newMembers: Member[]) => {
    if (totalAmount <= 0 || newMembers.length === 0) return newMembers;
    const perPerson = Math.floor(totalAmount / newMembers.length);
    const remainder = totalAmount - perPerson * newMembers.length;
    return newMembers.map((m, i) => ({
      ...m,
      amount: i === 0 ? perPerson + remainder : perPerson,
    }));
  };

  const addMember = () => {
    const newMembers = redistributeAmounts([...members, { name: '', nickname: '', amount: 0 }]);
    setMembers(newMembers);
  };

  const removeMember = (index: number) => {
    if (members.length <= 1) return;
    const newMembers = redistributeAmounts(members.filter((_, i) => i !== index));
    setMembers(newMembers);
  };

  const updateMember = (index: number, field: keyof Member, value: string | number) => {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  // 금액 수동 수정 시 나머지 자동 조정
  const updateAmount = (index: number, value: number) => {
    const newMembers = [...members];
    newMembers[index] = { ...newMembers[index], amount: value };

    // 수정된 금액들의 합
    const fixedTotal = newMembers.reduce((sum, m) => sum + m.amount, 0);
    const diff = totalAmount - fixedTotal;

    // 차이가 있으면 첫 번째 멤버에 반영
    if (diff !== 0 && index !== 0) {
      newMembers[0] = { ...newMembers[0], amount: newMembers[0].amount + diff };
    }

    setMembers(newMembers);
  };

  const totalAssigned = members.reduce((sum, m) => sum + m.amount, 0);
  const isBalanced = totalAssigned === totalAmount;

  const handleKakaoShare = async () => {
    if (totalAmount <= 0) return alert('금액을 입력해주세요!');
    if (members.some(m => !m.name.trim())) return alert('모든 멤버 이름을 입력해주세요!');
    if (!isBalanced) return alert(`금액 합계가 맞지 않아요!\n총액: ${totalAmount.toLocaleString()}원\n배분: ${totalAssigned.toLocaleString()}원`);

    // 계좌번호 저장
    if (accountNumber) localStorage.setItem('settlement_account', accountNumber);

    try {
      await addDoc(collection(db, "settlements"), {
        userName: myName,
        totalAmount: Number(totalAmount),
        memo: memo || '모임 비용',
        playerCount: members.length,
        perPerson: Math.floor(totalAmount / members.length),
        members: members,
        accountNumber,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 카카오 공유 메시지 생성
      const memberLines = members
        .filter(m => m.name !== myName) // 본인 제외
        .map(m => `• ${m.nickname || m.name}: ${m.amount.toLocaleString()}원`)
        .join('\n');

      const myMember = members.find(m => m.name === myName);
      const accountLine = accountNumber ? `\n💳 계좌: ${accountNumber} (${myNickname || myName})` : '';

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
          <p className="text-xs opacity-70 mb-1 font-bold">총 지출</p>
          <h2 className="text-4xl font-black text-green-400">{totalAmount.toLocaleString()}원</h2>
          <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-[11px] opacity-80">
            <span>{members.length}명 기준</span>
            <span className={isBalanced ? 'text-green-400' : 'text-red-400'}>
              {isBalanced ? '✅ 배분 완료' : `⚠️ ${(totalAmount - totalAssigned).toLocaleString()}원 차이`}
            </span>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">지출 내용</label>
            <input
              type="text"
              placeholder="예: 그늘집 및 저녁 식사"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 font-medium text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">총 결제 금액 (원)</label>
            <input
              type="number"
              placeholder="0"
              value={totalAmount === 0 ? '' : totalAmount}
              onChange={(e) => handleTotalChange(Number(e.target.value))}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-xl font-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">입금받을 계좌번호</label>
            <input
              type="text"
              placeholder="예: 카카오뱅크 1234-56-789012"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
            />
          </div>
        </div>

        {/* 멤버별 금액 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">멤버별 금액</label>
            <button
              onClick={addMember}
              className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100"
            >
              + 멤버 추가
            </button>
          </div>

          <div className="space-y-3">
            {members.map((member, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="이름"
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    placeholder="닉네임(선택)"
                    value={member.nickname}
                    onChange={(e) => updateMember(index, 'nickname', e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                  />
                  {members.length > 1 && (
                    <button
                      onClick={() => removeMember(index)}
                      className="text-gray-300 hover:text-red-400 text-xl font-bold px-1"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={member.amount || ''}
                      onChange={(e) => updateAmount(index, Number(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-black text-green-700 focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <span className="text-gray-400 text-sm font-bold">원</span>
                  <button
                    onClick={() => {
                      // 균등 재분배
                      const newMembers = redistributeAmounts(members);
                      setMembers(newMembers);
                    }}
                    className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1.5 rounded-lg font-bold whitespace-nowrap"
                  >
                    균등
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 합계 확인 */}
          <div className={`mt-3 p-3 rounded-xl text-[12px] font-bold text-center ${
            isBalanced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}>
            배분 합계: {totalAssigned.toLocaleString()}원 / 총액: {totalAmount.toLocaleString()}원
            {!isBalanced && ` (${(totalAmount - totalAssigned) > 0 ? '+' : ''}${(totalAmount - totalAssigned).toLocaleString()}원)`}
          </div>
        </div>

        {/* 카톡 공유 버튼 */}
        <button
          onClick={handleKakaoShare}
          className="w-full bg-[#FEE500] text-[#191919] p-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-3 border-b-4 border-yellow-600/30"
        >
          <span className="text-2xl">💬</span> 카톡으로 정산 공유
        </button>

        <p className="text-center text-[11px] text-gray-400">
          공유 시 미정산 상태로 기록되며 마이페이지에 합산됩니다.
        </p>
      </div>
    </div>
  );
}