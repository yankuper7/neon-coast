/* חוף ניאון – ציור: קרקע במטמון, צללי שמש, מפת תאורה צבעונית, מזג אוויר, בניינים בפרספקטיבה, מכ"ם */
'use strict';
(() => {
  const NC = window.NC;
  const { clamp, lerp, TAU, shade, hexA, hash } = NC;
  const M = NC.map, T = M.T, N = M.N, G = NC.G, CARS = NC.CARS, Fx = NC.fx, Wx = NC.weather;
  const canvas = NC.$('game'), ctx = canvas.getContext('2d', { alpha: false });
  const radar = NC.$('radar'), rctx = radar.getContext('2d');
  const cam = NC.cam = { x: 0, y: 0, zoom: 1.2, k: 1 };
  let cw = 800, ch = 600, dpr = 1, base = 1, frame = 0;
  const HF = 0.0007, SW = 18;

  // ---------------- רמות איכות ----------------
  const QUAL = [
    { name: 'Low', dpr: 1, light: 4, win: 4, clouds: false, refl: false, parts: 170, chunk: 0.75, rain: 0.45 },
    { name: 'Medium', dpr: 1.5, light: 3, win: 8, clouds: true, refl: true, parts: 340, chunk: 1, rain: 0.75 },
    { name: 'High', dpr: 2, light: 2, win: 12, clouds: true, refl: true, parts: 520, chunk: 1.5, rain: 1 },
  ];
  let qLevel = 2, Q = QUAL[2];
  function setQuality(l) { qLevel = clamp(l | 0, 0, 2); Q = QUAL[qLevel]; Fx.max = Q.parts; resize(); }

  // ---------------- מטמון אריחי קרקע ----------------
  const CH = 4, CHW = CH * T;
  const chunks = new Map();
  let chunkScale = 1, chunkBudget = 0, chunkMax = 24;

  let lightCv = null, lightCtx = null, vignette = null;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
    cw = Math.max(1, window.innerWidth); ch = Math.max(1, window.innerHeight);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    base = Math.min(cw, ch) / (cw > ch ? 800 : 560);
    const rs = radar.clientWidth || 150;
    radar.width = radar.height = Math.round(rs * Math.min(window.devicePixelRatio || 1, 2));
    lightCv = null; vignette = null;
    const cs = clamp(Math.round(base * dpr * 4) / 4, 0.5, Q.chunk);
    if (cs !== chunkScale) { chunkScale = cs; chunks.clear(); }
    // כמה אריחים נראים בזום הרחוק ביותר, ועוד שוליים
    const vw = cw / (base * 0.74), vh = ch / (base * 0.74);
    chunkMax = Math.max(12, Math.ceil((Math.ceil(vw / CHW) + 2) * (Math.ceil(vh / CHW) + 2) * 1.3));
  }

  // ---------------- מפה קטנה ----------------
  const mm = document.createElement('canvas');
  const MMP = 6;
  (function buildMinimap() {
    mm.width = mm.height = N * MMP;
    const g = mm.getContext('2d');
    const DC = { palms: '#3d6e34', downtown: '#454d57', strip: '#6b5a4a', market: '#5e5346', port: '#474c50' };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const t = M.tiles[M.idx(i, j)];
      g.fillStyle = t === M.ROAD ? '#a3a9b1' : t === M.WATER ? '#1b6f8f' : t === M.SAND ? '#cdbb85' : t === M.PARK ? '#3f8d3a' : t === M.GLADE ? '#2f6233' : DC[M.districtAt((i + 0.5) * T, (j + 0.5) * T)] || '#444';
      g.fillRect(i * MMP, j * MMP, MMP, MMP);
    }
    g.fillStyle = 'rgba(255,255,255,0.13)';
    for (const b of M.buildings) if (b.kind !== 'box') g.fillRect(b.x / T * MMP, b.y / T * MMP, b.w / T * MMP, b.h / T * MMP);
  })();

  // ---------------- ספרייטים של אור ----------------
  const sprites = new Map();
  // עיגול רך בצבע נתון. soft=true נופל מהר יותר (אור), אחרת מלא יותר (עשן)
  function glow(color, soft) {
    const key = color + (soft ? 's' : 'f');
    let s = sprites.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 96;
    const g = s.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    if (soft) { gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(0.22, hexA(color, 0.62)); gr.addColorStop(0.55, hexA(color, 0.2)); gr.addColorStop(1, hexA(color, 0)); }
    else { gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(0.55, hexA(color, 0.72)); gr.addColorStop(1, hexA(color, 0)); }
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    if (sprites.size > 90) sprites.clear();
    sprites.set(key, s);
    return s;
  }
  // קונוס אור של פנסי רכב, פונה ימינה מהנקודה (0, 128)
  let coneSpr = null;
  function cone() {
    if (coneSpr) return coneSpr;
    coneSpr = document.createElement('canvas'); coneSpr.width = coneSpr.height = 256;
    const g = coneSpr.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    for (const [ang, a] of [[0.5, 0.22], [0.38, 0.3], [0.25, 0.36], [0.13, 0.3]]) {
      const gr = g.createRadialGradient(0, 128, 4, 0, 128, 256);
      gr.addColorStop(0, `rgba(255,246,214,${a})`); gr.addColorStop(0.5, `rgba(255,246,214,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,246,214,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 128); g.arc(0, 128, 256, -ang, ang); g.closePath(); g.fill();
    }
    return coneSpr;
  }
  let cloudSpr = null;
  function cloudSprite() {
    if (cloudSpr) return cloudSpr;
    cloudSpr = document.createElement('canvas'); cloudSpr.width = cloudSpr.height = 128;
    const g = cloudSpr.getContext('2d');
    for (let q = 0; q < 7; q++) {
      const x = 64 + (hash(q, 61) - 0.5) * 62, y = 64 + (hash(q, 67) - 0.5) * 44, r = 22 + hash(q, 71) * 20;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(10,16,44,0.5)'); gr.addColorStop(1, 'rgba(10,16,44,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return cloudSpr;
  }

  // ---------------- תמונות מכוניות שמורות ----------------
  const SPR = 2.5, carSprites = new Map();
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function paintCar(g, type, color, dead) {
    const d = CARS[type], L = d.len, Wd = d.wid, hw = Wd / 2;
    if (dead) color = '#2a2a2a';
    // גלגלים אחוריים (הקדמיים מצוירים בנפרד כדי שיסתובבו עם ההגה)
    g.fillStyle = '#111';
    for (const sy of [-1, 1]) g.fillRect(-L * 0.3 - 5, sy * hw - (sy > 0 ? 1.5 : 2), 10, 3.5);
    // מראות צד
    if (type !== 'van') { g.fillStyle = shade(color, -0.35); g.fillRect(L * 0.1, -hw - 1.6, 3, 2); g.fillRect(L * 0.1, hw - 0.4, 3, 2); }
    // מרכב
    const bg = g.createLinearGradient(0, -hw, 0, hw);
    bg.addColorStop(0, shade(color, -0.34)); bg.addColorStop(0.28, shade(color, 0.1)); bg.addColorStop(0.5, shade(color, 0.26)); bg.addColorStop(0.72, shade(color, 0.1)); bg.addColorStop(1, shade(color, -0.34));
    rrect(g, -L / 2, -hw, L, Wd, type === 'van' ? 4 : 7); g.fillStyle = bg; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.stroke();
    // מכסה מנוע – קו עדין
    if (type !== 'van' && !dead) { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(L * 0.3, -hw + 3); g.quadraticCurveTo(L * 0.34, 0, L * 0.3, hw - 3); g.stroke(); }
    if (type === 'police' && !dead) { g.fillStyle = '#1b2a49'; rrect(g, L * 0.2, -hw + 1, L * 0.3 - 1, Wd - 2, 5); g.fill(); rrect(g, -L / 2 + 1, -hw + 1, L * 0.2, Wd - 2, 5); g.fill(); }
    const glass = dead ? '#111' : '#1c2b3b';
    if (type === 'van') {
      g.fillStyle = shade(color, 0.3); rrect(g, -L / 2 + 3, -hw + 2.5, L * 0.68, Wd - 5, 3); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(-L / 2 + 3 + k * L * 0.17, -hw + 3); g.lineTo(-L / 2 + 3 + k * L * 0.17, hw - 3); } g.stroke();
      g.fillStyle = glass; g.beginPath(); g.moveTo(L * 0.22, -hw + 3); g.lineTo(L * 0.36, -hw + 4); g.lineTo(L * 0.36, hw - 4); g.lineTo(L * 0.22, hw - 3); g.closePath(); g.fill();
    } else if (type === 'pickup') {
      g.fillStyle = shade(color, -0.5); rrect(g, -L / 2 + 3, -hw + 3, L * 0.4, Wd - 6, 2); g.fill();
      g.strokeStyle = shade(color, 0.2); g.lineWidth = 1.2; g.stroke();
      g.fillStyle = glass; g.beginPath(); g.moveTo(L * 0.12, -hw + 3); g.lineTo(L * 0.26, -hw + 5); g.lineTo(L * 0.26, hw - 5); g.lineTo(L * 0.12, hw - 3); g.closePath(); g.fill();
      g.fillStyle = shade(color, 0.15); g.fillRect(-L * 0.08, -hw + 3.5, L * 0.2, Wd - 7);
      g.fillStyle = glass; g.fillRect(-L * 0.11, -hw + 4, 2.5, Wd - 8);
    } else {
      g.fillStyle = glass;
      g.beginPath(); g.moveTo(L * 0.1, -hw + 3); g.lineTo(L * 0.27, -hw + 5); g.lineTo(L * 0.27, hw - 5); g.lineTo(L * 0.1, hw - 3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-L * 0.2, -hw + 3); g.lineTo(-L * 0.31, -hw + 5); g.lineTo(-L * 0.31, hw - 5); g.lineTo(-L * 0.2, hw - 3); g.closePath(); g.fill();
      g.fillRect(-L * 0.2, -hw + 2.2, L * 0.3, 2); g.fillRect(-L * 0.2, hw - 4.2, L * 0.3, 2);
      g.fillStyle = shade(color, type === 'police' ? 0 : 0.18); rrect(g, -L * 0.2, -hw + 4.2, L * 0.3, Wd - 8.4, 2.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(L * 0.12, -hw + 4); g.lineTo(L * 0.2, -hw + 5); g.lineTo(L * 0.14, -hw + 9); g.closePath(); g.fill();
      if (type === 'sports' && !dead) {
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-L / 2 + 2, -3.2, L - 4, 2); g.fillRect(-L / 2 + 2, 1.2, L - 4, 2);
        g.fillStyle = '#151515'; g.fillRect(-L / 2 - 1, -hw + 1, 4, Wd - 2);
      }
      if (type === 'muscle' && !dead) {
        g.fillStyle = 'rgba(15,15,15,0.8)'; g.fillRect(L * 0.27, -4.5, L * 0.21, 3); g.fillRect(L * 0.27, 1.5, L * 0.21, 3); g.fillRect(-L / 2 + 2, -4.5, L * 0.19, 3); g.fillRect(-L / 2 + 2, 1.5, L * 0.19, 3);
        g.fillStyle = '#151515'; g.fillRect(L * 0.3, -2.2, 6, 4.4);
      }
      if (type === 'taxi' && !dead) {
        g.fillStyle = '#111'; for (let k = 0; k < 7; k++) { g.fillRect(-L * 0.3 + k * 5, -hw + 0.6, 2.5, 1.6); g.fillRect(-L * 0.3 + k * 5 + 2.5, hw - 2.2, 2.5, 1.6); }
        g.fillStyle = '#fff'; g.fillRect(-L * 0.08, -4, 5, 8); g.strokeStyle = '#111'; g.lineWidth = 0.8; g.strokeRect(-L * 0.08, -4, 5, 8);
      }
    }
    if (!dead) {
      g.fillStyle = '#fff7c2'; g.fillRect(L / 2 - 2.5, -hw + 2.5, 2.5, 5); g.fillRect(L / 2 - 2.5, hw - 7.5, 2.5, 5);
      g.fillStyle = '#b3201f'; g.fillRect(-L / 2, -hw + 2.5, 2, 5); g.fillRect(-L / 2, hw - 7.5, 2, 5);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc((hash(k, 3) - 0.5) * L * 0.8, (hash(k, 5) - 0.5) * Wd * 0.7, 3 + hash(k, 7) * 4, 0, TAU); g.fill(); }
    }
  }
  function carSprite(c) {
    const key = c.type + c.color + (c.dead ? 'x' : '');
    let s = carSprites.get(key);
    if (s) return s;
    const w = c.d.len + 12, h = c.d.wid + 12;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * SPR); cv.height = Math.ceil(h * SPR);
    const g = cv.getContext('2d'); g.setTransform(SPR, 0, 0, SPR, cv.width / 2, cv.height / 2);
    paintCar(g, c.type, c.color, c.dead);
    s = { cv, w, h };
    if (carSprites.size > 160) carSprites.clear();
    carSprites.set(key, s);
    return s;
  }

  // ---------------- שעון, שמש ותאורת סביבה ----------------
  function nightAmount(h) {
    if (h >= 20.6 || h < 5) return 1;
    if (h >= 18.6) return (h - 18.6) / 2;
    if (h < 6.5) return 1 - (h - 5) / 1.5;
    return 0;
  }
  NC.nightAmount = nightAmount;
  // צבע האור לאורך היממה: לילה כחול, זריחה ורודה, יום לבן, שעת זהב, שקיעה
  const AMB = [[0, 0.25, 0.29, 0.52], [4.6, 0.25, 0.29, 0.52], [5.6, 0.5, 0.43, 0.58], [6.5, 1, 0.8, 0.66], [7.8, 1, 1, 1], [16.8, 1, 1, 1], [18.3, 1, 0.86, 0.64], [19.3, 0.94, 0.6, 0.56], [20.2, 0.5, 0.4, 0.64], [21.2, 0.25, 0.29, 0.52], [24.01, 0.25, 0.29, 0.52]];
  const amb = [1, 1, 1];
  let ambKey = -1, ambLum = 1, ambCss = 'rgb(255,255,255)';
  const acache = new Map();
  function computeAmbient(h) {
    let q = 0; while (q < AMB.length - 2 && h >= AMB[q + 1][0]) q++;
    const a = AMB[q], b = AMB[q + 1], t = NC.smooth((h - a[0]) / (b[0] - a[0]));
    const gray = clamp(Wx.cloud * 0.7, 0, 0.8), dim = 1 - (Wx.cloud * 0.16 + Wx.rain * 0.14 + Wx.fog * 0.06);
    const fl = Wx.flash > 0 ? Wx.flash * (0.6 + 0.4 * Math.sin(Wx.flash * 40)) : 0;
    const GR = [0.93, 0.97, 1.04];
    let lum = 0;
    for (let c = 0; c < 3; c++) lum += lerp(a[c + 1], b[c + 1], t) / 3;
    for (let c = 0; c < 3; c++) { const v = lerp(a[c + 1], b[c + 1], t); amb[c] = Math.min(1.05, lerp(v, lum * dim * GR[c], gray) + fl * 0.75); }
    ambLum = (amb[0] + amb[1] + amb[2]) / 3;
    const r = Math.min(255, amb[0] * 255) | 0, g = Math.min(255, amb[1] * 255) | 0, bl = Math.min(255, amb[2] * 255) | 0;
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (bl >> 2);
    if (key !== ambKey) { ambKey = key; acache.clear(); ambCss = `rgb(${r},${g},${bl})`; }
  }
  // צבע (עם הבהרה/הכהיה f) מוכפל באור הסביבה. משמש לכל מה שמעל הקרקע: בניינים ועצים
  function A(hex, f) {
    const key = f ? hex + f : hex;
    let v = acache.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    v = `rgb(${Math.min(255, r * amb[0]) | 0},${Math.min(255, g * amb[1]) | 0},${Math.min(255, b * amb[2]) | 0})`;
    acache.set(key, v);
    return v;
  }
  // כיוון הצל ליחידת גובה, ועוצמתו
  const sun = { ox: 0, oy: -0.3, a: 0.3 };
  function computeSun(h) {
    const t = (h - 5.6) / (20.2 - 5.6), soft = 1 - 0.72 * Wx.cloud;
    if (t > 0 && t < 1) {
      const e = Math.sin(Math.PI * t), len = lerp(1.15, 0.36, e), dx = -Math.cos(Math.PI * t), dy = -0.5, n = Math.hypot(dx, dy);
      sun.ox = dx / n * len; sun.oy = dy / n * len; sun.a = 0.34 * clamp(e * 5, 0, 1) * soft;
    } else { sun.ox = 0.3; sun.oy = -0.42; sun.a = 0.12 * clamp((nightAmount(h) - 0.85) / 0.15, 0, 1) * soft; } // אור ירח
  }

  // ---------------- קרקע (חלק סטטי – נצבע פעם אחת לאריח) ----------------
  function paintTile(g, i, j) {
    const x = i * T, y = j * T;
    if (!M.inb(i, j)) { g.fillStyle = '#1787ad'; g.fillRect(x, y, T + 1, T + 1); return; }
    const k = M.idx(i, j), t = M.tiles[k];
    if (t === M.ROAD) {
      const m = M.conn(i, j);
      g.fillStyle = '#3b3e44'; g.fillRect(x, y, T + 1, T + 1);
      // מרקם אספלט
      g.fillStyle = 'rgba(255,255,255,0.045)'; for (let q = 0; q < 7; q++) g.fillRect(x + hash(k, q + 50) * 116, y + hash(k, q + 60) * 116, 3, 2);
      g.fillStyle = 'rgba(0,0,0,0.1)'; for (let q = 0; q < 3; q++) g.fillRect(x + 20 + hash(k, q + 70) * 70, y + 20 + hash(k, q + 80) * 70, 9 + hash(k, q + 90) * 14, 5);
      if (hash(k, 95) < 0.16 && (m === 5 || m === 10)) { g.fillStyle = '#2c2f34'; g.beginPath(); g.arc(x + 60 + (m === 10 ? 0 : 22), y + 60 + (m === 10 ? 22 : 0), 6, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke(); }
      // מדרכות
      g.fillStyle = '#b9b5ab';
      if (!(m & 1)) g.fillRect(x, y, T + 1, SW); if (!(m & 4)) g.fillRect(x, y + T - SW, T + 1, SW + 1);
      if (!(m & 8)) g.fillRect(x, y, SW, T + 1); if (!(m & 2)) g.fillRect(x + T - SW, y, SW + 1, T + 1);
      if ((m & 1) && (m & 2)) g.fillRect(x + T - SW, y, SW + 1, SW); if ((m & 2) && (m & 4)) g.fillRect(x + T - SW, y + T - SW, SW + 1, SW + 1);
      if ((m & 4) && (m & 8)) g.fillRect(x, y + T - SW, SW, SW + 1); if ((m & 8) && (m & 1)) g.fillRect(x, y, SW, SW);
      // תפרי מרצפות ואבן שפה
      g.fillStyle = 'rgba(0,0,0,0.07)';
      for (let q = 30; q < T; q += 30) {
        if (!(m & 1)) g.fillRect(x + q, y, 1, SW - 2); if (!(m & 4)) g.fillRect(x + q, y + T - SW + 2, 1, SW - 2);
        if (!(m & 8)) g.fillRect(x, y + q, SW - 2, 1); if (!(m & 2)) g.fillRect(x + T - SW + 2, y + q, SW - 2, 1);
      }
      g.fillStyle = '#8e8a80';
      if (!(m & 1)) g.fillRect(x, y + SW - 2, T + 1, 2); if (!(m & 4)) g.fillRect(x, y + T - SW, T + 1, 2);
      if (!(m & 8)) g.fillRect(x + SW - 2, y, 2, T + 1); if (!(m & 2)) g.fillRect(x + T - SW, y, 2, T + 1);
      g.fillStyle = 'rgba(0,0,0,0.16)';
      if (!(m & 1)) g.fillRect(x, y + SW, T + 1, 3); if (!(m & 4)) g.fillRect(x, y + T - SW - 3, T + 1, 3);
      if (!(m & 8)) g.fillRect(x + SW, y, 3, T + 1); if (!(m & 2)) g.fillRect(x + T - SW - 3, y, 3, T + 1);
      if (m === 10) { g.fillStyle = '#e6d68a'; for (let q = 0; q < 3; q++) g.fillRect(x + 9 + q * 40, y + T / 2 - 1.5, 22, 3); }
      else if (m === 5) { g.fillStyle = '#e6d68a'; for (let q = 0; q < 3; q++) g.fillRect(x + T / 2 - 1.5, y + 9 + q * 40, 3, 22); }
      else if (M.connCount(m) >= 3) { // מעברי חצייה
        g.fillStyle = 'rgba(240,240,240,0.82)';
        for (let q = 0; q < 6; q++) {
          const o = SW + 6 + q * 13;
          if (m & 8) g.fillRect(x + 3, y + o, 12, 7); if (m & 2) g.fillRect(x + T - 15, y + o, 12, 7);
          if (m & 1) g.fillRect(x + o, y + 3, 7, 12); if (m & 4) g.fillRect(x + o, y + T - 15, 7, 12);
        }
      }
    } else if (t === M.WATER) {
      const deep = i >= 58 || j >= 60;
      g.fillStyle = deep ? '#1787ad' : '#22a3c9'; g.fillRect(x, y, T + 1, T + 1);
      if (!deep) { const gr = i === 57 ? g.createLinearGradient(x, 0, x + T, 0) : g.createLinearGradient(0, y, 0, y + T); gr.addColorStop(0, 'rgba(120,225,235,0.35)'); gr.addColorStop(1, 'rgba(23,135,173,1)'); g.fillStyle = gr; g.fillRect(x, y, T + 1, T + 1); }
      if (M.inb(i, j - 1) && M.tiles[M.idx(i, j - 1)] === M.ROAD) { g.fillStyle = '#6d6a63'; g.fillRect(x, y, T + 1, 10); g.fillStyle = '#4f4c46'; g.fillRect(x, y + 10, T + 1, 3); }
    } else if (t === M.SAND) {
      g.fillStyle = '#efdba0'; g.fillRect(x, y, T + 1, T + 1);
      g.fillStyle = 'rgba(190,160,100,0.35)';
      for (let q = 0; q < 8; q++) g.fillRect(x + hash(k, q) * 112, y + hash(k, q + 9) * 112, 3, 2);
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.5; g.beginPath();
      for (let q = 0; q < 2; q++) { const sx = x + hash(k, q + 30) * 70, sy = y + 20 + hash(k, q + 33) * 80; g.moveTo(sx, sy); g.quadraticCurveTo(sx + 20, sy - 5, sx + 40, sy); }
      g.stroke();
      if (M.inb(i + 1, j) && M.tiles[M.idx(i + 1, j)] === M.WATER) { const gr = g.createLinearGradient(x + T - 40, 0, x + T, 0); gr.addColorStop(0, 'rgba(160,130,80,0)'); gr.addColorStop(1, 'rgba(150,120,75,0.42)'); g.fillStyle = gr; g.fillRect(x + T - 40, y, 41, T + 1); }
    } else {
      g.fillStyle = M.groundColor[k]; g.fillRect(x, y, T + 1, T + 1);
      if (t === M.PARK || t === M.GLADE || M.groundColor[k] === '#6dab4d') {
        g.fillStyle = 'rgba(20,70,20,0.2)';
        for (let q = 0; q < 6; q++) g.fillRect(x + hash(k, q) * 110, y + hash(k, q + 5) * 110, 4, 7);
        g.fillStyle = 'rgba(190,240,120,0.18)';
        for (let q = 0; q < 4; q++) g.fillRect(x + hash(k, q + 20) * 100, y + hash(k, q + 25) * 100, 14, 5);
        if (t === M.PARK) { // פרחים
          for (let q = 0; q < 3; q++) { g.fillStyle = ['#ff7eb6', '#ffe14d', '#ffffff'][q]; g.beginPath(); g.arc(x + 8 + hash(k, q + 100) * 104, y + 8 + hash(k, q + 110) * 104, 2.2, 0, TAU); g.fill(); }
        }
        if (t === M.GLADE && hash(k, 40) < 0.45) { g.fillStyle = 'rgba(30,90,110,0.55)'; g.beginPath(); g.ellipse(x + 30 + hash(k, 41) * 60, y + 30 + hash(k, 42) * 60, 26 + hash(k, 43) * 18, 16 + hash(k, 44) * 10, hash(k, 45) * 3, 0, TAU); g.fill(); }
      } else {
        g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(x + 60, y); g.lineTo(x + 60, y + T); g.moveTo(x, y + 60); g.lineTo(x + T, y + 60); g.stroke();
      }
    }
  }

  function paintDecor(g, d) {
    if (d.t === 'pool') {
      g.fillStyle = '#f3efe4'; rrect(g, d.x - 4, d.y - 4, d.w + 8, d.h + 8, 8); g.fill();
      g.fillStyle = '#35c3e8'; rrect(g, d.x, d.y, d.w, d.h, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; rrect(g, d.x + 3, d.y + 3, d.w - 6, d.h * 0.3, 4); g.fill();
    } else if (d.t === 'parking') {
      g.fillStyle = '#4a4d52'; g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let q = 0; q * 44 < d.w - 20; q++) g.fillRect(d.x + 4 + q * 44, d.y + 6, 2, 66);
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let q = 0; q < 4; q++) g.fillRect(d.x + 12 + hash(q, d.x) * (d.w - 40), d.y + 80 + hash(q, d.y) * Math.max(1, d.h - 110), 16, 9);
    } else if (d.t === 'plaza') {
      g.fillStyle = d.special ? '#d9d2c2' : '#cbc4b4'; g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1; g.beginPath();
      for (let q = 30; q < d.w; q += 30) { g.moveTo(d.x + q, d.y); g.lineTo(d.x + q, d.y + d.h); }
      for (let q = 30; q < d.h; q += 30) { g.moveTo(d.x, d.y + q); g.lineTo(d.x + d.w, d.y + q); }
      g.stroke();
      if (!d.special && d.w > 150 && d.h > 150) { // אגן המזרקה
        const fx = d.x + d.w / 2, fy = d.y + d.h / 2;
        g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(fx + 3, fy + 4, 27, 0, TAU); g.fill();
        g.fillStyle = '#9a958a'; g.beginPath(); g.arc(fx, fy, 26, 0, TAU); g.fill();
        g.fillStyle = '#4fc6e6'; g.beginPath(); g.arc(fx, fy, 21, 0, TAU); g.fill();
      }
    } else if (d.t === 'yard') { g.fillStyle = '#6d7378'; g.fillRect(d.x, d.y, d.w, d.h); g.strokeStyle = 'rgba(255,220,80,0.35)'; g.lineWidth = 2; g.strokeRect(d.x + 5, d.y + 5, d.w - 10, d.h - 10); }
    else if (d.t === 'pond') {
      g.fillStyle = '#d9cfa5'; g.beginPath(); g.ellipse(d.x, d.y, d.rx + 12, d.ry + 12, 0, 0, TAU); g.fill();
      g.fillStyle = '#2aa9cf'; g.beginPath(); g.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(20,90,130,0.35)'; g.beginPath(); g.ellipse(d.x + 10, d.y + 8, d.rx * 0.7, d.ry * 0.65, 0, 0, TAU); g.fill();
      g.fillStyle = '#3f9b46'; for (let q = 0; q < 5; q++) { const lx = d.x + (hash(q, 1) - 0.5) * d.rx * 1.3, ly = d.y + (hash(q, 2) - 0.5) * d.ry * 1.2; g.beginPath(); g.arc(lx, ly, 9, 0.4, TAU); g.lineTo(lx, ly); g.fill(); }
    } else if (d.t === 'path') { g.fillStyle = '#d6c79a'; g.fillRect(d.x, d.y, d.w, d.h); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(d.x, d.y, d.w, 2); g.fillRect(d.x, d.y, 2, d.h); }
    else if (d.t === 'umbrella') {
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(d.x + 6, d.y + 8, 20, 0, TAU); g.fill();
      g.fillStyle = '#4fb7d9'; g.fillRect(d.x + 16, d.y + 12, 13, 26);
      for (let q = 0; q < 8; q++) { g.fillStyle = q % 2 ? '#ffffff' : d.c; g.beginPath(); g.moveTo(d.x, d.y); g.arc(d.x, d.y, 20, q * TAU / 8, (q + 1) * TAU / 8); g.closePath(); g.fill(); }
    }
  }
  function paintArea(g, i0, j0, i1, j1) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) paintTile(g, i, j);
    for (let j = j0 - 3; j <= j1 + 2; j++) for (let i = i0 - 3; i <= i1 + 2; i++) { if (M.inb(i, j)) for (const d of M.dGrid[M.idx(i, j)]) paintDecor(g, d); }
  }
  function getChunk(cx, cy) {
    const key = cx + cy * 256;
    const c = chunks.get(key);
    if (c) { c.used = frame; return c.cv; }
    if (chunkBudget <= 0) return null;
    chunkBudget--;
    let cv = null;
    if (chunks.size >= chunkMax) { // ממחזרים את האריח שלא נראה הכי הרבה זמן
      let ok = null, ou = frame;
      for (const [k2, v] of chunks) if (v.used < ou) { ou = v.used; ok = k2; }
      if (ok != null) { cv = chunks.get(ok).cv; chunks.delete(ok); }
    }
    const px = Math.round(CHW * chunkScale);
    if (!cv || cv.width !== px) { cv = document.createElement('canvas'); cv.width = cv.height = px; }
    const g = cv.getContext('2d'), i0 = cx * CH - 2, j0 = cy * CH - 2;
    g.setTransform(chunkScale, 0, 0, chunkScale, -i0 * T * chunkScale, -j0 * T * chunkScale);
    paintArea(g, i0, j0, i0 + CH - 1, j0 + CH - 1);
    chunks.set(key, { cv, used: frame });
    return cv;
  }
  function drawGround(i0, j0, i1, j1) {
    chunkBudget = chunks.size < 4 ? 64 : 2;
    const c0 = Math.floor((i0 + 2) / CH), c1 = Math.floor((i1 + 2) / CH), r0 = Math.floor((j0 + 2) / CH), r1 = Math.floor((j1 + 2) / CH);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const x = (cx * CH - 2) * T, y = (cy * CH - 2) * T;
      if (cx < -1 || cy < -1 || cx > 16 || cy > 16) { ctx.fillStyle = '#1787ad'; ctx.fillRect(x, y, CHW + 1, CHW + 1); continue; }
      const cv = getChunk(cx, cy);
      if (cv) ctx.drawImage(cv, x, y, CHW + 0.6, CHW + 0.6);
      else { ctx.save(); ctx.beginPath(); ctx.rect(x, y, CHW + 0.6, CHW + 0.6); ctx.clip(); paintArea(ctx, cx * CH - 2, cy * CH - 2, cx * CH + 1, cy * CH + 1); ctx.restore(); }
    }
  }
  // החלקים החיים של הקרקע: גלים, קצף, שלוליות, מזרקות
  function drawGroundLive(i0, j0, i1, j1, time) {
    const wet = Wx.wet;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * T, y = j * T, inb = M.inb(i, j), k = inb ? M.idx(i, j) : (i * 31 + j * 17), t = inb ? M.tiles[k] : M.WATER;
      if (t === M.WATER) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let q = 0; q < 2; q++) {
          const wx = x + hash(k, q) * 80 + Math.sin(time * 0.8 + k + q) * 8, wy = y + 25 + q * 55 + Math.cos(time * 0.6 + k) * 5;
          ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 14, wy - 6, wx + 28, wy);
        }
        ctx.stroke();
        if (inb && M.inb(i - 1, j) && M.tiles[M.idx(i - 1, j)] === M.SAND) { // קצף על קו החוף
          const surge = Math.sin(time * 0.9 + j * 0.7) * 5;
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(x - 4, y);
          for (let q = 0; q <= 4; q++) ctx.lineTo(x + 16 + surge + Math.sin(time * 1.3 + j * 2 + q * 1.7) * 7, y + q * 30);
          ctx.lineTo(x - 4, y + T); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(x - 4, y);
          for (let q = 0; q <= 4; q++) ctx.lineTo(x + 6 + surge + Math.sin(time * 1.6 + j * 2 + q * 1.7) * 6, y + q * 30);
          ctx.lineTo(x - 4, y + T); ctx.closePath(); ctx.fill();
        }
      } else if (t === M.ROAD && wet > 0.22) { // שלוליות
        const a = (wet - 0.22) * 0.5;
        ctx.fillStyle = ambLum > 0.6 ? `rgba(170,200,225,${a.toFixed(3)})` : `rgba(120,150,210,${(a * 0.8).toFixed(3)})`;
        for (let q = 0; q < 2; q++) {
          if (hash(k, q + 120) > 0.55) continue;
          ctx.beginPath(); ctx.ellipse(x + 26 + hash(k, q + 121) * 68, y + 26 + hash(k, q + 122) * 68, 10 + hash(k, q + 123) * 16, 5 + hash(k, q + 124) * 8, hash(k, q + 125) * 3, 0, TAU); ctx.fill();
        }
      }
      if (!inb) continue;
      for (const d of M.dGrid[k]) {
        if (d.t === 'pool') {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
          const wv = Math.sin(time * 2 + d.x) * 3; ctx.moveTo(d.x + 6, d.y + 16 + wv); ctx.lineTo(d.x + d.w - 8, d.y + 14 + wv); ctx.moveTo(d.x + 8, d.y + 36 - wv); ctx.lineTo(d.x + d.w - 6, d.y + 38 - wv); ctx.stroke();
        } else if (d.t === 'plaza' && !d.special && d.w > 150 && d.h > 150) {
          const fx = d.x + d.w / 2, fy = d.y + d.h / 2;
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(fx, fy, 8 + (time * 9 % 12), 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(fx, fy, 5 + Math.sin(time * 5) * 2, 0, TAU); ctx.fill();
        } else if (d.t === 'pond') {
          ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(d.x - 50 + Math.sin(time * 0.7) * 10, d.y - 30, 60, 14, 0.2, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(d.x + 60 + Math.cos(time * 0.5) * 12, d.y + 40, 40, 9, -0.1, 0, TAU); ctx.fill();
        }
      }
    }
  }

  // ---------------- דמויות ----------------
  function drawPed(x, y, ang, ph, shirt, skin, hair, opts) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3 + sun.ox * 9, y + 4 + sun.oy * 9, 8, 6, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (opts.down) {
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(-3, 0, 9, 5.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(8, 0, 4.5, 0, TAU); ctx.fill(); ctx.fillRect(-14, -4, 5, 3); ctx.fillRect(-14, 1, 5, 3);
      ctx.restore();
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💫', x, y - 12);
      return;
    }
    const sw = opts.moving ? Math.sin(ph) * 3.2 : 0;
    ctx.fillStyle = '#22252b'; ctx.beginPath(); ctx.ellipse(sw, -3.4, 3.2, 2.1, 0, 0, TAU); ctx.ellipse(-sw, 3.4, 3.2, 2.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-sw * 0.8, -8, 2.3, 0, TAU); ctx.arc(sw * 0.8, 8, 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, 0, 5, 8, 0, 0, TAU); ctx.fill();
    if (opts.player) { ctx.fillStyle = '#19e3ff'; for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(-1 + (q % 2) * 2.5, -5 + q * 3.2, 1.1, 0, TAU); ctx.fill(); } }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(0, 0, 5, 8, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(1, 0, 4.7, 0, TAU); ctx.fill();
    ctx.fillStyle = opts.player ? '#ffffff' : hair; ctx.beginPath(); ctx.arc(0.4, 0, 4.7, Math.PI * 0.5, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    if (opts.player) { ctx.beginPath(); ctx.arc(1, 0, 4.7, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff3fa4'; ctx.beginPath(); ctx.ellipse(5, 0, 2.6, 4, 0, 0, TAU); ctx.fill(); }
    if (opts.cop) { ctx.fillStyle = '#16284f'; ctx.beginPath(); ctx.arc(1, 0, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(4, 0, 1.4, 0, TAU); ctx.fill(); }
    if (opts.wave) { ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(4, -10 - Math.abs(Math.sin(ph * 0.6)) * 3, 2.4, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (opts.umb) { // מטרייה בגשם
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(x + 4, y + 5, 13, 0, TAU); ctx.fill();
      for (let q = 0; q < 6; q++) { ctx.fillStyle = q % 2 ? shade(opts.umb, -0.18) : opts.umb; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 13, q * TAU / 6, (q + 1) * TAU / 6); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, TAU); ctx.fill();
    }
  }

  function drawCar(c, time) {
    const s = carSprite(c), L = c.d.len, hw = c.d.wid / 2;
    const cs = Math.cos(c.ang), sn = Math.sin(c.ang);
    // צל
    ctx.setTransform(cam.k * cs, cam.k * sn, -cam.k * sn, cam.k * cs, cam.k * (c.x + 3 + sun.ox * 11) + cam.ox, cam.k * (c.y + 4 + sun.oy * 11) + cam.oy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, -L / 2, -hw, L, hw * 2, 7); ctx.fill();
    ctx.setTransform(cam.k * cs, cam.k * sn, -cam.k * sn, cam.k * cs, cam.k * c.x + cam.ox, cam.k * c.y + cam.oy);
    // גלגלים קדמיים – מסתובבים עם ההגה
    if (!c.dead) {
      const sa = (c.steerVis || 0) * 0.5, wc = Math.cos(sa), ws = Math.sin(sa);
      ctx.fillStyle = '#111';
      for (const sy of [-1, 1]) {
        const wx = L * 0.3, wy = sy * (hw - 0.4);
        ctx.beginPath(); ctx.moveTo(wx - 5 * wc + 1.9 * ws, wy - 5 * ws - 1.9 * wc); ctx.lineTo(wx + 5 * wc + 1.9 * ws, wy + 5 * ws - 1.9 * wc); ctx.lineTo(wx + 5 * wc - 1.9 * ws, wy + 5 * ws + 1.9 * wc); ctx.lineTo(wx - 5 * wc - 1.9 * ws, wy - 5 * ws + 1.9 * wc); ctx.closePath(); ctx.fill();
      }
    }
    // המרכב נוטה מעט בפניות
    const roll = c.dead ? 0 : (c.roll || 0);
    ctx.drawImage(s.cv, -s.w / 2, -s.h / 2 + roll * 0.55, s.w, s.h);
    if (!c.dead) {
      const hf = c.hp / c.d.hp;
      if (hf < 0.6) { ctx.fillStyle = `rgba(20,20,20,${(0.6 - hf) * 0.8})`; for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc((hash(q, c.seed) - 0.3) * L * 0.6, (hash(q + 4, c.seed) - 0.5) * hw * 1.4, 3 + hash(q + 8, c.seed) * 4, 0, TAU); ctx.fill(); } }
      if (c.brake) { ctx.fillStyle = 'rgba(255,40,30,0.95)'; ctx.fillRect(-L / 2 - 0.5, -hw + 2, 3, 6); ctx.fillRect(-L / 2 - 0.5, hw - 8, 3, 6); }
      if (c.blink && Math.floor(time * 2.6) % 2) { const by = c.blink > 0 ? hw - 4 : -hw + 1; ctx.fillStyle = '#ffb020'; ctx.fillRect(L / 2 - 4, by, 4, 3); ctx.fillRect(-L / 2, by, 4, 3); }
      if (c.type === 'police') {
        const on = c.ai && c.ai.cop && G.wanted > 0 || c.block, fl = Math.floor(time * 6) % 2;
        ctx.fillStyle = on ? (fl ? '#ff2b2b' : '#5a1010') : '#a33'; ctx.fillRect(-4, -hw + 4, 5, hw - 4.5);
        ctx.fillStyle = on ? (fl ? '#10205a' : '#2b6bff') : '#33a'; ctx.fillRect(-4, 0.5, 5, hw - 4.5);
      }
      if (c.type === 'taxi' && c.forHire) { ctx.fillStyle = '#7CFC9A'; ctx.fillRect(-L * 0.08 + 1, -3, 3, 6); }
      if (c.hitT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; rrect(ctx, -L / 2, -hw, L, hw * 2, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
  }

  // ---------------- צללי שמש של בניינים ועצים ----------------
  // מוסיף לנתיב את המשושה שנוצר ממלבן הבסיס ומההעתק שלו לכיוון הצל (עם כיוון השעון, כמו arc)
  function SP(x, y, fin, fout, ox, oy, first) {
    if (fin) { if (first) ctx.moveTo(x + ox, y + oy); else ctx.lineTo(x + ox, y + oy); if (!fout) ctx.lineTo(x, y); }
    else { if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y); if (fout) ctx.lineTo(x + ox, y + oy); }
  }
  function shadowPoly(x0, y0, x1, y1, ox, oy) {
    const f0 = oy < 0, f1 = ox > 0, f2 = oy > 0, f3 = ox < 0; // אילו צלעות פונות לכיוון הצל: עליונה, ימנית, תחתונה, שמאלית
    SP(x0, y0, f3, f0, ox, oy, true); SP(x1, y0, f0, f1, ox, oy, false); SP(x1, y1, f1, f2, ox, oy, false); SP(x0, y1, f2, f3, ox, oy, false);
    ctx.closePath();
  }
  function drawShadows(objs) {
    if (sun.a < 0.012) return;
    ctx.fillStyle = `rgba(8,12,40,${sun.a.toFixed(3)})`;
    ctx.beginPath();
    for (const o of objs) {
      if (o.type) { // עץ
        const z = o.z * 0.85, cx = o.x + sun.ox * z, cy = o.y + sun.oy * z, r = o.type === 'palm' ? 19 : 23;
        ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
      } else {
        const z = Math.min(o.z, 300 / Math.max(0.36, Math.hypot(sun.ox, sun.oy)));
        shadowPoly(o.x, o.y, o.x + o.w, o.y + o.h, sun.ox * z, sun.oy * z);
      }
    }
    ctx.fill();
    // גזעי העצים
    ctx.strokeStyle = `rgba(8,12,40,${sun.a.toFixed(3)})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
    for (const o of objs) if (o.type) { const z = o.z * 0.85; ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + sun.ox * (z - 16), o.y + sun.oy * (z - 16)); }
    ctx.stroke();
  }

  // ---------------- בניינים ועצים בפרספקטיבה ----------------
  const objs = [];
  function wall(ax, ay, bx, by, s, color, b, lights) {
    const qx0 = cam.x + (ax - cam.x) * s, qy0 = cam.y + (ay - cam.y) * s, qx1 = cam.x + (bx - cam.x) * s, qy1 = cam.y + (by - cam.y) * s;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(qx1, qy1); ctx.lineTo(qx0, qy0); ctx.closePath(); ctx.fill();
    if (b.kind === 'house' || b.kind === 'box') return;
    const depth = Math.abs(qx0 - ax) + Math.abs(qy0 - ay);
    if (depth < 7) return; // הקיר כמעט לא נראה
    const floors = clamp(Math.round(b.z / 28), 1, Q.win), lit = lights > 0.3;
    ctx.lineWidth = clamp(depth / floors * 0.5, 1.2, 2.8);
    // חלונות כהים – כל הקומות בנתיב אחד
    ctx.strokeStyle = lit ? A('#1a2540') : A('#2a3f5c'); ctx.globalAlpha = lit ? 0.75 : 0.42; ctx.setLineDash([8, 5]);
    ctx.beginPath();
    for (let f = 0; f < floors; f++) { const t = (f + 0.55) / floors; ctx.moveTo(lerp(ax, qx0, t), lerp(ay, qy0, t)); ctx.lineTo(lerp(bx, qx1, t), lerp(by, qy1, t)); }
    ctx.stroke();
    if (lit) { // חלונות מוארים – חלק מהקומות, ופחות אחרי חצות
      const frac = (G.clock > 0.5 && G.clock < 7 ? 0.32 : 0.62) * (b.kind === 'special' ? 1.2 : 1);
      ctx.strokeStyle = b.seed % 5 === 0 ? '#bfe4ff' : '#ffd678'; ctx.globalAlpha = Math.min(1, lights * 1.1) * 0.9; ctx.setLineDash([7, 6 + (b.seed % 4) * 3]);
      ctx.beginPath();
      for (let f = 0; f < floors; f++) {
        if (hash(f, b.seed) > frac) continue;
        const t = (f + 0.55) / floors, o = hash(f + 3, b.seed) * 0.12;
        ctx.moveTo(lerp(lerp(ax, qx0, t), lerp(bx, qx1, t), o), lerp(lerp(ay, qy0, t), lerp(by, qy1, t), o)); ctx.lineTo(lerp(bx, qx1, t), lerp(by, qy1, t));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = b._cover ? 0.3 : 1;
  }

  function drawBuilding(b, lights, pp, time) {
    const s = 1 + b.z * HF;
    const rx = cam.x + (b.x - cam.x) * s, ry = cam.y + (b.y - cam.y) * s, rw = b.w * s, rh = b.h * s;
    const minx = Math.min(b.x, rx), miny = Math.min(b.y, ry), maxx = Math.max(b.x + b.w, rx + rw), maxy = Math.max(b.y + b.h, ry + rh);
    const cover = b.z > 45 && pp.x > minx - 12 && pp.x < maxx + 12 && pp.y > miny - 12 && pp.y < maxy + 12;
    b._cover = cover;
    if (cover) ctx.globalAlpha = 0.3;
    const c1 = A(b.wall, -0.16), c2 = A(b.wall, -0.34);
    if (cam.x < b.x) wall(b.x, b.y + b.h, b.x, b.y, s, c1, b, lights);
    else if (cam.x > b.x + b.w) wall(b.x + b.w, b.y, b.x + b.w, b.y + b.h, s, c1, b, lights);
    if (cam.y < b.y) wall(b.x, b.y, b.x + b.w, b.y, s, c2, b, lights);
    else if (cam.y > b.y + b.h) wall(b.x + b.w, b.y + b.h, b.x, b.y + b.h, s, c2, b, lights);
    // גג
    if (b.kind === 'box') {
      ctx.fillStyle = A(b.wall, 0.12); ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 1; q < 7; q++) { ctx.moveTo(rx + q * rw / 7, ry); ctx.lineTo(rx + q * rw / 7, ry + rh); } ctx.stroke();
    } else if (b.kind === 'house') {
      const horiz = b.w >= b.h;
      ctx.fillStyle = A(b.roof, 0.15); ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = A(b.roof, -0.18);
      if (horiz) ctx.fillRect(rx, ry + rh / 2, rw, rh / 2); else ctx.fillRect(rx + rw / 2, ry, rw / 2, rh);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (horiz) { ctx.moveTo(rx, ry + rh / 2); ctx.lineTo(rx + rw, ry + rh / 2); } else { ctx.moveTo(rx + rw / 2, ry); ctx.lineTo(rx + rw / 2, ry + rh); }
      ctx.stroke();
      ctx.fillStyle = A('#8a6f5a'); ctx.fillRect(rx + rw * 0.72, ry + rh * 0.18, 9, 9); // ארובה
      if (lights > 0.4 && b.seed % 3) { ctx.fillStyle = `rgba(255,214,120,${(0.75 * lights).toFixed(2)})`; ctx.fillRect(rx + rw * 0.2, ry + rh * 0.62, 10, 7); } // חלון גג מואר
    } else {
      ctx.fillStyle = A(b.roof); ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = A(b.wall, 0.2); ctx.fillRect(rx, ry, rw, 5); ctx.fillRect(rx, ry + rh - 5, rw, 5); ctx.fillRect(rx, ry, 5, rh); ctx.fillRect(rx + rw - 5, ry, 5, rh);
      const sd = b.seed;
      if (b.label) {
        if (b.label === 'H') { ctx.strokeStyle = A('#ffe14d'); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, 34, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = lights > 0.3 ? '#fff' : A('#ffffff'); ctx.font = `bold ${b.label === 'H' ? 40 : 44}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.label, rx + rw / 2, ry + rh / 2 + 2);
      } else {
        if (b.kind === 'strip' && sd % 3 === 0 && rw > 110 && rh > 90) {
          ctx.fillStyle = A('#f3efe4'); rrect(ctx, rx + rw * 0.25 - 4, ry + rh * 0.3 - 4, rw * 0.5 + 8, rh * 0.35 + 8, 8); ctx.fill();
          ctx.fillStyle = lights > 0.4 ? '#35c3e8' : A('#35c3e8'); rrect(ctx, rx + rw * 0.25, ry + rh * 0.3, rw * 0.5, rh * 0.35, 6); ctx.fill(); // בריכת גג מוארת בלילה
        } else if (b.kind === 'warehouse') { ctx.fillStyle = A('#a9c4d6'); for (let q = 0; q < 3; q++) ctx.fillRect(rx + rw * (0.2 + q * 0.25), ry + rh * 0.2, rw * 0.08, rh * 0.6); }
        else if (b.kind === 'downtown' && sd % 4 === 1 && rw > 90 && rh > 90) { ctx.strokeStyle = A('#d8dde2'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, 20, 0, TAU); ctx.moveTo(rx + rw / 2 - 9, ry + rh / 2 - 9); ctx.lineTo(rx + rw / 2 - 9, ry + rh / 2 + 9); ctx.moveTo(rx + rw / 2 + 9, ry + rh / 2 - 9); ctx.lineTo(rx + rw / 2 + 9, ry + rh / 2 + 9); ctx.moveTo(rx + rw / 2 - 9, ry + rh / 2); ctx.lineTo(rx + rw / 2 + 9, ry + rh / 2); ctx.stroke(); } // מנחת
        const ac = A('#9aa2a8'), ac2 = A('#6f777d');
        for (let q = 0; q < 1 + (sd % 3); q++) { const ax = rx + 12 + hash(q, sd) * (rw - 44), ay = ry + 12 + hash(q + 5, sd) * (rh - 40); ctx.fillStyle = ac; ctx.fillRect(ax, ay, 18, 14); ctx.fillStyle = ac2; ctx.fillRect(ax + 3, ay + 3, 12, 8); }
        if (b.z > 200 && lights > 0.3 && Math.floor(time * 1.2 + sd) % 2) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(rx + rw - 12, ry + 12, 3.5, 0, TAU); ctx.fill(); } // אור אזהרה למטוסים
      }
      if (b.neon) {
        if (lights > 0.25) {
          const pulse = 0.8 + 0.2 * Math.sin(time * 3 + b.seed), flick = (b.seed % 7 === 0 && Math.sin(time * 23 + b.seed) > 0.86) ? 0.35 : 1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = hexA(b.neon, 0.3 * lights * pulse * flick); ctx.lineWidth = 12; ctx.strokeRect(rx + 7, ry + 7, rw - 14, rh - 14);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = hexA(b.neon, Math.min(1, 0.95 * lights * pulse * flick + 0.25)); ctx.lineWidth = 3; ctx.strokeRect(rx + 7, ry + 7, rw - 14, rh - 14);
        } else { ctx.strokeStyle = A(b.neon); ctx.lineWidth = 2.5; ctx.strokeRect(rx + 7, ry + 7, rw - 14, rh - 14); }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.strokeRect(rx, ry, rw, rh);
    if (cover) ctx.globalAlpha = 1;
  }

  function drawTree(t, time, pp, dt) {
    if (t.shake > 0) t.shake -= dt;
    const s = 1 + t.z * HF * 1.4, wind = 0.6 + Wx.wind * 1.6;
    const sway = (Math.sin(time * 1.3 + t.ph) * 3 + Math.sin(time * 3.1 + t.ph * 2) * Wx.wind * 2.5) * wind + Wx.wind * 4 + (t.shake > 0 ? Math.sin(time * 40) * 5 * t.shake : 0);
    const tx = cam.x + (t.x - cam.x) * s + sway, ty = cam.y + (t.y - cam.y) * s + sway * 0.4;
    const near = Math.abs(pp.x - tx) < 34 && Math.abs(pp.y - ty) < 34;
    if (near) ctx.globalAlpha = 0.4;
    ctx.strokeStyle = t.type === 'palm' ? A('#8a6a3f') : A('#5e4023'); ctx.lineWidth = t.type === 'palm' ? 5 : 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.quadraticCurveTo((t.x + tx) / 2 + 6, (t.y + ty) / 2, tx, ty); ctx.stroke();
    if (t.type === 'palm') {
      const c0 = A('#37b24d'), c1 = A('#2f9e44');
      for (let q = 0; q < 7; q++) {
        const a = q * TAU / 7 + t.ph + Math.sin(time * 1.1 * wind + q + t.ph) * 0.08 * wind, ca = Math.cos(a), sa = Math.sin(a);
        ctx.fillStyle = q % 2 ? c1 : c0;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 18 * ca + 9 * sa, ty + 18 * sa - 9 * ca, tx + 36 * ca, ty + 36 * sa); ctx.quadraticCurveTo(tx + 18 * ca - 6 * sa, ty + 18 * sa + 6 * ca, tx, ty); ctx.fill();
      }
      ctx.fillStyle = A('#5a3d1e'); ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, TAU); ctx.fill();
    } else {
      const cols = ['#2b8a3e', '#2f9e44', '#40c057'];
      for (let q = 0; q < 3; q++) { ctx.fillStyle = A(cols[q]); ctx.beginPath(); ctx.arc(tx + [-9, 8, -1][q], ty + [4, 3, -7][q], [19, 18, 16][q], 0, TAU); ctx.fill(); }
      ctx.fillStyle = `rgba(255,255,255,${(0.14 * ambLum).toFixed(3)})`; ctx.beginPath(); ctx.arc(tx - 6, ty - 10, 8, 0, TAU); ctx.fill();
    }
    if (near) ctx.globalAlpha = 1;
  }

  // ---------------- סימונים ----------------
  const MCOL = { start: '#ffe14d', check: '#19e3ff', next: '#19e3ff', spray: '#3dff9e', target: '#ff3fa4', job: '#ff9d3d', item: '#ffe14d', enemy: '#ff5252', heal: '#ff6b81' };
  MCOL.rival = '#ff5252';
  const mcol = (kind) => MCOL[kind] || '#ff3fa4';
  const mc = (m) => m.col || mcol(m.kind);
  function drawMarkers(time, marks) {
    for (const m of marks) {
      if (m.kind === 'car' || m.kind === 'enemy' || m.kind === 'rival') continue;
      const col = mc(m), r = m.kind === 'start' || m.kind === 'job' ? 44 : m.kind === 'spray' ? 50 : m.kind === 'item' ? 26 : m.r || 58;
      const a = m.kind === 'next' ? 0.3 : 1;
      ctx.fillStyle = hexA(col, 0.16 * a); ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(col, 0.9 * a); ctx.lineWidth = 5; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -time * 40;
      ctx.beginPath(); ctx.arc(m.x, m.y, r + Math.sin(time * 4) * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (m.label) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, 20, 0, TAU); ctx.fill();
        ctx.fillStyle = '#222'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.label, m.x, m.y + 2);
      } else if (m.kind === 'item') { ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.icon || '📦', m.x, m.y + Math.sin(time * 3 + m.x) * 3); }
    }
    // מוסכי ריסוס – תמיד מסומנים על הקרקע
    for (const k of ['spray', 'spray2']) {
      const s = M.special[k];
      ctx.strokeStyle = 'rgba(61,255,158,0.7)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(s.x, s.y, 48, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎨', s.x, s.y);
    }
    // פלמינגו זהב
    for (let i = 0; i < NC.PKGS.length; i++) {
      if (G.pkgs.includes(i)) continue;
      const p = NC.PKGS[i];
      if (Math.abs(p.x - cam.x) > 1200 || Math.abs(p.y - cam.y) > 1200) continue;
      const bob = Math.sin(time * 3 + i) * 4;
      ctx.fillStyle = 'rgba(255,225,77,0.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, 26 + bob, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,77,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, 20, time * 2, time * 2 + 4.5); ctx.stroke();
      ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦩', p.x, p.y - 2 + bob * 0.5);
    }
  }
  // "גליל הולוגרמה" מעל יעדים – טבעות שעולות בגובה ונוטות כמו הבניינים
  function drawBeacons(time, marks) {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of marks) {
      if (m.kind === 'next' || m.kind === 'spray' || m.kind === 'rival') continue;
      const col = mc(m);
      if (m.kind === 'car' || m.kind === 'enemy') { // חץ מקפץ מעל רכב
        const by = m.y - 46 - Math.abs(Math.sin(time * 4)) * 8;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = m.kind === 'enemy' ? '#ff5252' : '#ffe14d'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, by + 16); ctx.lineTo(m.x - 12, by); ctx.lineTo(m.x + 12, by); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        continue;
      }
      const r = m.kind === 'start' || m.kind === 'job' ? 44 : m.kind === 'item' ? 22 : m.r || 58;
      for (let q = 1; q <= 4; q++) {
        const z = (q * 34 + time * 30) % 150, s = 1 + z * HF * 1.3;
        ctx.strokeStyle = hexA(col, 0.32 * (1 - z / 150)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cam.x + (m.x - cam.x) * s, cam.y + (m.y - cam.y) * s, r * s, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------- מפת תאורה: צבע הסביבה + כל מקורות האור, מוכפלת על שכבת הקרקע ----------------
  function buildLightmap(view, lights, time, marks) {
    const div = Q.light, lw = Math.ceil(canvas.width / div), lh = Math.ceil(canvas.height / div);
    if (!lightCv || lightCv.width !== lw || lightCv.height !== lh) { lightCv = document.createElement('canvas'); lightCv.width = lw; lightCv.height = lh; lightCtx = lightCv.getContext('2d', { alpha: false }); }
    const L = lightCtx, s = cam.k / div, tx = cam.ox / div, ty = cam.oy / div;
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1;
    L.fillStyle = ambCss; L.fillRect(0, 0, lw, lh);
    if (lights < 0.03) return;
    L.globalCompositeOperation = 'lighter';
    L.setTransform(s, 0, 0, s, tx, ty);
    const spot = (spr, x, y, r, a) => { L.globalAlpha = a > 1 ? 1 : a; L.drawImage(spr, x - r, y - r, r * 2, r * 2); };
    const lamp = glow('#ffd9a0', true);
    for (const l of view.lamps) spot(lamp, l.x, l.y, 235, 0.95 * lights);
    const pp = NC.world.playerPos();
    spot(glow('#ffffff', true), pp.x, pp.y, 130, 0.4 * lights);
    // פנסי רכב
    const cn = cone();
    for (const c of view.cars) {
      if (c.dead) continue;
      if (c.burnT > 0) { spot(glow('#ff9a3d', true), c.x, c.y, 170, 0.9); continue; }
      if (!c.driver && !c.ai) continue;
      const cs = Math.cos(c.ang), sn = Math.sin(c.ang), hx = c.x + cs * c.d.len * 0.42, hy = c.y + sn * c.d.len * 0.42;
      L.setTransform(s * cs, s * sn, -s * sn, s * cs, s * hx + tx, s * hy + ty);
      L.globalAlpha = Math.min(1, lights * 1.05); L.drawImage(cn, 0, -150, 300, 300);
      L.setTransform(s, 0, 0, s, tx, ty);
      spot(glow('#ff5040', true), c.x - cs * c.d.len * 0.5, c.y - sn * c.d.len * 0.5, c.brake ? 52 : 34, (c.brake ? 0.8 : 0.45) * lights);
      if ((c.ai && c.ai.cop && G.wanted > 0) || c.block) spot(glow(Math.floor(time * 6) % 2 ? '#ff3030' : '#3060ff', true), c.x, c.y, 190, 0.85);
    }
    // ניאון נשפך על המדרכה
    for (const b of view.neon) { L.globalAlpha = 0.5 * lights * (0.85 + 0.15 * Math.sin(time * 3 + b.seed)); L.drawImage(glow(b.neon, true), b.x - 95, b.y - 95, b.w + 190, b.h + 190); }
    for (const m of marks) if (m.kind !== 'car' && m.kind !== 'enemy' && m.kind !== 'rival') spot(glow(mc(m), true), m.x, m.y, 150, 0.55);
    for (const kx of ['spray', 'spray2']) spot(glow('#3dff9e', true), M.special[kx].x, M.special[kx].y, 130, 0.5);
    for (let i = 0; i < NC.PKGS.length; i++) { if (G.pkgs.includes(i)) continue; const p = NC.PKGS[i]; if (Math.abs(p.x - cam.x) < 1100 && Math.abs(p.y - cam.y) < 900) spot(glow('#ffe14d', true), p.x, p.y, 90, 0.6); }
    for (const sg of view.signals) spot(glow(sg.col, true), sg.x, sg.y, 46, 0.5 * lights);
    let gl = 0; for (const p of G.parts) { if (p.glow && p.kind === 0 && gl++ < 26) spot(glow('#ffb060', true), p.x, p.y, 34 + p.r * 4, 0.5 * (p.life / p.max)); }
    const H = G.heli;
    if (H && H.on) spot(glow('#eaf4ff', true), H.lx, H.ly, 170, 0.95);
    L.globalAlpha = 1;
  }

  // אורות שנראים בעצמם (מעל החושך): פנסים, זנבות, מהבהבים, אש, השתקפויות ברטוב
  function drawEmissive(view, lights, time) {
    ctx.globalCompositeOperation = 'lighter';
    const haze = 1 + Wx.fog * 1.6 + Wx.rain * 0.5, wet = Q.refl ? Wx.wet : 0;
    if (lights > 0.05) {
      const lamp = glow('#ffd9a0', true);
      for (const l of view.lamps) {
        ctx.globalAlpha = Math.min(1, 0.85 * lights); ctx.drawImage(lamp, l.x - 20, l.y - 20, 40, 40);
        ctx.globalAlpha = Math.min(1, 0.16 * lights * haze); ctx.drawImage(lamp, l.x - 80, l.y - 80, 160, 160);
        if (wet > 0.25) { ctx.globalAlpha = 0.2 * lights * wet; ctx.drawImage(lamp, l.x - 13, l.y + 6, 26, 130); }
      }
    }
    const white = glow('#fff6d6', true), red = glow('#ff3020', true), cn = cone();
    for (const c of view.cars) {
      if (c.dead) continue;
      const cs = Math.cos(c.ang), sn = Math.sin(c.ang), L = c.d.len, hw = c.d.wid / 2 - 4;
      const on = c.driver || c.ai;
      if (on && lights > 0.05) {
        const hx = c.x + cs * L * 0.46, hy = c.y + sn * L * 0.46;
        ctx.globalAlpha = Math.min(1, lights);
        ctx.drawImage(white, hx - sn * hw - 9, hy + cs * hw - 9, 18, 18); ctx.drawImage(white, hx + sn * hw - 9, hy - cs * hw - 9, 18, 18);
        // אלומת אור נראית באבק, בערפל ובגשם
        ctx.setTransform(cam.k * cs, cam.k * sn, -cam.k * sn, cam.k * cs, cam.k * hx + cam.ox, cam.k * hy + cam.oy);
        ctx.globalAlpha = Math.min(0.6, lights * 0.13 * haze); ctx.drawImage(cn, 0, -120, 240, 240);
        ctx.setTransform(cam.k, 0, 0, cam.k, cam.ox, cam.oy);
        if (wet > 0.25) { ctx.globalAlpha = 0.16 * lights * wet; ctx.drawImage(white, hx + cs * 40 - 16, hy + sn * 40 - 16, 32, 100); }
      }
      const tx = c.x - cs * L * 0.5, ty = c.y - sn * L * 0.5;
      if (on && (lights > 0.05 || c.brake)) {
        const r = c.brake ? 15 : 9; ctx.globalAlpha = c.brake ? Math.max(0.55, lights) : 0.8 * lights;
        ctx.drawImage(red, tx - sn * hw - r, ty + cs * hw - r, r * 2, r * 2); ctx.drawImage(red, tx + sn * hw - r, ty - cs * hw - r, r * 2, r * 2);
      }
      if (c.blink && Math.floor(time * 2.6) % 2) {
        const o = glow('#ffa020', true), sd = c.blink > 0 ? 1 : -1;
        ctx.globalAlpha = 0.5 + 0.4 * lights;
        ctx.drawImage(o, c.x + cs * L * 0.46 - sn * hw * sd - 9, c.y + sn * L * 0.46 + cs * hw * sd - 9, 18, 18); ctx.drawImage(o, tx - sn * hw * sd - 9, ty + cs * hw * sd - 9, 18, 18);
      }
      if ((c.ai && c.ai.cop && G.wanted > 0) || c.block) { // מהבהבים – נראים גם ביום
        const fl = Math.floor(time * 6) % 2;
        ctx.globalAlpha = 0.3 + 0.45 * lights; ctx.drawImage(glow(fl ? '#ff2828' : '#3a6aff', true), c.x - 95, c.y - 95, 190, 190);
        ctx.globalAlpha = 0.9; ctx.drawImage(glow(fl ? '#ff5050' : '#6a90ff', true), c.x - 16, c.y - 16, 32, 32);
      }
    }
    // חלקיקים זוהרים: אש וניצוצות
    ctx.lineCap = 'round';
    for (const p of G.parts) {
      if (!p.glow) continue;
      const a = Math.max(0, p.life / p.max) * p.a;
      if (p.kind === 1) { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.r; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke(); }
      else if (p.kind === 3) { ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.r), 0, TAU); ctx.stroke(); }
      else { const r = Math.max(1, p.r) * 2.1; ctx.globalAlpha = a; ctx.drawImage(glow(p.color, false), p.x - r, p.y - r, r * 2, r * 2); }
    }
    for (const sg of view.signals) { ctx.globalAlpha = 0.55 + 0.4 * lights; ctx.drawImage(glow(sg.col, true), sg.x - 9, sg.y - 9, 18, 18); }
    const H = G.heli;
    if (H && H.on && lights > 0.1) { ctx.globalAlpha = 0.16 * lights * haze; ctx.drawImage(glow('#eaf4ff', true), H.lx - 150, H.ly - 150, 300, 300); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // חלקיקים רגילים: עשן, אבק, שברים, טבעות, קונפטי
  function drawParticles() {
    for (const p of G.parts) {
      if (p.glow) continue;
      const a = Math.max(0, p.life / p.max) * p.a;
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      if (p.kind === 0) { const r = Math.max(1, p.r) * 1.35; ctx.drawImage(glow(p.color, false), p.x - r, p.y - r, r * 2, r * 2); }
      else if (p.kind === 3) { ctx.strokeStyle = p.color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.r), 0, TAU); ctx.stroke(); }
      else { // שבר או קונפטי – מלבן מסתובב
        const c = Math.cos(p.rot), s = Math.sin(p.rot), w = p.r, h = p.kind === 4 ? p.r * 0.5 * Math.abs(Math.cos(p.rot * 1.7)) + 0.6 : p.r * 0.6;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(p.x - c * w + s * h, p.y - s * w - c * h); ctx.lineTo(p.x + c * w + s * h, p.y + s * w - c * h); ctx.lineTo(p.x + c * w - s * h, p.y + s * w + c * h); ctx.lineTo(p.x - c * w - s * h, p.y - s * w + c * h); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // צללי עננים נודדים
  function drawCloudShadows(time, hw, hh) {
    const a = (0.1 + 0.2 * Wx.cloud) * clamp((ambLum - 0.45) * 3, 0, 1);
    if (a < 0.02) return;
    const spr = cloudSprite(), CELL = 1150, sx = time * (14 + 40 * Wx.wind), sy = -time * 6;
    const c0 = Math.floor((cam.x - hw - sx - 700) / CELL), c1 = Math.floor((cam.x + hw - sx + 700) / CELL), r0 = Math.floor((cam.y - hh - sy - 700) / CELL), r1 = Math.floor((cam.y + hh - sy + 700) / CELL);
    ctx.globalAlpha = a;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const h1 = hash(c, r * 7 + 3), h2 = hash(c * 3 + 1, r), sz = 520 + hash(c + 9, r + 5) * 520;
      if (h1 > 0.35 + Wx.cloud * 0.6) continue;
      ctx.drawImage(spr, c * CELL + h1 * 700 + sx - sz / 2, r * CELL + h2 * 700 + sy - sz * 0.35, sz, sz * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  // גשם, ערפל, ברק ווינייטה – במרחב המסך
  function drawWeather(dt, hw, hh) {
    const rain = Wx.rain;
    if (rain > 0.03) {
      // טבעות קטנות על הקרקע
      const n = rain * 70 * Q.rain * dt;
      for (let q = Math.random() < n % 1 ? Math.ceil(n) : Math.floor(n); q > 0; q--) Fx.ring(cam.x + (Math.random() * 2 - 1) * hw, cam.y + (Math.random() * 2 - 1) * hh, 2, '#dcecff', 30, 0.34);
      const cnt = Math.round(rain * Q.rain * Math.min(380, cw * ch / 2600)), len = 15 + 15 * rain, dx = -(5 + 11 * Wx.wind) * (1 + Wx.gust * 0.2);
      ctx.strokeStyle = `rgba(210,228,255,${(0.2 + 0.2 * rain).toFixed(3)})`; ctx.lineWidth = 1.1; ctx.beginPath();
      for (let q = 0; q < cnt; q++) { const x = Math.random() * (cw + 40), y = Math.random() * (ch + 30) - 30; ctx.moveTo(x, y); ctx.lineTo(x + dx, y + len); }
      ctx.stroke();
    }
    if (Wx.fog > 0.02) {
      const f = Wx.fog, r = Math.min(255, 205 * amb[0] + 20) | 0, g = Math.min(255, 212 * amb[1] + 20) | 0, b = Math.min(255, 224 * amb[2] + 22) | 0;
      ctx.fillStyle = `rgba(${r},${g},${b},${(f * 0.3).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch);
      const gr = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.16, cw / 2, ch / 2, Math.max(cw, ch) * 0.62);
      gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(1, `rgba(${r},${g},${b},${(f * 0.72).toFixed(3)})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
    }
    if (Wx.flash > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(215,228,255,${(Wx.flash * 0.3).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch); ctx.globalCompositeOperation = 'source-over'; }
    if (!vignette) {
      vignette = document.createElement('canvas'); vignette.width = 256; vignette.height = Math.max(64, Math.round(256 * ch / cw));
      const g = vignette.getContext('2d'), w = 256, h = vignette.height;
      g.setTransform(1, 0, 0, h / w, 0, 0);
      const gr = g.createRadialGradient(128, 128, 128 * 0.62, 128, 128, 128 * 1.42); gr.addColorStop(0, 'rgba(6,4,24,0)'); gr.addColorStop(1, 'rgba(6,4,24,1)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
    ctx.globalAlpha = 0.32 + 0.3 * (1 - ambLum) + Wx.rain * 0.12; ctx.drawImage(vignette, 0, 0, cw, ch); ctx.globalAlpha = 1;
  }

  function drawHeli(H, time, lights) {
    const s = 1 + 330 * HF, x = cam.x + (H.x - cam.x) * s, y = cam.y + (H.y - cam.y) * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(H.ang);
    ctx.fillStyle = A('#1d2f55'); ctx.fillRect(-52, -3, 34, 6); ctx.fillRect(-56, -11, 7, 22);
    ctx.fillStyle = A('#f4f6f8'); ctx.beginPath(); ctx.ellipse(0, 0, 26, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = A('#1d2f55'); ctx.beginPath(); ctx.ellipse(-3, 0, 17, 14, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    ctx.fillStyle = '#16202e'; ctx.beginPath(); ctx.ellipse(12, 0, 11, 9, 0, -1.2, 1.2); ctx.fill();
    ctx.rotate(time * 31);
    ctx.strokeStyle = 'rgba(30,30,36,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.moveTo(0, -50); ctx.lineTo(0, 50); ctx.stroke();
    ctx.fillStyle = 'rgba(200,210,230,0.1)'; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fill();
    ctx.restore();
    if (Math.floor(time * 3) % 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(glow('#ff3030', true), x - 12, y - 12, 24, 24); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }

  // ---------------- ציור ראשי ----------------
  const view = { lamps: [], cars: [], neon: [], signals: [] };
  function draw(dt) {
    frame++;
    const P = G.player, pp = NC.world.playerPos(), time = G.time;
    // מצלמה
    const sp = NC.world.playerSpeed();
    const vx = P.car ? P.car.vx : P.vx, vy = P.car ? P.car.vy : P.vy;
    const tx = pp.x + clamp(vx * 0.4, -190, 190), ty = pp.y + clamp(vy * 0.4, -190, 190);
    const kf = Math.min(1, dt * 4.5);
    if (Math.abs(tx - cam.x) > 1500 || Math.abs(ty - cam.y) > 1500) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * kf; cam.y += (ty - cam.y) * kf; }
    const tz = P.car ? lerp(1.02, 0.74, clamp(sp / 480, 0, 1)) : 1.3;
    cam.zoom += (tz - cam.zoom) * Math.min(1, dt * 2);
    const k = cam.k = base * cam.zoom * dpr;
    const shk = NC.settings.shake ? G.shake : 0;
    const shx = shk ? (Math.random() - 0.5) * shk * dpr : 0, shy = shk ? (Math.random() - 0.5) * shk * dpr : 0;
    const ox = cam.ox = canvas.width / 2 - cam.x * k + shx, oy = cam.oy = canvas.height / 2 - cam.y * k + shy;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const hw = canvas.width / (2 * k), hh = canvas.height / (2 * k);
    const i0 = Math.floor((cam.x - hw) / T) - 1, i1 = Math.floor((cam.x + hw) / T) + 1, j0 = Math.floor((cam.y - hh) / T) - 1, j1 = Math.floor((cam.y + hh) / T) + 1;
    computeAmbient(G.clock); computeSun(G.clock);
    const lights = clamp(Math.max(nightAmount(G.clock), Wx.gloom() * 1.15), 0, 1);
    const marks = NC.mission.markers();

    drawGround(i0, j0, i1, j1);
    drawGroundLive(i0, j0, i1, j1, time);

    // סימני צמיגים ופיח
    ctx.lineCap = 'round';
    for (const s of G.skids) {
      if (s.scorch) { const g = ctx.createRadialGradient(s.x1, s.y1, 5, s.x1, s.y1, s.r); g.addColorStop(0, `rgba(15,12,10,${Math.min(0.6, s.life / 20)})`); g.addColorStop(1, 'rgba(15,12,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x1, s.y1, s.r, 0, TAU); ctx.fill(); continue; }
      if (Math.abs(s.x1 - cam.x) > hw + 40 || Math.abs(s.y1 - cam.y) > hh + 40) continue;
      ctx.strokeStyle = `rgba(15,15,15,${Math.min(0.4, s.life / 10)})`; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }

    drawMarkers(time, marks);

    // פנסי רחוב ורמזורים (העמודים)
    view.lamps.length = 0; view.cars.length = 0; view.neon.length = 0; view.signals.length = 0;
    for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
      if (!M.inb(i, j)) continue;
      for (const l of M.lGrid[M.idx(i, j)]) { view.lamps.push(l); ctx.fillStyle = '#2d3238'; ctx.beginPath(); ctx.arc(l.x, l.y, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = lights > 0.2 ? '#ffe9a8' : '#cfd4da'; ctx.beginPath(); ctx.arc(l.x, l.y, 2, 0, TAU); ctx.fill(); }
      if (M.signalAt && M.signalAt(i, j)) {
        const ph = M.lightPhase(i, j, time), m = M.conn(i, j), x = i * T, y = j * T;
        const ns = ph === 0 ? '#35e06a' : ph === 1 ? '#ffc93d' : '#ff4040', ew = ph === 3 ? '#35e06a' : ph === 4 ? '#ffc93d' : '#ff4040';
        // ראש רמזור לכל כיוון הגעה, בצד ימין של הנתיב
        const put = (sx, sy, col) => { ctx.fillStyle = '#1c1f24'; ctx.fillRect(sx - 5, sy - 5, 10, 10); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, TAU); ctx.fill(); view.signals.push({ x: sx, y: sy, col }); };
        if (m & 1) put(x + SW - 6, y + SW - 6, ns); if (m & 4) put(x + T - SW + 6, y + T - SW + 6, ns);
        if (m & 2) put(x + T - SW + 6, y + SW - 6, ew); if (m & 8) put(x + SW - 6, y + T - SW + 6, ew);
      }
    }

    // הולכי רגל
    const umb = Wx.rain > 0.15;
    for (const p of G.peds) {
      if (Math.abs(p.x - cam.x) > hw + 40 || Math.abs(p.y - cam.y) > hh + 40) continue;
      drawPed(p.x, p.y, p.ang, p.ph, p.shirt, p.skin, p.hair, { down: p.st === 'down', moving: p.st !== 'wait' && p.st !== 'hold' && p.st !== 'idle', wave: p.st === 'wait', cop: !!p.cop, umb: umb && p.st !== 'down' && p.st !== 'flee' && !p.cop ? p.umb : null });
      if (p.st === 'wait') { ctx.fillStyle = '#ff3fa4'; const by = p.y - 26 - Math.abs(Math.sin(time * 4)) * 6; ctx.beginPath(); ctx.moveTo(p.x, by + 9); ctx.lineTo(p.x - 7, by); ctx.lineTo(p.x + 7, by); ctx.closePath(); ctx.fill(); }
    }
    if (!P.car) drawPed(P.x, P.y, P.ang, P.walk, '#ff4fa3', '#e0ac69', '#fff', { player: true, moving: Math.hypot(P.vx, P.vy) > 10, down: !!G.dead && G.dead.kind === 'wasted' });

    // מכוניות
    for (const c of G.cars) {
      if (Math.abs(c.x - cam.x) > hw + 320 || Math.abs(c.y - cam.y) > hh + 320) continue;
      view.cars.push(c);
      if (Math.abs(c.x - cam.x) > hw + 60 || Math.abs(c.y - cam.y) > hh + 60) continue;
      drawCar(c, time);
    }
    ctx.setTransform(k, 0, 0, k, ox, oy);
    // רמז כניסה לרכב
    if (!P.car && !G.dead) {
      const c = NC.world.nearestEnterable();
      if (c) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time * 20; ctx.beginPath(); ctx.arc(c.x, c.y, c.d.len / 2 + 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      NC.ui.nearCar(!!c);
    } else NC.ui.nearCar(false);

    // אוספים בניינים ועצים – מהרחוק לקרוב
    objs.length = 0;
    for (let j = j0 - 3; j <= j1 + 3; j++) for (let i = i0 - 3; i <= i1 + 3; i++) {
      if (!M.inb(i, j)) continue;
      const kk = M.idx(i, j);
      for (const b of M.bGrid[kk]) { if (b._f === frame) continue; b._f = frame; b._d = Math.max(Math.abs(b.x + b.w / 2 - cam.x), Math.abs(b.y + b.h / 2 - cam.y)); objs.push(b); if (b.neon && lights > 0.25) view.neon.push(b); }
      for (const t of M.tGrid[kk]) { t._d = Math.max(Math.abs(t.x - cam.x), Math.abs(t.y - cam.y)) - 30; objs.push(t); }
    }
    objs.sort((a, b) => b._d - a._d);

    drawShadows(objs);
    const H = G.heli;
    if (H && H.on) { ctx.fillStyle = `rgba(8,12,40,${(0.12 + sun.a * 0.5).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(H.x + sun.ox * 120, H.y + sun.oy * 120, 30, 16, H.ang, 0, TAU); ctx.fill(); }
    if (Q.clouds) drawCloudShadows(time, hw, hh);
    drawParticles();

    // אור: מכפילים את שכבת הקרקע במפת התאורה, ואז מוסיפים את האורות עצמם
    if (ambKey !== 0x3ffff || lights > 0.03) {
      buildLightmap(view, lights, time, marks);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(lightCv, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(k, 0, 0, k, ox, oy);
    }
    drawEmissive(view, lights, time);

    for (const o of objs) { if (o.type) drawTree(o, time, pp, dt); else drawBuilding(o, lights, pp, time); }
    drawBeacons(time, marks);
    if (H && H.on) drawHeli(H, time, lights);

    // טקסט צף
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px sans-serif';
    for (const f of G.floaters) { ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, f.x + 1.5, f.y + 1.5); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWeather(dt, hw, hh);

    // חץ כיוון ליעד
    const tg = NC.mission.target();
    if (tg) {
      const dx = tg.x - pp.x, dy = tg.y - pp.y;
      let d = Math.hypot(dx, dy);
      if (d > 260) {
        // החץ מראה את הדרך בכבישים (הפנייה הבאה), לא קו אווירי דרך הבניינים
        let ax = tg.x, ay = tg.y;
        const gp = NC.mission.gps();
        if (gp) {
          d = gp.len; let acc = 0;
          for (let q = 1; q < gp.pts.length; q++) {
            const a0 = gp.pts[q - 1], a1 = gp.pts[q], L = Math.hypot(a1.x - a0.x, a1.y - a0.y);
            if (acc + L >= 380) { const f = (380 - acc) / L; ax = a0.x + (a1.x - a0.x) * f; ay = a0.y + (a1.y - a0.y) * f; break; }
            acc += L; ax = a1.x; ay = a1.y;
          }
        }
        const a = Math.atan2(ay - pp.y, ax - pp.x), R = Math.min(cw, ch) * 0.33;
        const px = cw / 2 + (pp.x - cam.x) * k / dpr + Math.cos(a) * R, py = ch / 2 + (pp.y - cam.y) * k / dpr + Math.sin(a) * R;
        ctx.save(); ctx.translate(px, py); ctx.rotate(a);
        ctx.fillStyle = mc(tg); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, 11); ctx.lineTo(-4, 0); ctx.lineTo(-10, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(Math.round(d / 10) + ' m', px + 1, py + 25); ctx.fillStyle = '#fff'; ctx.fillText(Math.round(d / 10) + ' m', px, py + 24);
      }
    }
    // הבזק פגיעה
    if (G.hurtFlash > 0) {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,20,20,${Math.min(0.55, G.hurtFlash * 1.4)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    drawRadar(time, marks);
  }

  function drawRadar(time, marks) {
    const S = radar.width, c = S / 2, g = rctx, pp = NC.world.playerPos();
    const range = 1050, sc = c / range; // פיקסלים ליחידת עולם
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(c, c, c - 3, 0, TAU); g.clip();
    g.fillStyle = '#16323f'; g.fillRect(0, 0, S, S);
    const ms = sc * T / MMP;
    g.imageSmoothingEnabled = false;
    g.drawImage(mm, c - (pp.x / (T / MMP)) * ms, c - (pp.y / (T / MMP)) * ms, mm.width * ms, mm.height * ms);
    const nt = nightAmount(G.clock);
    if (nt > 0.05) { g.fillStyle = `rgba(8,10,48,${(nt * 0.35).toFixed(3)})`; g.fillRect(0, 0, S, S); }
    const put = (x, y, edge) => {
      let dx = (x - pp.x) * sc, dy = (y - pp.y) * sc; const d = Math.hypot(dx, dy), mx = c - 9 * (S / 150);
      if (d > mx) { if (!edge) return null; dx = dx / d * mx; dy = dy / d * mx; }
      return [c + dx, c + dy];
    };
    const u = S / 150;
    // אזור החיפוש של המשטרה כשאיבדו אותך
    if (G.wanted > 0 && G.lkp && G.hideT > 1) { const p = put(G.lkp.x, G.lkp.y, false); if (p) { g.strokeStyle = 'rgba(255,225,77,0.8)'; g.fillStyle = 'rgba(255,225,77,0.14)'; g.lineWidth = 1.5 * u; g.beginPath(); g.arc(p[0], p[1], 420 * sc, 0, TAU); g.fill(); g.stroke(); } }
    for (const k of ['spray', 'spray2']) { const p = put(M.special[k].x, M.special[k].y, false); if (p) { g.fillStyle = '#3dff9e'; g.fillRect(p[0] - 3 * u, p[1] - 3 * u, 6 * u, 6 * u); } }
    // קו ניווט אל היעד, לאורך הכבישים
    const gp = NC.mission.gps();
    if (gp) {
      g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
      gp.pts.forEach((q, n) => { const x = c + (q.x - pp.x) * sc, y = c + (q.y - pp.y) * sc; if (n) g.lineTo(x, y); else g.moveTo(x, y); });
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 5.5 * u; g.stroke();
      g.strokeStyle = gp.col || mcol(gp.kind); g.lineWidth = 2.8 * u; g.stroke();
    }
    for (const m of marks) {
      const p = put(m.x, m.y, m.kind !== 'next' && m.kind !== 'job' && m.kind !== 'heal'); if (!p) continue;
      g.fillStyle = mc(m); g.strokeStyle = '#000'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.arc(p[0], p[1], (m.kind === 'next' || m.kind === 'item' || m.kind === 'rival' ? 3.2 : 5.5) * u, 0, TAU); g.fill(); g.stroke();
      if (m.label) { g.fillStyle = '#000'; g.font = `bold ${8 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.label, p[0], p[1] + 0.5 * u); }
    }
    if (G.wanted > 0) {
      for (const cc of G.cars) { if (!((cc.ai && cc.ai.cop) || cc.block) || cc.dead) continue; const p = put(cc.x, cc.y, false); if (p) { g.fillStyle = Math.floor(time * 5) % 2 ? '#ff3b3b' : '#4d8dff'; g.beginPath(); g.arc(p[0], p[1], 3.5 * u, 0, TAU); g.fill(); } }
      for (const q of G.peds) { if (!q.cop) continue; const p = put(q.x, q.y, false); if (p) { g.fillStyle = '#4d8dff'; g.beginPath(); g.arc(p[0], p[1], 2.2 * u, 0, TAU); g.fill(); } }
      const H = G.heli;
      if (H && H.on) { const p = put(H.x, H.y, true); if (p) { g.strokeStyle = '#fff'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(p[0] - 5 * u, p[1] - 5 * u); g.lineTo(p[0] + 5 * u, p[1] + 5 * u); g.moveTo(p[0] + 5 * u, p[1] - 5 * u); g.lineTo(p[0] - 5 * u, p[1] + 5 * u); g.stroke(); } }
    }
    // השחקן
    g.translate(c, c); g.rotate(G.player.ang);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * u; g.beginPath(); g.moveTo(8 * u, 0); g.lineTo(-5 * u, 5 * u); g.lineTo(-2 * u, 0); g.lineTo(-5 * u, -5 * u); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.strokeStyle = G.wanted > 0 && G.hideT < 0.5 ? (Math.floor(time * 5) % 2 ? '#ff3b3b' : '#4d8dff') : G.wanted > 0 ? '#ffe14d' : 'rgba(255,255,255,0.85)';
    g.lineWidth = 4 * u; g.beginPath(); g.arc(c, c, c - 3 * u, 0, TAU); g.stroke();
    // צפון
    g.fillStyle = '#fff'; g.font = `bold ${9 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', c, 12 * u);
  }

  // מפה גדולה למסך ההשהיה
  function drawBigMap(cv) {
    const g = cv.getContext('2d'), S = cv.width, sc = S / mm.width;
    g.imageSmoothingEnabled = false; g.drawImage(mm, 0, 0, S, S);
    const w2 = (x) => x / (T / MMP) * sc;
    // שמות השכונות
    g.font = `bold ${Math.round(S / 36)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [name, i, j] of [['GLASS TOWERS', 38, 12], ['PALM HEIGHTS', 11, 30], ['COLOR MARKET', 40, 36], ['OLD PORT', 28, 53], ['NEON STRIP', 53, 20], ['FLAMINGO PARK', 26.5, 26.5]]) {
      g.save(); g.translate(w2(i * T), w2(j * T)); if (name === 'NEON STRIP') g.rotate(Math.PI / 2);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(name, 1, 1); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(name, 0, 0); g.restore();
    }
    const dot = (x, y, col, r, label) => { g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(w2(x), w2(y), r, 0, TAU); g.fill(); g.stroke(); if (label) { g.fillStyle = '#000'; g.font = `bold ${r * 1.3}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w2(x), w2(y) + 1); } };
    for (const k of ['spray', 'spray2']) dot(M.special[k].x, M.special[k].y, '#3dff9e', 6, '');
    dot(M.special.hospital.x, M.special.hospital.y, '#ffffff', 7, '+');
    dot(M.special.police.x, M.special.police.y, '#4d8dff', 7, '★');
    dot(M.special.home.x, M.special.home.y, '#ffd8a8', 7, '⌂');
    for (let i = 0; i < NC.PKGS.length; i++) if (G.pkgs.includes(i)) dot(NC.PKGS[i].x, NC.PKGS[i].y, '#ff9ecf', 3.5, '');
    const gp = NC.mission.gps();
    if (gp) {
      g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
      gp.pts.forEach((q, n) => { if (n) g.lineTo(w2(q.x), w2(q.y)); else g.moveTo(w2(q.x), w2(q.y)); });
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 7; g.stroke(); g.strokeStyle = gp.col || mcol(gp.kind); g.lineWidth = 3.5; g.stroke();
    }
    for (const m of NC.mission.markers()) if (m.kind !== 'next') dot(m.x, m.y, mc(m), m.kind === 'item' || m.kind === 'rival' ? 5 : 9, m.label && m.label.length === 1 ? m.label : '');
    const pp = NC.world.playerPos();
    g.save(); g.translate(w2(pp.x), w2(pp.y)); g.rotate(G.player.ang); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, 8); g.lineTo(-3, 0); g.lineTo(-8, -8); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  NC.render = {
    resize, draw, drawBigMap, canvas, setQuality, QUAL,
    get quality() { return qLevel; },
    // לבדיקות: מצב התאורה הנוכחי
    debug() { return { amb: amb.slice(), ambLum, sun: { ...sun }, chunks: chunks.size, chunkScale, dpr, q: qLevel }; },
  };
})();
