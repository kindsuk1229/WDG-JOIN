'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, arrayUnion, arrayRemove, getDoc
} from 'firebase/firestore';

interface MarketItem {
  id: string;
  title: string;
  price: number;
  description: string;
  category: string;
  images: string[];
  sellerName: string;
  sellerNickname: string;
  status: 'sale' | 'reserved' | 'sold';
  likes: string[];
  createdAt: string;
  kakaoId?: string;
}

const CATEGORIES = ['전체', '골프채', '골프웨어', '골프공', '골프화', '기타용품'];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  sale:     { label: '판매중',  color: 'bg-green-100 text-green-700' },
  reserved: { label: '예약중',  color: 'bg-yellow-100 text-yellow-700' },
  sold:     { label: '거래완료', color: 'bg-gray-100 text-gray-400' },
};

export default function MarketPage() {
  const router = useRouter();
  const [myName, setMyName] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('전체');
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [formCategory, setFormCategory] = useState('골프채');
  const [kakaoId, setKakaoId] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const name = (localStorage.getItem('user_name') || '').trim();
    const nickname = (localStorage.getItem('user_nickname') || '').trim();
    setMyName(name);
    setMyNickname(nickname || name);

    // 실시간 목록 구독
    const q = query(collection(db, 'market'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 이미지 업로드 (base64로 Firebase 저장)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) return alert('이미지는 최대 5장까지 가능해요.');
    setUploading(true);
    try {
      const base64List = await Promise.all(files.map(file => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      })));
      setImages(prev => [...prev, ...base64List]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 판매글 등록
  const handleSubmit = async () => {
    if (!title.trim()) return alert('제목을 입력해주세요.');
    if (!price) return alert('가격을 입력해주세요.');
    setSaving(true);
    try {
      await addDoc(collection(db, 'market'), {
        title: title.trim(),
        price: Number(price),
        description: description.trim(),
        category: formCategory,
        images,
        sellerName: myName,
        sellerNickname: myNickname,
        status: 'sale',
        likes: [],
        kakaoId: kakaoId.trim(),
        createdAt: new Date().toISOString(),
      });
      setTitle(''); setPrice(''); setDescription('');
      setFormCategory('골프채'); setKakaoId(''); setImages([]);
      setShowForm(false);
      alert('판매글이 등록되었습니다! 🥕');
    } catch { alert('등록 중 오류가 발생했습니다.'); }
    finally { setSaving(false); }
  };

  // 관심 토글
  const handleLike = async (item: MarketItem) => {
    const ref = doc(db, 'market', item.id);
    const isLiked = item.likes.includes(myName);
    await updateDoc(ref, {
      likes: isLiked ? arrayRemove(myName) : arrayUnion(myName),
    });
  };

  // 상태 변경 (판매자만)
  const handleStatusChange = async (item: MarketItem, status: string) => {
    await updateDoc(doc(db, 'market', item.id), { status });
    setSelectedItem(prev => prev ? { ...prev, status: status as any } : null);
  };

  // 삭제 (판매자만)
  const handleDelete = async (item: MarketItem) => {
    if (!window.confirm('판매글을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'market', item.id));
    setSelectedItem(null);
  };

  const filtered = items.filter(i => category === '전체' || i.category === category);

  const formatPrice = (price: number) => price === 0 ? '나눔' : `${price.toLocaleString()}원`;
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000 / 60);
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  };

  // 상세 모달
  if (selectedItem) {
    const isMine = selectedItem.sellerName === myName;
    const isLiked = selectedItem.likes.includes(myName);
    return (
      <div className="bg-gray-50 min-h-screen text-gray-900">
        <header className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <button onClick={() => setSelectedItem(null)} className="text-xl font-bold text-gray-600">←</button>
          {isMine && (
            <div className="flex gap-2">
              {(['sale', 'reserved', 'sold'] as const).map(s => (
                <button key={s} onClick={() => handleStatusChange(selectedItem, s)}
                  className={`text-xs px-2 py-1 rounded-lg font-bold ${selectedItem.status === s ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABEL[s].label}
                </button>
              ))}
              <button onClick={() => handleDelete(selectedItem)}
                className="text-xs px-2 py-1 bg-red-50 text-red-400 rounded-lg font-bold">삭제</button>
            </div>
          )}
        </header>

        {/* 이미지 */}
        {selectedItem.images.length > 0 ? (
          <div className="flex overflow-x-auto gap-2 p-4 bg-white">
            {selectedItem.images.map((img, i) => (
              <img key={i} src={img} alt="" className="w-72 h-72 object-cover rounded-2xl flex-shrink-0" />
            ))}
          </div>
        ) : (
          <div className="h-48 bg-gray-100 flex items-center justify-center">
            <span className="text-5xl">🥕</span>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_LABEL[selectedItem.status].color}`}>
                {STATUS_LABEL[selectedItem.status].label}
              </span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{selectedItem.category}</span>
            </div>
            <p className="text-xl font-black text-gray-800">{selectedItem.title}</p>
            <p className="text-2xl font-black text-green-600">{formatPrice(selectedItem.price)}</p>
            <p className="text-sm text-gray-500 leading-relaxed">{selectedItem.description}</p>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              <span className="text-sm font-bold text-gray-600">{selectedItem.sellerNickname || selectedItem.sellerName}</span>
              <span className="text-xs text-gray-400">· {formatDate(selectedItem.createdAt)}</span>
            </div>
          </div>

          {/* 관심 + 연락 */}
          <div className="flex gap-3">
            <button onClick={() => handleLike(selectedItem)}
              className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold border transition-all ${
                isLiked ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-gray-200 text-gray-500'
              }`}>
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{selectedItem.likes.length}</span>
            </button>
            {!isMine && selectedItem.status === 'sale' && (
              selectedItem.kakaoId ? (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedItem.kakaoId!);
                    alert(`카카오톡 ID: ${selectedItem.kakaoId}\n클립보드에 복사되었습니다!`);
                  }}
                  className="flex-1 py-3.5 bg-yellow-400 text-white rounded-2xl font-bold text-base active:scale-95 transition-all">
                  💬 카카오톡으로 연락하기
                </button>
              ) : (
                <button
                  onClick={() => {
                    const text = `안녕하세요! WDG 마켓에서 "${selectedItem.title}" 보고 연락드립니다 🥕`;
                    navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text);
                  }}
                  className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl font-bold text-base active:scale-95 transition-all">
                  📞 연락하기
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900 pb-24">
      <header className="p-4 bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-800">🥕 WDG 마켓</h1>
            <p className="text-xs text-gray-400">우동골 회원 중고 거래</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all">
            + 판매하기
          </button>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${
                category === c ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🥕</p>
            <p className="text-gray-400 text-sm">아직 판매 중인 물품이 없어요.</p>
            <button onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold">
              첫 판매글 올리기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => {
              const isLiked = item.likes.includes(myName);
              return (
                <div key={item.id} onClick={() => setSelectedItem(item)}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-95 transition-all">
                  {/* 이미지 */}
                  <div className="relative">
                    {item.images.length > 0 ? (
                      <img src={item.images[0]} alt="" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                        <span className="text-4xl">🥕</span>
                      </div>
                    )}
                    {item.status !== 'sale' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_LABEL[item.status].color}`}>
                          {STATUS_LABEL[item.status].label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 mb-1">{item.category}</p>
                    <p className="font-bold text-gray-800 text-sm truncate">{item.title}</p>
                    <p className="font-black text-green-600 mt-1">{formatPrice(item.price)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{item.sellerNickname || item.sellerName}</span>
                      <span className="text-xs text-gray-400">
                        {isLiked ? '❤️' : '🤍'} {item.likes.length}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 판매글 등록 바텀시트 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-[32px] flex flex-col"
            style={{ maxHeight: 'calc(100vh - 60px)' }}>
            <div className="px-6 pt-6 pb-4 shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
              <h3 className="text-xl font-black">판매글 등록</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
              {/* 이미지 업로드 */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-2">사진 (최대 5장)</label>
                <div className="flex gap-2 flex-wrap">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="w-20 h-20 object-cover rounded-xl" />
                      <button onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center">×</button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 active:bg-gray-200">
                      <span className="text-2xl">📷</span>
                      <span className="text-xs mt-1">{uploading ? '업로드중' : '추가'}</span>
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-2">카테고리</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.filter(c => c !== '전체').map(c => (
                    <button key={c} onClick={() => setFormCategory(c)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold ${formCategory === c ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">제목</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="예: 캘러웨이 드라이버 판매"
                  className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              {/* 가격 */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">가격 (0원 = 나눔)</label>
                <input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
                  placeholder="예: 150000"
                  className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              {/* 설명 */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">설명</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="상품 상태, 구매 시기, 판매 이유 등을 자유롭게 적어주세요."
                  rows={4}
                  className="w-full p-3 bg-gray-50 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-green-500 outline-none resize-none" />
              </div>

              {/* 카카오톡 ID */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">카카오톡 ID (선택)</label>
                <input type="text" value={kakaoId} onChange={e => setKakaoId(e.target.value)}
                  placeholder="카카오톡 ID 입력"
                  className="w-full p-3 bg-gray-50 rounded-xl text-gray-800 focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
            </div>

            <div className="flex gap-3 px-6 pt-4 pb-20 shrink-0 border-t border-gray-100">
              <button onClick={() => setShowForm(false)}
                className="flex-1 p-4 bg-gray-100 rounded-2xl font-bold text-gray-500">취소</button>
              <button onClick={handleSubmit} disabled={saving}
                className={`flex-1 p-4 rounded-2xl font-bold text-white ${saving ? 'bg-gray-400' : 'bg-green-600'}`}>
                {saving ? '등록중...' : '🥕 판매글 올리기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}