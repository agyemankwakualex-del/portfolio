// Hero / page scene. The page loads js/scene.bundle.js, which is this file
// bundled with three@0.170.0 (MIT). Rebuild from the repo root:
//   cd /tmp/three-build && npm init -y && npm install three@0.170.0 esbuild
//   npx esbuild /workspace/js/scene.js --bundle --minify --format=esm --target=es2020 \
//     --outfile=/workspace/js/scene.bundle.js --legal-comments=eof
import * as THREE from "three";

const POSES = [
  { x: -0.72, y: 0.12, spin: 0.35, cam: 5.35, spread: 1.15, ring: 1.12 },
  { x: 1.05, y: 0.28, spin: 1.25, cam: 5.7, spread: 1.35, ring: 1.22 },
  { x: -0.35, y: -0.08, spin: 2.15, cam: 6.05, spread: 1.55, ring: 1.28 },
  { x: 0.8, y: 0.32, spin: 3.0, cam: 6.35, spread: 1.2, ring: 1.02 },
  { x: -0.55, y: 0.08, spin: 3.8, cam: 6.5, spread: 1.7, ring: 1.12 },
  { x: 0.45, y: 0.18, spin: 4.55, cam: 5.8, spread: 1.25, ring: 1.18 },
  { x: 0.0, y: 0.04, spin: 5.3, cam: 5.25, spread: 1.08, ring: 1.22 },
];

function damp(current, target, dt, lambda) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function mixPose(scroll) {
  const last = POSES.length - 1;
  const x = Math.min(Math.max(scroll, 0), 1) * last;
  const i = Math.min(last - 1, Math.floor(x));
  const f = x - i;
  const a = POSES[i];
  const b = POSES[i + 1];
  const out = {};
  for (const key of Object.keys(a)) out[key] = a[key] + (b[key] - a[key]) * f;
  return out;
}

export function mountScene(canvas, options) {
  const opts = options || {};
  const mobile = window.matchMedia("(max-width: 800px)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !mobile,
    powerPreference: "low-power",
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: false,
  });
  if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 0, 6.45);

  const group = new THREE.Group();
  scene.add(group);

  const ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 1),
    new THREE.MeshBasicMaterial({ color: 0xffc17a, wireframe: true })
  );
  group.add(ico);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshBasicMaterial({ color: 0x1f6f66 })
  );
  group.add(core);

  const coreWire = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.78, 0),
    new THREE.MeshBasicMaterial({ color: 0x9be7d8, wireframe: true })
  );
  group.add(coreWire);

  function makeRing(radius, color, opacity) {
    return new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.02, 8, mobile ? 48 : 80),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
  }

  const rings = [
    makeRing(2.15, 0xffc17a, 0.95),
    makeRing(2.7, 0x9be7d8, 0.8),
    makeRing(1.72, 0xf3efe6, 0.55),
  ];
  rings[0].rotation.x = Math.PI / 2.35;
  rings[1].rotation.x = Math.PI / 2.9;
  rings[1].rotation.y = 0.5;
  rings[2].rotation.y = Math.PI / 2;
  rings.forEach((ring) => group.add(ring));

  const pointCount = mobile ? 36 : 90;
  const positions = new Float32Array(pointCount * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < pointCount; i += 1) {
    const y = 1 - (i / (pointCount - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
  }
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    pointGeo,
    new THREE.PointsMaterial({
      color: 0xf3efe6,
      size: mobile ? 0.045 : 0.032,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  points.scale.setScalar(3.05);
  group.add(points);

  const orbit = new THREE.Group();
  const satellites = [];
  if (!mobile) {
    const box = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 6; i += 1) {
      const mesh = new THREE.Mesh(
        box,
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9be7d8 : 0xe8a15a })
      );
      const angle = (i / 6) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 2.65, Math.sin(angle) * 0.35, Math.sin(angle) * 2.65);
      orbit.add(mesh);
      satellites.push(mesh);
    }
    group.add(orbit);
  }

  const dprCap = mobile ? 1 : 1.5;
  const minFrame = mobile ? 1000 / 30 : 1000 / 48;
  const state = { x: 1.55, y: 0.08, spin: 0.25, cam: 6.45, spread: 1, ring: 1 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scroll = 0;
  let stopped = false;
  let onScreen = true;
  let rafId = 0;
  let last = 0;
  let ready = false;
  let slowFrames = 0;
  let degraded = false;

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(window.innerHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function sideScale() {
    return window.innerWidth < 800 ? 0.15 : 1;
  }

  function render(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const pose = mixPose(scroll);
    const side = sideScale();
    state.x = damp(state.x, pose.x * side, dt, 4.5);
    state.y = damp(state.y, pose.y + (mobile ? 1.05 : 0), dt, 4.5);
    state.spin = damp(state.spin, pose.spin, dt, 3.2);
    state.cam = damp(state.cam, pose.cam + (mobile ? 0.25 : 0), dt, 4);
    state.spread = damp(state.spread, pose.spread, dt, 3.5);
    state.ring = damp(state.ring, pose.ring, dt, 3.5);
    pointer.x = damp(pointer.x, pointer.tx, dt, 7);
    pointer.y = damp(pointer.y, pointer.ty, dt, 7);

    group.position.set(state.x, state.y, 0);
    group.rotation.y = state.spin + pointer.x;
    group.rotation.x = pointer.y * 0.85 + Math.sin(state.spin) * 0.06;
    points.scale.setScalar(3.05 * state.spread);
    rings[0].scale.setScalar(state.ring);
    rings[1].scale.setScalar(1 + (state.ring - 1) * 0.6);
    rings[0].rotation.z += dt * 0.18;
    rings[1].rotation.y -= dt * 0.12;
    rings[2].rotation.x += dt * 0.15;
    core.rotation.y -= dt * 0.45;
    core.rotation.x += dt * 0.2;
    coreWire.rotation.y += dt * 0.35;
    ico.rotation.y += dt * 0.12;
    ico.rotation.z -= dt * 0.05;
    if (orbit.parent) orbit.rotation.y += dt * 0.35;
    camera.position.z = state.cam;
    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      if (typeof opts.onReady === "function") opts.onReady();
    }
  }

  function loop(now) {
    rafId = 0;
    if (stopped || document.hidden || !onScreen) return;
    rafId = requestAnimationFrame(loop);
    if (now - last < minFrame && last !== 0) return;
    const frameStart = performance.now();
    render(now);
    const frameMs = performance.now() - frameStart;
    if (frameMs > 28) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (!degraded && slowFrames > 18) {
      degraded = true;
      points.visible = false;
      if (rings[2]) rings[2].visible = false;
      satellites.forEach((mesh) => {
        mesh.visible = false;
      });
    }
  }

  function start() {
    if (stopped || rafId || document.hidden || !onScreen) return;
    last = 0;
    rafId = requestAnimationFrame(loop);
  }

  function onPointer(event) {
    const x = event.clientX / Math.max(window.innerWidth, 1);
    const y = event.clientY / Math.max(window.innerHeight, 1);
    pointer.tx = (x - 0.5) * 0.7;
    pointer.ty = (y - 0.5) * 0.45;
  }

  function onVis() {
    if (document.hidden) return;
    start();
  }

  const io = new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen) start();
    },
    { threshold: 0.01 }
  );

  function onLost(event) {
    event.preventDefault();
    destroy();
    if (typeof opts.onLost === "function") opts.onLost();
  }

  resize();
  io.observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", onLost);
  start();

  function destroy() {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    io.disconnect();
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVis);
    canvas.removeEventListener("webglcontextlost", onLost);
    pointGeo.dispose();
    points.material.dispose();
    ico.geometry.dispose();
    ico.material.dispose();
    core.geometry.dispose();
    core.material.dispose();
    coreWire.geometry.dispose();
    coreWire.material.dispose();
    rings.forEach((ring) => {
      ring.geometry.dispose();
      ring.material.dispose();
    });
    if (satellites.length) satellites[0].geometry.dispose();
    satellites.forEach((mesh) => {
      mesh.material.dispose();
    });
    renderer.dispose();
  }

  return {
    setScroll(value) {
      scroll = value;
      start();
    },
    destroy,
  };
}
