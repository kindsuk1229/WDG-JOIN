'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/UI';
import { timeNow } from '@/lib/utils';

interface Msg { id: string; sender: string; name: string; text: string; time: string; }

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: '1', sender: 'u1', name: '김민준', text: '이번 주말 라운드 기대됩니다!', time: '10:30' },
    { id: '2', sender: 'u2', name: '이서연', text: '좋아요! 날씨도 좋다네요 😊', time: '10:32' },
    { id: '3', sender: 'u3', name: '박지호', text: '저도 기대됩니다~ 점심은 어디서 할까요?', time: '10:35' },
  ]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const myUid = 'me'; // TODO: auth

  useEffect(() => { scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }); }, [msgs.length]);

  const send = () => {
    if (!text.trim()) return;
    setMsgs(p => [...p, { id: String(Date.now()), sender: myUid, name: '나', text: text.trim(), time: timeNow() }]);
    setText('');
  };

  return (
    <div className="flex flex-col h-screen bg-white safe-top">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="text-gray-400 text-[13px]">← 뒤로</button>
        <h1 className="text-[16px] font-semibold">채팅</h1>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 scrollbar-hide">
        {msgs.map(m => {
          const isMe = m.sender === myUid;
          return (
            <div key={m.id} className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && <Avatar name={m.name} size={32} />}
              <div className={`max-w-[72%] ${isMe ? 'items-end' : ''}`}>
                {!isMe && <p className="text-[11px] text-gray-400 mb-0.5 pl-1">{m.name}</p>}
                <div className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                  isMe
                    ? 'bg-golf-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>{m.text}</div>
                <p className={`text-[10px] text-gray-400 mt-0.5 px-1 ${isMe ? 'text-right' : ''}`}>{m.time}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-100 safe-bottom bg-white">
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="메시지 입력..."
          className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-[14px]"
        />
        <button onClick={send} className="bg-golf-600 text-white rounded-xl px-5 py-2.5 text-[14px] font-semibold shrink-0">
          전송
        </button>
      </div>
    </div>
  );
}
