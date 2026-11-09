/* ============================================================================
 * hero3d.js — ROVZEXI cinematic 3D homepage hero (Three.js, r160, vendored).
 * A glowing portal orbited by real product cards from the live database.
 *   • Mouse/touch parallax camera  • hover raycasting  • click card → product
 *   • Tap-and-hold to dive toward the portal  • scroll-driven camera push
 *   • Fully disposable; auto-destroys when the hash route leaves '/'
 *   • WebGL-free & prefers-reduced-motion handled by the caller/fallback CSS
 * ==========================================================================*/
import * as THREE from '../assets/vendor/three.module.min.js';

const GOLD = 0xffb340;
const GOLD_SOFT = 0xffd27a;
const EMBER = 0xd66a1e;

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function isMobile() { return window.matchMedia?.('(max-width: 900px)')?.matches ?? false; }

/* ------------------------------------------------------------ card painter */
/* Each floating card is drawn onto a canvas → CanvasTexture: consistent
 * glassy look, real product logo + name, no SVG scaling pitfalls. */
function paintCard(product, priceLabel) {
  const W = 560, H = 360, dpr = 1;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);

  // glass body
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, 'rgba(22,30,42,0.96)');
  bg.addColorStop(0.55, 'rgba(12,16,26,0.96)');
  bg.addColorStop(1, 'rgba(8,11,18,0.96)');
  roundRect(g, 3, 3, W - 6, H - 6, 34);
  g.fillStyle = bg; g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(255,179,64,0.55)';
  roundRect(g, 3, 3, W - 6, H - 6, 34); g.stroke();

  // top sheen
  const sheen = g.createLinearGradient(0, 0, 0, H * 0.5);
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(g, 3, 3, W - 6, H - 6, 34);
  g.fillStyle = sheen; g.fill();

  // logo plate
  const plate = { x: 40, y: 42, w: 150, h: 150 };
  g.fillStyle = 'rgba(255,179,64,0.08)';
  roundRect(g, plate.x, plate.y, plate.w, plate.h, 26); g.fill();
  g.strokeStyle = 'rgba(255,179,64,0.30)';
  g.lineWidth = 1.5;
  roundRect(g, plate.x, plate.y, plate.w, plate.h, 26); g.stroke();

  const img = product.images && product.images[0];
  const needsLoad = img ? 1 : 0;
  const finish = (image) => {
    if (image) {
      const s = Math.min((plate.w - 24) / image.width, (plate.h - 24) / image.height);
      const w = image.width * s, h = image.height * s;
      try { g.drawImage(image, plate.x + (plate.w - w) / 2, plate.y + (plate.h - h) / 2, w, h); } catch { /* opaque svg etc. */ }
    } else {
      g.fillStyle = GOLD_SOFT;
      g.font = '700 54px "Space Grotesk", system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(product.name || 'R').slice(0, 2).toUpperCase(), plate.x + plate.w / 2, plate.y + plate.h / 2);
    }
    // text block
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff7e8';
    g.font = '600 40px "Space Grotesk", system-ui, sans-serif';
    g.fillText(clip(g, product.name || '', 340), 226, 96);
    g.fillStyle = 'rgba(255,214,138,0.85)';
    g.font = '500 26px "Inter", system-ui, sans-serif';
    g.fillText(clip(g, product.vendor || priceLabel, 340), 226, 140);
    // price chip
    g.fillStyle = 'rgba(255,179,64,0.14)';
    roundRect(g, 226, 168, 200, 52, 26); g.fill();
    g.fillStyle = GOLD_SOFT;
    g.font = '700 26px "Space Grotesk", system-ui, sans-serif';
    g.fillText(clip(g, priceLabel, 180), 250, 202);
    return cv;
  };

  if (!needsLoad) return finish(null);
  const image = new Image();
  image.crossOrigin = 'anonymous';
  return new Promise((resolve) => {
    image.onload = () => resolve(finish(image));
    image.onerror = () => resolve(finish(null));
    image.src = img;
  });
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function clip(g, text, maxW) {
  let s = String(text ?? '');
  if (g.measureText(s).width <= maxW) return s;
  while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

/* ---------------------------------------------------------- portal shader */
const discVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const discFrag = /* glsl */`
  uniform float uTime; uniform float uBoost;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    if (r > 1.0) discard;
    float core = smoothstep(0.55, 0.0, r);
    float rays = 0.62 + 0.38 * sin(a * 7.0 - uTime * 1.4 + r * 9.0);
    float rings = 0.75 + 0.25 * sin(r * 26.0 - uTime * 2.6);
    float glow = core * rays * rings;
    glow *= smoothstep(1.0, 0.35, r);
    vec3 gold = vec3(1.0, 0.70, 0.25);
    vec3 hot  = vec3(1.0, 0.92, 0.72);
    vec3 col = mix(gold, hot, core);
    gl_FragColor = vec4(col, glow * (0.85 + uBoost * 0.9));
  }`;

/* ============================================================ scene setup */
export async function createHero3D(host, { products = [], onNavigate, onHover } = {}) {
  if (!webglAvailable()) return null;

  const mobile = isMobile();
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05080d, 0.055);

  const camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.1, 80);
  const camBase = new THREE.Vector3(0, 0.4, 9.2);
  camera.position.copy(camBase);

  /* lighting — warm cinematic key + ember rim */
  scene.add(new THREE.AmbientLight(0x30405a, 0.9));
  const key = new THREE.PointLight(GOLD, 60, 40); key.position.set(4, 5, 4); scene.add(key);
  const rim = new THREE.PointLight(EMBER, 26, 30); rim.position.set(-6, -2, -3); scene.add(rim);
  const fill = new THREE.PointLight(0x6fa8ff, 10, 25); fill.position.set(-4, 3, 5); scene.add(fill);

  /* ------------------------------------------------------------- portal */
  const portal = new THREE.Group();
  portal.position.set(0, 0.55, -5.5);
  scene.add(portal);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: GOLD, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.075, 20, 120), ringMat);
  portal.add(ring);
  const ring2Mat = new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: GOLD_SOFT, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.85 });
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.03, 16, 120), ring2Mat);
  ring2.rotation.x = Math.PI / 2.6; ring2.rotation.y = 0.35;
  portal.add(ring2);

  const discMat = new THREE.ShaderMaterial({
    vertexShader: discVert, fragmentShader: discFrag,
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.45, 64), discMat);
  portal.add(disc);

  // fake bloom — additive radial sprite behind the portal
  const bloomCv = document.createElement('canvas'); bloomCv.width = bloomCv.height = 256;
  const bg = bloomCv.getContext('2d');
  const rad = bg.createRadialGradient(128, 128, 8, 128, 128, 128);
  rad.addColorStop(0, 'rgba(255,190,90,0.85)'); rad.addColorStop(0.35, 'rgba(214,106,30,0.35)'); rad.addColorStop(1, 'rgba(214,106,30,0)');
  bg.fillStyle = rad; bg.fillRect(0, 0, 256, 256);
  const bloom = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(bloomCv), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
  }));
  bloom.scale.set(11, 11, 1); bloom.position.z = -0.6;
  portal.add(bloom);

  /* --------------------------------------------------------- energy grid */
  const grid = new THREE.GridHelper(60, 46, GOLD, 0x3a2a12);
  grid.material.transparent = true; grid.material.opacity = 0.14;
  grid.position.set(0, -2.6, -4);
  scene.add(grid);

  /* ------------------------------------------------------ product cards */
  const cards = [];
  const texLoaderQueue = [];
  const picks = products.slice(0, mobile ? 5 : 7);
  const orbit = [
    { r: 4.6, y: 1.5, a0: 0.4,  tilt: 0.10, speed: 0.05 },
    { r: 5.6, y: -0.6, a0: 2.2, tilt: -0.12, speed: -0.04 },
    { r: 4.2, y: -1.7, a0: 4.0, tilt: 0.14, speed: 0.045 },
    { r: 6.2, y: 0.6, a0: 1.3,  tilt: -0.08, speed: -0.035 },
    { r: 5.0, y: 2.2, a0: 5.1,  tilt: 0.10, speed: 0.04 },
    { r: 6.6, y: -1.9, a0: 3.1, tilt: -0.1, speed: 0.03 },
    { r: 4.9, y: 0.1, a0: 5.8,  tilt: 0.12, speed: -0.045 },
  ];

  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    const priceLabel = p.cat === 'adobe' ? 'WhatsApp' : `${p.price ?? ''} MAD`;
    const cv = await paintCard(p, priceLabel);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const grp = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 1.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
    );
    // glow frame (slightly bigger additive quad behind the card)
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.86, 1.24),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.z = -0.02;
    grp.add(face, glow);

    const o = orbit[i % orbit.length];
    grp.userData = { ...o, angle: o.a0, hover: 0, baseScale: 1, bob: Math.random() * Math.PI * 2 };
    scene.add(grp);
    cards.push({ grp, face, glow, product: p });
  }

  /* ---------------------------------------------------------- particles */
  const COUNT = mobile ? 260 : 700;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  const cGold = new THREE.Color(GOLD), cEmber = new THREE.Color(EMBER), cBlue = new THREE.Color(0x6fa8ff);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 3;
    const c = Math.random() < 0.72 ? cGold : (Math.random() < 0.6 ? cEmber : cBlue);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* -------------------------------------------------------- interaction */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  let hovered = null;
  let parX = 0, parY = 0, parTX = 0, parTY = 0;
  let holdT = 0, holding = false, holdTimer = null, movedWhileDown = false;
  let scrollP = 0;                    // 0 → 1 as the hero scrolls away
  const clock = new THREE.Clock();
  let running = true, inView = true, rafId = 0;

  function setPointer(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((cx - r.left) / r.width) * 2 - 1;
    pointer.y = -((cy - r.top) / r.height) * 2 + 1;
  }

  function onPointerMove(e) {
    setPointer(e.clientX, e.clientY);
    parTX = (pointer.x * 0.9);
    parTY = (pointer.y * 0.55);
  }
  function onPointerLeave() {
    parTX = 0; parTY = 0;
    pointer.set(-10, -10);
    setHovered(null);
  }
  function onPointerDown(e) {
    setPointer(e.clientX, e.clientY);
    movedWhileDown = false;
    if (e.pointerType === 'mouse' && hovered) { /* click handled on up */ }
    holdTimer = setTimeout(() => { if (!movedWhileDown) holding = true; }, 260);
  }
  function onPointerMoveDown(e) { if (holding || holdTimer) { movedWhileDown = true; holding = false; clearTimeout(holdTimer); holdTimer = null; } }
  function onPointerUp(e) {
    clearTimeout(holdTimer); holdTimer = null;
    const wasHolding = holding; holding = false;
    if (wasHolding || movedWhileDown) return;
    if (hovered && onNavigate) onNavigate(hovered.product);   // short tap on a card
  }
  function onScroll() {
    const range = Math.max(host.clientHeight * 0.85, 1);
    scrollP = Math.min(Math.max(window.scrollY / range, 0), 1);
  }

  function setHovered(card) {
    if (card === hovered) return;
    hovered = card;
    renderer.domElement.style.cursor = card ? 'pointer' : '';
    onHover?.(card ? card.product : null);
  }

  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';                 // page scroll still works on touch
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  el.addEventListener('pointerdown', onPointerDown, { passive: true });
  el.addEventListener('pointermove', onPointerMoveDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  el.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* pause when tab hidden or hero off-screen */
  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { threshold: 0.02 });
  io.observe(host);
  const onVis = () => { running = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);

  /* ------------------------------------------------------------- render */
  const camTarget = new THREE.Vector3(0, 0.3, -5.5);
  let destroyed = false;
  let camZ = camBase.z, fov = camera.fov;

  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!running || !inView) return;
    const t = clock.getElapsedTime();

    /* hover raycast (throttled to pointer changes is overkill; do it here) */
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cards.map(c => c.face), false)[0];
    setHovered(hit ? cards.find(c => c.face === hit.object) : null);

    /* parallax + idle drift + hold dive + scroll push */
    parX += (parTX - parX) * 0.045;
    parY += (parTY - parY) * 0.045;
    holdT += ((holding ? 1 : 0) - holdT) * 0.06;
    const dive = holdT * holdT;                    // eased
    const idle = Math.sin(t * 0.28) * 0.35;
    camZ += ((camBase.z - dive * 3.6 - scrollP * 3.4) - camZ) * 0.06;
    camera.position.set(parX + idle * 0.4, camBase.y - parY - scrollP * 0.9, camZ);
    const fovTarget = 55 - dive * 9;
    fov += (fovTarget - fov) * 0.06;
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.lookAt(camTarget.x + parX * 0.4, camTarget.y - parY * 0.5, camTarget.z);

    /* portal life */
    discMat.uniforms.uTime.value = t;
    discMat.uniforms.uBoost.value = dive * 0.9 + scrollP * 0.4;
    ring.rotation.z = t * 0.12;
    ring2.rotation.z = -t * 0.18;
    ringMat.emissiveIntensity = 1.6 + Math.sin(t * 1.8) * 0.28 + dive * 1.4;
    bloom.material.opacity = 0.75 + Math.sin(t * 1.8) * 0.1 + dive * 0.25;

    /* cards orbit + hover response */
    for (const c of cards) {
      const u = c.grp.userData;
      u.angle += u.speed * (0.016 + dive * 0.05);
      const bob = Math.sin(t * 0.9 + u.bob) * 0.16;
      c.grp.position.set(Math.cos(u.angle) * u.r, u.y + bob, Math.sin(u.angle) * u.r * 0.55 - 2.2);
      c.grp.rotation.y = -u.angle * 0.35 + Math.sin(t * 0.5 + u.bob) * 0.05;
      c.grp.rotation.x = u.tilt + Math.cos(t * 0.6 + u.bob) * 0.04;
      const target = c === hovered ? 0.16 : 0;
      u.hover += (target - u.hover) * 0.14;
      const s = 1 + u.hover * 0.55;
      c.grp.scale.setScalar(s);
      c.glow.material.opacity = u.hover * 0.34;
      c.face.position.z = 0.02 + u.hover * 0.05;
    }

    /* particles drift */
    const arr = pGeo.attributes.position.array;
    const drift = 0.0035 + dive * 0.02;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += Math.sin(t * 0.6 + seeds[i]) * drift * 0.6;
      arr[i * 3] += Math.cos(t * 0.4 + seeds[i]) * drift;
      if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = -7.5;
    }
    pGeo.attributes.position.needsUpdate = true;
    particles.rotation.y = t * 0.012 + parX * 0.06;

    /* fade the whole canvas as the user scrolls into the page */
    renderer.domElement.style.opacity = String(1 - scrollP);

    renderer.render(scene, camera);
  }

  /* reduced motion → render a single static frame, no loop */
  if (reducedMotion) {
    renderer.render(scene, camera);
    el.style.opacity = '1';
  } else {
    frame();
  }

  /* ------------------------------------------------------------- dispose */
  function onRouteChange() {
    const h = location.hash || '#/';
    if (!h.startsWith('#/') || h.replace(/^#\//, '').split('?')[0] !== '') destroy();
  }
  function onResize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('hashchange', onRouteChange);
  /* rebuild textures once real fonts are in (cards look sharper) */
  if (document.fonts?.ready) document.fonts.ready.then(() => {
    if (destroyed) return;
    for (const c of cards) {
      paintCard(c.product, c.product.cat === 'adobe' ? 'WhatsApp' : `${c.product.price ?? ''} MAD`).then(cv => {
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        c.face.material.map?.dispose();
        c.face.material.map = tex;
        c.face.material.needsUpdate = true;
      });
    }
  });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(rafId);
    io.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('hashchange', onRouteChange);
    document.removeEventListener('visibilitychange', onVis);
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose?.();
      const m = obj.material;
      if (m) {
        if (m.map?.dispose) m.map.dispose();
        m.dispose?.();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { destroy };
}
