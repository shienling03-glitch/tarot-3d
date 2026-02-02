import Link from 'next/link';

export default function TarotPage() {
  return (
    <main className="h-screen bg-black flex flex-col">
      {/* 顶部导航 */}
      {/* <div className="h-12 px-4 bg-gray-900 flex items-center justify-between border-b border-gray-800">
        <Link href="/" className="text-yellow-400 hover:underline">← 返回首页</Link>
        <span className="text-yellow-400 font-medium">🃏 Tarot Experience</span>
        <div className="w-16"></div>
      </div> */}
      
      {/* iframe 容器 */}
      <div className="flex-1">
        <iframe
          src="/tarot_3d_gesture.html"
          className="w-full h-full border-none"
          allow="camera; microphone"
          title="Tarot Experience"
        />
      </div>
    </main>
  );
}
