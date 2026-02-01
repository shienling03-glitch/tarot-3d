'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface TarotCard {
  id: string;
  name: string;
  keywords: string[];
  meaning: string;
  love: string;
  career: string;
  advice: string;
}

interface HandState {
  isDetected: boolean;
  gesture: 'none' | 'open' | 'point' | 'pinch';
  position: { x: number; y: number };
  palmX: number;
}

type GamePhase = 'initial' | 'cards-spread' | 'selecting' | 'card-reveal' | 'result';

interface Props {
  startAnimation?: boolean;
}

export default function MagicCircleScene({ startAnimation = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    controls: OrbitControls;
    magicCircleGroup: THREE.Group;
    cardsGroup: THREE.Group;
    cards: THREE.Mesh[];
    centerCard: THREE.Mesh;
    textSprite: THREE.Sprite;
    selectedCardIndex: number;
    cardsRotation: number;
    bloomPass: UnrealBloomPass;
    cameraAnimating: boolean;
    cameraStartTime: number;
    cameraPhase: 'flip' | 'zoom';
  } | null>(null);
  
  // 屏幕光标元素引用
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const [handState, setHandState] = useState<HandState>({
    isDetected: false,
    gesture: 'none',
    position: { x: 0.5, y: 0.5 },
    palmX: 0.5,
  });
  const [handTrackingReady, setHandTrackingReady] = useState(false);
  const [displayText, setDisplayText] = useState('Happy Birthday');
  const [gamePhase, setGamePhase] = useState<GamePhase>('initial');
  const [selectedCards, setSelectedCards] = useState<TarotCard[]>([]);
  const [tarotData, setTarotData] = useState<Record<string, any>>({});
  const [currentRevealCard, setCurrentRevealCard] = useState<TarotCard | null>(null);
  const prevGestureRef = useRef<string>('none');
  const lastPalmXRef = useRef<number>(0.5);
  const handLandmarkerRef = useRef<any>(null);
  
  // 手指位置平滑相关 - 使用屏幕坐标
  const fingerTipPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const smoothedFingerPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const SMOOTHING_FACTOR = 0.75; // 平滑系数（0-1，越大越灵敏）

  // Load tarot data
  useEffect(() => {
    fetch('/tarot_data.json')
      .then(res => res.json())
      .then(data => setTarotData(data.cards || {}))
      .catch(console.error);
  }, []);

  // 辅助函数：设置卡牌透明度
  const setCardOpacity = (card: THREE.Object3D, opacity: number) => {
    if (card.userData.backMesh) {
      (card.userData.backMesh.material as THREE.MeshStandardMaterial).opacity = opacity;
    }
    if (card.userData.frontMesh) {
      (card.userData.frontMesh.material as THREE.MeshStandardMaterial).opacity = opacity;
    }
  };

  const resetGame = useCallback(() => {
    setGamePhase('initial');
    setSelectedCards([]);
    setCurrentRevealCard(null);
    
    // 重置卡牌状态
    if (sceneRef.current) {
      const { cards, centerCard } = sceneRef.current;
      centerCard.visible = true;
      sceneRef.current.selectedCardIndex = -1;
      sceneRef.current.cardsRotation = 0;
      cards.forEach(card => {
        card.userData.selected = false;
        card.userData.glowing = false;
        card.scale.set(1, 1, 1);
        setCardOpacity(card, 0);
      });
    }
  }, []);

  // Three.js Scene Setup
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000011, 0.015); // Add atmospheric fog for depth

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, -3, 0); // Start from below the magic circle
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    // Add OrbitControls for better 3D navigation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.8; // Prevent going below ground
    controls.target.set(0, 0, 0);
    controls.enabled = false; // Disable during initial animation

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.4;
    bloomPass.strength = 0.6;
    bloomPass.radius = 0.3;
    composer.addPass(bloomPass);

    // Lights - Enhanced for better 3D depth
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    
    // Main point light from above
    const pointLight = new THREE.PointLight(0xffdd44, 3, 30);
    pointLight.position.set(0, 8, 0);
    pointLight.castShadow = true;
    scene.add(pointLight);
    
    // Secondary lights for depth
    const sideLight1 = new THREE.PointLight(0x4488ff, 1, 20);
    sideLight1.position.set(8, 4, 8);
    scene.add(sideLight1);
    
    const sideLight2 = new THREE.PointLight(0xff4488, 1, 20);
    sideLight2.position.set(-8, 4, -8);
    scene.add(sideLight2);

    // Magic Circle Group
    const magicCircleGroup = new THREE.Group();
    magicCircleGroup.position.y = -2;
    magicCircleGroup.rotation.x = 0; // Keep flat on ground
    magicCircleGroup.scale.set(1.2, 1.2, 1.2); // Slightly larger for better visibility
    scene.add(magicCircleGroup);

    const lineMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFF99,
      emissive: 0x444433,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2
    });

    // Outer Ring
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.04, 16, 100), lineMaterial);
    outerRing.rotation.x = -Math.PI / 2;
    magicCircleGroup.add(outerRing);

    // Inner Ring
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.03, 16, 100), lineMaterial.clone());
    innerRing.rotation.x = -Math.PI / 2;
    magicCircleGroup.add(innerRing);

    // Hexagram
    const starGroup = new THREE.Group();
    const hexagramRadius = 2.2;
    const starLineMaterial = new THREE.LineBasicMaterial({ color: 0xFFFF99 });

    // Triangle 1 - up
    const tri1Points: THREE.Vector3[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      tri1Points.push(new THREE.Vector3(Math.cos(angle) * hexagramRadius, 0, Math.sin(angle) * hexagramRadius));
    }
    starGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(tri1Points), starLineMaterial));

    // Triangle 2 - down
    const tri2Points: THREE.Vector3[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3 + Math.PI / 2;
      tri2Points.push(new THREE.Vector3(Math.cos(angle) * hexagramRadius, 0, Math.sin(angle) * hexagramRadius));
    }
    starGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(tri2Points), starLineMaterial));

    // Inner circle
    const innerCircle = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xFFFF99, side: THREE.DoubleSide })
    );
    innerCircle.rotation.x = -Math.PI / 2;
    innerCircle.position.y = 0.02;
    starGroup.add(innerCircle);
    magicCircleGroup.add(starGroup);

    // Center Disc - Enhanced with better material
    const centerDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xFFFF99,
        emissive: 0x444433,
        emissiveIntensity: 0.5,
        metalness: 0.6,
        roughness: 0.3
      })
    );
    centerDisc.position.y = 0.04;
    magicCircleGroup.add(centerDisc);

    // Rune Characters
    const runeChars = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#b20852ff';
      ctx.font = 'bold 48px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(runeChars[i % runeChars.length], 32, 32);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
      sprite.position.set(Math.cos(angle) * 2.6, 0.1, Math.sin(angle) * 2.6);
      sprite.scale.set(0.3, 0.3, 0.3);
      magicCircleGroup.add(sprite);
    }

    // Cards Group
    const cardsGroup = new THREE.Group();
    cardsGroup.position.y = -1.5; // Adjust to match new magic circle position
    scene.add(cardsGroup);
    const cards: THREE.Mesh[] = [];

    // Create card texture loader
    const textureLoader = new THREE.TextureLoader();
    const backTexture = textureLoader.load('/back.png');

    // 加载塔罗牌正面图片列表
    const tarotCardFiles = [
      '00_愚者_The_Fool.jpg', '01_魔术师_The_Magician.jpg', '02_女祭司_The_High_Priestess.jpg',
      '03_皇后_The_Empress.jpg', '04_皇帝_The_Emperor.jpg', '05_教皇_The_Hierophant.jpg',
      '06_恋人_The_Lovers.jpg', '07_战车_The_Chariot.jpg', '08_力量_Strength.jpg',
      '09_隐士_The_Hermit.jpg', '10_命运之轮_Wheel_of_Fortune.jpg', '11_正义_Justice.jpg'
    ];

    // Center Floating Card (replacing beam)
    const centerCardGeometry = new THREE.PlaneGeometry(1, 1.6);
    const centerCardMaterial = new THREE.MeshBasicMaterial({
      map: backTexture, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.9
    });
    const centerCard = new THREE.Mesh(centerCardGeometry, centerCardMaterial);
    centerCard.position.y = 2; // Floating above the magic circle
    centerCard.rotation.x = Math.PI * 0.1; // Slight tilt for 3D effect
    magicCircleGroup.add(centerCard);

    // Create 6 cards with front and back (like reference)
    const CARD_WIDTH = 2.0;
    const CARD_HEIGHT = 2.0 * 1.6;
    
    for (let i = 0; i < 6; i++) {
      const cardGroup = new THREE.Group();
      
      // 卡牌背面
      const backGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
      const backMaterial = new THREE.MeshStandardMaterial({
        map: backTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
      });
      const backMesh = new THREE.Mesh(backGeometry, backMaterial);
      backMesh.position.z = 0.01;
      cardGroup.add(backMesh);
      
      // 卡牌正面（随机选择）
      const frontGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
      const randomIndex = Math.floor(Math.random() * tarotCardFiles.length);
      const frontTexture = textureLoader.load(`/tarot_cards/${tarotCardFiles[randomIndex]}`);
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: frontTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
      });
      const frontMesh = new THREE.Mesh(frontGeometry, frontMaterial);
      frontMesh.rotation.y = Math.PI; // 翻转正面
      frontMesh.position.z = -0.01;
      cardGroup.add(frontMesh);
      
      // 卡牌边框（用于悬停效果）
      const edgesGeometry = new THREE.EdgesGeometry(backGeometry);
      const edgesMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true,
        opacity: 0
      });
      const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
      cardGroup.add(edges);
      
      // 发光点光源
      const glowLight = new THREE.PointLight(0x00ffff, 0, 3);
      glowLight.position.set(0, 0, 0.5);
      cardGroup.add(glowLight);
      
      cardGroup.userData = { 
        index: i, 
        selected: false, 
        glowing: false,
        backMesh,
        frontMesh,
        edges,
        glowLight,
        imageFileName: tarotCardFiles[randomIndex]
      };
      
      // 为了兼容现有代码，给cardGroup添加material属性的代理
      Object.defineProperty(cardGroup, 'material', {
        get: () => backMaterial
      });
      
      cards.push(cardGroup as any);
      cardsGroup.add(cardGroup);
    }

    // Sakura Petals using InstancedMesh (like reference)
    const sakuraCount = 1000;
    
    // Create petal texture
    const petalCanvas = document.createElement('canvas');
    petalCanvas.width = 64;
    petalCanvas.height = 64;
    const petalCtx = petalCanvas.getContext('2d')!;
    petalCtx.beginPath();
    petalCtx.moveTo(32, 60);
    petalCtx.bezierCurveTo(10, 40, 0, 20, 32, 0);
    petalCtx.bezierCurveTo(64, 20, 54, 40, 32, 60);
    // Gradient fill for more realistic petal
    const gradient = petalCtx.createRadialGradient(32, 30, 0, 32, 30, 30);
    gradient.addColorStop(0, '#ffddee');
    gradient.addColorStop(0.5, '#ffb8d0');
    gradient.addColorStop(1, '#ff99bb');
    petalCtx.fillStyle = gradient;
    petalCtx.fill();
    const petalTexture = new THREE.CanvasTexture(petalCanvas);

    const petalGeometry = new THREE.PlaneGeometry(0.25, 0.25);
    const petalMaterial = new THREE.MeshBasicMaterial({
      map: petalTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.9
    });
    const sakuraMesh = new THREE.InstancedMesh(petalGeometry, petalMaterial, sakuraCount);
    
    const dummy = new THREE.Object3D();
    const sakuraData: { velocity: number; rotSpeedX: number; rotSpeedZ: number; x: number; y: number; z: number; rotX: number; rotZ: number }[] = [];

    for (let i = 0; i < sakuraCount; i++) {
      const x = (Math.random() - 0.5) * 25;
      const y = Math.random() * 18;
      const z = (Math.random() - 0.5) * 25;
      const rotX = Math.random() * Math.PI;
      const rotZ = Math.random() * Math.PI;
      const scale = Math.random() * 0.5 + 0.5;
      
      dummy.position.set(x, y, z);
      dummy.rotation.set(rotX, 0, rotZ);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      sakuraMesh.setMatrixAt(i, dummy.matrix);
      
      sakuraData.push({
        velocity: Math.random() * 0.03 + 0.015,
        rotSpeedX: (Math.random() - 0.5) * 0.02,
        rotSpeedZ: (Math.random() - 0.5) * 0.02,
        x, y, z, rotX, rotZ
      });
    }
    scene.add(sakuraMesh);

    // Text Sprite
    const createTextSprite = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.shadowColor = '#e44114ff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ec5f23ff';
      ctx.font = 'bold 100px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
      sprite.scale.set(6, 1.5, 1);
      return sprite;
    };
    const textSprite = createTextSprite(displayText);
    textSprite.position.set(0, 4, -2); // Adjusted for new camera angle
    scene.add(textSprite);

    // Store refs
    sceneRef.current = {
      scene, camera, renderer, composer, controls, magicCircleGroup, cardsGroup, cards,
      centerCard, textSprite, selectedCardIndex: -1, cardsRotation: 0, bloomPass,
      cameraAnimating: true, cameraStartTime: Date.now(), cameraPhase: 'flip'
    };

    // Animation
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;
      if (!sceneRef.current) return;

      const { magicCircleGroup, cardsGroup, cards, centerCard, textSprite, controls, camera } = sceneRef.current;

      // Two-phase camera animation: flip then zoom
      if (sceneRef.current.cameraAnimating) {
        const elapsed = Date.now() - sceneRef.current.cameraStartTime;
        
        if (sceneRef.current.cameraPhase === 'flip') {
          // Phase 1: Smooth arc from bottom to overhead view (3 seconds)
          const flipDuration = 3000;
          const progress = Math.min(elapsed / flipDuration, 1);
          const easeInOut = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2; // Smooth ease-in-out
          
          // Create a smooth arc trajectory
          const startAngle = -Math.PI / 2; // Bottom (-90 degrees)
          const endAngle = Math.PI / 6; // Slight overhead angle (30 degrees)
          const currentAngle = startAngle + (endAngle - startAngle) * easeInOut;
          
          const radius = 15; // Distance from center
          
          camera.position.x = 0;
          camera.position.y = Math.sin(currentAngle) * radius;
          camera.position.z = Math.cos(currentAngle) * radius;
          camera.lookAt(0, 0, 0);
          
          if (progress >= 1) {
            sceneRef.current.cameraPhase = 'zoom';
            sceneRef.current.cameraStartTime = Date.now(); // Reset timer for zoom phase
          }
        } else if (sceneRef.current.cameraPhase === 'zoom') {
          // Phase 2: Zoom in to final position (2 seconds)
          const zoomDuration = 2000;
          const progress = Math.min(elapsed / zoomDuration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          
          // From current position to final close position
          const startPos = { 
            x: 0, 
            y: Math.sin(Math.PI / 6) * 15, // Current position from flip phase
            z: Math.cos(Math.PI / 6) * 15 
          };
          const endPos = { x: 0, y: 6, z: 8 };
          
          camera.position.x = startPos.x + (endPos.x - startPos.x) * easeOut;
          camera.position.y = startPos.y + (endPos.y - startPos.y) * easeOut;
          camera.position.z = startPos.z + (endPos.z - startPos.z) * easeOut;
          camera.lookAt(0, 0, 0);
          
          if (progress >= 1) {
            sceneRef.current.cameraAnimating = false;
            controls.enabled = true; // Enable controls after animation
          }
        }
      } else {
        // Update controls only after animation is done
        controls.update();
      }

      // Rotate magic circle
      magicCircleGroup.rotation.y += 0.005;
      starGroup.rotation.y -= 0.008; // 顺时针缓慢转动

      // Text floating
      textSprite.position.y = 4 + Math.sin(time) * 0.15; // Adjusted for new position

      // Center card floating and rotating
      if (centerCard.visible) {
        centerCard.position.y = 2 + Math.sin(time * 2) * 0.2; // Floating motion
        centerCard.rotation.y += 0.01; // Slow rotation
        centerCard.rotation.z = Math.sin(time * 1.5) * 0.1; // Gentle wobble
      }

      // Sakura petal animation using InstancedMesh
      for (let i = 0; i < sakuraCount; i++) {
        const data = sakuraData[i];
        
        // Update position
        data.y -= data.velocity;
        data.x += Math.sin(time + i * 0.1) * 0.008; // Wind sway
        data.z += Math.cos(time * 0.7 + i * 0.1) * 0.008;
        
        // Update rotation (tumbling effect)
        data.rotX += data.rotSpeedX;
        data.rotZ += data.rotSpeedZ;
        
        // Reset if below ground
        if (data.y < -3) {
          data.y = 18;
          data.x = (Math.random() - 0.5) * 25;
          data.z = (Math.random() - 0.5) * 25;
        }
        
        dummy.position.set(data.x, data.y, data.z);
        dummy.rotation.set(data.rotX, 0, data.rotZ);
        dummy.updateMatrix();
        sakuraMesh.setMatrixAt(i, dummy.matrix);
      }
      sakuraMesh.instanceMatrix.needsUpdate = true;

      // Update cards position based on rotation - 面向摄像机
      const cardRadius = 4.0;
      cards.forEach((card, i) => {
        if (!card.userData.selected) {
          const angle = sceneRef.current!.cardsRotation + (i / 6) * Math.PI * 2;
          card.position.x = Math.sin(angle) * cardRadius;
          card.position.z = Math.cos(angle) * cardRadius;
          card.position.y = 1.5; // 高度提高
          // 让卡牌面向摄像机方向，而不是面向中心
          card.rotation.y = 0; // 面向Z轴正方向（摄像机方向）
          card.rotation.x = -0.2; // 稍微向后倾斜
          card.rotation.z = 0;
        }
      });

      composer.render();
    };
    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [displayText]);

  // 当startAnimation变为true时，重置动画开始时间
  useEffect(() => {
    if (startAnimation && sceneRef.current) {
      sceneRef.current.cameraAnimating = true;
      sceneRef.current.cameraStartTime = Date.now();
      sceneRef.current.cameraPhase = 'flip';
    }
  }, [startAnimation]);

  // Handle game phase changes
  useEffect(() => {
    if (!sceneRef.current) return;
    const { cards, centerCard } = sceneRef.current;

    if (gamePhase === 'initial') {
      // Hide cards, show center card
      centerCard.visible = true;
      cards.forEach(card => {
        setCardOpacity(card, 0);
        card.userData.selected = false;
      });
    } else if (gamePhase === 'cards-spread') {
      // Hide center card, show cards
      centerCard.visible = false;
      cards.forEach((card, i) => {
        setTimeout(() => {
          setCardOpacity(card, 1);
        }, i * 100);
      });
    } else if (gamePhase === 'selecting') {
      // Nothing special needed
    }
  }, [gamePhase]);

  // Handle gesture changes
  useEffect(() => {
    const { gesture, palmX } = handState;
    const prevGesture = prevGestureRef.current;
    
    if (!handState.isDetected || !sceneRef.current) return;

    // Open hand: spread cards or rotate
    if (gesture === 'open') {
      if (gamePhase === 'initial') {
        setGamePhase('cards-spread');
        setTimeout(() => setGamePhase('selecting'), 1000);
      } else if (gamePhase === 'selecting') {
        // Rotate cards based on hand movement
        const deltaX = palmX - lastPalmXRef.current;
        sceneRef.current.cardsRotation += deltaX * 3;
      }
    }

    // Point or Pinch gesture: check card hover
    if ((gesture === 'point' || gesture === 'pinch') && gamePhase === 'selecting') {
      const { cards, camera } = sceneRef.current;
      
      // 使用屏幕坐标检测卡牌悬停
      let hoveredIndex = -1;
      let minDistance = Infinity;
      
      cards.forEach((card, i) => {
        if (card.userData.selected) return;
        
        // 将卡牌位置投影到屏幕坐标
        const cardScreenPos = card.position.clone().project(camera);
        const cardScreenX = (cardScreenPos.x + 1) / 2 * window.innerWidth;
        const cardScreenY = (1 - cardScreenPos.y) / 2 * window.innerHeight;
        
        // 计算光标与卡牌的屏幕距离
        const dx = fingerTipPositionRef.current.x - cardScreenX;
        const dy = fingerTipPositionRef.current.y - cardScreenY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 检测范围200像素内，选择最近的卡牌
        if (distance < 200 && distance < minDistance) {
          minDistance = distance;
          hoveredIndex = i;
        }
      });

      // Update card hover effects
      cards.forEach((card, i) => {
        if (card.userData.selected) return;
        
        if (i === hoveredIndex) {
          // 悬停特效：边框发光 + 点光源
          if (card.userData.edges) {
            (card.userData.edges.material as THREE.LineBasicMaterial).opacity = 1;
          }
          if (card.userData.glowLight) {
            card.userData.glowLight.intensity = 2;
          }
          card.userData.glowing = true;
          sceneRef.current!.selectedCardIndex = i;
        } else {
          // 取消悬停特效
          if (card.userData.edges) {
            (card.userData.edges.material as THREE.LineBasicMaterial).opacity = 0;
          }
          if (card.userData.glowLight) {
            card.userData.glowLight.intensity = 0;
          }
          card.userData.glowing = false;
        }
      });
    } else if (gamePhase === 'selecting' && sceneRef.current) {
      // 没有point/pinch手势时，取消所有悬停特效
      sceneRef.current.cards.forEach(card => {
        if (card.userData.edges) {
          (card.userData.edges.material as THREE.LineBasicMaterial).opacity = 0;
        }
        if (card.userData.glowLight) {
          card.userData.glowLight.intensity = 0;
        }
        card.userData.glowing = false;
      });
    }

    // Pinch gesture: select card
    if (gesture === 'pinch' && prevGesture === 'point' && gamePhase === 'selecting') {
      const { selectedCardIndex, cards } = sceneRef.current;
      if (selectedCardIndex >= 0 && !cards[selectedCardIndex].userData.selected) {
        selectCard(selectedCardIndex);
      }
    }

    // Open gesture during card-reveal: dismiss card with sakura burst
    // 只要在card-reveal阶段张开手掌就触发，不管之前是什么手势
    if (gesture === 'open' && gamePhase === 'card-reveal') {
      dismissRevealedCard();
    }

    prevGestureRef.current = gesture;
    lastPalmXRef.current = palmX;
  }, [handState, gamePhase]);

  // Select a card - 捏合时翻开卡牌并移动到光芒阵中央
  const selectCard = (index: number) => {
    if (!sceneRef.current) return;
    const card = sceneRef.current.cards[index];
    
    card.userData.selected = true;
    card.userData.originalIndex = index; // 保存原始索引用于后续补卡

    // Get random tarot card data
    const cardKeys = Object.keys(tarotData);
    const randomKey = cardKeys[Math.floor(Math.random() * cardKeys.length)];
    const cardData = tarotData[randomKey];
    
    const tarotCard: TarotCard = {
      id: randomKey,
      name: cardData?.name || 'Unknown',
      keywords: cardData?.keywords || [],
      meaning: cardData?.upright?.meaning || '',
      love: cardData?.upright?.love || '',
      career: cardData?.upright?.career || '',
      advice: cardData?.upright?.advice || '',
    };

    setCurrentRevealCard(tarotCard);
    setGamePhase('card-reveal');

    // 第一阶段：移动到中央
    const animateToCenter = () => {
      let progress = 0;
      const startPos = card.position.clone();
      const startRot = card.rotation.clone();
      // 目标位置：光芒阵中央上方，面向摄像机
      const targetPos = new THREE.Vector3(0, 1.5, 2);
      const targetRot = new THREE.Euler(-0.3, 0, 0);

      const animate = () => {
        progress += 0.025;
        if (progress >= 1) {
          card.position.copy(targetPos);
          card.rotation.set(targetRot.x, targetRot.y, targetRot.z);
          // 移动完成后开始翻转
          flipCard();
          return;
        }
        // 使用缓动函数
        const t = 1 - Math.pow(1 - progress, 3);
        card.position.lerpVectors(startPos, targetPos, t);
        card.rotation.x = startRot.x + (targetRot.x - startRot.x) * t;
        card.rotation.y = startRot.y + (targetRot.y - startRot.y) * t;
        card.rotation.z = startRot.z + (targetRot.z - startRot.z) * t;
        requestAnimationFrame(animate);
      };
      animate();
    };

    // 第二阶段：翻转卡牌（绕Y轴旋转180度）
    const flipCard = () => {
      let progress = 0;
      const startRotY = card.rotation.y;
      const targetRotY = startRotY + Math.PI; // 翻转180度
      const flipDuration = 600; // 翻转时长600ms
      const startTime = Date.now();

      const animateFlip = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / flipDuration, 1);
        
        // 使用缓动函数
        const t = 1 - Math.pow(1 - progress, 3);
        card.rotation.y = startRotY + (targetRotY - startRotY) * t;

        if (progress < 1) {
          requestAnimationFrame(animateFlip);
        }
        // 翻转完成
      };
      animateFlip();
    };

    animateToCenter();
  };

  // Dismiss revealed card with sakura burst effect - 捏合变张开时触发
  const dismissRevealedCard = () => {
    if (!sceneRef.current || !currentRevealCard) return;

    // Add to selected cards
    setSelectedCards(prev => [...prev, currentRevealCard]);

    // Find the selected card - 使用 selected 标记而不是 scale 大小
    const selectedCard = sceneRef.current.cards.find(c => c.userData.selected);
    
    if (!selectedCard) {
      setCurrentRevealCard(null);
      setGamePhase('selecting');
      return;
    }
    
    const selectedIndex = selectedCard.userData.originalIndex ?? sceneRef.current.cards.indexOf(selectedCard);
    const cardPosition = selectedCard.position.clone();
    
    // Create sakura burst effect at card position
    createSakuraBurst(cardPosition);
    
    // Hide the card immediately
    setCardOpacity(selectedCard, 0);
    
    // Reset card position to its slot position but high above
    const angle = sceneRef.current.cardsRotation + (selectedIndex / 6) * Math.PI * 2;
    const cardRadius = 4.0;
    selectedCard.position.x = Math.sin(angle) * cardRadius;
    selectedCard.position.z = Math.cos(angle) * cardRadius;
    selectedCard.position.y = 8; // Start from above for drop animation
    selectedCard.rotation.set(-0.2, 0, 0);

    setCurrentRevealCard(null);

    // Check if 3 cards selected
    if (selectedCards.length + 1 >= 3) {
      setTimeout(() => setGamePhase('result'), 500);
    } else {
      // Drop new card from above after a short delay
      const cardToAnimate = selectedCard;
      setTimeout(() => {
        if (!sceneRef.current) return;
        
        cardToAnimate.userData.selected = false;
        cardToAnimate.userData.originalIndex = undefined;
        setCardOpacity(cardToAnimate, 1);
        
        // Animate card dropping with easing
        let dropProgress = 0;
        const startY = cardToAnimate.position.y;
        const targetY = 1.5; // 与其他卡牌相同高度
        
        const dropCard = () => {
          dropProgress += 0.03;
          if (dropProgress >= 1) {
            cardToAnimate.position.y = targetY;
            return;
          }
          // Ease out effect
          const t = 1 - Math.pow(1 - dropProgress, 3);
          cardToAnimate.position.y = startY + (targetY - startY) * t;
          requestAnimationFrame(dropCard);
        };
        dropCard();
      }, 400);
      
      setGamePhase('selecting');
    }
  };
  
  // Create sakura burst effect at position
  const createSakuraBurst = (position: THREE.Vector3) => {
    if (!sceneRef.current) return;
    const { scene } = sceneRef.current;
    
    const burstCount = 50;
    const burstPetals: THREE.Mesh[] = [];
    
    // Create petal texture
    const petalCanvas = document.createElement('canvas');
    petalCanvas.width = 64;
    petalCanvas.height = 64;
    const petalCtx = petalCanvas.getContext('2d')!;
    petalCtx.beginPath();
    petalCtx.moveTo(32, 60);
    petalCtx.bezierCurveTo(10, 40, 0, 20, 32, 0);
    petalCtx.bezierCurveTo(64, 20, 54, 40, 32, 60);
    const gradient = petalCtx.createRadialGradient(32, 30, 0, 32, 30, 30);
    gradient.addColorStop(0, '#ffddee');
    gradient.addColorStop(0.5, '#ffb8d0');
    gradient.addColorStop(1, '#ff99bb');
    petalCtx.fillStyle = gradient;
    petalCtx.fill();
    const petalTexture = new THREE.CanvasTexture(petalCanvas);
    
    // Create burst petals
    for (let i = 0; i < burstCount; i++) {
      const petalGeometry = new THREE.PlaneGeometry(0.3, 0.3);
      const petalMaterial = new THREE.MeshBasicMaterial({
        map: petalTexture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: 1
      });
      
      const petal = new THREE.Mesh(petalGeometry, petalMaterial);
      petal.position.copy(position);
      
      // Random velocity for burst effect
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.1 + Math.random() * 0.15;
      
      petal.userData.velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.5 + 0.05,
        Math.sin(phi) * Math.sin(theta) * speed
      );
      petal.userData.rotSpeed = {
        x: (Math.random() - 0.5) * 0.2,
        z: (Math.random() - 0.5) * 0.2
      };
      petal.userData.life = 1.0;
      
      scene.add(petal);
      burstPetals.push(petal);
    }
    
    // Animate burst petals
    const animateBurst = () => {
      let allDead = true;
      
      burstPetals.forEach(petal => {
        if (petal.userData.life <= 0) return;
        allDead = false;
        
        // Update position
        petal.position.add(petal.userData.velocity);
        petal.userData.velocity.y -= 0.003; // Gravity
        
        // Update rotation
        petal.rotation.x += petal.userData.rotSpeed.x;
        petal.rotation.z += petal.userData.rotSpeed.z;
        
        // Fade out
        petal.userData.life -= 0.015;
        (petal.material as THREE.MeshBasicMaterial).opacity = Math.max(0, petal.userData.life);
        
        if (petal.userData.life <= 0) {
          scene.remove(petal);
          petal.geometry.dispose();
          (petal.material as THREE.MeshBasicMaterial).dispose();
        }
      });
      
      if (!allDead) {
        requestAnimationFrame(animateBurst);
      }
    };
    
    animateBurst();
  };

  // 使用从loading阶段传递过来的MediaPipe实例
  useEffect(() => {
    let animationId: number;
    let mounted = true;

    const setupHandTracking = () => {
      const handLandmarker = (window as any).__handLandmarker;
      const videoElement = (window as any).__videoElement as HTMLVideoElement | undefined;
      
      if (!handLandmarker || !videoElement) {
        setTimeout(setupHandTracking, 500);
        return;
      }
      
      handLandmarkerRef.current = handLandmarker;
      setHandTrackingReady(true);

      const detectHands = () => {
        if (!mounted) return;
        
        if (videoElement && videoElement.readyState >= 2 && handLandmarkerRef.current) {
          try {
            const results = handLandmarkerRef.current.detectForVideo(videoElement, performance.now());
            
            if (results.landmarks && results.landmarks.length > 0) {
              const landmarks = results.landmarks[0];
              
              const thumbTip = landmarks[4];
              const indexTip = landmarks[8];
              const middleTip = landmarks[12];
              const ringTip = landmarks[16];
              const pinkyTip = landmarks[20];
              const indexMcp = landmarks[5];

              const indexExtended = indexTip.y < indexMcp.y - 0.05;
              const middleExtended = middleTip.y < landmarks[9].y - 0.05;
              const ringExtended = ringTip.y < landmarks[13].y - 0.05;
              const pinkyExtended = pinkyTip.y < landmarks[17].y - 0.05;

              const pinchDist = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
              );
              const isPinch = pinchDist < 0.06;

              let gesture: 'none' | 'open' | 'point' | 'pinch' = 'none';
              if (isPinch) {
                gesture = 'pinch';
              } else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
                gesture = 'point';
              } else if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
                gesture = 'open';
              }

              // 捏合时锁定光标位置，不更新
              if (gesture !== 'pinch') {
                // 直接更新光标位置（绕过React state以获得更好的响应速度）
                const rawX = (1 - indexTip.x) * window.innerWidth;
                const rawY = indexTip.y * window.innerHeight;
                
                // 使用EMA平滑减少抖动，系数0.35平衡响应速度和稳定性
                const smoothFactor = 0.35;
                if (smoothedFingerPositionRef.current.x === 0 && smoothedFingerPositionRef.current.y === 0) {
                  smoothedFingerPositionRef.current.x = rawX;
                  smoothedFingerPositionRef.current.y = rawY;
                } else {
                  smoothedFingerPositionRef.current.x += (rawX - smoothedFingerPositionRef.current.x) * smoothFactor;
                  smoothedFingerPositionRef.current.y += (rawY - smoothedFingerPositionRef.current.y) * smoothFactor;
                }
              }
              
              // 直接更新光标DOM
              const cursor = document.getElementById('gesture-cursor');
              if (cursor) {
                if (gesture === 'open') {
                  cursor.style.display = 'none';
                } else {
                  cursor.style.display = 'block';
                  cursor.style.transform = `translate(${smoothedFingerPositionRef.current.x}px, ${smoothedFingerPositionRef.current.y}px) translate(-50%, -50%)`;
                }
              }
              
              fingerTipPositionRef.current.x = smoothedFingerPositionRef.current.x;
              fingerTipPositionRef.current.y = smoothedFingerPositionRef.current.y;

              // 更新React state用于其他逻辑
              setHandState({
                isDetected: true,
                gesture,
                position: { 
                  x: indexTip.x, 
                  y: indexTip.y 
                },
                palmX: (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3,
              });
            } else {
              // 没检测到手，隐藏光标
              const cursor = document.getElementById('gesture-cursor');
              if (cursor) {
                cursor.style.display = 'none';
              }
              setHandState(prev => ({ ...prev, isDetected: false, gesture: 'none' }));
              // 重置平滑状态
              smoothedFingerPositionRef.current = { x: 0, y: 0 };
            }
          } catch (e) {
            // 忽略检测错误
          }
        }
        animationId = requestAnimationFrame(detectHands);
      };
      detectHands();
    };

    setTimeout(setupHandTracking, 100);

    return () => {
      mounted = false;
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* 屏幕光标 */}
      <div
        id="gesture-cursor"
        className="fixed pointer-events-none z-[1000]"
        style={{
          display: 'none',
          left: 0,
          top: 0,
          width: '30px',
          height: '30px',
          border: '2px solid rgba(0, 255, 255, 1)',
          borderRadius: '50%',
          boxShadow: '0 0 5px rgba(0, 255, 255, 0.8), 0 0 10px rgba(0, 255, 255, 0.6), 0 0 15px rgba(0, 255, 255, 0.4), inset 0 0 5px rgba(0, 255, 255, 0.3)',
          willChange: 'transform',
        }}
      >
        <div 
          className="absolute top-1/2 left-1/2 w-1 h-1 bg-cyan-400 rounded-full"
          style={{ transform: 'translate(-50%, -50%)', boxShadow: '0 0 4px rgba(0, 255, 255, 1)' }}
        />
      </div>

      {/* Result screen overlay */}
      {gamePhase === 'result' && (
        <div className="absolute inset-0 z-50 bg-gradient-to-b from-black/95 via-purple-950/95 to-black/95 text-white p-8 overflow-auto">
          <button
            onClick={resetGame}
            className="absolute top-4 left-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-full text-black font-semibold"
          >
            ← 返回
          </button>
          
          <h1 className="text-3xl font-bold text-center text-yellow-400 mt-12 mb-8">
            🔮 塔罗牌解读报告
          </h1>

          <div className="flex flex-wrap justify-center gap-6 mb-8">
            {selectedCards.map((card, i) => (
              <div key={i} className="bg-black/50 rounded-xl p-4 border border-yellow-500/30 w-72">
                <div className="text-center mb-4">
                  <span className="text-yellow-400 text-lg font-bold">{card.name}</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  {card.keywords.map((kw, j) => (
                    <span key={j} className="px-2 py-1 bg-yellow-600/30 rounded text-xs">{kw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {selectedCards.map((card, i) => (
              <div key={i} className="bg-black/40 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-xl font-bold text-yellow-400 mb-3">第 {i + 1} 张: {card.name}</h3>
                <p className="text-gray-300 mb-4">{card.meaning}</p>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-pink-900/30 p-3 rounded">
                    <span className="text-pink-400 font-bold">💕 爱情</span>
                    <p className="text-gray-300 mt-1">{card.love}</p>
                  </div>
                  <div className="bg-blue-900/30 p-3 rounded">
                    <span className="text-blue-400 font-bold">💼 事业</span>
                    <p className="text-gray-300 mt-1">{card.career}</p>
                  </div>
                  <div className="bg-green-900/30 p-3 rounded">
                    <span className="text-green-400 font-bold">💡 建议</span>
                    <p className="text-gray-300 mt-1">{card.advice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status indicators */}
      {handTrackingReady && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${handState.isDetected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-white text-sm">
            {handState.isDetected ? `手势: ${handState.gesture}` : '未检测到手'}
          </span>
        </div>
      )}
      {!handTrackingReady && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-white text-sm">正在加载手势追踪...</span>
        </div>
      )}

      {/* Instructions */}
      {/* <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center text-yellow-400/80 text-sm">
        {gamePhase === 'initial' && handTrackingReady && '张开五指展开卡牌'}
        {gamePhase === 'selecting' && '五指张开旋转 | 食指指向选牌 | 捏合确认'}
        {gamePhase === 'card-reveal' && '张开手掌继续抽牌'}
      </div> */}

      {/* Progress */}
      {/* <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-yellow-400">
        已选择: {selectedCards.length} / 3
      </div> */}
    </div>
  );
}
