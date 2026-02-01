'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  avatar?: string;
  lastSeen: number;
}

interface Message {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  content: string;
  image?: string;
  createdAt: string;
  read: boolean;
}

interface ChatPreview {
  friendId: string;
  friendName: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('chat_user_id');
  if (!id) {
    id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('chat_user_id', id);
  }
  return id;
}

function getStoredUsername(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('chat_username') || '';
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (dayDiff === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function formatMsgTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const dayDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (dayDiff === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function shouldShowTime(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const curr = new Date(messages[index].createdAt).getTime();
  const prev = new Date(messages[index - 1].createdAt).getTime();
  return curr - prev > 5 * 60 * 1000;
}


function AddFriendPanel({ userId, friends, onAdd, onClose }: { 
  userId: string; friends: User[]; onAdd: (id: string) => void; onClose: () => void;
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/chat?action=searchUsers&keyword=${encodeURIComponent(searchKeyword)}`);
      const data = await res.json();
      setSearchResults(data.filter((u: User) => u.id !== userId));
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  const isFriend = (id: string) => friends.some(f => f.id === id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold mb-3 text-gray-800 text-center">添加好友</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="搜索用户昵称"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#07c160]"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchKeyword.trim()}
            className="px-4 py-2 bg-[#07c160] text-white rounded-lg disabled:opacity-50"
          >
            {searching ? '...' : '搜索'}
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {searchResults.map(u => (
            <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#07c160] rounded flex items-center justify-center text-white font-bold">{u.username[0]}</div>
                <span>{u.username}</span>
              </div>
              {isFriend(u.id) ? (
                <span className="text-gray-400 text-sm">已添加</span>
              ) : (
                <button onClick={() => onAdd(u.id)} className="px-3 py-1 bg-[#07c160] text-white text-sm rounded-lg">添加</button>
              )}
            </div>
          ))}
          {hasSearched && searchResults.length === 0 && <p className="text-gray-500 text-sm text-center py-4">未找到用户</p>}
          {!hasSearched && <p className="text-gray-400 text-sm text-center py-4">输入昵称搜索用户</p>}
        </div>
        <button onClick={onClose} className="mt-3 w-full py-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200">关闭</button>
      </div>
    </div>
  );
}


export default function ChatPage() {
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [registered, setRegistered] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [requests, setRequests] = useState<{id: string; fromId: string; fromName: string}[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showChatView, setShowChatView] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const api = useCallback(async (action: string, params: Record<string, string> = {}) => {
    const url = new URL('/api/chat', window.location.origin);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url);
    return res.json();
  }, []);

  const postApi = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const register = async () => {
    if (!username.trim()) return;
    localStorage.setItem('chat_username', username);
    await postApi({ action: 'register', userId, username });
    setRegistered(true);
  };

  const fetchData = useCallback(async () => {
    if (!registered || !userId) return;
    await postApi({ action: 'heartbeat', userId });
    const [friendsData, requestsData, previewsData] = await Promise.all([
      api('friends', { userId }),
      api('requests', { userId }),
      api('chatPreviews', { userId }),
    ]);
    setFriends(friendsData);
    setRequests(requestsData);
    setChatPreviews(previewsData);
  }, [registered, userId, api, postApi]);

  const fetchMessages = useCallback(async () => {
    if (!selectedFriend) return;
    const data = await api('messages', { userId, friendId: selectedFriend.id });
    setMessages(data);
  }, [selectedFriend, userId, api]);

  useEffect(() => {
    const id = getUserId();
    const stored = getStoredUsername();
    setUserId(id);
    setUsername(stored);
    if (stored) {
      postApi({ action: 'register', userId: id, username: stored }).then(() => setRegistered(true));
    }
  }, [postApi]);

  useEffect(() => {
    if (!registered) return;
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [registered, fetchData]);

  useEffect(() => {
    if (!selectedFriend) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [selectedFriend, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addFriend = async (targetId: string) => {
    await postApi({ action: 'addFriend', userId, targetId });
    alert('好友请求已发送');
    setShowAddPanel(false);
  };

  const acceptRequest = async (requestId: string) => {
    await postApi({ action: 'acceptFriend', userId, targetId: requestId });
    fetchData();
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && !image) || !selectedFriend) return;
    setSending(true);
    await postApi({ action: 'sendMessage', userId, targetId: selectedFriend.id, content: inputText, image });
    setInputText('');
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchMessages();
    setSending(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('图片不能超过2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const selectChat = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    if (friend) { setSelectedFriend(friend); setShowChatView(true); }
  };

  const goBackToList = () => { setShowChatView(false); setSelectedFriend(null); };


  if (!registered) {
    return (
      <main className="min-h-screen bg-[#ededed] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
          <h1 className="text-xl font-bold text-[#07c160] mb-6 text-center">微信风格聊天</h1>
          <input type="text" placeholder="输入你的昵称" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20}
            className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-lg focus:border-[#07c160] focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && register()} />
          <button onClick={register} disabled={!username.trim()}
            className="w-full py-3 bg-[#07c160] text-white font-bold rounded-lg disabled:opacity-50">进入聊天</button>
          <Link href="/" className="block text-center text-gray-500 mt-4 hover:text-[#07c160]">← 返回首页</Link>
        </div>
      </main>
    );
  }

  const ChatListView = () => (
    <div className="flex flex-col h-full bg-[#ededed]">
      <div className="h-12 px-4 bg-[#ededed] flex items-center justify-between border-b border-[#d9d9d9]">
        <Link href="/" className="text-gray-600">←</Link>
        <span className="font-medium">微信</span>
        <button onClick={() => setShowAddPanel(true)} className="text-xl text-gray-600">+</button>
      </div>
      {requests.length > 0 && (
        <div className="mx-3 mt-2 p-3 bg-[#fa9d3b] text-white rounded-lg">
          <p className="font-medium mb-2">{requests.length} 条好友请求</p>
          {requests.map(r => (
            <div key={r.id} className="flex items-center justify-between py-1">
              <span>{r.fromName}</span>
              <button onClick={() => acceptRequest(r.id)} className="px-3 py-1 bg-white text-[#fa9d3b] text-sm rounded">接受</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {chatPreviews.map((chat) => (
          <div key={chat.friendId} onClick={() => selectChat(chat.friendId)}
            className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#ededed] active:bg-[#ececec]">
            <div className="w-12 h-12 bg-[#07c160] rounded flex items-center justify-center text-white font-bold text-lg flex-shrink-0">{chat.friendName[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-800">{chat.friendName}</span>
                <span className="text-xs text-gray-500">{formatTime(chat.lastTime)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-gray-500 truncate pr-2">{chat.lastMessage || '[图片]'}</span>
                {chat.unread > 0 && <span className="bg-[#f44] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0">{chat.unread}</span>}
              </div>
            </div>
          </div>
        ))}
        {chatPreviews.length === 0 && <div className="text-center py-12 text-gray-500"><p>暂无会话</p><p className="text-sm mt-2">点击右上角 + 添加好友</p></div>}
      </div>
      <div className="h-14 px-4 bg-white border-t border-[#d9d9d9] flex items-center gap-3">
        <div className="w-9 h-9 bg-[#07c160] rounded flex items-center justify-center text-white">{username[0]}</div>
        <span className="text-sm text-gray-700">{username}</span>
      </div>
    </div>
  );


  const ChatView = () => (
    <div className="flex flex-col h-full bg-[#ededed]">
      <div className="h-12 px-4 bg-[#ededed] flex items-center justify-between border-b border-[#d9d9d9]">
        <button onClick={goBackToList} className="text-gray-600 md:hidden">＜</button>
        <Link href="/" className="text-gray-600 hidden md:block">←</Link>
        <span className="font-medium">{selectedFriend?.username}</span>
        <span className="text-gray-400">···</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.map((m, index) => (
          <div key={m.id}>
            {shouldShowTime(messages, index) && (
              <div className="text-center my-3">
                <span className="text-xs text-gray-500 bg-[#dadada] px-2 py-1 rounded">{formatMsgTime(m.createdAt)}</span>
              </div>
            )}
            <div className={`flex items-start gap-2 mb-3 ${m.fromId === userId ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 bg-[#07c160] rounded flex-shrink-0 flex items-center justify-center text-white font-bold">{m.fromName[0]}</div>
              <div className={`max-w-[70%] ${m.fromId === userId ? 'mr-1' : 'ml-1'}`}>
                {m.content && (
                  <div className={`px-3 py-2 rounded-lg break-words whitespace-pre-wrap ${m.fromId === userId ? 'bg-[#95ec69] text-gray-800' : 'bg-white text-gray-800'}`}>{m.content}</div>
                )}
                {m.image && <img src={m.image} alt="" className="max-w-[200px] rounded-lg mt-1 cursor-pointer" onClick={() => setPreviewImage(m.image!)} />}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-[#f5f5f5] border-t border-[#d9d9d9] p-2">
        {image && (
          <div className="relative inline-block mb-2 ml-2">
            <img src={image} alt="" className="h-16 rounded-lg" />
            <button onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs">×</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center text-gray-600"><span className="text-xl">🎤</span></button>
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            className="flex-1 h-9 px-3 bg-white rounded-lg border-none focus:outline-none" />
          <button className="w-8 h-8 flex items-center justify-center text-gray-600"><span className="text-xl">😊</span></button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="mobile-img" />
          <label htmlFor="mobile-img" className="w-8 h-8 flex items-center justify-center text-gray-600 cursor-pointer"><span className="text-xl">⊕</span></label>
        </div>
      </div>
    </div>
  );

  return (
    <main className="h-screen bg-[#ededed]">
      <div className="md:hidden h-full">{showChatView && selectedFriend ? <ChatView /> : <ChatListView />}</div>
      <div className="hidden md:flex h-full">
        <div className="w-80 border-r border-[#d9d9d9]"><ChatListView /></div>
        <div className="flex-1">{selectedFriend ? <ChatView /> : <div className="h-full flex items-center justify-center text-gray-400">选择一个好友开始聊天</div>}</div>
      </div>
      {showAddPanel && <AddFriendPanel userId={userId} friends={friends} onAdd={addFriend} onClose={() => setShowAddPanel(false)} />}
      {previewImage && <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}><img src={previewImage} alt="" className="max-w-full max-h-full object-contain" /></div>}
    </main>
  );
}
