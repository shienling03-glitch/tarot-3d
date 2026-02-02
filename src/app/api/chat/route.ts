import { NextRequest, NextResponse } from 'next/server';

interface User {
  id: string;
  username: string;
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

interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// 内存存储 + 持久化用户列表
const users: Map<string, User> = new Map();
const allRegisteredUsers: Map<string, User> = new Map(); // 所有注册过的用户（持久化）
const friends: Map<string, Set<string>> = new Map(); // userId -> Set of friendIds
const friendRequests: FriendRequest[] = [];
const messages: Message[] = [];

// 清理超过30分钟不活跃的用户
function cleanupInactiveUsers() {
  const now = Date.now();
  const timeout = 30 * 60 * 1000;
  users.forEach((user, id) => {
    if (now - user.lastSeen > timeout) {
      users.delete(id);
    }
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');

  cleanupInactiveUsers();

  if (action === 'users') {
    // 获取所有在线用户
    return NextResponse.json(Array.from(users.values()));
  }

  if (action === 'searchUsers') {
    // 搜索用户（按昵称或ID）- 从所有注册用户中搜索
    const keyword = searchParams.get('keyword')?.toLowerCase() || '';
    if (!keyword) {
      return NextResponse.json([]);
    }
    const results = Array.from(allRegisteredUsers.values()).filter(u => 
      u.username.toLowerCase().includes(keyword) || u.id.toLowerCase().includes(keyword)
    );
    return NextResponse.json(results);
  }

  if (action === 'friends' && userId) {
    // 获取好友列表
    const friendIds = friends.get(userId) || new Set();
    const friendList = Array.from(friendIds)
      .map(id => users.get(id))
      .filter(Boolean);
    return NextResponse.json(friendList);
  }

  if (action === 'requests' && userId) {
    // 获取收到的好友请求
    const pending = friendRequests.filter(r => r.toId === userId && r.status === 'pending');
    return NextResponse.json(pending);
  }

  if (action === 'messages' && userId) {
    const friendId = searchParams.get('friendId');
    if (!friendId) return NextResponse.json([]);
    
    // 获取与某好友的聊天记录
    const chat = messages.filter(m => 
      (m.fromId === userId && m.toId === friendId) ||
      (m.fromId === friendId && m.toId === userId)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // 标记为已读
    chat.forEach(m => {
      if (m.toId === userId) m.read = true;
    });
    
    return NextResponse.json(chat);
  }

  if (action === 'unread' && userId) {
    // 获取未读消息数
    const unreadCount: Record<string, number> = {};
    messages.forEach(m => {
      if (m.toId === userId && !m.read) {
        unreadCount[m.fromId] = (unreadCount[m.fromId] || 0) + 1;
      }
    });
    return NextResponse.json(unreadCount);
  }

  if (action === 'chatPreviews' && userId) {
    // 获取会话列表预览
    const friendIds = friends.get(userId) || new Set();
    const previews = Array.from(friendIds).map(friendId => {
      const friend = users.get(friendId);
      if (!friend) return null;
      
      // 获取最后一条消息
      const chatMessages = messages.filter(m => 
        (m.fromId === userId && m.toId === friendId) ||
        (m.fromId === friendId && m.toId === userId)
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const lastMsg = chatMessages[0];
      const unread = messages.filter(m => m.fromId === friendId && m.toId === userId && !m.read).length;
      
      return {
        friendId,
        friendName: friend.username,
        lastMessage: lastMsg?.content || (lastMsg?.image ? '[图片]' : ''),
        lastTime: lastMsg?.createdAt || friend.lastSeen.toString(),
        unread,
      };
    }).filter(Boolean);
    
    // 按最后消息时间排序
    previews.sort((a, b) => new Date(b!.lastTime).getTime() - new Date(a!.lastTime).getTime());
    return NextResponse.json(previews);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, userId, username, targetId, content, image } = body;

  if (action === 'register') {
    // 注册/更新用户
    if (!userId || !username) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    const user = { id: userId, username, lastSeen: Date.now() };
    users.set(userId, user);
    allRegisteredUsers.set(userId, user); // 同时保存到持久化列表
    if (!friends.has(userId)) {
      friends.set(userId, new Set());
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'heartbeat') {
    // 心跳更新
    const user = users.get(userId);
    if (user) {
      user.lastSeen = Date.now();
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'addFriend') {
    // 发送好友请求
    if (!userId || !targetId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    
    // 检查是否已经是好友
    if (friends.get(userId)?.has(targetId)) {
      return NextResponse.json({ error: '已经是好友了' }, { status: 400 });
    }
    
    // 检查是否已发送请求
    const existing = friendRequests.find(r => 
      r.fromId === userId && r.toId === targetId && r.status === 'pending'
    );
    if (existing) {
      return NextResponse.json({ error: '已发送过请求' }, { status: 400 });
    }

    const fromUser = users.get(userId);
    friendRequests.push({
      id: Date.now().toString(),
      fromId: userId,
      toId: targetId,
      fromName: fromUser?.username || '未知用户',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'acceptFriend') {
    // 接受好友请求
    const request = friendRequests.find(r => r.id === targetId && r.toId === userId);
    if (!request) {
      return NextResponse.json({ error: '请求不存在' }, { status: 404 });
    }
    request.status = 'accepted';
    
    // 互相添加好友
    if (!friends.has(userId)) friends.set(userId, new Set());
    if (!friends.has(request.fromId)) friends.set(request.fromId, new Set());
    friends.get(userId)!.add(request.fromId);
    friends.get(request.fromId)!.add(userId);
    
    return NextResponse.json({ success: true });
  }

  if (action === 'rejectFriend') {
    // 拒绝好友请求
    const request = friendRequests.find(r => r.id === targetId && r.toId === userId);
    if (request) {
      request.status = 'rejected';
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'sendMessage') {
    // 发送消息
    if (!userId || !targetId || (!content?.trim() && !image)) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    
    // 检查是否是好友
    if (!friends.get(userId)?.has(targetId)) {
      return NextResponse.json({ error: '只能给好友发消息' }, { status: 403 });
    }

    const fromUser = users.get(userId);
    const message: Message = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      fromId: userId,
      toId: targetId,
      fromName: fromUser?.username || '未知用户',
      content: content?.trim().slice(0, 500) || '',
      image,
      createdAt: new Date().toISOString(),
      read: false,
    };
    messages.push(message);
    return NextResponse.json(message, { status: 201 });
  }

  if (action === 'deleteFriend') {
    // 删除好友
    if (!userId || !targetId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    friends.get(userId)?.delete(targetId);
    friends.get(targetId)?.delete(userId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
