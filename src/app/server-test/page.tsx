'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Comment {
  id: string;
  userId: string;
  username: string;
  content: string;
  image?: string;
  createdAt: string;
}

function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let userId = localStorage.getItem('comment_user_id');
  if (!userId) {
    userId = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('comment_user_id', userId);
  }
  return userId;
}

function getUsername(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('comment_username') || '';
}

function setUsername(name: string) {
  localStorage.setItem('comment_username', name);
}

export default function CommentPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [username, setUsernameState] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    const res = await fetch('/api/comments');
    const data = await res.json();
    setComments(data);
  }, []);

  useEffect(() => {
    setUserId(getUserId());
    setUsernameState(getUsername());
    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleUsernameChange = (name: string) => {
    setUsernameState(name);
    setUsername(name);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !image) || !username.trim()) return;

    setLoading(true);
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username, content, image }),
    });
    setContent('');
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchComments();
    setLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('确定删除这条评论吗？')) return;
    await fetch(`/api/comments?id=${commentId}&userId=${userId}`, { method: 'DELETE' });
    await fetchComments();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-yellow-400 hover:underline mb-6 inline-block">
          ← 返回首页
        </Link>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-6">💬 评论区</h1>
        
        <form onSubmit={handleSubmit} className="mb-8 p-4 bg-gray-900 rounded-lg">
          <input
            type="text"
            placeholder="你的昵称"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            maxLength={20}
            className="w-full mb-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-yellow-500 focus:outline-none"
          />
          <textarea
            placeholder="说点什么..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full mb-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-yellow-500 focus:outline-none resize-none"
          />
          
          {/* 图片预览 */}
          {image && (
            <div className="relative mb-3 inline-block">
              <img src={image} alt="预览" className="max-h-32 rounded-lg" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-400"
              >
                ×
              </button>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors text-sm"
              >
                📷 添加图片
              </label>
              <span className="text-gray-500 text-sm">{content.length}/500</span>
            </div>
            <button
              type="submit"
              disabled={loading || (!content.trim() && !image) || !username.trim()}
              className="px-6 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '发送中...' : '发布'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">还没有评论，来说点什么吧~</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="p-4 bg-gray-900 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-yellow-400">{comment.username}</span>
                    <span className="text-gray-500 text-sm ml-2">{formatTime(comment.createdAt)}</span>
                  </div>
                  {comment.userId === userId && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
                {comment.content && (
                  <p className="text-gray-200 whitespace-pre-wrap break-words">{comment.content}</p>
                )}
                {comment.image && (
                  <img
                    src={comment.image}
                    alt="评论图片"
                    className="mt-2 max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                    onClick={() => setPreviewImage(comment.image!)}
                  />
                )}
              </div>
            ))
          )}
        </div>
        
        <p className="text-gray-600 text-xs text-center mt-8">
          评论每5秒自动刷新 · 图片限制2MB · 数据存储在服务器内存中
        </p>
      </div>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="大图" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
            onClick={() => setPreviewImage(null)}
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
