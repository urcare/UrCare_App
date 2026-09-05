import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../context/ThemeContext';

export const ThreeBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 28;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Group for Metabolic Energy Rings & Cellular Waves
    const waveGroup = new THREE.Group();
    scene.add(waveGroup);

    // Build Floating Metabolic Bio-Rings
    const numRings = 16;
    const ringGeom = new THREE.TorusGeometry(5, 0.08, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x059669,
      transparent: true,
      opacity: 0.28,
    });

    const sphereGeom = new THREE.SphereGeometry(0.35, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.45,
    });

    for (let i = 0; i < numRings; i++) {
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.scale.set(0.6 + i * 0.18, 0.6 + i * 0.18, 0.6 + i * 0.18);
      ring.rotation.x = (i * Math.PI) / 8;
      ring.rotation.y = (i * Math.PI) / 6;
      waveGroup.add(ring);

      const orb = new THREE.Mesh(sphereGeom, sphereMat);
      orb.position.set(
        Math.cos(i * 0.8) * (4 + i * 0.3),
        Math.sin(i * 0.8) * (4 + i * 0.3),
        Math.sin(i * 1.2) * 3
      );
      waveGroup.add(orb);
    }

    waveGroup.position.set(10, 0, -4);
    waveGroup.rotation.z = -0.15;

    // Ambient floating metabolic glow points
    const particleCount = 70;
    const particleGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 50;
      positions[i + 1] = (Math.random() - 0.5) * 45;
      positions[i + 2] = (Math.random() - 0.5) * 20;
    }

    particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x059669,
      size: 0.25,
      transparent: true,
      opacity: 0.35,
    });

    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // Mouse Parallax Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Continuous slow orbital rotation
      waveGroup.rotation.y += 0.004;
      waveGroup.rotation.x += 0.002;

      // Parallax easing
      targetX += (mouseX - targetX) * 0.03;
      targetY += (mouseY - targetY) * 0.03;
      waveGroup.position.x = 10 + targetX * 1.5;
      waveGroup.position.y = -targetY * 1.2;

      // Particle drift
      particles.rotation.y += 0.0004;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-50 transition-opacity duration-700"
      aria-hidden="true"
    />
  );
};
