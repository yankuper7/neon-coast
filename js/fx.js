/* חוף ניאון – חלקיקים: עשן, אש, ניצוצות, אבק, התזות, שברים וקונפטי. אובייקטים ממוחזרים כדי לא להעמיס על הזיכרון */
'use strict';
(() => {
  const NC = window.NC;
  const { rand, pick } = NC;
  // סוגים: 0 עיגול רך, 1 ניצוץ (קו), 2 שבר מסתובב, 3 טבעת מתרחבת, 4 קונפטי
  const SOFT = 0, SPARK = 1, DEBRIS = 2, RING = 3, CONF = 4;
  const FIRE = ['#ffb347', '#ff7a1a', '#ffe082', '#ff5a1f'];
  const PARTY = ['#ff3fa4', '#19e3ff', '#ffe14d', '#9d5cff', '#3dff9e', '#ff7a3d'];
  const Fx = NC.fx = {
    SOFT, SPARK, DEBRIS, RING, CONF, list: [], pool: [], max: 520, windX: 0, windY: 0,
    clear() { for (const p of this.list) this.pool.push(p); this.list.length = 0; },
    add(x, y, vx, vy, life, r, color, grow, a, glow, kind) {
      const L = this.list;
      let p;
      if (L.length >= this.max) { p = L.shift(); } else p = this.pool.pop() || {};
      p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.r = r; p.color = color; p.grow = grow || 0; p.a = a || 1; p.glow = !!glow;
      p.kind = kind || SOFT; p.drag = 3.7; p.rot = 0; p.spin = 0; p.wind = 0;
      L.push(p);
      return p;
    },
    update(dt) {
      const L = this.list; let n = 0;
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        p.life -= dt;
        if (p.life <= 0) { this.pool.push(p); continue; }
        const f = Math.exp(-p.drag * dt);
        p.vx *= f; p.vy *= f;
        p.x += (p.vx + this.windX * p.wind) * dt; p.y += (p.vy + this.windY * p.wind) * dt;
        if (p.grow) p.r += p.grow * dt;
        if (p.spin) p.rot += p.spin * dt;
        L[n++] = p;
      }
      L.length = n;
    },
    // --- אפקטים מוכנים ---
    sparks(x, y, n, power) {
      for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(0.3, 1) * power; const p = this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.18, 0.45), rand(1.2, 2.4), i % 3 ? '#ffd27a' : '#fff3c4', 0, 1, true, SPARK); p.drag = 5; }
    },
    smoke(x, y, color, vx, vy, size) {
      const p = this.add(x, y, rand(-14, 14) + (vx || 0), rand(-38, -14) + (vy || 0), rand(0.9, 1.6), size || 6, color || '#c9c9c9', 17, 0.42, false, SOFT);
      p.wind = 1; p.drag = 1.6; return p;
    },
    fire(x, y) { const p = this.add(x + rand(-6, 6), y + rand(-6, 6), rand(-20, 20), rand(-55, -12), rand(0.35, 0.6), rand(4, 8), pick(FIRE), 6, 0.9, true, SOFT); p.wind = 0.5; },
    dust(x, y, color, vx, vy) { const p = this.add(x, y, rand(-25, 25) + (vx || 0), rand(-25, 25) + (vy || 0), rand(0.5, 0.9), rand(4, 7), color, 20, 0.34, false, SOFT); p.wind = 0.6; p.drag = 2.4; },
    splash(x, y, n) {
      for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(40, 130); const p = this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 0.8), rand(2.5, 5), '#e8f8ff', 6, 0.75, false, SOFT); p.drag = 3; }
      this.ring(x, y, 10, '#ffffff', 70, 0.7);
    },
    ring(x, y, r, color, grow, life) { return this.add(x, y, 0, 0, life || 0.5, r, color, grow || 40, 0.7, false, RING); },
    debris(x, y, n, color, power) {
      for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(0.3, 1) * (power || 200); const p = this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.1), rand(2, 4.5), i % 2 ? color : '#2a2a2a', 0, 1, false, DEBRIS); p.spin = rand(-14, 14); p.drag = 2.6; }
    },
    confetti(x, y, n) {
      for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(60, 330); const p = this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(1, 2.2), rand(2.5, 4.5), pick(PARTY), 0, 1, false, CONF); p.spin = rand(-12, 12); p.drag = 2.2; p.wind = 0.4; }
    },
    explosion(x, y) {
      for (let i = 0; i < 26; i++) { const p = this.add(x, y, rand(-260, 260), rand(-260, 260), rand(0.4, 0.9), rand(5, 11), pick(FIRE), 8, 1, true, SOFT); p.drag = 4; }
      for (let i = 0; i < 12; i++) { const p = this.add(x + rand(-22, 22), y + rand(-22, 22), rand(-45, 45), rand(-70, -10), rand(1.2, 2.4), rand(11, 18), '#3a3a3a', 24, 0.55, false, SOFT); p.wind = 1; p.drag = 1.4; }
      this.sparks(x, y, 22, 520);
      this.debris(x, y, 14, '#555555', 380);
      const r = this.ring(x, y, 20, '#fff1c4', 520, 0.38); r.glow = true;
    },
    sparkle(x, y, color, n) {
      for (let i = 0; i < n; i++) { const a = rand(0, 6.283), s = rand(30, 150); const p = this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 0.9), rand(2, 4), color, -2, 1, true, SOFT); p.drag = 3; }
      const r = this.ring(x, y, 8, color, 120, 0.5); r.glow = true;
    },
  };
})();
