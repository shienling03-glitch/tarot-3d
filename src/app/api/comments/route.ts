import { NextRequest, NextResponse } from 'next/server';

interface Comment {
  id: string;
  userId: string;
  username: string;
  content: string;
  image?: string; // base64 图片
  createdAt: string;
}

// 内存存储（重启后会清空，简单实现）
const comments: Comment[] = [];

// 获取所有评论
export async function GET() {
  return NextResponse.json(comments.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));
}

// 发布评论
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, username, content, image } = body;

  if (!userId || !username || (!content?.trim() && !image)) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
  }

  // 限制图片大小（base64约为原文件1.37倍，限制2MB原图）
  if (image && image.length > 3 * 1024 * 1024) {
    return NextResponse.json({ error: '图片太大，请上传小于2MB的图片' }, { status: 400 });
  }

  const comment: Comment = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    userId,
    username: username.slice(0, 20),
    content: content?.trim().slice(0, 500) || '',
    image,
    createdAt: new Date().toISOString(),
  };

  comments.push(comment);
  return NextResponse.json(comment, { status: 201 });
}

// 删除评论
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('userId');

  if (!id || !userId) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  const index = comments.findIndex(c => c.id === id);
  if (index === -1) {
    return NextResponse.json({ error: '评论不存在' }, { status: 404 });
  }

  if (comments[index].userId !== userId) {
    return NextResponse.json({ error: '只能删除自己的评论' }, { status: 403 });
  }

  comments.splice(index, 1);
  return NextResponse.json({ success: true });
}
