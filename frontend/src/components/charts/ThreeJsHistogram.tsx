import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface DataPoint {
  name: string;
  encaissements: number;
  decaissements: number;
}

interface ThreeJsHistogramProps {
  data: DataPoint[];
  formatValue: (value: number) => string;
}

export default function ThreeJsHistogram({ data, formatValue }: ThreeJsHistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafafa);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / 300, 0.1, 1000);
    camera.position.set(8, 6, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, 300);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xf0f0f0, 
      roughness: 0.8,
      metalness: 0.2 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create bars
    const maxValue = Math.max(...data.flatMap(d => [d.encaissements, d.decaissements]));
    const barWidth = 0.6;
    const barSpacing = 2.5;
    const startX = -(data.length * barSpacing) / 2;

    data.forEach((point, index) => {
      const xPos = startX + index * barSpacing;

      // Encaissements bar (Orange gradient)
      const encHeight = (point.encaissements / maxValue) * 5;
      const encGeometry = new THREE.BoxGeometry(barWidth, encHeight, barWidth);
      
      const encCanvas = document.createElement('canvas');
      encCanvas.width = 256;
      encCanvas.height = 256;
      const encCtx = encCanvas.getContext('2d')!;
      const encGradient = encCtx.createLinearGradient(0, 0, 0, 256);
      encGradient.addColorStop(0, '#ff9a56');
      encGradient.addColorStop(1, '#ff6b35');
      encCtx.fillStyle = encGradient;
      encCtx.fillRect(0, 0, 256, 256);
      
      const encTexture = new THREE.CanvasTexture(encCanvas);
      const encMaterial = new THREE.MeshStandardMaterial({ 
        map: encTexture,
        roughness: 0.3,
        metalness: 0.4,
        emissive: new THREE.Color(0xff6b35),
        emissiveIntensity: 0.2
      });
      
      const encBar = new THREE.Mesh(encGeometry, encMaterial);
      encBar.position.set(xPos - barWidth / 2 - 0.1, encHeight / 2, 0);
      encBar.castShadow = true;
      encBar.userData = { value: point.encaissements, label: point.name, type: 'Encaissements' };
      scene.add(encBar);

      // Decaissements bar (Blue gradient)
      const decHeight = (point.decaissements / maxValue) * 5;
      const decGeometry = new THREE.BoxGeometry(barWidth, decHeight, barWidth);
      
      const decCanvas = document.createElement('canvas');
      decCanvas.width = 256;
      decCanvas.height = 256;
      const decCtx = decCanvas.getContext('2d')!;
      const decGradient = decCtx.createLinearGradient(0, 0, 0, 256);
      decGradient.addColorStop(0, '#60a5fa');
      decGradient.addColorStop(1, '#3b82f6');
      decCtx.fillStyle = decGradient;
      decCtx.fillRect(0, 0, 256, 256);
      
      const decTexture = new THREE.CanvasTexture(decCanvas);
      const decMaterial = new THREE.MeshStandardMaterial({ 
        map: decTexture,
        roughness: 0.3,
        metalness: 0.4,
        emissive: new THREE.Color(0x3b82f6),
        emissiveIntensity: 0.2
      });
      
      const decBar = new THREE.Mesh(decGeometry, decMaterial);
      decBar.position.set(xPos + barWidth / 2 + 0.1, decHeight / 2, 0);
      decBar.castShadow = true;
      decBar.userData = { value: point.decaissements, label: point.name, type: 'Décaissements' };
      scene.add(decBar);

      // Animate bars
      encBar.scale.y = 0;
      decBar.scale.y = 0;
      
      const delay = index * 150;
      setTimeout(() => {
        animateBar(encBar, 1);
        animateBar(decBar, 1);
      }, delay);
    });

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.padding = '8px 12px';
    tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.borderRadius = '6px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    tooltip.style.zIndex = '1000';
    containerRef.current.appendChild(tooltip);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj.userData.value));

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.clientX - rect.left + 10}px`;
        tooltip.style.top = `${event.clientY - rect.top - 10}px`;
        tooltip.innerHTML = `<strong>${obj.userData.label}</strong><br/>${obj.userData.type}: ${formatValue(obj.userData.value)}`;
      } else {
        tooltip.style.display = 'none';
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / 300;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, 300);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      containerRef.current?.removeChild(renderer.domElement);
      containerRef.current?.removeChild(tooltip);
      renderer.dispose();
    };
  }, [data, formatValue]);

  const animateBar = (bar: THREE.Mesh, targetScale: number) => {
    const duration = 800;
    const startScale = bar.scale.y;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      bar.scale.y = startScale + (targetScale - startScale) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  };

  return <div ref={containerRef} style={{ width: '100%', height: '300px', position: 'relative' }} />;
}
