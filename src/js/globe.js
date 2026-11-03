// The globe. A country-accurate world drawn once to a canvas texture, wrapped on a Three.js sphere.
// Falls back to a flat, equally clickable map when WebGL (or the CDN) is unavailable.
//
// No UI knowledge lives here: main.js hands in callbacks and a layout function.

import { COUNTRY_LANG, BY_CODE } from './languages.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export const PALETTE = {
  ocean: '#08111d', oceanMid: '#0c1a2c', grid: 'rgba(150,185,230,0.10)',
  land: '#2a384f', landLang: '#40577a', border: '#0b1422', coast: 'rgba(190,212,245,0.55)',
  amber: '255,176,32', cool: '178,200,235',
};

// ----------------------------------------------------------------- world data

function decodeTopology(topo) {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((arc) => {
    let x = 0; let y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const ring = (idx) => {
    const pts = [];
    for (const i of idx) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]);
    }
    // Rings that cross the antimeridian jump from +180 to -180; unwrap so they stay continuous
    // (longitudes may then run past 180, and drawing/picking account for that).
    for (let k = 1; k < pts.length; k++) {
      const d = pts[k][0] - pts[k - 1][0];
      if (d > 180) pts[k] = [pts[k][0] - 360, pts[k][1]]; else if (d < -180) pts[k] = [pts[k][0] + 360, pts[k][1]];
    }
    return pts;
  };
  const area = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] * r[i][1]) - (r[i][0] * r[j][1]); return a / 2; };
  const centroid = (r) => {
    let a = 0; let cx = 0; let cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = (r[j][0] * r[i][1]) - (r[i][0] * r[j][1]);
      a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
    a /= 2;
    return a ? [cx / (6 * a), cy / (6 * a)] : r[0];
  };

  const countries = topo.objects.countries.geometries.map((g) => {
    const polys = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map((p) => {
      const rings = p.map(ring);
      let minX = 1e9; let minY = 90; let maxX = -1e9; let maxY = -90;
      for (const [x, y] of rings[0]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      return { rings, bbox: [minX, minY, maxX, maxY], size: Math.abs(area(rings[0])) };
    });
    const biggest = polys.reduce((a, b) => (b.size > a.size ? b : a));
    const [rawLon, clat] = centroid(biggest.rings[0]);
    const clon = ((rawLon + 540) % 360) - 180;
    return { name: g.properties.name, id: g.id, polys, lon: clon, lat: clat, lang: COUNTRY_LANG.get(g.properties.name) ?? null };
  });
  const landGeom = topo.objects.land.geometries?.[0] ?? topo.objects.land;
  const land = (landGeom.type === 'Polygon' ? [landGeom.arcs] : landGeom.arcs).map((p) => p.map(ring));
  return { countries, land, byName: new Map(countries.map((c) => [c.name, c])) };
}

function inRing(lon, lat, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]; const [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function countryAt(world, lon, lat) {
  for (const c of world.countries) {
    for (const p of c.polys) {
      const b = p.bbox;
      if (lat < b[1] || lat > b[3]) continue;
      for (const o of [0, 360, -360]) {
        const x = lon + o;
        if (x < b[0] || x > b[2]) continue;
        if (inRing(x, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(x, lat, h))) return c;
      }
    }
  }
  return null;
}

// ----------------------------------------------------------------- painting

function addRing(ctx, r, W, H) {
  for (const off of [-W, 0, W]) { // wrapped copies so antimeridian-crossing countries close cleanly
    r.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W + off; const y = ((90 - lat) / 180) * H;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
  }
}

function tracePolys(ctx, c, W, H) {
  ctx.beginPath();
  for (const p of c.polys) for (const r of p.rings) addRing(ctx, r, W, H);
}

function paintBase(canvas, world) {
  const W = canvas.width; const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.ocean); g.addColorStop(0.5, PALETTE.oceanMid); g.addColorStop(1, PALETTE.ocean);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = PALETTE.grid; ctx.lineWidth = Math.max(1, W / 2600);
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) { const x = ((lon + 180) / 360) * W; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let lat = -75; lat <= 75; lat += 15) { const y = ((90 - lat) / 180) * H; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  ctx.lineJoin = 'round';
  for (const c of world.countries) {
    tracePolys(ctx, c, W, H);
    ctx.fillStyle = c.lang ? PALETTE.landLang : PALETTE.land;
    ctx.fill('evenodd');
    ctx.strokeStyle = PALETTE.border; ctx.lineWidth = Math.max(0.8, W / 3400);
    ctx.stroke();
  }
  // coastline: one light line around every landmass so continents read at a glance
  ctx.beginPath();
  for (const poly of world.land) for (const r of poly) addRing(ctx, r, W, H);
  ctx.strokeStyle = PALETTE.coast; ctx.lineWidth = Math.max(1, W / 2800);
  ctx.stroke();
}

/** Highlight layer, painted on black so it can be used as an emissive map or added in 2D. */
function paintHighlight(canvas, world, { to, from, hover, selected }) {
  const W = canvas.width; const H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  const fillSet = (set, rgb, a) => {
    if (!set?.size) return;
    for (const c of world.countries) if (set.has(c.name)) { tracePolys(ctx, c, W, H); ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill('evenodd'); }
  };
  fillSet(from, PALETTE.cool, 0.2);
  fillSet(to, PALETTE.amber, 0.34);
  const one = (name, rgb, a, stroke) => {
    const c = name && world.byName.get(name); if (!c) return;
    tracePolys(ctx, c, W, H); ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill('evenodd');
    if (stroke) { ctx.strokeStyle = `rgba(${rgb},1)`; ctx.lineWidth = Math.max(1.5, W / 1100); ctx.stroke(); }
  };
  one(selected, PALETTE.amber, 0.62, true);
  if (hover && hover !== selected) one(hover, '255,255,255', 0.2, true);
}

const toVec = (THREE, lat, lon, r = 1) => new THREE.Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R) * r, Math.sin(lat * D2R) * r, -Math.cos(lat * D2R) * Math.sin(lon * D2R) * r);

// ----------------------------------------------------------------- shared setup

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const names = (code) => new Set(BY_CODE[code]?.countries ?? []);

/**
 * createGlobe({ canvas, worldUrl, layout, onHover, onPick, onView, onReady, reducedMotion })
 *   layout(W,H) -> { cx, cy, radius }     where the globe sits, in CSS pixels
 * Returns an object with: kind, setState, flyToLanguage, flyToCountry, arc, resize, setReducedMotion, centerCountry
 */
export async function createGlobe(opts) {
  const world = decodeTopology(await (await fetch(opts.worldUrl)).json());
  let THREE = null;
  if (webglOk()) {
    try { THREE = await import('three'); } catch (err) { console.warn('three.js could not be loaded; using the flat map.', err); }
  }
  if (THREE) {
    try { return buildWebGL(THREE, world, opts); } catch (err) { console.warn('WebGL setup failed; using the flat map.', err); }
  }
  return buildFlat(world, opts);
}

// ----------------------------------------------------------------- WebGL globe

function buildWebGL(THREE, world, { canvas, layout, onHover, onPick, onView, onReady, reducedMotion = false }) {
  const small = Math.min(innerWidth, innerHeight) < 600;
  const base = Object.assign(document.createElement('canvas'), { width: small ? 2048 : 4096, height: small ? 1024 : 2048 });
  paintBase(base, world);
  const hi = Object.assign(document.createElement('canvas'), { width: 2048, height: 1024 });
  const hl = { to: new Set(), from: new Set(), hover: null, selected: null };
  paintHighlight(hi, world, hl);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const FOV = 30;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const mapTex = new THREE.CanvasTexture(base);
  mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = aniso;
  const hiTex = new THREE.CanvasTexture(hi);
  hiTex.colorSpace = THREE.SRGBColorSpace; hiTex.anisotropy = aniso;

  const globe = new THREE.Group();
  scene.add(globe);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.MeshStandardMaterial({ map: mapTex, emissiveMap: hiTex, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.88, metalness: 0 }),
  );
  globe.add(body);

  // atmosphere: bright just outside the limb, fading out
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 64, 64),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vN; void main(){ float i = pow(max(0.0, 0.62 - dot(vN, vec3(0.0,0.0,1.0))), 4.0); gl_FragColor = vec4(vec3(0.58,0.7,0.88) * i * 0.55, i * 0.55); }',
    }),
  );
  scene.add(atmo);

  scene.add(new THREE.HemisphereLight(0x9fb4d6, 0x0a0e16, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
  sun.position.set(-2.4, 1.7, 3.2);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6f8fc4, 0.9);
  rim.position.set(3, -1, -2);
  scene.add(rim);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(1100 * 3);
  for (let i = 0; i < 1100; i++) {
    const u = Math.random() * 2 - 1; const t = Math.random() * TAU; const r = 28 + Math.random() * 30; const s = Math.sqrt(1 - u * u);
    sp.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8e8, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false })));

  // markers (from = pale ring, to = amber dot)
  const dot = (color, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), new THREE.MeshBasicMaterial({ color })); m.visible = false; globe.add(m); return m; };
  const toDot = dot(0xffb020, 0.016);
  const fromDot = dot(0xe6edf8, 0.011);
  const place = (m, c) => { if (!c) { m.visible = false; return; } m.position.copy(toVec(THREE, c.lat, c.lon, 1.004)); m.visible = true; };

  // ---- view state
  let W = 1; let H = 1; let L = { cx: 0, cy: 0, radius: 200 };
  const rot = { x: 0.45, y: -Math.PI / 2 - 8 * D2R };
  const vel = { x: 0, y: 0 };
  let zoom = 1; let zoomT = 1;
  let fly = null; let dirty = true; let idleSince = performance.now(); let reduced = reducedMotion;
  let arcState = null; let lastView = 0; let destroyed = false;

  function setViewOffset() {
    camera.aspect = W / H;
    camera.setViewOffset(W, H, -(L.cx - W / 2), -(L.cy - H / 2), W, H);
    const rpx = Math.max(40, L.radius * zoom);
    const t = Math.tan((FOV * D2R) / 2);
    camera.position.z = Math.sqrt(1 + (H / (2 * rpx * t)) ** 2);
    camera.updateProjectionMatrix();
  }

  function resize() {
    W = Math.max(1, canvas.clientWidth || innerWidth); H = Math.max(1, canvas.clientHeight || innerHeight);
    renderer.setSize(W, H, false);
    L = layout(W, H);
    setViewOffset();
    dirty = true;
  }

  const raycaster = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera({ x: ((clientX - r.left) / r.width) * 2 - 1, y: -(((clientY - r.top) / r.height) * 2 - 1) }, camera);
    const hit = raycaster.intersectObject(body, false)[0];
    if (!hit) return null;
    const p = body.worldToLocal(hit.point.clone());
    const lat = Math.asin(clamp(p.y, -1, 1)) / D2R; const lon = Math.atan2(-p.z, p.x) / D2R;
    const c = countryAt(world, lon, lat);
    return { lat, lon, country: c?.name ?? null, lang: c?.lang ?? null };
  }

  const centerLatLon = () => ({ lat: rot.x / D2R, lon: ((((-Math.PI / 2 - rot.y) / D2R) + 540) % 360) - 180 });
  const centerCountry = () => { const { lat, lon } = centerLatLon(); const c = countryAt(world, lon, lat); return { lat, lon, country: c?.name ?? null, lang: c?.lang ?? null }; };

  function setHover(name) {
    if (hl.hover === name) return;
    hl.hover = name; paintHighlight(hi, world, hl); hiTex.needsUpdate = true; dirty = true;
  }

  function flyToLatLon(lat, lon, { zoom: z = 1.12, duration } = {}) {
    const tx = clamp(lat * D2R, -1.2, 1.2);
    let ty = -Math.PI / 2 - lon * D2R;
    ty = rot.y + ((((ty - rot.y) % TAU) + 3 * Math.PI) % TAU) - Math.PI; // shortest way round
    vel.x = vel.y = 0;
    zoomT = z;
    if (reduced) { rot.x = tx; rot.y = ty; fly = null; dirty = true; return; }
    const dist = Math.hypot(tx - rot.x, ty - rot.y);
    fly = { t0: performance.now(), dur: duration ?? clamp(500 + dist * 520, 600, 1500), fx: rot.x, fy: rot.y, tx, ty };
  }

  function setArcProgress(a, p) {
    a.mesh.geometry.setDrawRange(0, Math.floor(p * a.segs) * a.radial * 6);
    const pt = a.curve.getPoint(clamp(p, 0, 1));
    a.head.position.copy(pt);
    a.head.visible = p > 0 && p < 1;
  }

  function clearArc() {
    if (!arcState) return;
    globe.remove(arcState.mesh, arcState.head);
    arcState.mesh.geometry.dispose(); arcState.mesh.material.dispose(); arcState.head.geometry.dispose(); arcState.head.material.dispose();
    arcState = null;
  }

  function arc(fromCode, toCode) {
    clearArc();
    const a = world.byName.get(BY_CODE[fromCode]?.home); const b = world.byName.get(BY_CODE[toCode]?.home);
    if (!a || !b || a === b) return;
    const p0 = toVec(THREE, a.lat, a.lon).normalize(); const p1 = toVec(THREE, b.lat, b.lon).normalize();
    const ang = p0.angleTo(p1);
    const pts = [];
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const v = new THREE.Vector3().copy(p0).lerp(p1, t).normalize();
      pts.push(v.multiplyScalar(1.004 + Math.sin(Math.PI * t) * (0.02 + ang * 0.055)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = 96; const radial = 6;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.0036, radial, false), mat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    globe.add(mesh, head);
    arcState = { mesh, head, curve, segs, radial, t0: performance.now(), dur: 1100 + ang * 500, done: reduced };
    setArcProgress(arcState, reduced ? 1 : 0);
    arcState.head.visible = false;
    dirty = true;
  }

  // ---- pointer input
  const pointers = new Map();
  let drag = null; let pinch = 0;
  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; fly = null; vel.x = vel.y = 0; }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
    idleSince = performance.now();
  });

  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (prev) { prev.x = e.clientX; prev.y = e.clientY; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomT = clamp(zoomT * (d / pinch), 0.8, 2.4);
      pinch = d; dirty = true; return;
    }
    if (drag && pointers.size === 1) {
      const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6) {
        const k = 1 / Math.max(60, L.radius * zoom);
        rot.y += dx * k; rot.x = clamp(rot.x + dy * k, -1.3, 1.3);
        vel.y = dx * k; vel.x = dy * k;
        setHover(null); onHover?.(null);
        dirty = true;
      }
      return;
    }
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const h = pick(e.clientX, e.clientY);
      setHover(h?.country ?? null);
      canvas.style.cursor = h?.lang ? 'pointer' : h ? 'default' : 'grab';
      onHover?.(h, e.clientX, e.clientY);
    }
  });

  const end = (e) => {
    const wasDrag = drag;
    pointers.delete(e.pointerId);
    pinch = 0;
    if (wasDrag && pointers.size === 0) {
      if (wasDrag.moved <= 6 && performance.now() - wasDrag.t < 600) {
        const h = pick(e.clientX, e.clientY);
        if (h) { onPick?.(h, e.clientX, e.clientY); if (e.pointerType === 'touch') onHover?.(h, e.clientX, e.clientY); }
      }
      drag = null; idleSince = performance.now();
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { setHover(null); onHover?.(null); } });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomT = clamp(zoomT * Math.exp(-e.deltaY * 0.0014), 0.8, 2.4);
    idleSince = performance.now(); dirty = true;
  }, { passive: false });

  canvas.addEventListener('keydown', (e) => {
    const step = 0.14 / zoom;
    const k = e.key;
    if (k === 'ArrowLeft') rot.y += step; else if (k === 'ArrowRight') rot.y -= step;
    else if (k === 'ArrowUp') rot.x = clamp(rot.x + step, -1.3, 1.3); else if (k === 'ArrowDown') rot.x = clamp(rot.x - step, -1.3, 1.3);
    else if (k === '+' || k === '=') zoomT = clamp(zoomT * 1.15, 0.8, 2.4); else if (k === '-' || k === '_') zoomT = clamp(zoomT / 1.15, 0.8, 2.4);
    else if (k === 'Enter' || k === ' ') { const c = centerCountry(); onPick?.(c); onHover?.(c, L.cx, L.cy); e.preventDefault(); return; }
    else return;
    e.preventDefault(); fly = null; idleSince = performance.now(); dirty = true;
    const c = centerCountry(); setHover(c.country); onHover?.(c, L.cx, L.cy);
  });

  // ---- loop
  let raf = 0; let last = performance.now();
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, now - last); last = now;
    if (document.hidden) return;

    if (fly) {
      const p = clamp((now - fly.t0) / fly.dur, 0, 1); const e = ease(p);
      rot.x = fly.fx + (fly.tx - fly.fx) * e; rot.y = fly.fy + (fly.ty - fly.fy) * e;
      if (p >= 1) { fly = null; idleSince = now; }
      dirty = true;
    } else if (!drag && pointers.size === 0) {
      if (Math.abs(vel.x) > 1e-5 || Math.abs(vel.y) > 1e-5) {
        rot.y += vel.y; rot.x = clamp(rot.x + vel.x, -1.3, 1.3);
        vel.x *= 0.93; vel.y *= 0.93; dirty = true;
      } else if (!reduced && now - idleSince > 4500) {
        rot.y -= dt * 0.00007; dirty = true;
      }
    }
    if (Math.abs(zoomT - zoom) > 0.0008) { zoom += (zoomT - zoom) * Math.min(1, dt * 0.012); setViewOffset(); dirty = true; }

    if (arcState) {
      const a = arcState; const age = now - a.t0;
      if (!a.done) { const p = clamp(age / a.dur, 0, 1); setArcProgress(a, ease(p)); if (p >= 1) { a.done = true; a.head.visible = false; } dirty = true; }
      const fade = clamp((age - a.dur - 2400) / 1200, 0, 1);
      if (fade > 0) { a.mesh.material.opacity = 0.95 * (1 - fade); dirty = true; if (fade >= 1) clearArc(); }
    }

    if (dirty) {
      globe.rotation.set(rot.x, rot.y, 0);
      renderer.render(scene, camera);
      dirty = false;
      if (onView && now - lastView > 120) { lastView = now; const c = centerLatLon(); onView(c.lat, c.lon); }
    }
  }

  new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange', () => { dirty = true; });
  resize();
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => onReady?.());

  return {
    kind: 'webgl',
    debugBase: base,
    locate: (name) => world.byName.get(name) ?? null,
    resize,
    centerCountry,
    setReducedMotion(v) { reduced = v; },
    setState({ from, to, selected }) {
      hl.from = names(from); hl.to = names(to); hl.selected = selected ?? BY_CODE[to]?.home ?? null;
      paintHighlight(hi, world, hl); hiTex.needsUpdate = true;
      place(toDot, world.byName.get(BY_CODE[to]?.home)); place(fromDot, from ? world.byName.get(BY_CODE[from]?.home) : null);
      dirty = true;
    },
    flyToLanguage(code, o) { const c = world.byName.get(BY_CODE[code]?.home); if (c) flyToLatLon(c.lat, c.lon, o); },
    flyToCountry(name, o) { const c = world.byName.get(name); if (c) flyToLatLon(c.lat, c.lon, o); },
    arc,
    nudge() { idleSince = performance.now(); },
    dispose() { destroyed = true; cancelAnimationFrame(raf); renderer.dispose(); },
  };
}

// ----------------------------------------------------------------- flat fallback

function buildFlat(world, { canvas, layout, onHover, onPick, onReady, onView }) {
  const base = Object.assign(document.createElement('canvas'), { width: 2048, height: 1024 });
  paintBase(base, world);
  const hi = Object.assign(document.createElement('canvas'), { width: 2048, height: 1024 });
  const hl = { to: new Set(), from: new Set(), hover: null, selected: null };
  const ctx = canvas.getContext('2d');
  let box = { x: 0, y: 0, w: 1, h: 1 }; let focus = null; let dpr = 1;
  canvas.dataset.fallback = 'flat';

  function draw() {
    paintHighlight(hi, world, hl);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(base, box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(hi, box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = 'source-over';
    if (focus) {
      const x = box.x + ((focus.lon + 180) / 360) * box.w; const y = box.y + ((90 - focus.lat) / 180) * box.h;
      ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
    }
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const W = canvas.clientWidth || innerWidth; const H = canvas.clientHeight || innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const L = layout(W, H);
    const w = Math.min(L.radius * 3.4, W - 24); const h = w / 2;
    box = { x: L.cx - w / 2, y: L.cy - h / 2, w, h };
    draw();
  }

  const at = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left; const py = cy - r.top;
    if (px < box.x || py < box.y || px > box.x + box.w || py > box.y + box.h) return null;
    const lon = ((px - box.x) / box.w) * 360 - 180; const lat = 90 - ((py - box.y) / box.h) * 180;
    const c = countryAt(world, lon, lat);
    return { lat, lon, country: c?.name ?? null, lang: c?.lang ?? null };
  };

  canvas.addEventListener('pointermove', (e) => {
    const h = at(e.clientX, e.clientY);
    if ((h?.country ?? null) !== hl.hover) { hl.hover = h?.country ?? null; draw(); }
    canvas.style.cursor = h?.lang ? 'pointer' : 'default';
    onHover?.(h, e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => { hl.hover = null; draw(); onHover?.(null); });
  canvas.addEventListener('click', (e) => { const h = at(e.clientX, e.clientY); if (h) { onPick?.(h, e.clientX, e.clientY); if (e.pointerType === 'touch') onHover?.(h, e.clientX, e.clientY); } });

  new ResizeObserver(resize).observe(canvas);
  resize();
  requestAnimationFrame(() => onReady?.());

  return {
    kind: 'flat',
    locate: (name) => world.byName.get(name) ?? null,
    resize,
    centerCountry: () => ({ lat: 0, lon: 0, country: null, lang: null }),
    setReducedMotion() {},
    setState({ from, to, selected }) {
      hl.from = names(from); hl.to = names(to); hl.selected = selected ?? BY_CODE[to]?.home ?? null;
      focus = world.byName.get(BY_CODE[to]?.home) ?? null;
      draw();
    },
    flyToLanguage(code) { focus = world.byName.get(BY_CODE[code]?.home) ?? focus; draw(); onView?.(focus?.lat ?? 0, focus?.lon ?? 0); },
    flyToCountry(name) { focus = world.byName.get(name) ?? focus; draw(); },
    arc() {},
    nudge() {},
    dispose() {},
  };
}
