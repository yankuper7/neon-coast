/* חוף ניאון – ציור: קרקע, בניינים בפרספקטיבה, מכוניות, תאורת לילה, מכ"ם */
'use strict';
(() => {
  const NC = window.NC;
  const { clamp, lerp, TAU, shade, hexA, hash } = NC;
  const M = NC.map, T = M.T, N = M.N, G = NC.G, CARS = NC.CARS;
  const canvas = NC.$('game'), ctx = canvas.getContext('2d');
  const radar = NC.$('radar'), rctx = radar.getContext('2d');
  const cam = NC.cam = { x: 0, y: 0, zoom: 1.2, k: 1 };
  let cw = 800, ch = 600, dpr = 1, base = 1, frame = 0;
  const HF = 0.0007, SW = 18;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    base = Math.min(cw, ch) / (cw > ch ? 800 : 560);
    const rs = radar.clientWidth || 150;
    radar.width = radar.height = Math.round(rs * dpr);
    lightCv = null;
  }

  // ---------------- מפה קטנה ----------------
  const mm = document.createElement('canvas');
  const MMP = 4;
  (function buildMinimap() {
    mm.width = mm.height = N * MMP;
    const g = mm.getContext('2d');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const t = M.tiles[M.idx(i, j)];
      g.fillStyle = t === M.ROAD ? '#9aa0a8' : t === M.WATER ? '#1b6f8f' : t === M.SAND ? '#cdbb85' : t === M.PARK ? '#3f8d3a' : t === M.GLADE ? '#2f6233'
        : { palms: '#3d6e34', downtown: '#454d57', strip: '#6b5a4a', market: '#5e5346', port: '#474c50' }[M.districtAt((i + 0.5) * T, (j + 0.5) * T)] || '#444';
      g.fillRect(i * MMP, j * MMP, MMP, MMP);
    }
  })();

  // ---------------- תמונות מכוניות שמורות ----------------
  const SPR = 2.5, carSprites = new Map();
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function paintCar(g, type, color, dead) {
    const d = CARS[type], L = d.len, Wd = d.wid, hw = Wd / 2;
    if (dead) color = '#2a2a2a';
    // גלגלים
    g.fillStyle = '#111';
    for (const sx of [-0.3, 0.3]) for (const sy of [-1, 1]) g.fillRect(L * sx - 5, sy * hw - (sy > 0 ? 1.5 : 2), 10, 3.5);
    // מרכב
    const bg = g.createLinearGradient(0, -hw, 0, hw);
    bg.addColorStop(0, shade(color, -0.32)); bg.addColorStop(0.5, shade(color, 0.22)); bg.addColorStop(1, shade(color, -0.32));
    rrect(g, -L / 2, -hw, L, Wd, type === 'van' ? 4 : 7); g.fillStyle = bg; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.stroke();
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
      // שמשות וגג
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

  // ---------------- שעון ותאורה ----------------
  function nightAmount(h) {
    if (h >= 20.5 || h < 5) return 1;
    if (h >= 18.5) return (h - 18.5) / 2;
    if (h < 6.5) return 1 - (h - 5) / 1.5;
    return 0;
  }
  function duskTint(h) {
    const bump = (c, w) => Math.max(0, 1 - Math.abs(h - c) / w);
    const s = bump(19.2, 1.9), d = bump(5.9, 1.2);
    if (s > 0) return `rgba(255,95,110,${(s * 0.24).toFixed(3)})`;
    if (d > 0) return `rgba(255,170,110,${(d * 0.16).toFixed(3)})`;
    return null;
  }
  NC.nightAmount = nightAmount;

  // ---------------- קרקע ----------------
  function drawGround(i0, j0, i1, j1, time) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * T, y = j * T;
      if (!M.inb(i, j)) { ctx.fillStyle = '#1b98bd'; ctx.fillRect(x, y, T + 1, T + 1); continue; }
      const k = M.idx(i, j), t = M.tiles[k];
      if (t === M.ROAD) {
        const m = M.conn(i, j);
        ctx.fillStyle = '#3b3e44'; ctx.fillRect(x, y, T + 1, T + 1);
        ctx.fillStyle = '#b9b5ab';
        if (!(m & 1)) ctx.fillRect(x, y, T + 1, SW); if (!(m & 4)) ctx.fillRect(x, y + T - SW, T + 1, SW + 1);
        if (!(m & 8)) ctx.fillRect(x, y, SW, T + 1); if (!(m & 2)) ctx.fillRect(x + T - SW, y, SW + 1, T + 1);
        if ((m & 1) && (m & 2)) ctx.fillRect(x + T - SW, y, SW + 1, SW); if ((m & 2) && (m & 4)) ctx.fillRect(x + T - SW, y + T - SW, SW + 1, SW + 1);
        if ((m & 4) && (m & 8)) ctx.fillRect(x, y + T - SW, SW, SW + 1); if ((m & 8) && (m & 1)) ctx.fillRect(x, y, SW, SW);
        ctx.fillStyle = '#8e8a80';
        if (!(m & 1)) ctx.fillRect(x, y + SW - 2, T + 1, 2); if (!(m & 4)) ctx.fillRect(x, y + T - SW, T + 1, 2);
        if (!(m & 8)) ctx.fillRect(x + SW - 2, y, 2, T + 1); if (!(m & 2)) ctx.fillRect(x + T - SW, y, 2, T + 1);
        if (m === 10) { ctx.fillStyle = '#e6d68a'; for (let q = 0; q < 3; q++) ctx.fillRect(x + 9 + q * 40, y + T / 2 - 1.5, 22, 3); }
        else if (m === 5) { ctx.fillStyle = '#e6d68a'; for (let q = 0; q < 3; q++) ctx.fillRect(x + T / 2 - 1.5, y + 9 + q * 40, 3, 22); }
        else if (M.connCount(m) >= 3) { // מעברי חצייה
          ctx.fillStyle = 'rgba(240,240,240,0.82)';
          for (let q = 0; q < 6; q++) {
            const o = SW + 6 + q * 13;
            if (m & 8) ctx.fillRect(x + 3, y + o, 12, 7); if (m & 2) ctx.fillRect(x + T - 15, y + o, 12, 7);
            if (m & 1) ctx.fillRect(x + o, y + 3, 7, 12); if (m & 4) ctx.fillRect(x + o, y + T - 15, 7, 12);
          }
        }
      } else if (t === M.WATER) {
        ctx.fillStyle = '#1b98bd'; ctx.fillRect(x, y, T + 1, T + 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let q = 0; q < 2; q++) {
          const wx = x + hash(k, q) * 80 + Math.sin(time * 0.8 + k + q) * 8, wy = y + 25 + q * 55 + Math.cos(time * 0.6 + k) * 5;
          ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 14, wy - 6, wx + 28, wy);
        }
        ctx.stroke();
        if (M.inb(i - 1, j) && M.tiles[M.idx(i - 1, j)] === M.SAND) { // קצף על קו החוף
          ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(x, y);
          for (let q = 0; q <= 4; q++) ctx.lineTo(x + 7 + Math.sin(time * 1.6 + j * 2 + q * 1.7) * 6, y + q * 30);
          ctx.lineTo(x, y + T); ctx.closePath(); ctx.fill();
        }
        if (M.inb(i, j - 1) && M.tiles[M.idx(i, j - 1)] === M.ROAD) { ctx.fillStyle = '#6d6a63'; ctx.fillRect(x, y, T + 1, 10); }
      } else if (t === M.SAND) {
        ctx.fillStyle = '#efdba0'; ctx.fillRect(x, y, T + 1, T + 1);
        ctx.fillStyle = 'rgba(190,160,100,0.35)';
        for (let q = 0; q < 6; q++) ctx.fillRect(x + hash(k, q) * 112, y + hash(k, q + 9) * 112, 3, 2);
        if (M.inb(i + 1, j) && M.tiles[M.idx(i + 1, j)] === M.WATER) { ctx.fillStyle = 'rgba(160,130,80,0.3)'; ctx.fillRect(x + T - 26, y, 27, T + 1); }
      } else {
        ctx.fillStyle = M.groundColor[k]; ctx.fillRect(x, y, T + 1, T + 1);
        if (t === M.PARK || t === M.GLADE || M.groundColor[k] === '#6dab4d') {
          ctx.fillStyle = 'rgba(20,70,20,0.2)';
          for (let q = 0; q < 5; q++) ctx.fillRect(x + hash(k, q) * 110, y + hash(k, q + 5) * 110, 4, 7);
          ctx.fillStyle = 'rgba(190,240,120,0.18)';
          for (let q = 0; q < 3; q++) ctx.fillRect(x + hash(k, q + 20) * 100, y + hash(k, q + 25) * 100, 14, 5);
          if (t === M.GLADE && hash(k, 40) < 0.45) { ctx.fillStyle = 'rgba(30,90,110,0.55)'; ctx.beginPath(); ctx.ellipse(x + 30 + hash(k, 41) * 60, y + 30 + hash(k, 42) * 60, 26 + hash(k, 43) * 18, 16 + hash(k, 44) * 10, hash(k, 45) * 3, 0, TAU); ctx.fill(); }
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(x + 60, y); ctx.lineTo(x + 60, y + T); ctx.moveTo(x, y + 60); ctx.lineTo(x + T, y + 60); ctx.stroke();
        }
      }
    }
  }

  function drawDecor(i0, j0, i1, j1, time) {
    for (let j = j0 - 3; j <= j1; j++) for (let i = i0 - 3; i <= i1; i++) {
      if (!M.inb(i, j)) continue;
      for (const d of M.dGrid[M.idx(i, j)]) {
        if (d.t === 'pool') {
          ctx.fillStyle = '#f3efe4'; rrect(ctx, d.x - 4, d.y - 4, d.w + 8, d.h + 8, 8); ctx.fill();
          ctx.fillStyle = '#35c3e8'; rrect(ctx, d.x, d.y, d.w, d.h, 6); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
          const wv = Math.sin(time * 2 + d.x) * 3; ctx.moveTo(d.x + 6, d.y + 16 + wv); ctx.lineTo(d.x + d.w - 8, d.y + 14 + wv); ctx.moveTo(d.x + 8, d.y + 36 - wv); ctx.lineTo(d.x + d.w - 6, d.y + 38 - wv); ctx.stroke();
        } else if (d.t === 'parking') {
          ctx.fillStyle = '#4a4d52'; ctx.fillRect(d.x, d.y, d.w, d.h);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          for (let q = 0; q * 44 < d.w - 20; q++) ctx.fillRect(d.x + 4 + q * 44, d.y + 6, 2, 66);
        } else if (d.t === 'plaza') {
          ctx.fillStyle = d.special ? '#d9d2c2' : '#cbc4b4'; ctx.fillRect(d.x, d.y, d.w, d.h);
          ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1; ctx.beginPath();
          for (let q = 30; q < d.w; q += 30) { ctx.moveTo(d.x + q, d.y); ctx.lineTo(d.x + q, d.y + d.h); }
          for (let q = 30; q < d.h; q += 30) { ctx.moveTo(d.x, d.y + q); ctx.lineTo(d.x + d.w, d.y + q); }
          ctx.stroke();
          if (!d.special && d.w > 150 && d.h > 150) { // מזרקה
            const fx = d.x + d.w / 2, fy = d.y + d.h / 2;
            ctx.fillStyle = '#9a958a'; ctx.beginPath(); ctx.arc(fx, fy, 26, 0, TAU); ctx.fill();
            ctx.fillStyle = '#4fc6e6'; ctx.beginPath(); ctx.arc(fx, fy, 21, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(fx, fy, 5 + Math.sin(time * 5) * 2, 0, TAU); ctx.fill();
          }
        } else if (d.t === 'yard') { ctx.fillStyle = '#6d7378'; ctx.fillRect(d.x, d.y, d.w, d.h); }
        else if (d.t === 'pond') {
          ctx.fillStyle = '#d9cfa5'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx + 12, d.ry + 12, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2aa9cf'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(d.x - 50 + Math.sin(time * 0.7) * 10, d.y - 30, 60, 14, 0.2, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3f9b46'; for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(d.x + (hash(q, 1) - 0.5) * d.rx * 1.3, d.y + (hash(q, 2) - 0.5) * d.ry * 1.2, 9, 0.4, TAU); ctx.lineTo(d.x + (hash(q, 1) - 0.5) * d.rx * 1.3, d.y + (hash(q, 2) - 0.5) * d.ry * 1.2); ctx.fill(); }
        } else if (d.t === 'path') { ctx.fillStyle = '#d6c79a'; ctx.fillRect(d.x, d.y, d.w, d.h); }
        else if (d.t === 'umbrella') {
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(d.x + 6, d.y + 8, 20, 0, TAU); ctx.fill();
          ctx.fillStyle = '#4fb7d9'; ctx.fillRect(d.x + 16, d.y + 12, 13, 26);
          for (let q = 0; q < 8; q++) { ctx.fillStyle = q % 2 ? '#ffffff' : d.c; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.arc(d.x, d.y, 20, q * TAU / 8, (q + 1) * TAU / 8); ctx.closePath(); ctx.fill(); }
        }
      }
    }
  }

  // ---------------- דמויות ----------------
  function drawPed(x, y, ang, ph, shirt, skin, hair, opts) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 4, 8, 6, 0, 0, TAU); ctx.fill();
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
    if (opts.wave) { ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(4, -10 - Math.abs(Math.sin(ph * 0.6)) * 3, 2.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawCar(c, night, time) {
    const s = carSprite(c);
    ctx.save(); ctx.translate(c.x + 5, c.y + 7); ctx.rotate(c.ang);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, -c.d.len / 2, -c.d.wid / 2, c.d.len, c.d.wid, 7); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
    ctx.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
    const L = c.d.len, hw = c.d.wid / 2;
    if (!c.dead) {
      const hf = c.hp / c.d.hp;
      if (hf < 0.6) { ctx.fillStyle = `rgba(20,20,20,${(0.6 - hf) * 0.8})`; for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc((hash(q, c.seed) - 0.3) * L * 0.6, (hash(q + 4, c.seed) - 0.5) * hw * 1.4, 3 + hash(q + 8, c.seed) * 4, 0, TAU); ctx.fill(); } }
      if (c.brake) { ctx.fillStyle = 'rgba(255,40,30,0.95)'; ctx.fillRect(-L / 2 - 0.5, -hw + 2, 3, 6); ctx.fillRect(-L / 2 - 0.5, hw - 8, 3, 6); }
      if (c.type === 'police') {
        const on = c.ai && c.ai.cop && G.wanted > 0, fl = Math.floor(time * 6) % 2;
        ctx.fillStyle = on ? (fl ? '#ff2b2b' : '#5a1010') : '#a33'; ctx.fillRect(-4, -hw + 4, 5, hw - 4.5);
        ctx.fillStyle = on ? (fl ? '#10205a' : '#2b6bff') : '#33a'; ctx.fillRect(-4, 0.5, 5, hw - 4.5);
      }
      if (c.hitT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; rrect(ctx, -L / 2, -hw, L, hw * 2, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
  }

  // ---------------- בניינים ועצים בפרספקטיבה ----------------
  const objs = [];
  function wall(ax, ay, bx, by, s, color, b, night) {
    const qx0 = cam.x + (ax - cam.x) * s, qy0 = cam.y + (ay - cam.y) * s, qx1 = cam.x + (bx - cam.x) * s, qy1 = cam.y + (by - cam.y) * s;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(qx1, qy1); ctx.lineTo(qx0, qy0); ctx.closePath(); ctx.fill();
    if (b.kind === 'house' || b.kind === 'box') return;
    const floors = clamp(Math.round(b.z / 28), 1, 12);
    const lit = night > 0.3;
    ctx.lineWidth = lit ? 2.2 : 2.6;
    for (let f = 0; f < floors; f++) {
      const t = (f + 0.55) / floors;
      const x0 = lerp(ax, qx0, t), y0 = lerp(ay, qy0, t), x1 = lerp(bx, qx1, t), y1 = lerp(by, qy1, t);
      if (lit) { ctx.strokeStyle = hash(f, b.seed) < 0.55 ? 'rgba(255,214,120,0.85)' : 'rgba(20,28,45,0.5)'; ctx.setLineDash([7, 5 + hash(f + 3, b.seed) * 9]); ctx.lineDashOffset = hash(f + 7, b.seed) * 20; }
      else { ctx.strokeStyle = 'rgba(25,40,60,0.38)'; ctx.setLineDash([8, 5]); }
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawBuilding(b, night, pp) {
    const s = 1 + b.z * HF;
    const rx = cam.x + (b.x - cam.x) * s, ry = cam.y + (b.y - cam.y) * s, rw = b.w * s, rh = b.h * s;
    const minx = Math.min(b.x, rx), miny = Math.min(b.y, ry), maxx = Math.max(b.x + b.w, rx + rw), maxy = Math.max(b.y + b.h, ry + rh);
    const cover = b.z > 45 && pp.x > minx - 12 && pp.x < maxx + 12 && pp.y > miny - 12 && pp.y < maxy + 12;
    if (cover) ctx.globalAlpha = 0.3;
    if (!b.c1) { b.c1 = shade(b.wall, -0.16); b.c2 = shade(b.wall, -0.34); }
    if (cam.x < b.x) wall(b.x, b.y + b.h, b.x, b.y, s, b.c1, b, night);
    else if (cam.x > b.x + b.w) wall(b.x + b.w, b.y, b.x + b.w, b.y + b.h, s, b.c1, b, night);
    if (cam.y < b.y) wall(b.x, b.y, b.x + b.w, b.y, s, b.c2, b, night);
    else if (cam.y > b.y + b.h) wall(b.x + b.w, b.y + b.h, b.x, b.y + b.h, s, b.c2, b, night);
    // גג
    if (b.kind === 'box') {
      ctx.fillStyle = shade(b.wall, 0.12); ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 1; q < 7; q++) { ctx.moveTo(rx + q * rw / 7, ry); ctx.lineTo(rx + q * rw / 7, ry + rh); } ctx.stroke();
    } else if (b.kind === 'house') {
      const horiz = b.w >= b.h;
      ctx.fillStyle = shade(b.roof, 0.15); ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = shade(b.roof, -0.18);
      if (horiz) ctx.fillRect(rx, ry + rh / 2, rw, rh / 2); else ctx.fillRect(rx + rw / 2, ry, rw / 2, rh);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (horiz) { ctx.moveTo(rx, ry + rh / 2); ctx.lineTo(rx + rw, ry + rh / 2); } else { ctx.moveTo(rx + rw / 2, ry); ctx.lineTo(rx + rw / 2, ry + rh); }
      ctx.stroke();
    } else {
      ctx.fillStyle = b.roof; ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = shade(b.wall, 0.2); ctx.fillRect(rx, ry, rw, 5); ctx.fillRect(rx, ry + rh - 5, rw, 5); ctx.fillRect(rx, ry, 5, rh); ctx.fillRect(rx + rw - 5, ry, 5, rh);
      const sd = b.seed;
      if (b.label) {
        if (b.label === 'H') { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, 34, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.font = `bold ${b.label === 'H' ? 40 : 44}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.label, rx + rw / 2, ry + rh / 2 + 2);
      } else {
        if (b.kind === 'strip' && sd % 3 === 0 && rw > 110 && rh > 90) { ctx.fillStyle = '#f3efe4'; rrect(ctx, rx + rw * 0.25 - 4, ry + rh * 0.3 - 4, rw * 0.5 + 8, rh * 0.35 + 8, 8); ctx.fill(); ctx.fillStyle = '#35c3e8'; rrect(ctx, rx + rw * 0.25, ry + rh * 0.3, rw * 0.5, rh * 0.35, 6); ctx.fill(); }
        else if (b.kind === 'warehouse') { ctx.fillStyle = 'rgba(200,225,240,0.5)'; for (let q = 0; q < 3; q++) ctx.fillRect(rx + rw * (0.2 + q * 0.25), ry + rh * 0.2, rw * 0.08, rh * 0.6); }
        ctx.fillStyle = '#9aa2a8';
        for (let q = 0; q < 1 + (sd % 3); q++) { const ax = rx + 12 + hash(q, sd) * (rw - 44), ay = ry + 12 + hash(q + 5, sd) * (rh - 40); ctx.fillRect(ax, ay, 18, 14); ctx.fillStyle = '#6f777d'; ctx.fillRect(ax + 3, ay + 3, 12, 8); ctx.fillStyle = '#9aa2a8'; }
      }
      if (b.neon) {
        if (night > 0.25) b._neon = { rx, ry, rw, rh };
        else { ctx.strokeStyle = b.neon; ctx.lineWidth = 2.5; ctx.strokeRect(rx + 7, ry + 7, rw - 14, rh - 14); }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.strokeRect(rx, ry, rw, rh);
    if (cover) ctx.globalAlpha = 1;
  }

  function drawTree(t, time, pp, dt) {
    if (t.shake > 0) t.shake -= dt;
    const s = 1 + t.z * HF * 1.4;
    const sway = Math.sin(time * 1.3 + t.ph) * 3 + (t.shake > 0 ? Math.sin(time * 40) * 5 * t.shake : 0);
    const tx = cam.x + (t.x - cam.x) * s + sway, ty = cam.y + (t.y - cam.y) * s + sway * 0.5;
    const near = Math.abs(pp.x - tx) < 34 && Math.abs(pp.y - ty) < 34;
    if (near) ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(t.x + 10, t.y + 12, 24, 15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = t.type === 'palm' ? '#8a6a3f' : '#5e4023'; ctx.lineWidth = t.type === 'palm' ? 5 : 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.quadraticCurveTo((t.x + tx) / 2 + 6, (t.y + ty) / 2, tx, ty); ctx.stroke();
    if (t.type === 'palm') {
      for (let q = 0; q < 7; q++) {
        const a = q * TAU / 7 + t.ph + Math.sin(time * 1.1 + q + t.ph) * 0.08;
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
        ctx.fillStyle = q % 2 ? '#2f9e44' : '#37b24d';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(18, -9, 36, 0); ctx.quadraticCurveTo(18, 6, 0, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(20,80,30,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(33, 0); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#5a3d1e'; ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, TAU); ctx.fill();
    } else {
      const cols = ['#2b8a3e', '#2f9e44', '#40c057'];
      for (let q = 0; q < 3; q++) { ctx.fillStyle = cols[q]; ctx.beginPath(); ctx.arc(tx + [-9, 8, -1][q], ty + [4, 3, -7][q], [19, 18, 16][q], 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(tx - 6, ty - 10, 8, 0, TAU); ctx.fill();
    }
    if (near) ctx.globalAlpha = 1;
  }

  // ---------------- סימונים ----------------
  function drawMarkers(time) {
    const ms = NC.mission.markers();
    for (const m of ms) {
      if (m.kind === 'car') continue;
      const col = m.kind === 'start' ? '#ffe14d' : m.kind === 'check' ? '#19e3ff' : m.kind === 'next' ? '#19e3ff' : m.kind === 'spray' ? '#3dff9e' : '#ff3fa4';
      const r = m.kind === 'start' ? 44 : m.kind === 'spray' ? 50 : m.r || 58;
      const a = m.kind === 'next' ? 0.3 : 1;
      ctx.fillStyle = hexA(col, 0.16 * a); ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(col, 0.9 * a); ctx.lineWidth = 5; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -time * 40;
      ctx.beginPath(); ctx.arc(m.x, m.y, r + Math.sin(time * 4) * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (m.kind === 'start') {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, 20, 0, TAU); ctx.fill();
        ctx.fillStyle = '#222'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.label, m.x, m.y + 2);
      }
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

  // ---------------- תאורת לילה ----------------
  let lightCv = null, lightCtx = null;
  function drawLighting(night, k, ox, oy, view, time) {
    const lw = Math.ceil(canvas.width / 2), lh = Math.ceil(canvas.height / 2);
    if (!lightCv || lightCv.width !== lw || lightCv.height !== lh) { lightCv = document.createElement('canvas'); lightCv.width = lw; lightCv.height = lh; lightCtx = lightCv.getContext('2d'); }
    const L = lightCtx;
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, lw, lh);
    L.fillStyle = `rgba(8,10,48,${(night * 0.7).toFixed(3)})`; L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = 'destination-out';
    L.setTransform(k / 2, 0, 0, k / 2, ox / 2, oy / 2);
    const hole = (x, y, r, a) => { const g = L.createRadialGradient(x, y, r * 0.12, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.beginPath(); L.arc(x, y, r, 0, TAU); L.fill(); };
    for (const l of view.lamps) hole(l.x, l.y, 215, 0.85);
    const pp = NC.world.playerPos(); hole(pp.x, pp.y, 150, 0.6);
    for (const c of view.cars) {
      if (c.dead || (!c.driver && !c.ai)) { if (c.burnT > 0) hole(c.x, c.y, 130, 0.8); continue; }
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang), hx = c.x + fx * c.d.len * 0.45, hy = c.y + fy * c.d.len * 0.45;
      const g = L.createRadialGradient(hx, hy, 6, hx, hy, 270); g.addColorStop(0, 'rgba(0,0,0,0.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g; L.beginPath(); L.moveTo(hx - fy * 9, hy + fx * 9); L.lineTo(hx + fx * 270 - fy * 105, hy + fy * 270 + fx * 105); L.lineTo(hx + fx * 270 + fy * 105, hy + fy * 270 - fx * 105); L.lineTo(hx + fy * 9, hy - fx * 9); L.closePath(); L.fill();
      hole(c.x, c.y, 62, 0.55);
    }
    for (const b of view.neon) { const n = b._neon; hole(n.rx + n.rw / 2, n.ry + n.rh / 2, Math.max(n.rw, n.rh) * 0.72 + 80, 0.6); }
    for (const m of NC.mission.markers()) hole(m.x, m.y, 120, 0.6);
    for (const kx of ['spray', 'spray2']) hole(M.special[kx].x, M.special[kx].y, 110, 0.6);
    let gl = 0; for (const p of G.parts) { if (p.glow && gl++ < 24) hole(p.x, p.y, 44, 0.5); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lightCv, 0, 0, canvas.width, canvas.height);
    // זוהר מעל החושך
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of view.lamps) { const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 70); g.addColorStop(0, `rgba(255,214,140,${0.55 * night})`); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, 70, 0, TAU); ctx.fill(); }
    for (const c of view.cars) {
      if (c.dead || (!c.driver && !c.ai)) continue;
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang), hx = c.x + fx * c.d.len * 0.45, hy = c.y + fy * c.d.len * 0.45;
      const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 230); g.addColorStop(0, `rgba(255,244,200,${0.32 * night})`); g.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hx - fy * 8, hy + fx * 8); ctx.lineTo(hx + fx * 230 - fy * 80, hy + fy * 230 + fx * 80); ctx.lineTo(hx + fx * 230 + fy * 80, hy + fy * 230 - fx * 80); ctx.lineTo(hx + fy * 8, hy - fx * 8); ctx.closePath(); ctx.fill();
      const tx = c.x - fx * c.d.len * 0.5, ty = c.y - fy * c.d.len * 0.5;
      ctx.fillStyle = `rgba(255,30,30,${(c.brake ? 0.55 : 0.28) * night})`; ctx.beginPath(); ctx.arc(tx, ty, c.brake ? 20 : 13, 0, TAU); ctx.fill();
    }
    for (const b of view.neon) {
      const n = b._neon, pulse = 0.8 + 0.2 * Math.sin(time * 3 + b.seed);
      ctx.strokeStyle = hexA(b.neon, 0.3 * night * pulse); ctx.lineWidth = 12; ctx.strokeRect(n.rx + 7, n.ry + 7, n.rw - 14, n.rh - 14);
      ctx.strokeStyle = hexA(b.neon, 0.95 * night * pulse); ctx.lineWidth = 3; ctx.strokeRect(n.rx + 7, n.ry + 7, n.rw - 14, n.rh - 14);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------- ציור ראשי ----------------
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
    const shx = G.shake ? (Math.random() - 0.5) * G.shake * dpr : 0, shy = G.shake ? (Math.random() - 0.5) * G.shake * dpr : 0;
    const ox = canvas.width / 2 - cam.x * k + shx, oy = canvas.height / 2 - cam.y * k + shy;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const hw = canvas.width / (2 * k), hh = canvas.height / (2 * k);
    const i0 = Math.floor((cam.x - hw) / T) - 1, i1 = Math.floor((cam.x + hw) / T) + 1, j0 = Math.floor((cam.y - hh) / T) - 1, j1 = Math.floor((cam.y + hh) / T) + 1;
    const night = nightAmount(G.clock);

    drawGround(i0, j0, i1, j1, time);
    drawDecor(i0, j0, i1, j1, time);

    // סימני צמיגים ופיח
    ctx.lineCap = 'round';
    for (const s of G.skids) {
      if (s.scorch) { const g = ctx.createRadialGradient(s.x1, s.y1, 5, s.x1, s.y1, s.r); g.addColorStop(0, `rgba(15,12,10,${Math.min(0.6, s.life / 20)})`); g.addColorStop(1, 'rgba(15,12,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x1, s.y1, s.r, 0, TAU); ctx.fill(); continue; }
      ctx.strokeStyle = `rgba(15,15,15,${Math.min(0.4, s.life / 10)})`; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }

    drawMarkers(time);

    // פנסי רחוב (העמוד)
    const view = { lamps: [], cars: [], neon: [] };
    for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
      if (!M.inb(i, j)) continue;
      for (const l of M.lGrid[M.idx(i, j)]) { view.lamps.push(l); ctx.fillStyle = '#2d3238'; ctx.beginPath(); ctx.arc(l.x, l.y, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = night > 0.2 ? '#ffe9a8' : '#cfd4da'; ctx.beginPath(); ctx.arc(l.x, l.y, 2, 0, TAU); ctx.fill(); }
    }

    // הולכי רגל
    for (const p of G.peds) {
      if (Math.abs(p.x - cam.x) > hw + 40 || Math.abs(p.y - cam.y) > hh + 40) continue;
      drawPed(p.x, p.y, p.ang, p.ph, p.shirt, p.skin, p.hair, { down: p.st === 'down', moving: p.st !== 'wait', wave: p.st === 'wait' });
      if (p.st === 'wait') { ctx.fillStyle = '#ff3fa4'; const by = p.y - 26 - Math.abs(Math.sin(time * 4)) * 6; ctx.beginPath(); ctx.moveTo(p.x, by + 9); ctx.lineTo(p.x - 7, by); ctx.lineTo(p.x + 7, by); ctx.closePath(); ctx.fill(); }
    }
    if (!P.car && !(G.dead && G.dead.kind === 'wasted' && false)) drawPed(P.x, P.y, P.ang, P.walk, '#ff4fa3', '#e0ac69', '#fff', { player: true, moving: Math.hypot(P.vx, P.vy) > 10, down: !!G.dead && G.dead.kind === 'wasted' });

    // מכוניות
    for (const c of G.cars) {
      if (Math.abs(c.x - cam.x) > hw + 320 || Math.abs(c.y - cam.y) > hh + 320) continue;
      view.cars.push(c);
      if (Math.abs(c.x - cam.x) > hw + 60 || Math.abs(c.y - cam.y) > hh + 60) continue;
      drawCar(c, night, time);
    }
    // חץ מעל רכב המשימה
    for (const m of NC.mission.markers()) if (m.kind === 'car') {
      const by = m.y - 46 - Math.abs(Math.sin(time * 4)) * 8;
      ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, by + 16); ctx.lineTo(m.x - 12, by); ctx.lineTo(m.x + 12, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // רמז כניסה לרכב
    if (!P.car && !G.dead) {
      const c = NC.world.nearestEnterable();
      if (c) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time * 20; ctx.beginPath(); ctx.arc(c.x, c.y, c.d.len / 2 + 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      NC.ui.nearCar(!!c);
    } else NC.ui.nearCar(false);

    // חלקיקים
    for (const p of G.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max) * p.a;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    // בניינים ועצים – מהרחוק לקרוב
    objs.length = 0;
    for (let j = j0 - 3; j <= j1 + 3; j++) for (let i = i0 - 3; i <= i1 + 3; i++) {
      if (!M.inb(i, j)) continue;
      const kk = M.idx(i, j);
      for (const b of M.bGrid[kk]) { if (b._f === frame) continue; b._f = frame; b._neon = null; b._d = Math.max(Math.abs(b.x + b.w / 2 - cam.x), Math.abs(b.y + b.h / 2 - cam.y)); objs.push(b); }
      for (const t of M.tGrid[kk]) { t._d = Math.max(Math.abs(t.x - cam.x), Math.abs(t.y - cam.y)) - 30; objs.push(t); }
    }
    objs.sort((a, b) => b._d - a._d);
    for (const o of objs) { if (o.type) drawTree(o, time, pp, dt); else { drawBuilding(o, night, pp); if (o._neon) view.neon.push(o); } }

    // טקסט צף
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px sans-serif';
    for (const f of G.floaters) { ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, f.x + 1.5, f.y + 1.5); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    // אור שקיעה, חושך וזוהר
    const tint = duskTint(G.clock);
    if (tint) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.setTransform(k, 0, 0, k, ox, oy); }
    if (night > 0.02) drawLighting(night, k, ox, oy, view, time);
    // הבהוב ניידות (גם ביום)
    if (G.wanted > 0) {
      ctx.setTransform(k, 0, 0, k, ox, oy); ctx.globalCompositeOperation = 'lighter';
      for (const c of view.cars) {
        if (!(c.ai && c.ai.cop) || c.dead) continue;
        const fl = Math.floor(time * 6) % 2;
        const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 110); g.addColorStop(0, fl ? 'rgba(255,40,40,0.4)' : 'rgba(50,90,255,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 110, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // חץ כיוון ליעד
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tg = NC.mission.target();
    if (tg) {
      const dx = tg.x - pp.x, dy = tg.y - pp.y, d = Math.hypot(dx, dy);
      if (d > 260) {
        const a = Math.atan2(dy, dx), R = Math.min(cw, ch) * 0.33;
        const px = cw / 2 + (pp.x - cam.x) * k / dpr + Math.cos(a) * R, py = ch / 2 + (pp.y - cam.y) * k / dpr + Math.sin(a) * R;
        ctx.save(); ctx.translate(px, py); ctx.rotate(a);
        ctx.fillStyle = tg.kind === 'start' ? '#ffe14d' : tg.kind === 'check' ? '#19e3ff' : '#ff3fa4'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
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
    drawRadar(time);
  }

  function blipColor(kind) { return kind === 'start' ? '#ffe14d' : kind === 'check' || kind === 'next' ? '#19e3ff' : kind === 'spray' ? '#3dff9e' : '#ff3fa4'; }

  function drawRadar(time) {
    const S = radar.width, c = S / 2, g = rctx, pp = NC.world.playerPos();
    const range = 1050, sc = c / range; // פיקסלים ליחידת עולם
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(c, c, c - 3, 0, TAU); g.clip();
    g.fillStyle = '#16323f'; g.fillRect(0, 0, S, S);
    const ms = sc * T / MMP;
    g.imageSmoothingEnabled = false;
    g.drawImage(mm, c - (pp.x / (T / MMP)) * ms, c - (pp.y / (T / MMP)) * ms, mm.width * ms, mm.height * ms);
    const put = (x, y, edge) => {
      let dx = (x - pp.x) * sc, dy = (y - pp.y) * sc; const d = Math.hypot(dx, dy), mx = c - 9 * (S / 150);
      if (d > mx) { if (!edge) return null; dx = dx / d * mx; dy = dy / d * mx; }
      return [c + dx, c + dy];
    };
    const u = S / 150;
    for (const k of ['spray', 'spray2']) { const p = put(M.special[k].x, M.special[k].y, false); if (p) { g.fillStyle = '#3dff9e'; g.fillRect(p[0] - 3 * u, p[1] - 3 * u, 6 * u, 6 * u); } }
    for (const m of NC.mission.markers()) {
      const p = put(m.x, m.y, m.kind !== 'next'); if (!p) continue;
      g.fillStyle = blipColor(m.kind); g.strokeStyle = '#000'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.arc(p[0], p[1], (m.kind === 'next' ? 3 : 5.5) * u, 0, TAU); g.fill(); g.stroke();
      if (m.label) { g.fillStyle = '#000'; g.font = `bold ${8 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.label, p[0], p[1] + 0.5 * u); }
    }
    if (G.wanted > 0) for (const cc of G.cars) { if (!(cc.ai && cc.ai.cop) || cc.dead) continue; const p = put(cc.x, cc.y, false); if (p) { g.fillStyle = Math.floor(time * 5) % 2 ? '#ff3b3b' : '#4d8dff'; g.beginPath(); g.arc(p[0], p[1], 3.5 * u, 0, TAU); g.fill(); } }
    // השחקן
    g.translate(c, c); g.rotate(G.player.ang);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * u; g.beginPath(); g.moveTo(8 * u, 0); g.lineTo(-5 * u, 5 * u); g.lineTo(-2 * u, 0); g.lineTo(-5 * u, -5 * u); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.strokeStyle = G.wanted > 0 && G.hideT < 0.5 ? (Math.floor(time * 5) % 2 ? '#ff3b3b' : '#4d8dff') : G.wanted > 0 ? '#ffe14d' : 'rgba(255,255,255,0.85)';
    g.lineWidth = 4 * u; g.beginPath(); g.arc(c, c, c - 3 * u, 0, TAU); g.stroke();
  }

  // מפה גדולה למסך ההשהיה
  function drawBigMap(cv) {
    const g = cv.getContext('2d'), S = cv.width, sc = S / mm.width;
    g.imageSmoothingEnabled = false; g.drawImage(mm, 0, 0, S, S);
    const w2 = (x) => x / (T / MMP) * sc;
    const dot = (x, y, col, r, label) => { g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(w2(x), w2(y), r, 0, TAU); g.fill(); g.stroke(); if (label) { g.fillStyle = '#000'; g.font = `bold ${r * 1.3}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w2(x), w2(y) + 1); } };
    for (const k of ['spray', 'spray2']) dot(M.special[k].x, M.special[k].y, '#3dff9e', 6, '');
    dot(M.special.hospital.x, M.special.hospital.y, '#ffffff', 7, '+');
    dot(M.special.police.x, M.special.police.y, '#4d8dff', 7, '★');
    for (const m of NC.mission.markers()) dot(m.x, m.y, blipColor(m.kind), 9, m.label || '');
    const pp = NC.world.playerPos();
    g.save(); g.translate(w2(pp.x), w2(pp.y)); g.rotate(G.player.ang); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, 8); g.lineTo(-3, 0); g.lineTo(-8, -8); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  NC.render = { resize, draw, drawBigMap, canvas };
})();
