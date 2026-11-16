/* חוף ניאון – העולם: מכוניות, פיזיקה, הולכי רגל, תנועה, משטרה */
'use strict';
(() => {
  const NC = window.NC;
  const { clamp, rand, pick, angDiff, TAU } = NC;
  const M = NC.map, T = M.T, N = M.N;

  const CARS = NC.CARS = {
    compact: { name: 'Compact', len: 48, wid: 24, acc: 500, max: 320, grip: 7.5, steer: 3.0, hp: 100, mass: 0.9 },
    sedan: { name: 'Sedan', len: 56, wid: 26, acc: 540, max: 360, grip: 7, steer: 2.8, hp: 110, mass: 1 },
    sports: { name: 'Sports', len: 56, wid: 26, acc: 820, max: 520, grip: 8.5, steer: 3.1, hp: 90, mass: 0.95 },
    pickup: { name: 'Pickup', len: 60, wid: 28, acc: 500, max: 340, grip: 6.5, steer: 2.6, hp: 150, mass: 1.4 },
    van: { name: 'Truck', len: 74, wid: 32, acc: 400, max: 290, grip: 6, steer: 2.2, hp: 230, mass: 2.2 },
    taxi: { name: 'Taxi', len: 56, wid: 26, acc: 560, max: 370, grip: 7, steer: 2.8, hp: 120, mass: 1 },
    police: { name: 'Police', len: 56, wid: 26, acc: 760, max: 480, grip: 8.5, steer: 3.0, hp: 170, mass: 1.2 },
  };
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#ecf0f1', '#34495e', '#e67e22', '#9b59b6', '#1abc9c', '#ff7eb6', '#95a5a6', '#c0392b', '#16a085'];
  const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#2ecc71', '#ff7eb6', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];
  const SKINS = ['#f2c9a1', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const HAIRS = ['#2b1d0e', '#4a2f17', '#111111', '#b5651d', '#d9b36c', '#777777'];
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // מזרח, דרום, מערב, צפון
  const DBIT = [2, 4, 8, 1];
  const LANE = 21, WALK = 51;

  const G = NC.G = {};
  let uid = 0;

  function resetWorld(save) {
    const home = M.special.home;
    Object.assign(G, {
      cars: [], peds: [], parts: [], skids: [], floaters: [], time: 0, clock: 15,
      wanted: 0, hideT: 0, crimeCd: 0, bustT: 0, copCd: 0, copDist: 1e9, fieldT: 0,
      money: save ? save.money : 50, story: save ? save.story : 0, pkgs: save ? save.pkgs.slice() : [],
      playTime: save ? save.playTime || 0 : 0,
      player: { x: home.x, y: home.y, ang: Math.PI / 2, vx: 0, vy: 0, hp: 100, car: null, walk: 0, stun: 0 },
      shake: 0, dead: null, mission: null, starFlash: 0,
    });
    for (const s of M.parkSpots) makeCar(pick(['compact', 'sedan', 'sedan', 'pickup', 'sports', 'van', 'compact']), s.x, s.y, s.ang, { parked: true });
    // רכב ראשון ליד הבית
    makeCar('compact', home.x + 90, home.y + 20, 0, { parked: true, color: '#ff7eb6' });
    for (let i = 0; i < 26; i++) spawnTraffic(true);
    for (let i = 0; i < 34; i++) spawnPed(true);
  }

  // ---------------- מכוניות ----------------
  function makeCar(type, x, y, ang, opts = {}) {
    const d = CARS[type];
    const c = {
      id: ++uid, type, d, x, y, ang, vx: 0, vy: 0, thr: 0, steer: 0, hb: false, speed: 0, slip: 0, hp: d.hp,
      color: opts.color || (type === 'taxi' ? '#ffd23f' : type === 'police' ? '#f4f6f8' : pick(COLORS)),
      driver: opts.driver || null, ai: null, parked: !!opts.parked, tag: opts.tag || null,
      burnT: 0, dead: false, hitT: 0, seed: Math.random() * 1000, brake: false, sk: null,
    };
    G.cars.push(c);
    return c;
  }

  function stepCar(c, dt) {
    const d = c.d;
    if (c.dead) { const f = Math.exp(-4 * dt); c.vx *= f; c.vy *= f; c.x += c.vx * dt; c.y += c.vy * dt; c.speed = 0; return; }
    let fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    let vf = c.vx * fx + c.vy * fy;
    const sp = Math.abs(vf);
    c.ang += c.steer * d.steer * clamp(sp / 130, 0, 1) / (1 + sp / 650) * (vf >= 0 ? 1 : -1) * dt;
    fx = Math.cos(c.ang); fy = Math.sin(c.ang);
    const rx = -fy, ry = fx;
    vf = c.vx * fx + c.vy * fy;
    let vr = c.vx * rx + c.vy * ry;
    const power = c.hp < d.hp * 0.25 ? 0.6 : 1;
    const ground = M.tileAt(c.x, c.y);
    const soft = ground === M.WATER ? 0.45 : ground === M.SAND || ground === M.GLADE ? 0.75 : 1;
    c.brake = false;
    if (c.thr > 0) vf += (vf < -5 ? d.acc * 2.2 : d.acc * power * soft * (1 - clamp(vf / d.max, 0, 1) * 0.85)) * c.thr * dt;
    else if (c.thr < 0) { vf += (vf > 5 ? -d.acc * 2.4 : -d.acc * 0.6 * (1 - clamp(-vf / (d.max * 0.4), 0, 1))) * -c.thr * dt; c.brake = vf > 5; }
    else { const dec = 130 * dt; vf = Math.abs(vf) < dec ? 0 : vf - Math.sign(vf) * dec; }
    vf -= vf * (soft < 0.5 ? 2.6 : soft < 1 ? 0.9 : 0.25) * dt;
    let grip = d.grip;
    if (c.hb) { grip *= 0.16; vf -= vf * 1.7 * dt; c.brake = true; }
    c.slip = Math.abs(vr);
    vr *= Math.exp(-grip * dt);
    c.vx = fx * vf + rx * vr; c.vy = fy * vf + ry * vr;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.x = clamp(c.x, 30, M.WS - 30); c.y = clamp(c.y, 30, M.WS - 30);
    c.speed = vf;
    if (c.hitT > 0) c.hitT -= dt;
  }

  const CX = [0, 0, 0], CY = [0, 0, 0], OX = [0, 0, 0], OY = [0, 0, 0];
  function circles(c, X, Y) {
    const r = c.d.wid / 2, o = c.d.len / 2 - r, fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    X[0] = c.x - fx * o; Y[0] = c.y - fy * o; X[1] = c.x; Y[1] = c.y; X[2] = c.x + fx * o; Y[2] = c.y + fy * o;
    return r;
  }

  function bump(c, nx, ny, pen, k, e) {
    // דחיפה החוצה והחזרת מהירות. מחזיר את עוצמת הפגיעה
    c.x += nx * pen; c.y += ny * pen;
    const vn = c.vx * nx + c.vy * ny;
    if (vn >= 0) return 0;
    c.vx -= (1 + e) * vn * nx; c.vy -= (1 + e) * vn * ny;
    const tx = -ny, ty = nx, vt = c.vx * tx + c.vy * ty;
    c.vx -= tx * vt * 0.12; c.vy -= ty * vt * 0.12;
    const o = (k - 1) * (c.d.len / 2 - c.d.wid / 2);
    const cross = Math.cos(c.ang) * o * ny - Math.sin(c.ang) * o * nx;
    c.ang += clamp(cross * -vn * 0.00003, -0.25, 0.25);
    return -vn;
  }

  function impactFx(c, x, y, impact) {
    if (impact < 110) return;
    const P = G.player, near = Math.abs(c.x - P.x) < 900 && Math.abs(c.y - P.y) < 700;
    if (near) NC.Sound.play('crash', clamp(impact / 400, 0.3, 1));
    for (let i = 0; i < Math.min(8, impact / 40); i++) addPart(x, y, rand(-160, 160), rand(-160, 160), rand(0.2, 0.45), rand(1.5, 3), '#ffd27a', 0, 1, true);
    if (P.car === c) G.shake = Math.max(G.shake, Math.min(14, impact / 30));
  }

  function damageCar(c, amt) {
    if (c.dead || amt <= 0) return;
    c.hp -= amt; c.hitT = 0.15;
    if (c.hp <= 0 && !c.burnT) {
      c.hp = 0; c.burnT = 4.5;
      if (c.driver === 'ai' || (c.ai && c.ai.cop)) ejectDriver(c, true);
      if (G.player.car === c) NC.ui.toast('🔥 The car is on fire! Get out!');
    } else if (c.hp < c.d.hp * 0.3 && c.driver === 'ai' && Math.random() < 0.4) ejectDriver(c, true);
  }

  function collideStatic(c) {
    const r = circles(c, CX, CY);
    const ti = Math.floor(c.x / T), tj = Math.floor(c.y / T);
    for (let j = tj - 1; j <= tj + 1; j++) for (let i = ti - 1; i <= ti + 1; i++) {
      if (!M.inb(i, j)) continue;
      const k0 = M.idx(i, j);
      for (const b of M.bGrid[k0]) {
        if (c.x < b.x - 50 || c.x > b.x + b.w + 50 || c.y < b.y - 50 || c.y > b.y + b.h + 50) continue;
        for (let k = 0; k < 3; k++) {
          const px = clamp(CX[k], b.x, b.x + b.w), py = clamp(CY[k], b.y, b.y + b.h);
          let dx = CX[k] - px, dy = CY[k] - py, d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          let d = Math.sqrt(d2), nx, ny, pen;
          if (d < 0.001) { // המרכז בתוך הבניין – יוצאים דרך הצלע הקרובה
            const l = CX[k] - b.x, rr2 = b.x + b.w - CX[k], t = CY[k] - b.y, bt = b.y + b.h - CY[k], mn = Math.min(l, rr2, t, bt);
            nx = mn === l ? -1 : mn === rr2 ? 1 : 0; ny = mn === t ? -1 : mn === bt ? 1 : 0; pen = mn + r;
          } else { nx = dx / d; ny = dy / d; pen = r - d; }
          const imp = bump(c, nx, ny, pen, k, 0.2);
          if (imp > 90) { damageCar(c, (imp - 90) * 0.085); impactFx(c, px, py, imp); if (G.player.car === c && imp > 260) hurtPlayer((imp - 260) * 0.04); }
          circles(c, CX, CY);
        }
      }
      for (const t of M.tGrid[k0]) {
        for (let k = 0; k < 3; k++) {
          const dx = CX[k] - t.x, dy = CY[k] - t.y, d2 = dx * dx + dy * dy, rr2 = r + t.r;
          if (d2 >= rr2 * rr2 || d2 < 0.0001) continue;
          const d = Math.sqrt(d2);
          const imp = bump(c, dx / d, dy / d, rr2 - d, k, 0.15);
          if (imp > 90) { damageCar(c, (imp - 90) * 0.07); impactFx(c, t.x, t.y, imp); t.shake = 0.5; }
          circles(c, CX, CY);
        }
      }
    }
  }

  function collideCars(a, b) {
    const dx0 = a.x - b.x, dy0 = a.y - b.y, reach = (a.d.len + b.d.len) / 2 + 4;
    if (dx0 * dx0 + dy0 * dy0 > reach * reach) return;
    const ra = circles(a, CX, CY), rb = circles(b, OX, OY);
    let best = 0, bn = 0, bm = 0, ka = 1, kb = 1;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const dx = CX[i] - OX[j], dy = CY[i] - OY[j], d = Math.hypot(dx, dy), pen = ra + rb - d;
      if (pen > best && d > 0.001) { best = pen; bn = dx / d; bm = dy / d; ka = i; kb = j; }
    }
    if (best <= 0) return;
    const ma = a.dead ? 3 : a.d.mass, mb = b.dead ? 3 : b.d.mass, tot = ma + mb;
    a.x += bn * best * (mb / tot); a.y += bm * best * (mb / tot);
    b.x -= bn * best * (ma / tot); b.y -= bm * best * (ma / tot);
    const rel = (a.vx - b.vx) * bn + (a.vy - b.vy) * bm;
    if (rel >= 0) return;
    const jimp = -(1.3) * rel / (1 / ma + 1 / mb);
    a.vx += bn * jimp / ma; a.vy += bm * jimp / ma;
    b.vx -= bn * jimp / mb; b.vy -= bm * jimp / mb;
    const imp = -rel;
    const oa = (ka - 1) * (a.d.len / 2 - ra), ob = (kb - 1) * (b.d.len / 2 - rb);
    a.ang += clamp((Math.cos(a.ang) * oa * bm - Math.sin(a.ang) * oa * bn) * imp * 0.00003 * (mb / tot) * 2, -0.3, 0.3);
    b.ang -= clamp((Math.cos(b.ang) * ob * bm - Math.sin(b.ang) * ob * bn) * imp * 0.00003 * (ma / tot) * 2, -0.3, 0.3);
    a.parked = b.parked = false;
    if (imp > 80) {
      damageCar(a, (imp - 80) * 0.07 * (mb / tot) * 2); damageCar(b, (imp - 80) * 0.07 * (ma / tot) * 2);
      impactFx(a, (a.x + b.x) / 2, (a.y + b.y) / 2, imp);
      const P = G.player;
      if (P.car === a || P.car === b) {
        const other = P.car === a ? b : a;
        if (imp > 260) hurtPlayer((imp - 260) * 0.03);
        if (other.type === 'police' && other.ai && imp > 140) crime(G.wanted < 2 ? 2 - G.wanted : imp > 300 && G.wanted < 4 ? 1 : 0);
        if (other.ai && !other.ai.cop && imp > 150) other.ai.panicT = 6;
      }
    }
  }

  function explodeCar(c) {
    c.dead = true; c.burnT = 0; c.color = '#2b2b2b'; c.driver = null; c.ai = null;
    NC.Sound.play('boom'); G.shake = Math.max(G.shake, 16);
    for (let i = 0; i < 30; i++) addPart(c.x, c.y, rand(-260, 260), rand(-260, 260), rand(0.4, 0.9), rand(4, 9), pick(['#ffb347', '#ff7a1a', '#ffe082']), 0, 1, true);
    for (let i = 0; i < 12; i++) addPart(c.x + rand(-20, 20), c.y + rand(-20, 20), rand(-40, 40), rand(-60, -10), rand(1, 2), rand(10, 16), '#3a3a3a', 22, 0.55);
    G.skids.push({ scorch: true, x1: c.x, y1: c.y, r: 60, life: 60 });
    const P = G.player;
    if (P.car === c) { P.car = null; hurtPlayer(1000); }
    else if (!P.car && Math.hypot(P.x - c.x, P.y - c.y) < 110) hurtPlayer(70);
    for (const o of G.cars) { if (o === c || o.dead) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < 130) { damageCar(o, 60); o.vx += (o.x - c.x) / d * 200; o.vy += (o.y - c.y) / d * 200; } }
    for (const p of G.peds) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < 140) knockPed(p, (p.x - c.x) / d * 260, (p.y - c.y) / d * 260); else if (d < 500) fleePed(p, c.x, c.y); }
    if (NC.mission) NC.mission.onCarDestroyed(c);
  }

  // ---------------- חלקיקים ----------------
  function addPart(x, y, vx, vy, life, r, color, grow, a, glow) {
    if (G.parts.length > 520) G.parts.shift();
    G.parts.push({ x, y, vx, vy, life, max: life, r, color, grow: grow || 0, a: a || 1, glow: !!glow });
  }
  function addFloater(x, y, text, color) { G.floaters.push({ x, y, text, color: color || '#fff', life: 1.6 }); if (G.floaters.length > 20) G.floaters.shift(); }

  // ---------------- הולכי רגל ----------------
  function makePed(x, y, opts = {}) {
    const p = {
      id: ++uid, x, y, ang: 0, vx: 0, vy: 0, st: 'walk', t: 0, axis: 'x', line: y, s: 1, speed: rand(36, 56), dec: -1, pend: null,
      shirt: opts.shirt || pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS), ph: Math.random() * 10, fx: 0, fy: 0, tag: opts.tag || null,
    };
    G.peds.push(p);
    return p;
  }
  function putOnSidewalk(p, i, j) {
    const m = M.conn(i, j), cx = (i + 0.5) * T, cy = (j + 0.5) * T;
    if (m & 10) { p.axis = 'x'; p.line = cy + (p.y >= cy ? WALK : -WALK); p.s = Math.random() < 0.5 ? 1 : -1; }
    else { p.axis = 'y'; p.line = cx + (p.x >= cx ? WALK : -WALK); p.s = Math.random() < 0.5 ? 1 : -1; }
    p.dec = -1; p.pend = null; p.st = 'walk';
  }
  function spawnPed(initial) {
    const P = G.player;
    for (let n = 0; n < 12; n++) {
      const [i, j] = pick(M.roadTiles), m = M.conn(i, j);
      if (m !== 10 && m !== 5) continue;
      const x = (i + 0.5) * T, y = (j + 0.5) * T, d = Math.hypot(x - P.x, y - P.y);
      if (d > 1300 || d < (initial ? 250 : 800)) continue;
      const p = makePed(x + rand(-50, 50), y + rand(-50, 50));
      p.y += Math.random() < 0.5 ? 0.1 : -0.1; p.x += Math.random() < 0.5 ? 0.1 : -0.1;
      putOnSidewalk(p, i, j);
      if (p.axis === 'x') p.y = p.line; else p.x = p.line;
      return p;
    }
    return null;
  }
  function fleePed(p, fromX, fromY) {
    if (p.st === 'down' || p.tag) return;
    const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
    p.st = 'flee'; p.t = rand(2.5, 4.5); p.fx = (p.x - fromX) / d; p.fy = (p.y - fromY) / d;
  }
  function knockPed(p, vx, vy) {
    if (p.st === 'down') return;
    p.st = 'down'; p.t = 2.8; p.vx = vx; p.vy = vy; p.ang = Math.atan2(vy, vx);
    for (let i = 0; i < 4; i++) addPart(p.x, p.y, rand(-60, 60), rand(-60, 60), 0.5, 3, '#ffffff', 0, 0.8);
  }
  function pushOutOfBuildings(o, r) {
    const ti = Math.floor(o.x / T), tj = Math.floor(o.y / T);
    for (let j = tj - 1; j <= tj + 1; j++) for (let i = ti - 1; i <= ti + 1; i++) {
      if (!M.inb(i, j)) continue;
      for (const b of M.bGrid[M.idx(i, j)]) {
        const px = clamp(o.x, b.x, b.x + b.w), py = clamp(o.y, b.y, b.y + b.h);
        const dx = o.x - px, dy = o.y - py, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2);
        if (d < 0.001) {
          const l = o.x - b.x, rr2 = b.x + b.w - o.x, t = o.y - b.y, bt = b.y + b.h - o.y, mn = Math.min(l, rr2, t, bt);
          if (mn === l) o.x = b.x - r; else if (mn === rr2) o.x = b.x + b.w + r; else if (mn === t) o.y = b.y - r; else o.y = b.y + b.h + r;
        } else { o.x += (dx / d) * (r - d); o.y += (dy / d) * (r - d); }
      }
    }
    o.x = clamp(o.x, 20, M.WS - 20); o.y = clamp(o.y, 20, M.WS - 20);
  }

  function updatePed(p, dt) {
    p.ph += dt * (p.st === 'flee' ? 14 : 7);
    if (p.st === 'wait') return;
    if (p.st === 'down') {
      p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-3.5 * dt); p.vx *= f; p.vy *= f;
      pushOutOfBuildings(p, 8);
      p.t -= dt; if (p.t <= 0) { p.st = 'flee'; p.t = 3; const a = Math.random() * TAU; p.fx = Math.cos(a); p.fy = Math.sin(a); }
      return;
    }
    if (p.st === 'flee') {
      p.x += p.fx * 150 * dt; p.y += p.fy * 150 * dt; p.ang = Math.atan2(p.fy, p.fx);
      pushOutOfBuildings(p, 8);
      p.t -= dt; if (p.t <= 0) p.st = 'return';
      return;
    }
    const ti = Math.floor(p.x / T), tj = Math.floor(p.y / T), m = M.conn(ti, tj);
    if (p.st === 'return') {
      if (m) { putOnSidewalk(p, ti, tj); return; }
      const [ri, rj] = M.nearestRoad(p.x, p.y), tx = (ri + 0.5) * T, ty = (rj + 0.5) * T, d = Math.hypot(tx - p.x, ty - p.y) || 1;
      p.x += (tx - p.x) / d * 70 * dt; p.y += (ty - p.y) / d * 70 * dt; p.ang = Math.atan2(ty - p.y, tx - p.x);
      pushOutOfBuildings(p, 8);
      return;
    }
    if (!m) { p.st = 'return'; return; }
    const key = M.idx(ti, tj), cx = (ti + 0.5) * T, cy = (tj + 0.5) * T, horiz = p.axis === 'x';
    if (p.dec !== key) {
      p.dec = key;
      const ahead = horiz ? M.isRoad(ti + p.s, tj) : M.isRoad(ti, tj + p.s);
      const canTurn = horiz ? (m & 5) : (m & 10);
      if (canTurn && (!ahead || Math.random() < 0.4)) {
        const side = Math.sign(p.line - (horiz ? cy : cx)) || 1, opts = [];
        if (horiz) { if (M.isRoad(ti, tj + side)) opts.push(side); if (M.isRoad(ti, tj - side)) opts.push(-side); }
        else { if (M.isRoad(ti + side, tj)) opts.push(side); if (M.isRoad(ti - side, tj)) opts.push(-side); }
        if (opts.length) p.pend = { at: (horiz ? cx : cy) + (Math.random() < 0.5 ? -WALK : WALK), ns: pick(opts) };
        else if (!ahead) p.s = -p.s;
      } else if (!ahead) p.s = -p.s;
    }
    if (horiz) {
      p.x += p.s * p.speed * dt; p.y += (p.line - p.y) * Math.min(1, dt * 6); p.ang = p.s > 0 ? 0 : Math.PI;
      if (p.pend && (p.x - p.pend.at) * p.s >= 0) { p.x = p.pend.at; p.axis = 'y'; p.line = p.pend.at; p.s = p.pend.ns; p.pend = null; }
    } else {
      p.y += p.s * p.speed * dt; p.x += (p.line - p.x) * Math.min(1, dt * 6); p.ang = p.s > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (p.pend && (p.y - p.pend.at) * p.s >= 0) { p.y = p.pend.at; p.axis = 'x'; p.line = p.pend.at; p.s = p.pend.ns; p.pend = null; }
    }
  }

  function ejectDriver(c, panic) {
    const rx = -Math.sin(c.ang), ry = Math.cos(c.ang);
    const p = makePed(c.x - rx * (c.d.wid / 2 + 12), c.y - ry * (c.d.wid / 2 + 12), c.type === 'police' ? { shirt: '#1f3a6e' } : {});
    pushOutOfBuildings(p, 8);
    fleePed(p, c.x + rand(-5, 5), c.y + rand(-5, 5));
    if (c.driver === 'ai') c.driver = null;
    if (c.ai && !panic) c.ai = null;
    if (panic) { c.ai = null; c.driver = c.driver === 'player' ? 'player' : null; }
    return p;
  }

  // ---------------- תנועה בכבישים ----------------
  function newAI(dir, cop) {
    return { dir, next: dir, switched: true, tileKey: -1, lastI: 0, lastJ: 0, cruise: rand(140, 200), blockT: 0, ghostT: 0, panicT: 0, honkCd: 0, cop: !!cop, stuckT: 0, revT: 0 };
  }
  function spawnTraffic(initial) {
    const P = G.player;
    for (let n = 0; n < 14; n++) {
      const [i, j] = pick(M.roadTiles), m = M.conn(i, j);
      if (m !== 10 && m !== 5) continue;
      const cx = (i + 0.5) * T, cy = (j + 0.5) * T, d = Math.hypot(cx - P.x, cy - P.y);
      if (d > 1600 || d < (initial ? 380 : 1050)) continue;
      const dir = m === 10 ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() < 0.5 ? 1 : 3);
      const x = cx - DIRS[dir][1] * LANE, y = cy + DIRS[dir][0] * LANE;
      if (G.cars.some((o) => Math.abs(o.x - x) < 110 && Math.abs(o.y - y) < 110)) continue;
      const r = Math.random();
      const type = r < 0.28 ? 'compact' : r < 0.56 ? 'sedan' : r < 0.68 ? 'pickup' : r < 0.77 ? 'van' : r < 0.89 ? 'taxi' : r < 0.96 ? 'sports' : 'police';
      const c = makeCar(type, x, y, Math.atan2(DIRS[dir][1], DIRS[dir][0]), { driver: 'ai' });
      c.ai = newAI(dir, false);
      c.vx = DIRS[dir][0] * 120; c.vy = DIRS[dir][1] * 120;
      return c;
    }
    return null;
  }

  function blockedAhead(c, range) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    for (const o of G.active) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y, ah = dx * fx + dy * fy;
      if (ah < 5 || ah > range + o.d.len / 2) continue;
      if (Math.abs(-dx * fy + dy * fx) < (c.d.wid + o.d.wid) / 2 + 3) return o;
    }
    const P = G.player;
    if (!P.car) { const dx = P.x - c.x, dy = P.y - c.y, ah = dx * fx + dy * fy; if (ah > 5 && ah < range && Math.abs(-dx * fy + dy * fx) < c.d.wid / 2 + 12) return P; }
    for (const p of G.peds) {
      const dx = p.x - c.x, dy = p.y - c.y;
      if (Math.abs(dx) > range + 20 || Math.abs(dy) > range + 20) continue;
      const ah = dx * fx + dy * fy;
      if (ah > 5 && ah < range * 0.8 && Math.abs(-dx * fy + dy * fx) < c.d.wid / 2 + 9) return p;
    }
    return null;
  }

  function aiDrive(c, dt) {
    const a = c.ai;
    const ti = Math.floor(c.x / T), tj = Math.floor(c.y / T), m = M.conn(ti, tj);
    let tx, ty;
    if (!m) { // ירד מהכביש – חוזר למשבצת הכביש האחרונה
      tx = (a.lastI + 0.5) * T; ty = (a.lastJ + 0.5) * T; a.tileKey = -1;
    } else {
      const key = M.idx(ti, tj), cx = (ti + 0.5) * T, cy = (tj + 0.5) * T;
      if (a.tileKey !== key) {
        a.tileKey = key; a.lastI = ti; a.lastJ = tj;
        const opts = [];
        for (let d = 0; d < 4; d++) if ((m & DBIT[d]) && d !== (a.dir + 2) % 4) opts.push(d);
        if (!opts.length) a.next = (a.dir + 2) % 4;
        else if (opts.includes(a.dir)) a.next = opts.length > 1 && Math.random() < 0.35 ? pick(opts) : a.dir;
        else a.next = pick(opts);
        a.switched = a.next === a.dir;
      }
      if (!a.switched) {
        const s = (c.x - cx) * DIRS[a.dir][0] + (c.y - cy) * DIRS[a.dir][1];
        const turn = (a.next - a.dir + 4) % 4;
        if (s >= (turn === 1 ? -LANE : turn === 3 ? LANE : 0)) { a.dir = a.next; a.switched = true; }
      }
      const dx = DIRS[a.dir][0], dy = DIRS[a.dir][1];
      const along = (c.x - cx) * dx + (c.y - cy) * dy, L = 55 + Math.abs(c.speed) * 0.28;
      tx = cx - dy * LANE + dx * (along + L); ty = cy + dx * LANE + dy * (along + L);
    }
    const diff = angDiff(Math.atan2(ty - c.y, tx - c.x), c.ang);
    c.steer = clamp(diff * 2.4, -1, 1);
    let limit = a.panicT > 0 ? 330 : a.cruise;
    if (!a.switched || Math.abs(diff) > 0.45) limit *= 0.55;
    if (a.panicT > 0) a.panicT -= dt;
    if (a.ghostT > 0) a.ghostT -= dt;
    const ob = a.ghostT > 0 ? null : blockedAhead(c, 34 + Math.abs(c.speed) * 0.55);
    c.hb = false;
    if (ob) {
      c.thr = c.speed > 8 ? -1 : 0;
      a.blockT += dt;
      if (a.blockT > 1.6 && a.honkCd <= 0 && (ob === G.player.car || ob === G.player)) { a.honkCd = 3; if (Math.hypot(c.x - G.player.x, c.y - G.player.y) < 500) NC.Sound.play('honk', 0.6); }
      if (a.blockT > 5) { a.ghostT = 2.5; a.blockT = 0; }
    } else {
      a.blockT = Math.max(0, a.blockT - dt);
      c.thr = c.speed < limit ? 0.75 : c.speed > limit + 35 ? -0.5 : 0;
    }
    if (a.honkCd > 0) a.honkCd -= dt;
    // נתקע על קיר? קצת רוורס ומנסים שוב
    if (a.revT > 0) { a.revT -= dt; c.thr = -0.8; c.steer = -c.steer; return; }
    if (c.thr > 0 && Math.abs(c.speed) < 12) { a.stuckT += dt; if (a.stuckT > 1.6) { a.revT = 1; a.stuckT = 0; } } else a.stuckT = 0;
  }

  // ---------------- משטרה ----------------
  const field = new Int16Array(N * N);
  function buildField(x, y) {
    field.fill(-1);
    const [si, sj] = M.nearestRoad(x, y);
    const q = [si, sj]; field[M.idx(si, sj)] = 0;
    for (let h = 0; h < q.length; h += 2) {
      const i = q[h], j = q[h + 1], d = field[M.idx(i, j)] + 1;
      for (let k = 0; k < 4; k++) {
        const ni = i + DIRS[k][0], nj = j + DIRS[k][1];
        if (M.isRoad(ni, nj) && field[M.idx(ni, nj)] < 0) { field[M.idx(ni, nj)] = d; q.push(ni, nj); }
      }
    }
  }
  const playerPos = () => (G.player.car ? G.player.car : G.player);
  const playerSpeed = () => (G.player.car ? Math.hypot(G.player.car.vx, G.player.car.vy) : Math.hypot(G.player.vx, G.player.vy));

  function copDrive(c, dt) {
    const a = c.ai, pp = playerPos(), P = G.player;
    const pvx = P.car ? P.car.vx : P.vx, pvy = P.car ? P.car.vy : P.vy;
    const dist = Math.hypot(pp.x - c.x, pp.y - c.y);
    let tx = pp.x + pvx * 0.35, ty = pp.y + pvy * 0.35;
    const ti = Math.floor(c.x / T), tj = Math.floor(c.y / T);
    if (dist > 300) {
      if (M.isRoad(ti, tj)) {
        let bi = ti, bj = tj, bd = field[M.idx(ti, tj)];
        for (let s = 0; s < 2; s++) { // שני צעדים קדימה במורד שדה המרחק
          let ni = bi, nj = bj;
          for (let k = 0; k < 4; k++) { const qi = bi + DIRS[k][0], qj = bj + DIRS[k][1]; if (M.isRoad(qi, qj)) { const fd = field[M.idx(qi, qj)]; if (fd >= 0 && fd < bd) { bd = fd; ni = qi; nj = qj; } } }
          bi = ni; bj = nj;
        }
        tx = (bi + 0.5) * T; ty = (bj + 0.5) * T;
      } else { const [ri, rj] = M.nearestRoad(c.x, c.y); tx = (ri + 0.5) * T; ty = (rj + 0.5) * T; }
    }
    const diff = angDiff(Math.atan2(ty - c.y, tx - c.x), c.ang);
    c.hb = false;
    if (a.revT > 0) { a.revT -= dt; c.thr = -1; c.steer = diff > 0 ? -1 : 1; return; }
    c.steer = clamp(diff * 2.6, -1, 1);
    const ram = G.wanted >= 3 && !!P.car; // לא דורסים שחקן שהולך ברגל
    if (dist < 150 && !ram) c.thr = c.speed > playerSpeed() + 50 ? -0.7 : 0.6;
    else if (Math.abs(diff) > 1.0 && c.speed > 170) { c.thr = -0.6; c.hb = Math.abs(diff) > 1.7; }
    else c.thr = c.speed > c.d.max * (ram ? 1 : 0.85) ? 0 : 1;
    if (Math.abs(c.speed) < 22 && dist > 110) { a.stuckT += dt; if (a.stuckT > 1.4) { a.revT = 1.1; a.stuckT = 0; } } else a.stuckT = 0;
  }

  function spawnCop() {
    const pp = playerPos();
    for (let n = 0; n < 40; n++) {
      const [i, j] = pick(M.roadTiles), x = (i + 0.5) * T, y = (j + 0.5) * T, d = Math.hypot(x - pp.x, y - pp.y);
      if (d < 750 || d > 1250) continue;
      if (G.cars.some((o) => Math.abs(o.x - x) < 100 && Math.abs(o.y - y) < 100)) continue;
      const c = makeCar('police', x, y, Math.atan2(pp.y - y, pp.x - x), { driver: 'ai' });
      c.ai = newAI(0, true);
      return c;
    }
    return null;
  }

  function crime(n) {
    if (n <= 0 || G.dead) return;
    if (G.crimeCd > 0 && G.wanted > 0) return;
    const before = G.wanted;
    G.wanted = Math.min(5, G.wanted + n); G.hideT = 0; G.crimeCd = 2.5;
    if (G.wanted > before) { G.starFlash = 1.5; NC.Sound.play('star'); }
  }
  function clearWanted(evaded) {
    if (!G.wanted) return;
    G.wanted = 0; G.hideT = 0; G.bustT = 0;
    for (const c of G.cars) if (c.ai && c.ai.cop) { c.ai.cop = false; c.ai.tileKey = -1; c.ai.dir = Math.round(((c.ang % TAU) + TAU) % TAU / (Math.PI / 2)) % 4; c.ai.switched = true; }
    if (evaded) { NC.ui.toast('😎 You lost the cops'); NC.Sound.play('clear'); }
  }

  function updatePolice(dt) {
    const pp = playerPos();
    let near = 1e9, seen = false, count = 0, close = false;
    for (const c of G.cars) {
      if (c.dead || !c.ai) continue;
      if (c.type === 'police' && !c.ai.cop && G.wanted > 0 && Math.hypot(c.x - pp.x, c.y - pp.y) < 650) c.ai.cop = true;
      if (!c.ai.cop) continue;
      count++;
      const d = Math.hypot(c.x - pp.x, c.y - pp.y);
      if (d < near) near = d;
      if (d < 560) seen = true;
      if (d < 105 && Math.abs(c.speed) < 130) close = true;
    }
    G.copDist = near;
    if (G.crimeCd > 0) G.crimeCd -= dt;
    if (G.starFlash > 0) G.starFlash -= dt;
    if (!G.wanted) { G.bustT = 0; return; }
    G.hideT = seen ? 0 : G.hideT + dt;
    if (G.hideT > 9 + G.wanted * 2.5) { clearWanted(true); return; }
    G.copCd -= dt;
    if (count < [0, 1, 2, 3, 5, 7][G.wanted] && G.copCd <= 0) { spawnCop(); G.copCd = 2; }
    G.fieldT -= dt;
    if (G.fieldT <= 0) { G.fieldT = 0.35; buildField(pp.x, pp.y); }
    if (close && playerSpeed() < 38) G.bustT += dt; else G.bustT = Math.max(0, G.bustT - dt * 2);
    if (G.bustT > (G.player.car ? 1.7 : 0.8)) die('busted');
  }

  // ---------------- השחקן ----------------
  function hurtPlayer(dmg) {
    const P = G.player;
    if (G.dead || dmg <= 0) return;
    P.hp -= dmg; G.hurtFlash = 0.4;
    if (P.hp <= 0) { P.hp = 0; die('wasted'); }
  }
  function die(kind) {
    if (G.dead) return;
    G.dead = { kind, t: 0 };
    NC.Sound.play(kind === 'busted' ? 'fail' : 'wasted');
    if (NC.mission) NC.mission.fail(kind === 'busted' ? 'You were busted' : 'You were wasted');
  }
  function respawn() {
    const P = G.player, kind = G.dead.kind;
    const s = kind === 'busted' ? M.special.police : M.special.hospital;
    if (P.car) { P.car.driver = null; P.car = null; }
    P.x = s.x; P.y = s.y; P.vx = P.vy = 0; P.hp = 100; P.stun = 0;
    const fee = kind === 'busted' ? Math.min(G.money, 100 + Math.floor(G.money * 0.1)) : Math.min(G.money, 100);
    G.money -= fee;
    clearWanted(false);
    G.cars = G.cars.filter((c) => !(c.ai && c.ai.cop) || Math.hypot(c.x - s.x, c.y - s.y) > 900);
    G.dead = null; G.bustT = 0;
    NC.ui.toast(kind === 'busted' ? `🚓 Released from the station. Fine: $${fee}` : `🏥 Patched up at the hospital. Bill: $${fee}`);
    NC.saveGame();
  }

  function nearestEnterable() {
    const P = G.player; let best = null, bd = 1e9;
    for (const c of G.active) {
      if (c.dead || c.burnT > 0) continue;
      const d = Math.hypot(c.x - P.x, c.y - P.y) - c.d.len / 2;
      if (d < 42 && d < bd && Math.hypot(c.vx, c.vy) < 110) { bd = d; best = c; }
    }
    return best;
  }
  function enterExit() {
    const P = G.player;
    if (G.dead || P.stun > 0) return;
    if (P.car) {
      const c = P.car;
      if (Math.abs(c.speed) > 75) { NC.ui.toast('Slow down before getting out'); return; }
      const rx = -Math.sin(c.ang), ry = Math.cos(c.ang), off = c.d.wid / 2 + 13;
      P.x = c.x - rx * off; P.y = c.y - ry * off;
      if (M.insideB(P.x, P.y, 6)) { P.x = c.x + rx * off; P.y = c.y + ry * off; }
      P.car = null; c.driver = null; c.thr = 0; c.steer = 0; c.hb = true; P.vx = P.vy = 0;
      NC.Sound.play('door');
      return;
    }
    const c = nearestEnterable();
    if (!c) return;
    if (c.driver === 'ai') {
      const wasCop = c.ai && c.ai.cop || c.type === 'police';
      ejectDriver(c, false);
      crime(wasCop ? Math.max(1, 2 - G.wanted) : (G.copDist < 600 || Math.random() < 0.45 ? 1 : 0));
    }
    c.ai = null; c.driver = 'player'; c.parked = false; c.hb = false; P.car = c;
    NC.Sound.play('door');
    if (NC.mission) NC.mission.onEnterCar(c);
  }

  function updatePlayer(dt) {
    const P = G.player, I = NC.input;
    if (P.stun > 0) P.stun -= dt;
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    if (!G.dead && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 1.2); // התאוששות איטית
    if (P.car) {
      const c = P.car;
      if (G.dead) { c.thr = 0; c.steer = 0; c.hb = true; }
      else if (I.analog) {
        const mag = Math.hypot(I.mx, I.my);
        if (mag > 0.15) {
          const diff = angDiff(Math.atan2(I.my, I.mx), c.ang);
          if (Math.abs(diff) > 2.1 && c.speed < 90) { c.thr = -mag; c.steer = diff > 0 ? -1 : 1; }
          else { c.steer = clamp(diff * 2.2, -1, 1); c.thr = mag * (Math.abs(diff) > 1.3 ? 0.55 : 1); }
        } else { c.thr = 0; c.steer = 0; }
        c.hb = I.hb;
      } else { c.thr = I.thr; c.steer = I.steer; c.hb = I.hb; }
      P.x = c.x; P.y = c.y; P.ang = c.ang;
      // סימני צמיגים
      if ((c.slip > 110 || (c.hb && Math.abs(c.speed) > 80)) && M.tileAt(c.x, c.y) === M.ROAD) {
        const fx = Math.cos(c.ang), fy = Math.sin(c.ang), o = c.d.len * 0.32, w = c.d.wid * 0.4;
        const l = [c.x - fx * o + fy * w, c.y - fy * o - fx * w], r = [c.x - fx * o - fy * w, c.y - fy * o + fx * w];
        if (c.sk) { G.skids.push({ x1: c.sk[0][0], y1: c.sk[0][1], x2: l[0], y2: l[1], life: 14 }, { x1: c.sk[1][0], y1: c.sk[1][1], x2: r[0], y2: r[1], life: 14 }); if (G.skids.length > 420) G.skids.splice(0, 2); }
        c.sk = [l, r];
        if (Math.random() < dt * 14) addPart(c.x - fx * o, c.y - fy * o, rand(-20, 20), rand(-20, 20), 0.6, 6, '#d8d8d8', 16, 0.3);
      } else c.sk = null;
      return;
    }
    if (G.dead || P.stun > 0) { P.x += P.vx * dt; P.y += P.vy * dt; const f = Math.exp(-4 * dt); P.vx *= f; P.vy *= f; pushOutOfBuildings(P, 9); return; }
    const mag = Math.hypot(I.mx, I.my);
    if (mag > 0.1) {
      const sp = (I.sprint || mag > 0.92 && I.analog ? 195 : 125) * Math.min(1, mag);
      P.vx = (I.mx / mag) * sp; P.vy = (I.my / mag) * sp;
      P.ang = Math.atan2(I.my, I.mx); P.walk += dt * sp * 0.085;
    } else { P.vx = P.vy = 0; }
    P.x += P.vx * dt; P.y += P.vy * dt;
    pushOutOfBuildings(P, 9);
    // לא עוברים דרך מכוניות
    for (const c of G.active) {
      if (Math.abs(c.x - P.x) > 60 || Math.abs(c.y - P.y) > 60) continue;
      const r = circles(c, CX, CY) + 8;
      for (let k = 0; k < 3; k++) { const dx = P.x - CX[k], dy = P.y - CY[k], d = Math.hypot(dx, dy); if (d < r && d > 0.01) { P.x += dx / d * (r - d); P.y += dy / d * (r - d); } }
    }
    if (M.isDeep(P.x, P.y)) { NC.Sound.play('splash'); hurtPlayer(1000); }
  }

  // ---------------- עדכון ראשי ----------------
  function update(dt) {
    const P = G.player;
    G.time += dt; G.playTime += dt;
    G.clock = (G.clock + dt / 12) % 24;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    const pp = playerPos();
    G.active = G.cars.filter((c) => Math.abs(c.x - pp.x) < 1700 && Math.abs(c.y - pp.y) < 1700);
    updatePlayer(dt);

    for (const c of G.active) {
      if (c.dead) { stepCar(c, dt); continue; }
      if (c.ai) { if (c.ai.cop && G.wanted > 0) copDrive(c, dt); else aiDrive(c, dt); }
      else if (c.driver !== 'player') { c.thr = 0; c.steer = 0; c.hb = true; }
      if (c.parked && !c.vx && !c.vy) continue;
      stepCar(c, dt);
      collideStatic(c);
      if (M.isDeep(c.x, c.y)) { // נפילה למים עמוקים
        if (P.car === c) { NC.Sound.play('splash'); P.car = null; c.dead = true; c.gone = true; hurtPlayer(1000); }
        else { c.dead = true; c.gone = true; }
        for (let i = 0; i < 12; i++) addPart(c.x, c.y, rand(-90, 90), rand(-90, 90), 0.8, 5, '#e8f8ff', 10, 0.7);
      }
      // עשן ואש
      const hf = c.hp / c.d.hp;
      if (c.burnT > 0) {
        c.burnT -= dt;
        const fx = Math.cos(c.ang) * c.d.len * 0.3, fy = Math.sin(c.ang) * c.d.len * 0.3;
        if (Math.random() < dt * 30) addPart(c.x + fx + rand(-6, 6), c.y + fy + rand(-6, 6), rand(-20, 20), rand(-50, -10), 0.5, rand(4, 8), pick(['#ff9a2e', '#ffd166', '#ff5a1f']), 6, 0.9, true);
        if (Math.random() < dt * 10) addPart(c.x + fx, c.y + fy, rand(-20, 20), rand(-50, -20), 1.4, 7, '#2b2b2b', 18, 0.5);
        if (c.burnT <= 0) explodeCar(c);
      } else if (hf < 0.5 && Math.random() < dt * (hf < 0.25 ? 14 : 6)) {
        const fx = Math.cos(c.ang) * c.d.len * 0.35, fy = Math.sin(c.ang) * c.d.len * 0.35;
        addPart(c.x + fx, c.y + fy, rand(-15, 15) + c.vx * 0.3, rand(-40, -15) + c.vy * 0.3, 1.1, 5, hf < 0.25 ? '#3a3a3a' : '#c9c9c9', 16, 0.45);
      }
    }
    const act = G.active;
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) { if (!act[i].gone && !act[j].gone) collideCars(act[i], act[j]); }

    // הולכי רגל מול מכוניות
    for (const p of G.peds) {
      updatePed(p, dt);
      if (p.st === 'down') continue;
      for (const c of act) {
        if (Math.abs(c.x - p.x) > 55 || Math.abs(c.y - p.y) > 55) continue;
        const r = circles(c, CX, CY) + 7, sp = Math.hypot(c.vx, c.vy);
        for (let k = 0; k < 3; k++) {
          const dx = p.x - CX[k], dy = p.y - CY[k], d = Math.hypot(dx, dy);
          if (d >= r || d < 0.01) continue;
          if (sp > 75 && !p.tag) {
            knockPed(p, c.vx * 0.9 + dx / d * 60, c.vy * 0.9 + dy / d * 60);
            if (Math.hypot(p.x - P.x, p.y - P.y) < 700) NC.Sound.play('thud');
            if (c === P.car) { crime(1); for (const q of G.peds) if (q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 260) fleePed(q, c.x, c.y); }
          } else { p.x += dx / d * (r - d); p.y += dy / d * (r - d); }
          break;
        }
      }
      // בורחים ממכונית שדוהרת לעברם
      if (P.car && p.st === 'walk') {
        const c = P.car, sp = Math.hypot(c.vx, c.vy);
        if (sp > 230) { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (d < 150 && (dx * c.vx + dy * c.vy) / (d * sp + 0.01) > 0.75) fleePed(p, c.x, c.y); }
      }
    }
    // השחקן ברגל מול מכוניות
    if (!P.car && !G.dead) {
      for (const c of act) {
        const sp = Math.hypot(c.vx, c.vy);
        if (sp < 80 || Math.abs(c.x - P.x) > 55 || Math.abs(c.y - P.y) > 55) continue;
        const r = circles(c, CX, CY) + 7;
        for (let k = 0; k < 3; k++) {
          const d = Math.hypot(P.x - CX[k], P.y - CY[k]);
          if (d < r && P.stun <= 0) { P.stun = 0.8; P.vx = c.vx * 0.8; P.vy = c.vy * 0.8; NC.Sound.play('thud'); hurtPlayer(sp * 0.11); G.shake = 8; break; }
        }
      }
    }

    updatePolice(dt);

    // חלקיקים, סימני צמיגים, טקסט צף
    for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; if (p.grow) p.r += p.grow * dt; }
    G.parts = G.parts.filter((p) => p.life > 0);
    for (const s of G.skids) s.life -= dt;
    if (G.skids.length && G.skids[0].life <= 0) G.skids = G.skids.filter((s) => s.life > 0);
    for (const f of G.floaters) { f.y -= 30 * dt; f.life -= dt; }
    G.floaters = G.floaters.filter((f) => f.life > 0);

    // הופעה והיעלמות של תנועה והולכי רגל
    G.spawnT = (G.spawnT || 0) - dt;
    if (G.spawnT <= 0) {
      G.spawnT = 0.25;
      let ai = 0;
      G.cars = G.cars.filter((c) => {
        if (c.gone) return false;
        if (c === P.car || c.tag) return true;
        const d = Math.hypot(c.x - pp.x, c.y - pp.y);
        if (c.ai) { if (d > 1900) return false; ai++; return true; }
        if (c.dead) return d < 1500;
        if (!c.parked) return d < 2300;
        return true;
      });
      if (ai < 26) spawnTraffic(false);
      G.peds = G.peds.filter((p) => p.tag || Math.hypot(p.x - pp.x, p.y - pp.y) < 1500);
      if (G.peds.length < 36) spawnPed(false);
    }
    if (NC.mission) NC.mission.update(dt);
  }

  NC.world = { resetWorld, update, makeCar, makePed, enterExit, nearestEnterable, crime, clearWanted, respawn, die, hurtPlayer, addPart, addFloater, playerPos, playerSpeed, damageCar, spawnCop, fleePed };
})();
