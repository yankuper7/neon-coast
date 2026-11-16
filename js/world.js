/* חוף ניאון – העולם: מכוניות, פיזיקה, הולכי רגל, תנועה עם רמזורים, משטרה */
'use strict';
(() => {
  const NC = window.NC;
  const { clamp, rand, pick, angDiff, TAU } = NC;
  const M = NC.map, T = M.T, N = M.N, Fx = NC.fx, Wx = NC.weather;

  const CARS = NC.CARS = {
    compact: { name: 'Compact', len: 48, wid: 24, acc: 500, max: 320, grip: 7.5, steer: 3.0, hp: 100, mass: 0.9 },
    sedan: { name: 'Sedan', len: 56, wid: 26, acc: 540, max: 360, grip: 7, steer: 2.8, hp: 110, mass: 1 },
    sports: { name: 'Sports', len: 56, wid: 26, acc: 820, max: 520, grip: 8.5, steer: 3.1, hp: 90, mass: 0.95 },
    muscle: { name: 'Muscle', len: 58, wid: 27, acc: 720, max: 450, grip: 6.4, steer: 2.9, hp: 125, mass: 1.15 },
    pickup: { name: 'Pickup', len: 60, wid: 28, acc: 500, max: 340, grip: 6.5, steer: 2.6, hp: 150, mass: 1.4 },
    van: { name: 'Truck', len: 74, wid: 32, acc: 400, max: 290, grip: 6, steer: 2.2, hp: 230, mass: 2.2 },
    taxi: { name: 'Taxi', len: 56, wid: 26, acc: 560, max: 370, grip: 7, steer: 2.8, hp: 120, mass: 1 },
    police: { name: 'Police', len: 56, wid: 26, acc: 760, max: 480, grip: 8.5, steer: 3.0, hp: 170, mass: 1.2 },
  };
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#ecf0f1', '#34495e', '#e67e22', '#9b59b6', '#1abc9c', '#ff7eb6', '#95a5a6', '#c0392b', '#16a085'];
  const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#2ecc71', '#ff7eb6', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];
  const SKINS = ['#f2c9a1', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const HAIRS = ['#2b1d0e', '#4a2f17', '#111111', '#b5651d', '#d9b36c', '#777777'];
  const UMBS = ['#e74c3c', '#3498db', '#f1c40f', '#222831', '#ff7eb6', '#ecf0f1', '#2ecc71'];
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // מזרח, דרום, מערב, צפון
  const DBIT = [2, 4, 8, 1];
  const LANE = 21, WALK = 51;

  const G = NC.G = {};
  // כמה תנועה והולכי רגל לדמות – הממשק מקטין את זה במכשירים חלשים
  const SIM = NC.sim = { cars: 26, peds: 36 };
  let uid = 0;
  const newStats = () => ({ dist: 0, crashes: 0, wrecked: 0, pedsHit: 0, busted: 0, wasted: 0, evaded: 0, maxStars: 0, jobs: 0, earned: 0, topSpeed: 0, stolen: 0 });

  function resetWorld(save) {
    const home = M.special.home;
    Fx.clear(); Wx.reset(save && save.weather);
    let px = home.x, py = home.y, pang = Math.PI / 2;
    const sp = save && save.pos;
    if (sp && isFinite(sp.x + sp.y) && !M.insideB(sp.x, sp.y, 12) && M.tileAt(sp.x, sp.y) !== M.WATER) { px = sp.x; py = sp.y; pang = sp.ang || 0; }
    Object.assign(G, {
      cars: [], peds: [], parts: Fx.list, skids: [], floaters: [], active: [], time: 0,
      clock: save && save.clock >= 0 && save.clock < 24 ? save.clock : 15, day: save && save.day > 0 ? save.day : 1,
      wanted: 0, hideT: 0, crimeCd: 0, bustT: 0, copCd: 0, copDist: 1e9, fieldT: 0, seen: false, contact: false, patrolNear: false, seeT: 0, lkp: { x: px, y: py }, blockCd: 6, officers: 0,
      heli: { mode: 0, on: false, x: 0, y: 0, lx: 0, ly: 0, ang: 0, fuel: 0, cd: 4, vx: 0, vy: 0 },
      money: save ? save.money : 50, done: save && Array.isArray(save.done) ? save.done.slice() : [], pkgs: save && Array.isArray(save.pkgs) ? save.pkgs.slice() : [],
      playTime: save ? save.playTime || 0 : 0, stats: Object.assign(newStats(), save && save.stats), best: Object.assign({}, save && save.best), fails: Object.assign({}, save && save.fails),
      player: { x: px, y: py, ang: pang, vx: 0, vy: 0, hp: save && save.hp > 5 ? Math.min(100, save.hp) : 100, car: null, walk: 0, stun: 0 },
      shake: 0, dead: null, mission: null, starFlash: 0, hurtFlash: 0, spawnT: 0, attract: false, lastCrash: 0,
    });
    for (const s of M.parkSpots) makeCar(pick(['compact', 'sedan', 'sedan', 'pickup', 'sports', 'van', 'compact', 'muscle']), s.x, s.y, s.ang, { parked: true });
    // רכב ראשון ליד הבית
    makeCar('compact', home.x + 90, home.y + 20, 0, { parked: true, color: '#ff7eb6' });
    // הרכב שבו נשמר המשחק
    if (save && save.car && CARS[save.car.type]) {
      G.cars = G.cars.filter((c) => Math.hypot(c.x - px, c.y - py) > 80);
      const c = makeCar(save.car.type, px, py, pang, { color: save.car.color });
      c.hp = clamp(save.car.hp || c.d.hp, c.d.hp * 0.3, c.d.hp); c.driver = 'player'; G.player.car = c;
    }
    for (let i = 0; i < SIM.cars; i++) spawnTraffic(true);
    for (let i = 0; i < SIM.peds; i++) spawnPed(true);
  }

  // מה שנשמר בין הפעלות
  function serialize() {
    const P = G.player, c = P.car;
    return {
      money: Math.floor(G.money), done: G.done.slice(), pkgs: G.pkgs.slice(), playTime: Math.round(G.playTime), clock: +G.clock.toFixed(2), day: G.day,
      weather: Wx.serialize(), pos: { x: Math.round(P.x), y: Math.round(P.y), ang: +P.ang.toFixed(2) }, hp: Math.round(P.hp),
      car: c && !c.dead && !c.burnT && !c.tag ? { type: c.type, color: c.color, hp: Math.round(c.hp) } : null,
      stats: G.stats, best: G.best, fails: G.fails,
    };
  }

  // ---------------- מכוניות ----------------
  function makeCar(type, x, y, ang, opts = {}) {
    const d = CARS[type];
    const c = {
      id: ++uid, type, d, x, y, ang, vx: 0, vy: 0, thr: 0, steer: 0, hb: false, speed: 0, slip: 0, hp: d.hp,
      color: opts.color || (type === 'taxi' ? '#ffd23f' : type === 'police' ? '#f4f6f8' : pick(COLORS)),
      driver: opts.driver || null, ai: null, parked: !!opts.parked, tag: opts.tag || null,
      burnT: 0, dead: false, hitT: 0, seed: Math.random() * 1000, brake: false, sk: null, steerVis: 0, roll: 0, ground: M.ROAD, blink: 0,
      block: false, officer: null, byPlayer: -99, ramT: -99,
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
    const power = (c.hp < d.hp * 0.25 ? 0.6 : 1) * (c.boost || 1);
    const ground = M.tileAt(c.x, c.y);
    const soft = ground === M.WATER ? 0.45 : ground === M.SAND || ground === M.GLADE ? 0.75 : 1;
    c.brake = false;
    if (c.thr > 0) vf += (vf < -5 ? d.acc * 2.2 : d.acc * power * soft * (1 - clamp(vf / (d.max * (c.boost || 1)), 0, 1) * 0.85)) * c.thr * dt;
    else if (c.thr < 0) { vf += (vf > 5 ? -d.acc * 2.4 : -d.acc * 0.6 * (1 - clamp(-vf / (d.max * 0.4), 0, 1))) * -c.thr * dt; c.brake = vf > 5; }
    else { const dec = 130 * dt; vf = Math.abs(vf) < dec ? 0 : vf - Math.sign(vf) * dec; }
    vf -= vf * (soft < 0.5 ? 2.6 : soft < 1 ? 0.9 : 0.25) * dt;
    let grip = d.grip * (ground === M.ROAD ? Wx.grip() : 1);
    if (c.hb) { grip *= 0.16; vf -= vf * 1.7 * dt; c.brake = true; }
    c.slip = Math.abs(vr);
    c.steerVis += (c.steer - c.steerVis) * Math.min(1, dt * 12);
    c.roll += (clamp(vr * 0.012 + c.steer * vf * 0.004, -2.2, 2.2) - c.roll) * Math.min(1, dt * 8);
    c.ground = ground;
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

  const nearPlayer = (x, y) => Math.abs(x - G.player.x) < 900 && Math.abs(y - G.player.y) < 700;
  function impactFx(c, x, y, impact) {
    if (impact < 110) return;
    const P = G.player;
    if (nearPlayer(c.x, c.y)) NC.Sound.play('crash', clamp(impact / 400, 0.3, 1), c.x);
    Fx.sparks(x, y, Math.min(14, Math.round(impact / 28)), 120 + impact * 0.7);
    if (impact > 240) Fx.debris(x, y, Math.min(8, Math.round(impact / 90)), c.color, impact * 0.8);
    if (P.car === c) {
      G.shake = Math.max(G.shake, Math.min(14, impact / 30));
      if (impact > 200 && G.time - G.lastCrash > 0.6) { G.stats.crashes++; G.lastCrash = G.time; NC.ui.buzz(Math.min(120, impact / 4)); }
    }
  }

  function damageCar(c, amt) {
    if (c.dead || amt <= 0) return;
    c.hp -= amt; c.hitT = 0.15;
    if (c.hp <= 0 && !c.burnT) {
      c.hp = 0; c.burnT = 4.5;
      if (c.driver === 'ai' || c.ai) ejectDriver(c, true);
      if (G.player.car === c) NC.ui.toast('🔥 The car is on fire! Get out!', 'warn');
    } else if (c.hp < c.d.hp * 0.3 && c.driver === 'ai' && !c.tag && !(c.ai && (c.ai.cop || c.ai.racer)) && Math.random() < 0.4) ejectDriver(c, true);
  }

  function collideStatic(c) {
    const r = circles(c, CX, CY);
    const ti = Math.floor(c.x / T), tj = Math.floor(c.y / T);
    const mine = G.player.car === c, dm = mine ? NC.diff().dmg : 1;
    for (let j = tj - 1; j <= tj + 1; j++) for (let i = ti - 1; i <= ti + 1; i++) {
      if (!M.inb(i, j)) continue;
      const k0 = M.idx(i, j);
      for (const b of M.bGrid[k0]) {
        if (c.x < b.x - 50 || c.x > b.x + b.w + 50 || c.y < b.y - 50 || c.y > b.y + b.h + 50) continue;
        for (let k = 0; k < 3; k++) {
          const px = clamp(CX[k], b.x, b.x + b.w), py = clamp(CY[k], b.y, b.y + b.h);
          const dx = CX[k] - px, dy = CY[k] - py, d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          let nx, ny, pen;
          if (d < 0.001) { // המרכז בתוך הבניין – יוצאים דרך הצלע הקרובה
            const l = CX[k] - b.x, rr2 = b.x + b.w - CX[k], t = CY[k] - b.y, bt = b.y + b.h - CY[k], mn = Math.min(l, rr2, t, bt);
            nx = mn === l ? -1 : mn === rr2 ? 1 : 0; ny = nx ? 0 : mn === t ? -1 : 1; pen = mn + r;
          } else { nx = dx / d; ny = dy / d; pen = r - d; }
          const imp = bump(c, nx, ny, pen, k, 0.2);
          if (imp > 90) { damageCar(c, (imp - 90) * 0.085 * dm); impactFx(c, px, py, imp); if (mine && imp > 260) hurtPlayer((imp - 260) * 0.04); }
          circles(c, CX, CY);
        }
      }
      for (const t of M.tGrid[k0]) {
        for (let k = 0; k < 3; k++) {
          const dx = CX[k] - t.x, dy = CY[k] - t.y, d2 = dx * dx + dy * dy, rr2 = r + t.r;
          if (d2 >= rr2 * rr2 || d2 < 0.0001) continue;
          const d = Math.sqrt(d2);
          const imp = bump(c, dx / d, dy / d, rr2 - d, k, 0.15);
          if (imp > 90) { damageCar(c, (imp - 90) * 0.07 * dm); impactFx(c, t.x, t.y, imp); t.shake = 0.5; }
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
    const sa = Math.hypot(a.vx, a.vy), sb = Math.hypot(b.vx, b.vy); // מהירויות לפני הפגיעה – מי נגח במי
    const jimp = -(1.3) * rel / (1 / ma + 1 / mb);
    a.vx += bn * jimp / ma; a.vy += bm * jimp / ma;
    b.vx -= bn * jimp / mb; b.vy -= bm * jimp / mb;
    const imp = -rel;
    const oa = (ka - 1) * (a.d.len / 2 - ra), ob = (kb - 1) * (b.d.len / 2 - rb);
    a.ang += clamp((Math.cos(a.ang) * oa * bm - Math.sin(a.ang) * oa * bn) * imp * 0.00003 * (mb / tot) * 2, -0.3, 0.3);
    b.ang -= clamp((Math.cos(b.ang) * ob * bm - Math.sin(b.ang) * ob * bn) * imp * 0.00003 * (ma / tot) * 2, -0.3, 0.3);
    a.parked = b.parked = false;
    if (imp > 80) {
      const P = G.player, mine = P.car === a || P.car === b, dm = NC.diff().dmg;
      damageCar(a, (imp - 80) * 0.07 * (mb / tot) * 2 * (P.car === a ? dm : 1)); damageCar(b, (imp - 80) * 0.07 * (ma / tot) * 2 * (P.car === b ? dm : 1));
      impactFx(mine ? P.car : a, (a.x + b.x) / 2, (a.y + b.y) / 2, imp);
      if (mine) {
        const other = P.car === a ? b : a;
        other.byPlayer = G.time;
        if (imp > 140 && (P.car === a ? sa : sb) > 70) other.ramT = G.time; // השחקן הוא שנגח
        if (imp > 260) hurtPlayer((imp - 260) * 0.03);
        const copCar = other.type === 'police' && (other.ai || other.block);
        const iRammed = (P.car === a ? sa : sb) >= (P.car === a ? sb : sa) * 0.9; // ניידת שנגחה בשחקן אינה עבירה שלו
        if (copCar && imp > 140 && iRammed) crime(G.wanted < 2 ? 2 - G.wanted : imp > 300 && G.wanted < 4 ? 1 : 0);
        else if (!copCar && !other.tag && imp > 190 && G.wanted === 0 && G.patrolNear) crime(1); // נהיגה פרועה מול ניידת
        if (other.ai && !other.ai.cop && imp > 150) other.ai.panicT = 6;
        if (imp > 230) for (const q of G.peds) if (Math.abs(q.x - a.x) < 230 && Math.abs(q.y - a.y) < 230) fleePed(q, a.x, a.y);
      }
    }
  }

  function explodeCar(c) {
    const wasCop = c.type === 'police' && (c.ai || c.block);
    c.dead = true; c.burnT = 0; c.color = '#2b2b2b'; c.driver = null; c.ai = null; c.block = false;
    if (nearPlayer(c.x, c.y)) { NC.Sound.play('boom', 1, c.x); G.shake = Math.max(G.shake, 16); NC.ui.buzz(200); }
    Fx.explosion(c.x, c.y);
    G.skids.push({ scorch: true, x1: c.x, y1: c.y, r: 60, life: 60 });
    const P = G.player;
    if (G.time - c.byPlayer < 8) { G.stats.wrecked++; if (wasCop) crime(1, true); }
    if (P.car === c) { P.car = null; hurtPlayer(1000); }
    else if (!P.car && Math.hypot(P.x - c.x, P.y - c.y) < 110) hurtPlayer(70);
    for (const o of G.cars) { if (o === c || o.dead) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < 130 && d > 0.1) { damageCar(o, 60); o.vx += (o.x - c.x) / d * 200; o.vy += (o.y - c.y) / d * 200; o.parked = false; } }
    for (const p of G.peds) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < 140 && d > 0.1) knockPed(p, (p.x - c.x) / d * 260, (p.y - c.y) / d * 260); else if (d < 500) fleePed(p, c.x, c.y); }
    if (NC.mission) NC.mission.onCarDestroyed(c);
  }

  function addPart(x, y, vx, vy, life, r, color, grow, a, glow) { return Fx.add(x, y, vx, vy, life, r, color, grow, a, glow, 0); }
  function addFloater(x, y, text, color) { G.floaters.push({ x, y, text, color: color || '#fff', life: 1.6 }); if (G.floaters.length > 20) G.floaters.shift(); }

  // ---------------- הולכי רגל ----------------
  function makePed(x, y, opts = {}) {
    const jog = !opts.tag && !opts.cop && Math.random() < 0.1;
    const p = {
      id: ++uid, x, y, ang: 0, vx: 0, vy: 0, st: 'walk', t: 0, axis: 'x', line: y, s: 1, speed: jog ? rand(92, 112) : rand(36, 56), dec: -1, pend: null,
      shirt: opts.shirt || pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS), ph: Math.random() * 10, fx: 0, fy: 0, tag: opts.tag || null,
      umb: jog || opts.cop || Math.random() > 0.6 ? null : pick(UMBS), cop: !!opts.cop, home: null, gone: false, jog,
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
      const [i, j] = pick(M.straightTiles);
      const x = (i + 0.5) * T, y = (j + 0.5) * T, d = Math.hypot(x - P.x, y - P.y);
      if (d > 1300 || d < (initial ? 250 : 800)) continue;
      const p = makePed(x + rand(-50, 50), y + rand(-50, 50));
      putOnSidewalk(p, i, j);
      if (p.axis === 'x') p.y = p.line; else p.x = p.line;
      return p;
    }
    return null;
  }
  function fleePed(p, fromX, fromY, secs) {
    if (p.st === 'down' || p.tag || p.cop) return;
    const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
    p.st = 'flee'; p.t = secs || rand(2.5, 4.5); p.fx = (p.x - fromX) / d; p.fy = (p.y - fromY) / d;
  }
  function knockPed(p, vx, vy) {
    if (p.st === 'down') return;
    p.st = 'down'; p.t = p.cop ? 2 : 2.8; p.vx = vx; p.vy = vy; p.ang = Math.atan2(vy, vx);
    for (let i = 0; i < 5; i++) addPart(p.x, p.y, rand(-70, 70), rand(-70, 70), 0.5, 3, '#ffffff', 0, 0.8);
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
    p.ph += dt * (p.st === 'flee' || p.st === 'cop' || p.jog ? 14 : 7);
    if (p.st === 'wait') return;
    if (p.st === 'down') {
      p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-3.5 * dt); p.vx *= f; p.vy *= f;
      pushOutOfBuildings(p, 8);
      p.t -= dt;
      if (p.t <= 0) { if (p.cop) p.st = 'cop'; else { p.st = 'flee'; p.t = 3; const a = Math.random() * TAU; p.fx = Math.cos(a); p.fy = Math.sin(a); } }
      return;
    }
    if (p.st === 'cop' || p.st === 'copback') { // שוטר רגלי: רודף אחרי השחקן, או חוזר לניידת
      const back = p.st === 'copback', home = p.home, pp = playerPos();
      if (back && (!home || home.dead || !G.cars.includes(home))) { p.gone = true; return; }
      const tx = back ? home.x : pp.x, ty = back ? home.y : pp.y, d = Math.hypot(tx - p.x, ty - p.y) || 1;
      if (back && d < 30) { p.gone = true; return; }
      if (!back && (!G.wanted || d > 560)) { p.st = 'copback'; return; }
      const sp = back ? 110 : 172;
      if (d > 14) { p.x += (tx - p.x) / d * sp * dt; p.y += (ty - p.y) / d * sp * dt; }
      p.ang = Math.atan2(ty - p.y, tx - p.x);
      pushOutOfBuildings(p, 8);
      return;
    }
    if (p.st === 'flee') {
      p.x += p.fx * 150 * dt; p.y += p.fy * 150 * dt; p.ang = Math.atan2(p.fy, p.fx);
      pushOutOfBuildings(p, 8);
      p.t -= dt; if (p.t <= 0) p.st = 'return';
      return;
    }
    if (p.st === 'hold' || p.st === 'idle') { p.t -= dt; if (p.t <= 0) p.st = 'walk'; return; }
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
      else if (!p.jog && Math.random() < 0.07) { p.st = 'idle'; p.t = rand(2, 6); return; } // עוצרים רגע
    }
    // בגשם, מי שאין לו מטרייה ממהר
    const step = p.s * p.speed * (Wx.rain > 0.3 && !p.umb ? 1.7 : 1) * dt;
    if (horiz) {
      const ni = Math.floor((p.x + step + p.s * 4) / T);
      // לפני חציית כביש בצומת מרומזר: מחכים שהתנועה החוצה תקבל אדום
      if (ni !== ti && M.signalAt(ni, tj) && M.canGo(ni, tj, false, G.time) !== 2) { p.st = 'hold'; p.t = 0.35; return; }
      p.x += step; p.y += (p.line - p.y) * Math.min(1, dt * 6); p.ang = p.s > 0 ? 0 : Math.PI;
      if (p.pend && (p.x - p.pend.at) * p.s >= 0) { p.x = p.pend.at; p.axis = 'y'; p.line = p.pend.at; p.s = p.pend.ns; p.pend = null; }
    } else {
      const nj = Math.floor((p.y + step + p.s * 4) / T);
      if (nj !== tj && M.signalAt(ti, nj) && M.canGo(ti, nj, true, G.time) !== 2) { p.st = 'hold'; p.t = 0.35; return; }
      p.y += step; p.x += (p.line - p.x) * Math.min(1, dt * 6); p.ang = p.s > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (p.pend && (p.y - p.pend.at) * p.s >= 0) { p.y = p.pend.at; p.axis = 'x'; p.line = p.pend.at; p.s = p.pend.ns; p.pend = null; }
    }
  }

  function ejectDriver(c, panic) {
    const rx = -Math.sin(c.ang), ry = Math.cos(c.ang);
    const p = makePed(c.x - rx * (c.d.wid / 2 + 12), c.y - ry * (c.d.wid / 2 + 12), c.type === 'police' ? { shirt: '#1f3a6e' } : {});
    pushOutOfBuildings(p, 8);
    fleePed(p, c.x + rand(-5, 5), c.y + rand(-5, 5));
    if (c.driver === 'ai') c.driver = null;
    c.ai = null; c.blink = 0;
    return p;
  }

  // ---------------- תנועה בכבישים ----------------
  function newAI(dir, cop) {
    return { dir, next: dir, plan: -1, switched: true, tileKey: -1, lastI: 0, lastJ: 0, cruise: rand(140, 205), blockT: 0, ghostT: 0, panicT: 0, honkCd: 0, cop: !!cop, stuckT: 0, revT: 0, passT: 0, ignore: null, hurryT: 0, search: false, route: null, racer: null, redStop: false, qd: 0 };
  }
  const headingDir = (ang) => Math.round(((ang % TAU) + TAU) % TAU / (Math.PI / 2)) % 4;
  function spawnTraffic(initial) {
    const P = G.player;
    for (let n = 0; n < 14; n++) {
      const [i, j] = pick(M.straightTiles), m = M.conn(i, j);
      const cx = (i + 0.5) * T, cy = (j + 0.5) * T, d = Math.hypot(cx - P.x, cy - P.y);
      if (d > 1600 || d < (initial ? 380 : 1050)) continue;
      const dir = m === 10 ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() < 0.5 ? 1 : 3);
      const x = cx - DIRS[dir][1] * LANE, y = cy + DIRS[dir][0] * LANE;
      if (G.cars.some((o) => Math.abs(o.x - x) < 110 && Math.abs(o.y - y) < 110)) continue;
      const r = Math.random();
      const type = r < 0.26 ? 'compact' : r < 0.52 ? 'sedan' : r < 0.63 ? 'pickup' : r < 0.71 ? 'van' : r < 0.83 ? 'taxi' : r < 0.89 ? 'sports' : r < 0.95 ? 'muscle' : 'police';
      const c = makeCar(type, x, y, Math.atan2(DIRS[dir][1], DIRS[dir][0]), { driver: 'ai' });
      c.ai = newAI(dir, false);
      if (type === 'sports' || type === 'muscle') c.ai.cruise += 35;
      c.vx = DIRS[dir][0] * 120; c.vy = DIRS[dir][1] * 120;
      return c;
    }
    return null;
  }

  function blockedAhead(c, range, ignore) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    for (const o of G.active) {
      if (o === c || o === ignore) continue;
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

  // בחירת כיוון בצומת: לפי מסלול (שדה מרחקים), לפי תכנון מוקדם, או אקראי
  function chooseDir(a, m, i, j, dir, usePlan) {
    const back = (dir + 2) % 4, opts = [];
    for (let d = 0; d < 4; d++) if ((m & DBIT[d]) && d !== back) opts.push(d);
    if (a.route) {
      let best = -1, bd = 1e9;
      for (let d = 0; d < 4; d++) { if (!(m & DBIT[d])) continue; const f = a.route[M.idx(i + DIRS[d][0], j + DIRS[d][1])]; if (f >= 0 && f + (d === back ? 0.5 : 0) < bd) { bd = f + (d === back ? 0.5 : 0); best = d; } }
      if (best >= 0) return best;
    }
    if (!opts.length) return back;
    if (usePlan && a.plan >= 0 && opts.includes(a.plan)) return a.plan;
    if (opts.includes(dir)) return opts.length > 1 && Math.random() < 0.35 ? pick(opts) : dir;
    return pick(opts);
  }

  function aiDrive(c, dt) {
    const a = c.ai;
    const ti = Math.floor(c.x / T), tj = Math.floor(c.y / T), m = M.conn(ti, tj);
    let tx, ty, stopD = -1;
    c.blink = 0;
    if (!m) { // ירד מהכביש – חוזר למשבצת הכביש האחרונה
      tx = (a.lastI + 0.5) * T; ty = (a.lastJ + 0.5) * T; a.tileKey = -1;
    } else {
      const key = M.idx(ti, tj), cx = (ti + 0.5) * T, cy = (tj + 0.5) * T;
      if (a.tileKey !== key) {
        a.tileKey = key; a.lastI = ti; a.lastJ = tj;
        a.next = chooseDir(a, m, ti, tj, a.dir, true);
        a.switched = a.next === a.dir;
        // מתכננים מראש את הפנייה בצומת הבא – כדי לאותת בזמן
        a.plan = -1;
        if (a.switched) { const ni = ti + DIRS[a.dir][0], nj = tj + DIRS[a.dir][1], nm = M.conn(ni, nj); if (M.connCount(nm) >= 3) a.plan = chooseDir(a, nm, ni, nj, a.dir, false); }
      }
      if (!a.switched) {
        const s = (c.x - cx) * DIRS[a.dir][0] + (c.y - cy) * DIRS[a.dir][1];
        const turn = (a.next - a.dir + 4) % 4;
        c.blink = turn === 1 ? 1 : turn === 3 ? -1 : 0;
        if (s >= (turn === 1 ? -LANE : turn === 3 ? LANE : 0)) { a.dir = a.next; a.switched = true; }
      } else if (a.plan >= 0 && a.plan !== a.dir) { const turn = (a.plan - a.dir + 4) % 4; c.blink = turn === 1 ? 1 : turn === 3 ? -1 : 0; }
      const dx = DIRS[a.dir][0], dy = DIRS[a.dir][1];
      // רמזור: עוצרים לפני הצומת באדום, ובצהוב אם עוד אפשר
      if (a.switched && !a.cop && a.panicT <= 0 && M.connCount(m) < 3) {
        const ni = ti + dx, nj = tj + dy;
        if (M.signalAt(ni, nj)) {
          const go = M.canGo(ni, nj, dy !== 0, G.time);
          const edge = (cx + dx * 60 - c.x) * dx + (cy + dy * 60 - c.y) * dy - c.d.len / 2 - 8;
          if (go === 0 || (go === 1 && edge > 30)) stopD = Math.max(0, edge);
        }
      }
      const along = (c.x - cx) * dx + (c.y - cy) * dy, L = 55 + Math.abs(c.speed) * 0.28;
      const lane = a.passT > 0 ? -LANE * 0.8 : LANE; // בעקיפה עוברים לנתיב הנגדי
      tx = cx - dy * lane + dx * (along + L); ty = cy + dx * lane + dy * (along + L);
    }
    const diff = angDiff(Math.atan2(ty - c.y, tx - c.x), c.ang);
    c.steer = clamp(diff * 2.4, -1, 1);
    let limit = a.panicT > 0 ? 330 : a.cruise * (1 - 0.18 * Wx.wet) * (a.hurryT > 0 ? 1.3 : 1);
    if (!a.switched || Math.abs(diff) > 0.45) limit *= 0.55;
    a.redStop = stopD >= 0;
    if (stopD >= 0) limit = Math.min(limit, Math.sqrt(700 * stopD));
    if (a.panicT > 0) a.panicT -= dt;
    if (a.ghostT > 0) a.ghostT -= dt;
    if (a.hurryT > 0) a.hurryT -= dt;
    if (a.passT > 0) { a.passT -= dt; if (a.passT <= 0) a.ignore = null; }
    const ob = a.ghostT > 0 ? null : blockedAhead(c, 34 + Math.abs(c.speed) * 0.55, a.ignore);
    c.hb = false;
    if (ob) {
      c.thr = c.speed > 8 ? -1 : 0;
      // תור לרמזור אדום אינו "תקיעה": מחכים בסבלנות מאחורי מי שעומד באדום (או מאחורי מי שמחכה לו)
      // (qd = המקום בתור; מוגבל, כדי ששני רכבים שחוסמים זה את זה לא "יחכו לרמזור" לנצח)
      a.qd = ob.ai ? (ob.ai.redStop ? 1 : ob.ai.qd > 0 && ob.ai.qd < 6 ? ob.ai.qd + 1 : 0) : 0;
      if (!a.qd) a.blockT += dt;
      const P = G.player;
      if (a.blockT > 1.6 && a.honkCd <= 0 && (ob === P.car || ob === P)) { a.honkCd = 3; if (Math.hypot(c.x - P.x, c.y - P.y) < 500) NC.Sound.play('honk', 0.6, c.x); }
      // רכב שעומד בלי נהג חוסם את הנתיב? קצת רוורס ועוקפים
      const still = ob.d && !ob.ai && Math.hypot(ob.vx, ob.vy) < 14;
      if (still && a.blockT > 2.2 && a.passT <= 0 && !a.cop) { a.passT = 4.4; a.ignore = ob; a.blockT = 0; }
      if (a.blockT > 6) { a.ghostT = 2.5; a.blockT = 0; } // מוצא אחרון נגד פקק נצחי
    } else {
      a.blockT = Math.max(0, a.blockT - dt); a.qd = 0;
      c.thr = c.speed < limit ? 0.75 : c.speed > limit + 35 ? -0.5 : 0;
      if (stopD >= 0 && stopD < 3) c.thr = c.speed > 6 ? -1 : 0;
    }
    if (a.honkCd > 0) a.honkCd -= dt;
    if (a.passT > 3.5) { c.thr = -0.7; c.steer = 0; return; } // שלב הרוורס של העקיפה
    // נתקע על קיר? קצת רוורס ומנסים שוב
    if (a.revT > 0) { a.revT -= dt; c.thr = -0.8; c.steer = -c.steer; return; }
    if (c.thr > 0 && Math.abs(c.speed) < 12) { a.stuckT += dt; if (a.stuckT > 1.6) { a.revT = 1; a.stuckT = 0; } } else a.stuckT = 0;
  }

  // נהג מרוץ / בריחה: נוסע דרך רשימת שערים. משמש את המשימות
  function racerDrive(c, dt) {
    const a = c.ai, R = a.racer, pts = R.pts;
    if (R.hold) { c.thr = 0; c.steer = 0; c.hb = true; return; } // ממתינים לזינוק
    if (R.idx >= pts.length) { c.thr = c.speed > 20 ? -1 : 0; c.steer = 0; c.hb = Math.abs(c.speed) < 30; return; }
    const p = pts[R.idx], dx = p.x - c.x, dy = p.y - c.y, dist = Math.hypot(dx, dy);
    if (dist < (R.r || 80)) { R.idx++; if (R.onGate) R.onGate(c, R.idx); return; }
    // חדות הפנייה בשער הבא קובעת כמה להאט לפניו
    let corner = 0;
    const nx = pts[R.idx + 1];
    if (nx) corner = Math.abs(angDiff(Math.atan2(nx.y - p.y, nx.x - p.x), Math.atan2(dy, dx)));
    else corner = 1.6;
    const vGate = corner > 1 ? 150 : corner > 0.4 ? 230 : 999;
    let limit = Math.min(c.d.max * R.skill, Math.sqrt(vGate * vGate + 2 * 560 * Math.max(0, dist - 40)));
    const diff = angDiff(Math.atan2(dy, dx), c.ang);
    if (Math.abs(diff) > 0.7) limit = Math.min(limit, 170);
    c.hb = false;
    if (a.revT > 0) { a.revT -= dt; c.thr = -1; c.steer = diff > 0 ? -1 : 1; return; }
    c.steer = clamp(diff * 2.8, -1, 1);
    const ob = blockedAhead(c, 26 + Math.abs(c.speed) * 0.22, null);
    if (ob && ob.d && Math.abs(c.speed) > 120) { // עוקפים מכשול במקום לעצור
      const side = (ob.x - c.x) * -Math.sin(c.ang) + (ob.y - c.y) * Math.cos(c.ang);
      c.steer = clamp(c.steer + (side > 0 ? -0.8 : 0.8), -1, 1); limit = Math.min(limit, 240);
    }
    c.thr = c.speed < limit ? R.skill : c.speed > limit + 30 ? -1 : 0;
    if (Math.abs(c.speed) < 20) { a.stuckT += dt; if (a.stuckT > 1.3) { a.revT = 1; a.stuckT = 0; } } else a.stuckT = 0;
  }

  // ---------------- משטרה ----------------
  const field = new Int16Array(N * N);
  const playerPos = () => (G.player.car ? G.player.car : G.player);
  const playerSpeed = () => (G.player.car ? Math.hypot(G.player.car.vx, G.player.car.vy) : Math.hypot(G.player.vx, G.player.vy));
  const evadeTime = () => (7 + 3.5 * G.wanted) * (NC.diff().cops > 1 ? 1.15 : NC.diff().cops < 1 ? 0.85 : 1);

  function copDrive(c, dt) {
    const a = c.ai, pp = playerPos(), P = G.player;
    const seen = G.seen || G.hideT < 1.2;
    // כשאיבדו קשר עין – נוסעים לנקודה האחרונה שבה נראה השחקן, ואז מחפשים בסביבה
    if (seen) { if (a.search) { a.search = false; } }
    else if (!a.search && Math.hypot(G.lkp.x - c.x, G.lkp.y - c.y) < 300) { a.search = true; a.tileKey = -1; a.dir = headingDir(c.ang); a.switched = true; a.plan = -1; a.cruise = 235; }
    if (a.search) { aiDrive(c, dt); return; }
    c.blink = 0;
    const pvx = P.car ? P.car.vx : P.vx, pvy = P.car ? P.car.vy : P.vy;
    const gx = seen ? pp.x : G.lkp.x, gy = seen ? pp.y : G.lkp.y;
    const dist = Math.hypot(gx - c.x, gy - c.y);
    let tx = gx + (seen ? pvx * 0.35 : 0), ty = gy + (seen ? pvy * 0.35 : 0);
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
    const ram = G.wanted >= 3 && !!P.car && seen; // לא דורסים שחקן שהולך ברגל
    if (dist < 150 && !ram) c.thr = c.speed > playerSpeed() + 50 ? -0.7 : dist < 70 ? (c.speed > 20 ? -1 : 0) : 0.6;
    else if (Math.abs(diff) > 1.0 && c.speed > 170) { c.thr = -0.6; c.hb = Math.abs(diff) > 1.7; }
    else c.thr = c.speed > c.d.max * (ram ? 1 : 0.85) ? 0 : 1;
    if (Math.abs(c.speed) < 22 && dist > 110) { a.stuckT += dt; if (a.stuckT > 1.4) { a.revT = 1.1; a.stuckT = 0; } } else a.stuckT = 0;
  }

  function spawnCop() {
    const pp = playerPos(), P = G.player;
    const vx = P.car ? P.car.vx : 0, vy = P.car ? P.car.vy : 0, sp = Math.hypot(vx, vy);
    for (let n = 0; n < 40; n++) {
      const [i, j] = pick(M.roadTiles), x = (i + 0.5) * T, y = (j + 0.5) * T, d = Math.hypot(x - pp.x, y - pp.y);
      if (d < 750 || d > 1250) continue;
      // ברמות גבוהות הניידות מגיעות מלפנים
      if (G.wanted >= 3 && sp > 150 && n < 28 && ((x - pp.x) * vx + (y - pp.y) * vy) / (d * sp) < 0.2) continue;
      if (G.cars.some((o) => Math.abs(o.x - x) < 100 && Math.abs(o.y - y) < 100)) continue;
      const c = makeCar('police', x, y, Math.atan2(pp.y - y, pp.x - x), { driver: 'ai' });
      c.ai = newAI(0, true);
      if (G.wanted >= 4) c.boost = 1.08;
      return c;
    }
    return null;
  }

  // מחסום: שתי ניידות לרוחב הכביש, לפני השחקן
  function spawnRoadblock() {
    const c = G.player.car; if (!c) return false;
    const sp = Math.hypot(c.vx, c.vy); if (sp < 130) return false;
    const ux = c.vx / sp, uy = c.vy / sp;
    for (let n = 0; n < 7; n++) {
      const dist = 800 + n * 110, x = c.x + ux * dist, y = c.y + uy * dist;
      const i = Math.floor(x / T), j = Math.floor(y / T), m = M.conn(i, j);
      if (m !== 5 && m !== 10) continue;
      const horiz = m === 10;
      if (horiz ? Math.abs(ux) < 0.6 : Math.abs(uy) < 0.6) continue;
      const cx = (i + 0.5) * T, cy = (j + 0.5) * T;
      if (G.cars.some((o) => Math.abs(o.x - cx) < 140 && Math.abs(o.y - cy) < 140)) continue;
      for (const s of [-1, 1]) {
        const b = makeCar('police', cx + (horiz ? s * 6 : s * 25), cy + (horiz ? s * 25 : s * 6), (horiz ? Math.PI / 2 : 0) + s * 0.12, { parked: true });
        b.block = true;
      }
      return true;
    }
    return false;
  }

  function deployOfficer(c) {
    const rx = -Math.sin(c.ang), ry = Math.cos(c.ang);
    const p = makePed(c.x - rx * (c.d.wid / 2 + 12), c.y - ry * (c.d.wid / 2 + 12), { shirt: '#1f3a6e', cop: true });
    pushOutOfBuildings(p, 8);
    p.st = 'cop'; p.home = c; c.officer = p;
    if (nearPlayer(c.x, c.y)) NC.Sound.play('door', 1, c.x);
  }

  function updateHeli(dt) {
    const H = G.heli, pp = playerPos(), P = G.player;
    if (H.mode === 0) {
      H.on = false;
      if (G.wanted >= 4) { H.cd -= dt; if (H.cd <= 0) { const a = rand(0, TAU); H.mode = 1; H.on = true; H.fuel = G.wanted >= 5 ? 46 : 34; H.x = pp.x + Math.cos(a) * 1500; H.y = pp.y + Math.sin(a) * 1500; H.lx = H.x; H.ly = H.y; H.vx = H.vy = 0; } }
      else H.cd = Math.min(H.cd, 5);
      return;
    }
    let tx, ty;
    if (H.mode === 1) {
      const pvx = P.car ? P.car.vx : P.vx, pvy = P.car ? P.car.vy : P.vy;
      // המסוק עוקב אחרי מה שהמשטרה יודעת: השחקן עצמו אם רואים אותו, אחרת הנקודה האחרונה
      tx = (G.seen ? pp.x + pvx * 0.5 : G.lkp.x); ty = (G.seen ? pp.y + pvy * 0.5 : G.lkp.y);
      H.fuel -= dt;
      if (H.fuel <= 0 || G.wanted < 4) { H.mode = 2; const d = Math.hypot(H.x - pp.x, H.y - pp.y) || 1; H.ex = (H.x - pp.x) / d || 1; H.ey = (H.y - pp.y) / d; }
    }
    if (H.mode === 2) {
      tx = H.x + H.ex * 900; ty = H.y + H.ey * 900;
      if (Math.hypot(H.x - pp.x, H.y - pp.y) > 1700) { H.mode = 0; H.on = false; H.cd = G.wanted >= 4 ? 22 : 5; return; }
    }
    const dx = tx - H.x, dy = ty - H.y, d = Math.hypot(dx, dy) || 1, want = Math.min(430, d * 2.2);
    H.vx += (dx / d * want - H.vx) * Math.min(1, dt * 1.6); H.vy += (dy / d * want - H.vy) * Math.min(1, dt * 1.6);
    H.x += H.vx * dt; H.y += H.vy * dt;
    if (Math.hypot(H.vx, H.vy) > 25) H.ang += angDiff(Math.atan2(H.vy, H.vx), H.ang) * Math.min(1, dt * 3);
    // הזרקור רודף אחרי השחקן, אבל לא רחוק מדי מהמסוק
    const sx = H.mode === 1 ? pp.x : H.x, sy = H.mode === 1 ? pp.y : H.y;
    H.lx += (sx - H.lx) * Math.min(1, dt * 3.2); H.ly += (sy - H.ly) * Math.min(1, dt * 3.2);
    const ld = Math.hypot(H.lx - H.x, H.ly - H.y); if (ld > 300) { H.lx = H.x + (H.lx - H.x) / ld * 300; H.ly = H.y + (H.ly - H.y) / ld * 300; }
  }

  function crime(n, force) {
    if (n <= 0 || G.dead || G.attract) return;
    if (!force && G.crimeCd > 0 && G.wanted > 0) return;
    const before = G.wanted;
    G.wanted = Math.min(5, G.wanted + n); G.hideT = 0; G.crimeCd = 2.5; G.seen = true; G.seeT = 0.6;
    const pp = playerPos(); G.lkp.x = pp.x; G.lkp.y = pp.y;
    if (G.wanted > before) { G.starFlash = 1.5; NC.Sound.play('star'); G.stats.maxStars = Math.max(G.stats.maxStars, G.wanted); if (before === 0) { G.blockCd = 8; G.contact = false; } }
  }
  function setWanted(n) {
    if (G.wanted >= n) return;
    if (!G.wanted) G.contact = false;
    G.wanted = n; G.hideT = 0; G.starFlash = 1.5; G.seen = true; G.seeT = 0.6; NC.Sound.play('star');
    const pp = playerPos(); G.lkp.x = pp.x; G.lkp.y = pp.y; G.blockCd = 8;
    G.stats.maxStars = Math.max(G.stats.maxStars, n);
  }
  function clearWanted(evaded) {
    if (!G.wanted) return;
    if (evaded) { G.stats.evaded++; NC.ui.toast('😎 You lost the cops', 'good'); NC.Sound.play('clear'); }
    G.wanted = 0; G.hideT = 0; G.bustT = 0; G.seen = false;
    for (const c of G.cars) {
      if (c.ai && c.ai.cop) { const a = c.ai; a.cop = false; a.search = false; a.tileKey = -1; a.dir = headingDir(c.ang); a.switched = true; a.plan = -1; a.cruise = rand(150, 200); c.boost = 1; }
      if (c.block) { c.block = false; c.gone = true; }
    }
    for (const p of G.peds) if (p.st === 'cop') p.st = 'copback';
  }

  function updatePolice(dt) {
    const pp = playerPos(), P = G.player, pspd = playerSpeed();
    let near = 1e9, count = 0, close = false, patrol = false;
    G.seeT -= dt;
    const check = G.seeT <= 0; if (check) G.seeT = 0.2;
    let seen = check ? false : G.seen;
    let officers = 0;
    for (const c of G.active) {
      if (c.dead || c.type !== 'police') continue;
      const d = Math.hypot(c.x - pp.x, c.y - pp.y);
      if (c.ai && !c.ai.cop) {
        if (d < 420) patrol = true;
        if (G.wanted > 0 && d < 600 && (d < 170 || M.los(c.x, c.y, pp.x, pp.y))) { c.ai.cop = true; c.ai.search = false; }
        else continue;
      }
      if (!(c.ai && c.ai.cop) && !c.block) continue;
      if (c.ai) count++;
      if (d < near) near = d;
      if (check && !seen && d < 620 && (d < 170 || M.los(c.x, c.y, pp.x, pp.y))) seen = true;
      if (c.ai && d < 105 && Math.abs(c.speed) < 130) close = true;
      // הניידת עצרה קרוב והשחקן לא בורח – שוטר יוצא ברגל
      if (c.ai && G.wanted && !c.officer && G.officers < 3 && d < 160 && Math.abs(c.speed) < 30 && pspd < 70) deployOfficer(c);
    }
    let arrest = 0;
    for (const p of G.peds) {
      if (!p.cop) continue;
      officers++;
      if (p.st !== 'cop') continue;
      const d = Math.hypot(p.x - pp.x, p.y - pp.y);
      if (check && !seen && d < 480 && (d < 150 || M.los(p.x, p.y, pp.x, pp.y))) seen = true;
      if (!P.car && d < 21) arrest = Math.max(arrest, 2.6); else if (P.car && d < 40 && pspd < 40) arrest = Math.max(arrest, 1);
    }
    G.officers = officers;
    G.patrolNear = patrol;
    const H = G.heli;
    updateHeli(dt);
    if (check && !seen && H.mode === 1 && Math.hypot(H.x - pp.x, H.y - pp.y) < 330) seen = true;
    G.copDist = near;
    if (G.crimeCd > 0) G.crimeCd -= dt;
    if (G.starFlash > 0) G.starFlash -= dt;
    if (!G.wanted) { G.bustT = 0; G.seen = false; return; }
    G.seen = seen;
    // שעון ההתחמקות רץ רק אחרי שהמשטרה כבר הגיעה (או שהתרחקת מזירת האירוע) – אחרת כוכב היה נעלם מעצמו לפני שמישהו הופיע
    if (seen) { if (check) G.contact = true; G.hideT = 0; G.lkp.x = pp.x; G.lkp.y = pp.y; }
    else if (G.contact || Math.hypot(pp.x - G.lkp.x, pp.y - G.lkp.y) > 600) G.hideT += dt;
    if (G.hideT > evadeTime()) { clearWanted(true); return; }
    G.copCd -= dt;
    const want = Math.round([0, 1, 2, 3, 4, 5][G.wanted] * NC.diff().cops);
    if (count < want && G.copCd <= 0) { spawnCop(); G.copCd = 2.2; }
    if (G.wanted >= 4) { G.blockCd -= dt; if (G.blockCd <= 0) G.blockCd = spawnRoadblock() ? (G.wanted >= 5 ? 11 : 16) : 2; }
    G.fieldT -= dt;
    if (G.fieldT <= 0) { G.fieldT = 0.35; M.fieldFrom(G.lkp.x, G.lkp.y, field); }
    if (close && pspd < 32) G.bustT += dt; else if (arrest) G.bustT += dt * arrest; else G.bustT = Math.max(0, G.bustT - dt * 2);
    if (G.bustT > (P.car ? 2.5 : 1) / (NC.diff().cops > 1 ? 1.2 : NC.diff().cops < 1 ? 0.8 : 1)) die('busted');
  }

  // ---------------- השחקן ----------------
  function hurtPlayer(dmg) {
    const P = G.player;
    if (G.dead || dmg <= 0 || G.attract) return;
    P.hp -= dmg * (dmg >= 900 ? 1 : NC.diff().dmg); G.hurtFlash = 0.4;
    if (P.hp <= 0) { P.hp = 0; die('wasted'); }
  }
  function die(kind) {
    if (G.dead || G.attract) return;
    G.dead = { kind, t: 0 };
    if (kind === 'busted') G.stats.busted++; else G.stats.wasted++;
    NC.Sound.play(kind === 'busted' ? 'fail' : 'wasted');
    NC.ui.buzz(300);
    if (NC.mission) NC.mission.fail(kind === 'busted' ? 'You were busted' : 'You were wasted');
  }
  function respawn() {
    const P = G.player, kind = G.dead.kind;
    const s = kind === 'busted' ? M.special.police : M.special.hospital;
    if (P.car) { P.car.driver = null; P.car = null; }
    P.x = s.x; P.y = s.y; P.vx = P.vy = 0; P.hp = 100; P.stun = 0;
    const fee = kind === 'busted' ? Math.min(G.money, 100 + Math.floor(G.money * 0.1)) : Math.min(G.money, 100);
    G.money -= fee;
    G.cars = G.cars.filter((c) => c.tag || !((c.ai && c.ai.cop) || c.block));
    G.peds = G.peds.filter((p) => !p.cop);
    clearWanted(false);
    G.heli.mode = 0; G.heli.on = false; G.heli.cd = 6;
    G.dead = null; G.bustT = 0;
    // זמן עובר בבית החולים / בתחנה
    G.clock += 3; if (G.clock >= 24) { G.clock -= 24; G.day++; }
    NC.ui.toast(kind === 'busted' ? `🚓 Released from the station. Fine: $${fee}` : `🏥 Patched up at the hospital. Bill: $${fee}`);
    NC.saveGame();
  }

  function nearestEnterable() {
    const P = G.player; let best = null, bd = 1e9;
    for (const c of G.active) {
      if (c.dead || c.burnT > 0 || c.block) continue;
      const d = Math.hypot(c.x - P.x, c.y - P.y) - c.d.len / 2;
      if (d < 42 && d < bd && Math.hypot(c.vx, c.vy) < 110) { bd = d; best = c; }
    }
    return best;
  }
  function enterExit() {
    const P = G.player;
    if (G.dead || P.stun > 0 || G.attract) return;
    if (P.car) {
      const c = P.car;
      if (Math.abs(c.speed) > 75) { NC.ui.toast('Slow down before getting out'); return; }
      const rx = -Math.sin(c.ang), ry = Math.cos(c.ang), off = c.d.wid / 2 + 13;
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang), back = c.d.len / 2 + 13;
      const free = (x, y) => !M.insideB(x, y, 8) && !M.isDeep(x, y) && !G.active.some((o) => o !== c && Math.hypot(o.x - x, o.y - y) < o.d.len / 2 + 6);
      const spots = [[c.x - rx * off, c.y - ry * off], [c.x + rx * off, c.y + ry * off], [c.x - fx * back, c.y - fy * back], [c.x + fx * back, c.y + fy * back]];
      const sp = spots.find((q) => free(q[0], q[1])) || spots[0];
      P.x = sp[0]; P.y = sp[1];
      P.car = null; c.driver = null; c.thr = 0; c.steer = 0; c.hb = true; c.blink = 0; P.vx = P.vy = 0;
      NC.Sound.play('door');
      if (NC.mission) NC.mission.onExitCar(c);
      return;
    }
    const c = nearestEnterable();
    if (!c) return;
    if (c.driver === 'ai') {
      const wasCop = (c.ai && c.ai.cop) || c.type === 'police';
      ejectDriver(c, false);
      G.stats.stolen++;
      crime(wasCop ? Math.max(1, 2 - G.wanted) : (G.copDist < 600 || G.patrolNear || Math.random() < 0.45 ? 1 : 0));
    }
    c.ai = null; c.driver = 'player'; c.parked = false; c.hb = false; c.blink = 0; P.car = c;
    NC.Sound.play('door');
    if (NC.mission) NC.mission.onEnterCar(c);
  }

  // צופר: הולכי רגל קופצים הצידה, ונהגים שלפניך ממהרים
  function horn() {
    const P = G.player, c = P.car;
    if (!c || G.dead || G.attract) return;
    NC.Sound.play('horn');
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    for (const p of G.peds) { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (d < 190 && d > 1 && (dx * fx + dy * fy) / d > 0.3 && p.st === 'walk') fleePed(p, c.x - fx * 30, c.y - fy * 30, 1.1); }
    for (const o of G.active) { if (!o.ai || o.ai.cop || o === c) continue; const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy); if (d < 240 && (dx * fx + dy * fy) / d > 0.5) o.ai.hurryT = 2.5; }
  }

  function updatePlayer(dt) {
    const P = G.player, I = NC.input;
    if (P.stun > 0) P.stun -= dt;
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    if (G.attract) { // בתפריט: המצלמה נוסעת עם אחת ממכוניות העיר
      let c = P.car;
      if (!c || c.dead || !c.ai || c.ai.cop) { c = null; let bd = 1e9; for (const o of G.cars) { if (!o.ai || o.dead || o.type === 'police') continue; const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < bd) { bd = d; c = o; } } P.car = c; }
      if (c) { P.x = c.x; P.y = c.y; P.ang = c.ang; }
      return;
    }
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
      const spd = Math.abs(c.speed);
      G.stats.dist += spd * dt; if (spd > G.stats.topSpeed) G.stats.topSpeed = spd;
      // סימני צמיגים
      if ((c.slip > 110 || (c.hb && spd > 80)) && c.ground === M.ROAD) {
        const fx = Math.cos(c.ang), fy = Math.sin(c.ang), o = c.d.len * 0.32, w = c.d.wid * 0.4;
        const l = [c.x - fx * o + fy * w, c.y - fy * o - fx * w], r = [c.x - fx * o - fy * w, c.y - fy * o + fx * w];
        if (c.sk) { G.skids.push({ x1: c.sk[0][0], y1: c.sk[0][1], x2: l[0], y2: l[1], life: 14 }, { x1: c.sk[1][0], y1: c.sk[1][1], x2: r[0], y2: r[1], life: 14 }); if (G.skids.length > 420) G.skids.splice(0, 2); }
        c.sk = [l, r];
        if (Math.random() < dt * 18) { const p = addPart(c.x - fx * o, c.y - fy * o, rand(-20, 20), rand(-20, 20), 0.7, 6, Wx.wet > 0.4 ? '#cfe6f2' : '#d8d8d8', 18, 0.3); p.wind = 0.5; }
      } else c.sk = null;
      return;
    }
    if (G.dead || P.stun > 0) { P.x += P.vx * dt; P.y += P.vy * dt; const f = Math.exp(-4 * dt); P.vx *= f; P.vy *= f; pushOutOfBuildings(P, 9); return; }
    const mag = Math.hypot(I.mx, I.my);
    if (mag > 0.1) {
      const shallow = M.tileAt(P.x, P.y) === M.WATER;
      const sp = (I.sprint || (mag > 0.92 && I.analog) ? 195 : 125) * Math.min(1, mag) * (shallow ? 0.55 : 1);
      P.vx = (I.mx / mag) * sp; P.vy = (I.my / mag) * sp;
      P.ang = Math.atan2(I.my, I.mx); P.walk += dt * sp * 0.085;
      if (shallow && Math.random() < dt * 9) Fx.ring(P.x, P.y, 4, '#ffffff', 34, 0.5);
      if (sp > 150) { P.stepT = (P.stepT || 0) - dt; if (P.stepT <= 0) { P.stepT = 0.26; NC.Sound.play('step', 0.5); } }
    } else { P.vx = P.vy = 0; }
    P.x += P.vx * dt; P.y += P.vy * dt;
    pushOutOfBuildings(P, 9);
    // לא עוברים דרך מכוניות
    for (const c of G.active) {
      if (Math.abs(c.x - P.x) > 60 || Math.abs(c.y - P.y) > 60) continue;
      const r = circles(c, CX, CY) + 8;
      for (let k = 0; k < 3; k++) { const dx = P.x - CX[k], dy = P.y - CY[k], d = Math.hypot(dx, dy); if (d < r && d > 0.01) { P.x += dx / d * (r - d); P.y += dy / d * (r - d); } }
    }
    if (M.isDeep(P.x, P.y)) { NC.Sound.play('splash'); Fx.splash(P.x, P.y, 14); hurtPlayer(1000); }
  }

  // ---------------- עדכון ראשי ----------------
  function update(dt) {
    const P = G.player;
    G.time += dt; if (!G.attract) G.playTime += dt;
    G.clock += dt / 22; if (G.clock >= 24) { G.clock -= 24; G.day++; }
    Wx.update(dt, G.clock, G.attract);
    Fx.windX = (40 + 90 * Wx.wind) * (1 + Wx.gust * 0.3); Fx.windY = -18 * Wx.wind;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    const pp = playerPos();
    const act = G.active; act.length = 0;
    for (const c of G.cars) if (Math.abs(c.x - pp.x) < 1700 && Math.abs(c.y - pp.y) < 1700) act.push(c);
    updatePlayer(dt);

    for (const c of act) {
      if (c.dead) { stepCar(c, dt); continue; }
      if (c.ai) { if (c.ai.racer) racerDrive(c, dt); else if (c.ai.cop && G.wanted > 0) copDrive(c, dt); else aiDrive(c, dt); }
      else if (c.driver !== 'player') { c.thr = 0; c.steer = 0; c.hb = true; }
      if (c.parked && !c.vx && !c.vy) continue;
      stepCar(c, dt);
      collideStatic(c);
      if (M.isDeep(c.x, c.y)) { // נפילה למים עמוקים
        if (nearPlayer(c.x, c.y)) NC.Sound.play('splash', 1, c.x);
        if (P.car === c && !G.attract) { P.car = null; c.dead = true; c.gone = true; hurtPlayer(1000); }
        else { if (P.car === c) P.car = null; c.dead = true; c.gone = true; }
        Fx.splash(c.x, c.y, 16);
        if (NC.mission) NC.mission.onCarDestroyed(c);
        continue;
      }
      // עשן ואש
      const hf = c.hp / c.d.hp;
      if (c.burnT > 0) {
        c.burnT -= dt;
        const fx = Math.cos(c.ang) * c.d.len * 0.3, fy = Math.sin(c.ang) * c.d.len * 0.3;
        if (Math.random() < dt * 34) Fx.fire(c.x + fx, c.y + fy);
        if (Math.random() < dt * 11) Fx.smoke(c.x + fx, c.y + fy, '#2b2b2b', 0, 0, 8);
        if (c.burnT <= 0) explodeCar(c);
      } else if (hf < 0.5 && Math.random() < dt * (hf < 0.25 ? 14 : 6)) {
        const fx = Math.cos(c.ang) * c.d.len * 0.35, fy = Math.sin(c.ang) * c.d.len * 0.35;
        Fx.smoke(c.x + fx, c.y + fy, hf < 0.25 ? '#3a3a3a' : '#c9c9c9', c.vx * 0.3, c.vy * 0.3, 5);
      }
      // אבק על חול ודשא, רסס במים רדודים ועל כביש רטוב
      const spd = Math.abs(c.speed);
      if (spd > 120 && nearPlayer(c.x, c.y)) {
        const g = c.ground, bx = c.x - Math.cos(c.ang) * c.d.len * 0.4, by = c.y - Math.sin(c.ang) * c.d.len * 0.4;
        if (g === M.SAND || g === M.GLADE || g === M.PARK) { if (Math.random() < dt * spd * 0.06) Fx.dust(bx, by, g === M.SAND ? '#e6d3a0' : '#9aa57a', -c.vx * 0.1, -c.vy * 0.1); }
        else if (g === M.WATER) { if (Math.random() < dt * spd * 0.1) Fx.dust(bx, by, '#e8f8ff', -c.vx * 0.15, -c.vy * 0.15); }
        else if (Wx.wet > 0.35 && Math.random() < dt * spd * 0.035 * Wx.wet) Fx.dust(bx, by, '#b9d4e4', -c.vx * 0.12, -c.vy * 0.12);
      }
    }
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) { if (!act[i].gone && !act[j].gone) collideCars(act[i], act[j]); }

    // הולכי רגל מול מכוניות
    for (const p of G.peds) {
      updatePed(p, dt);
      if (p.st === 'down' || p.gone) continue;
      for (const c of act) {
        if (Math.abs(c.x - p.x) > 55 || Math.abs(c.y - p.y) > 55) continue;
        const r = circles(c, CX, CY) + 7, sp = Math.hypot(c.vx, c.vy);
        for (let k = 0; k < 3; k++) {
          const dx = p.x - CX[k], dy = p.y - CY[k], d = Math.hypot(dx, dy);
          if (d >= r || d < 0.01) continue;
          if (sp > 75 && !p.tag) {
            knockPed(p, c.vx * 0.9 + dx / d * 60, c.vy * 0.9 + dy / d * 60);
            if (Math.hypot(p.x - P.x, p.y - P.y) < 700) NC.Sound.play('thud', 1, p.x);
            if (c === P.car && !G.attract) {
              G.stats.pedsHit++; NC.ui.buzz(40);
              if (p.cop) crime(G.wanted < 3 ? 3 - G.wanted : 1); else crime(1);
              for (const q of G.peds) if (q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 260) fleePed(q, c.x, c.y);
            }
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
    if (!P.car && !G.dead && !G.attract) {
      for (const c of act) {
        const sp = Math.hypot(c.vx, c.vy);
        if (sp < 80 || Math.abs(c.x - P.x) > 55 || Math.abs(c.y - P.y) > 55) continue;
        const r = circles(c, CX, CY) + 7;
        for (let k = 0; k < 3; k++) {
          const d = Math.hypot(P.x - CX[k], P.y - CY[k]);
          if (d < r && P.stun <= 0) { P.stun = 0.8; P.vx = c.vx * 0.8; P.vy = c.vy * 0.8; NC.Sound.play('thud'); hurtPlayer(sp * 0.11); G.shake = 8; NC.ui.buzz(120); break; }
        }
      }
    }

    updatePolice(dt);

    // חלקיקים, סימני צמיגים, טקסט צף
    Fx.update(dt);
    let dead = false;
    for (const s of G.skids) { s.life -= dt; if (s.life <= 0) dead = true; }
    if (dead) G.skids = G.skids.filter((s) => s.life > 0);
    for (const f of G.floaters) { f.y -= 30 * dt; f.life -= dt; }
    if (G.floaters.length && G.floaters[0].life <= 0) G.floaters = G.floaters.filter((f) => f.life > 0);

    // הופעה והיעלמות של תנועה והולכי רגל – פחות בלילה ובגשם
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      G.spawnT = 0.25;
      const night = NC.nightAmount ? NC.nightAmount(G.clock) : 0;
      let ai = 0;
      G.cars = G.cars.filter((c) => {
        if (c.gone) return false;
        if (c === P.car || c.tag) return true;
        const d = Math.hypot(c.x - pp.x, c.y - pp.y);
        if (c.block) return G.wanted > 0 && d < 1700;
        if (c.ai) { if ((Math.abs(c.x - pp.x) > 1650 || Math.abs(c.y - pp.y) > 1650) && !c.ai.racer && !c.ai.route) return false; ai++; return true; }
        if (c.dead) return d < 1500;
        if (!c.parked) return d < 2300;
        return true;
      });
      if (ai < Math.round(SIM.cars * (1 - 0.35 * night))) spawnTraffic(false);
      // חניה שהתרוקנה מתמלאת מחדש כשהשחקן רחוק
      const ps = M.parkSpots.length ? pick(M.parkSpots) : null;
      if (ps && Math.hypot(ps.x - pp.x, ps.y - pp.y) > 1900 && !G.cars.some((c) => Math.abs(c.x - ps.x) < 70 && Math.abs(c.y - ps.y) < 70)) makeCar(pick(['compact', 'sedan', 'sedan', 'pickup', 'sports', 'van', 'compact', 'muscle']), ps.x, ps.y, ps.ang, { parked: true });
      let walkers = 0;
      G.peds = G.peds.filter((p) => { if (p.gone) return false; if (p.tag || p.cop) return true; walkers++; return Math.hypot(p.x - pp.x, p.y - pp.y) < 1500; });
      if (walkers < Math.round(SIM.peds * (1 - 0.55 * night) * (1 - 0.4 * Wx.rain))) spawnPed(false);
    }
    if (NC.mission && !G.attract) NC.mission.update(dt);
  }

  NC.world = {
    resetWorld, serialize, update, makeCar, makePed, newAI, enterExit, nearestEnterable, crime, setWanted, clearWanted, respawn, die, hurtPlayer, horn,
    addPart, addFloater, playerPos, playerSpeed, damageCar, spawnCop, fleePed, ejectDriver, headingDir, evadeTime, DIRS, LANE,
  };
})();
