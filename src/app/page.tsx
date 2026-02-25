import Link from 'next/link';

export default function Home() {
  return (
    <main className="w-full min-h-screen bg-black flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-4xl font-bold text-yellow-400">Magic Circle Experience</h1>
      
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap justify-center">
        <Link
          href="/magic-circle"
          className="px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold rounded-full hover:scale-105 transition-transform shadow-lg shadow-yellow-500/30"
        >
          ✨ Enter Magic Circle
        </Link>
        
        <Link
          href="/tarot"
          className="px-8 py-4 bg-gray-800 text-yellow-400 border border-yellow-500 font-bold rounded-full hover:bg-gray-700 transition-colors"
        >
          🃏 Tarot Experience
        </Link>
        
        {/* <Link
          href="/server-test"
          className="px-8 py-4 bg-gray-800 text-yellow-400 border border-yellow-500 font-bold rounded-full hover:bg-gray-700 transition-colors"
        >
          💬 评论区
        </Link>
        
        <Link
          href="/chat"
          className="px-8 py-4 bg-gray-800 text-yellow-400 border border-yellow-500 font-bold rounded-full hover:bg-gray-700 transition-colors"
        >
          👥 好友聊天
        </Link> */}
      </div>
      
      <p className="text-gray-400 text-sm mt-8">
        Enable camera for hand gesture interaction
      </p>
    </main>
  );
}
