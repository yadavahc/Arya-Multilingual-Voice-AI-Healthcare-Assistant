'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Premium landing animation: a breathing sphere of particles (Arya's "voice
 * field") with an inner glowing core and orbiting rings, in the teal theme.
 * Pure three.js, self-contained, responsive, and paused when off-screen.
 */
export function AryaHero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // ── Particle sphere ──────────────────────────────────────────────
    const COUNT = 2600;
    const positions = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // even distribution on a sphere (golden spiral)
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = i * 2.399963229728653;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const radius = 2.4;
      positions[i * 3] = base[i * 3] = x * radius;
      positions[i * 3 + 1] = base[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = base[i * 3 + 2] = z * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dot = makeDotTexture();
    const mat = new THREE.PointsMaterial({
      size: 0.06,
      map: dot,
      color: new THREE.Color('#43b3ac'),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Glowing core ─────────────────────────────────────────────────
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 32, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#1c7a76'), transparent: true, opacity: 0.55 }),
    );
    scene.add(core);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 32, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#78d0ca'), transparent: true, opacity: 0.12 }),
    );
    scene.add(halo);

    // ── Orbiting rings ───────────────────────────────────────────────
    const rings: THREE.Mesh[] = [];
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.1 + k * 0.35, 0.012, 12, 120),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#aee5e0'), transparent: true, opacity: 0.35 - k * 0.08 }),
      );
      ring.rotation.x = Math.PI / 2.2 + k * 0.3;
      ring.rotation.y = k * 0.5;
      scene.add(ring);
      rings.push(ring);
    }

    // ── Animate ──────────────────────────────────────────────────────
    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;

    const render = () => {
      if (!running) return;
      const el = clock.getElapsedTime();

      // breathing pulse of the particle shell
      const pulse = 1 + Math.sin(el * 1.4) * 0.05;
      for (let i = 0; i < COUNT; i++) {
        const wobble = 1 + Math.sin(el * 2 + i) * 0.015;
        pos.setXYZ(i, base[i * 3] * pulse * wobble, base[i * 3 + 1] * pulse * wobble, base[i * 3 + 2] * pulse * wobble);
      }
      pos.needsUpdate = true;

      points.rotation.y = el * 0.12;
      points.rotation.x = Math.sin(el * 0.2) * 0.15;
      const cs = 1 + Math.sin(el * 1.4) * 0.08;
      core.scale.setScalar(cs);
      halo.scale.setScalar(cs * 1.05);
      (core.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(el * 1.4) * 0.12;
      rings.forEach((r, k) => { r.rotation.z = el * (0.2 + k * 0.05); });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    // Pause when tab hidden / off-screen for performance.
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running) render();
    });
    io.observe(mount);

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      dot.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" aria-hidden />;
}

function makeDotTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(174,229,224,0.9)');
  g.addColorStop(1, 'rgba(67,179,172,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
