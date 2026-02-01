'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';

// 预加载MagicCircleScene组件
const MagicCircleScene = dynamic(() => import('./MagicCircleScene'), {
  ssr: false,
});

export default function MagicCirclePage() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'splitting' | 'complete'>('loading');
  const [mediapipeReady, setMediapipeReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // MediaPipe加载
  useEffect(() => {
    let mounted = true;

    const initMediaPipe = async () => {
      if (!mounted) return;
      
      try {
        // 阶段1: 请求摄像头权限
        setProgress(5);
        await new Promise(resolve => setTimeout(resolve, 100)); // 让UI更新
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        setProgress(15);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        setProgress(20);
        await new Promise(resolve => setTimeout(resolve, 100));

        // 阶段2: 动态导入MediaPipe模块
        const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        
        if (!mounted) return;
        setProgress(35);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 阶段3: 加载WASM（这一步比较慢）
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );
        
        if (!mounted) return;
        setProgress(60);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 阶段4: 创建HandLandmarker并加载模型（这一步最慢）
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (!mounted) {
          handLandmarker.close();
          return;
        }

        setProgress(90);
        
        // 阶段5: 预热模型（做一次空检测，确保模型完全加载到GPU）
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try {
            handLandmarker.detectForVideo(videoRef.current, performance.now());
          } catch (e) {
            // 忽略预热错误
          }
        }
        
        // 保存到window供MagicCircleScene使用
        (window as any).__handLandmarker = handLandmarker;
        (window as any).__videoStream = stream;
        (window as any).__videoElement = videoRef.current;
        
        setProgress(100);
        
        // 确保100%显示一会儿
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (mounted) {
          setMediapipeReady(true);
        }
        
      } catch (error) {
        console.error('MediaPipe初始化错误:', error);
        setProgress(100);
        await new Promise(resolve => setTimeout(resolve, 200));
        if (mounted) {
          setMediapipeReady(true);
        }
      }
    };

    initMediaPipe();

    return () => {
      mounted = false;
    };
  }, []);

  // MediaPipe准备好后，开始分裂动画
  useEffect(() => {
    if (mediapipeReady && phase === 'loading') {
      // 先切换到splitting，让场景开始渲染
      setPhase('splitting');
      // 分裂动画1秒后完成
      setTimeout(() => {
        setPhase('complete');
      }, 1000);
    }
  }, [mediapipeReady, phase]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 场景在splitting阶段就开始渲染，分裂完成后才开始动画 */}
      {(phase === 'splitting' || phase === 'complete') && (
        <MagicCircleScene startAnimation={phase === 'complete'} />
      )}
      
      {/* Loading遮罩层 */}
      {phase !== 'complete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
          {/* 上半部分 */}
          <div 
            className={`absolute inset-x-0 top-0 h-1/2 bg-black transition-transform duration-1000 ease-in-out ${
              phase === 'splitting' ? '-translate-y-full' : ''
            }`}
          />
          
          {/* 下半部分 */}
          <div 
            className={`absolute inset-x-0 bottom-0 h-1/2 bg-black transition-transform duration-1000 ease-in-out ${
              phase === 'splitting' ? 'translate-y-full' : ''
            }`}
          />
          
          {/* 加载条 */}
          <div 
            className={`relative z-10 flex items-center gap-6 transition-opacity duration-500 ${
              phase === 'splitting' ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="relative w-[70vw] h-8">
              <div className="absolute inset-0 bg-cyan-500/20 blur-xl" />
              
              <div className="absolute inset-0 border-2 border-cyan-400/60 bg-black/50">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>
                
                <div className="absolute inset-0 opacity-30" 
                  style={{
                    backgroundImage: 'linear-gradient(90deg, transparent 0%, transparent 49%, rgba(0,255,255,0.3) 50%, transparent 51%, transparent 100%)',
                    backgroundSize: '20px 100%'
                  }}
                />
              </div>
              
              <div className="absolute -bottom-4 left-0 right-0 flex justify-between px-1">
                {[...Array(11)].map((_, i) => (
                  <div key={i} className="w-0.5 h-2 bg-cyan-400/60" />
                ))}
              </div>
            </div>
            
            <div className="text-cyan-400 font-mono text-2xl font-bold min-w-[80px] text-right">
              {progress}%
            </div>
          </div>
        </div>
      )}
      
      {/* 共享的video元素 - 隐藏但保持活跃 */}
      <video 
        ref={videoRef} 
        className="hidden"
        playsInline 
        muted 
        autoPlay 
      />
    </div>
  );
}
