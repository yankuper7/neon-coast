/* חוף ניאון – יצירת העיר: כבישים, שכונות, בניינים, עצים ומקומות מיוחדים */
'use strict';
(() => {
  const NC = window.NC;
  const T = 120;          // גודל משבצת ביחידות עולם
  const N = 61;           // משבצות לכל צד
  const WS = T * N;       // גודל העולם
  const GROUND = 0, ROAD = 1, SAND = 2, WATER = 3, PARK = 4, GLADE = 5;
  const R = NC.rng(20266);
  const rr = (a, b) => a + R() * (b - a);
  const rpick = (arr) => arr[Math.floor(R() * arr.length)];

  const tiles = new Uint8Array(N * N);
  const idx = (i, j) => j * N + i;
  const inb = (i, j) => i >= 0 && j >= 0 && i < N && j < N;

  // --- שטח בסיסי: ים במזרח ובדרום, חוף, ביצה במערב ובצפון ---
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let t = GROUND;
      if (i >= 57 || j >= 59) t = WATER;
      else if (i >= 55) t = SAND;
      else if (i < 2 || j < 2) t = GLADE;
      tiles[idx(i, j)] = t;
    }
  }
  // --- רשת כבישים: כל משבצת רביעית ---
  for (let j = 2; j <= 58; j++) for (let i = 2; i <= 54; i++) if (i % 4 === 2 || j % 4 === 2) tiles[idx(i, j)] = ROAD;

  // תאי בלוקים: a = 0..12 (עמודות 3+4a..5+4a), b = 0..13
  const CA = 13, CB = 14;
  const used = new Uint8Array(CA * CB);
  const cidx = (a, b) => b * CA + a;
  const merges = []; // {a,b,dir} dir: 0 = ימינה, 1 = למטה

  // פארק גדול במרכז: ארבעה תאים
  for (const [a, b] of [[5, 5], [6, 5], [5, 6], [6, 6]]) used[cidx(a, b)] = 2;
  for (let j = 23; j <= 29; j++) for (let i = 23; i <= 29; i++) tiles[idx(i, j)] = PARK;

  // בלוקים מיוחדים (לא מתמזגים)
  const SPECIAL_CELLS = {
    home: [2, 6], hospital: [4, 8], taxi: [7, 8], police: [9, 6], spray: [8, 3], spray2: [3, 11],
    garage: [9, 11], docks: [11, 13], club: [12, 4], tower: [10, 2],
  };
  for (const k in SPECIAL_CELLS) { const [a, b] = SPECIAL_CELLS[k]; used[cidx(a, b)] = 3; }

  // מיזוג אקראי של זוגות בלוקים, כדי שהרשת לא תהיה אחידה מדי
  for (let n = 0; n < 60 && merges.length < 18; n++) {
    const a = Math.floor(R() * CA), b = Math.floor(R() * CB), dir = R() < 0.5 ? 0 : 1;
    const a2 = a + (dir === 0 ? 1 : 0), b2 = b + (dir === 1 ? 1 : 0);
    if (a2 >= CA || b2 >= CB || used[cidx(a, b)] || used[cidx(a2, b2)]) continue;
    used[cidx(a, b)] = used[cidx(a2, b2)] = 1;
    merges.push({ a, b, dir });
    if (dir === 0) { const i = 6 + 4 * a; for (let j = 3 + 4 * b; j <= 5 + 4 * b; j++) tiles[idx(i, j)] = GROUND; }
    else { const j = 6 + 4 * b; for (let i = 3 + 4 * a; i <= 5 + 4 * a; i++) tiles[idx(i, j)] = GROUND; }
  }

  const isRoad = (i, j) => inb(i, j) && tiles[idx(i, j)] === ROAD;
  // חיבורי כביש: צפון=1, מזרח=2, דרום=4, מערב=8
  const conn = (i, j) => (isRoad(i, j) ? (isRoad(i, j - 1) ? 1 : 0) | (isRoad(i + 1, j) ? 2 : 0) | (isRoad(i, j + 1) ? 4 : 0) | (isRoad(i - 1, j) ? 8 : 0) : 0);
  const connCount = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

  // --- שכונות ---
  const DISTRICTS = {
    downtown: { name: 'Glass Towers', ground: '#8d9297' },
    strip: { name: 'Neon Strip', ground: '#d9c8a5' },
    market: { name: 'Color Market', ground: '#b7a68c' },
    palms: { name: 'Palm Heights', ground: '#6dab4d' },
    port: { name: 'Old Port', ground: '#7b8287' },
    park: { name: 'Flamingo Park', ground: '#62ae49' },
    beach: { name: 'Sunset Beach', ground: '#f0dca0' },
    glade: { name: 'The Glades', ground: '#4f8f45' },
    sea: { name: 'The Sea', ground: '#1fa3c4' },
  };
  function districtOfTile(i, j) {
    const t = inb(i, j) ? tiles[idx(i, j)] : WATER;
    if (t === WATER) return 'sea';
    if (t === SAND) return 'beach';
    if (t === GLADE) return 'glade';
    if (i >= 23 && i <= 29 && j >= 23 && j <= 29) return 'park';
    if (i >= 51) return 'strip';
    if (j >= 47) return 'port';
    if (i <= 21) return 'palms';
    if (j <= 25) return 'downtown';
    return 'market';
  }

  // --- בניינים, עצים, קישוטים ---
  const buildings = [], trees = [], lamps = [], decor = [], parkSpots = [], special = {};
  const PAL = {
    downtown: ['#7fb7d9', '#9cc7e0', '#b9d7e8', '#6f93b5', '#c9d6df', '#e8eef2', '#8fa9c4'],
    strip: ['#ff9eb5', '#7fe3d4', '#ffd59e', '#fff1c9', '#c8a8ff', '#8fd3ff', '#ffb38a'],
    market: ['#f6c177', '#e58f65', '#f2e2b6', '#9ad0c2', '#f4a6b8', '#d9b3ff', '#f0d37a'],
    palms: ['#fff5e1', '#ffe0c2', '#e6f3ff', '#fbe7ef', '#f3f0d8'],
    port: ['#9aa3a8', '#b0a089', '#7d8b93', '#a7988a'],
  };
  const ROOFS = ['#c8553d', '#b5653c', '#8a6f5a', '#4f7c8a', '#a8463a'];
  const BOXES = ['#d9534f', '#f0ad4e', '#3d8eb9', '#5cb85c', '#8e6bbf', '#e07b39'];
  const NEONS = ['#ff3fa4', '#19e3ff', '#ffe14d', '#9d5cff', '#3dff9e', '#ff7a3d'];
  const HEIGHT = { downtown: [130, 400], strip: [90, 250], market: [40, 95], port: [50, 75] };
  const MAXLOT = { downtown: 235, strip: 260, market: 175, palms: 175, port: 330 };

  function addBuilding(x, y, w, h, z, wall, roof, kind, neon) {
    buildings.push({ x, y, w, h, z, wall, roof, kind, neon: neon || null, seed: Math.floor(R() * 1e6) });
  }

  function lot(rc, d) {
    const r = R();
    if (d === 'palms') {
      const w = Math.min(rc.w - 30, rr(92, 124)), h = Math.min(rc.h - 30, rr(82, 110));
      if (w < 60 || h < 60) return;
      const x = rc.x + rr(12, rc.w - w - 12), y = rc.y + rr(12, rc.h - h - 12);
      addBuilding(x, y, w, h, rr(26, 40), rpick(PAL.palms), rpick(ROOFS), 'house');
      if (R() < 0.45 && rc.w - w > 70) decor.push({ t: 'pool', x: x + w + 10 < rc.x + rc.w - 50 ? x + w + 12 : rc.x + 8, y: rc.y + rr(10, Math.max(11, rc.h - 70)), w: 40, h: 58 });
      for (let k = 0; k < 2; k++) {
        const tx = rc.x + rr(8, rc.w - 8), ty = rc.y + rr(8, rc.h - 8);
        if (tx > x - 14 && tx < x + w + 14 && ty > y - 14 && ty < y + h + 14) continue;
        trees.push({ x: tx, y: ty, z: rr(60, 95), type: R() < 0.6 ? 'palm' : 'tree', r: 6, ph: rr(0, 6) });
      }
      return;
    }
    if (r < 0.14 && rc.w > 110 && rc.h > 110) { // חניון
      decor.push({ t: 'parking', x: rc.x + 6, y: rc.y + 6, w: rc.w - 12, h: rc.h - 12 });
      const n = Math.floor((rc.w - 30) / 44);
      for (let k = 0; k < n; k++) if (R() < 0.6) parkSpots.push({ x: rc.x + 28 + k * 44, y: rc.y + 42, ang: Math.PI / 2 });
      return;
    }
    if (r < 0.21 && d !== 'port') { // רחבה עם עצים
      decor.push({ t: 'plaza', x: rc.x + 6, y: rc.y + 6, w: rc.w - 12, h: rc.h - 12 });
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) trees.push({ x: rc.x + rr(20, rc.w - 20), y: rc.y + rr(20, rc.h - 20), z: rr(60, 100), type: d === 'downtown' ? 'tree' : 'palm', r: 6, ph: rr(0, 6) });
      return;
    }
    if (d === 'port' && r < 0.5) { // מכולות
      decor.push({ t: 'yard', x: rc.x + 4, y: rc.y + 4, w: rc.w - 8, h: rc.h - 8 });
      const cols = Math.floor((rc.w - 20) / 78), rows = Math.floor((rc.h - 20) / 44);
      for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
        if (R() < 0.45) continue;
        addBuilding(rc.x + 12 + cx * 78, rc.y + 12 + cy * 44, 68, 30, R() < 0.3 ? 44 : 22, rpick(BOXES), '', 'box');
      }
      return;
    }
    const g = rr(7, 14);
    const w = rc.w - g * 2, h = rc.h - g * 2;
    if (w < 50 || h < 50) return;
    const hr = HEIGHT[d];
    let z = rr(hr[0], hr[1]);
    if (d === 'downtown' && R() < 0.25) z *= 1.25;
    const neonP = { strip: 0.75, market: 0.45, downtown: 0.3, port: 0.05 }[d];
    const wall = rpick(PAL[d]);
    addBuilding(rc.x + g, rc.y + g, w, h, z, wall, d === 'downtown' ? '#5c6670' : d === 'port' ? '#6d7377' : NC.shade(wall, -0.25), d === 'port' ? 'warehouse' : d, R() < neonP ? rpick(NEONS) : null);
  }

  function split(rc, d, depth) {
    const m = MAXLOT[d];
    if ((rc.w > m || rc.h > m) && depth < 5) {
      const f = rr(0.4, 0.6);
      if (rc.w >= rc.h) { split({ x: rc.x, y: rc.y, w: rc.w * f, h: rc.h }, d, depth + 1); split({ x: rc.x + rc.w * f, y: rc.y, w: rc.w * (1 - f), h: rc.h }, d, depth + 1); }
      else { split({ x: rc.x, y: rc.y, w: rc.w, h: rc.h * f }, d, depth + 1); split({ x: rc.x, y: rc.y + rc.h * f, w: rc.w, h: rc.h * (1 - f) }, d, depth + 1); }
    } else lot(rc, d);
  }

  const SPECIAL_LOOK = {
    home: { wall: '#ffd8a8', roof: '#c8553d', z: 46, neon: null, label: '🏠' },
    hospital: { wall: '#f4f6f8', roof: '#dfe6ea', z: 110, neon: '#ff5a5a', label: '✚' },
    taxi: { wall: '#ffd23f', roof: '#3a3a3a', z: 55, neon: '#ffe14d', label: '🚕' },
    police: { wall: '#c9d6e8', roof: '#2c4a7c', z: 80, neon: '#4d8dff', label: '★' },
    spray: { wall: '#9be7c4', roof: '#2f8f6b', z: 50, neon: '#3dff9e', label: '🎨' },
    spray2: { wall: '#9be7c4', roof: '#2f8f6b', z: 50, neon: '#3dff9e', label: '🎨' },
    garage: { wall: '#b0a089', roof: '#5a5148', z: 60, neon: '#ff7a3d', label: '🔧' },
    docks: { wall: '#8fa3ad', roof: '#4d5c66', z: 65, neon: '#19e3ff', label: '⚓' },
    club: { wall: '#ff9eb5', roof: '#7a2d5c', z: 120, neon: '#ff3fa4', label: '♫' },
    tower: { wall: '#9cc7e0', roof: '#3d4f63', z: 460, neon: '#19e3ff', label: 'H' },
  };

  // מעבר על כל התאים ויצירת התוכן
  const cellDone = new Uint8Array(CA * CB);
  for (let b = 0; b < CB; b++) {
    for (let a = 0; a < CA; a++) {
      if (cellDone[cidx(a, b)] || used[cidx(a, b)] === 2) continue;
      let a2 = a, b2 = b;
      const mg = merges.find((m) => m.a === a && m.b === b);
      if (mg) { if (mg.dir === 0) a2 = a + 1; else b2 = b + 1; }
      cellDone[cidx(a, b)] = cellDone[cidx(a2, b2)] = 1;
      const tx0 = 3 + 4 * a, ty0 = 3 + 4 * b, tx1 = 5 + 4 * a2, ty1 = 5 + 4 * b2;
      const x0 = tx0 * T + 8, y0 = ty0 * T + 8, x1 = (tx1 + 1) * T - 8, y1 = (ty1 + 1) * T - 8;
      const d = districtOfTile(tx0 + 1, ty0 + 1);
      const sk = Object.keys(SPECIAL_CELLS).find((k) => SPECIAL_CELLS[k][0] === a && SPECIAL_CELLS[k][1] === b);
      if (sk) {
        const L = SPECIAL_LOOK[sk];
        const bh = (y1 - y0) * 0.5;
        addBuilding(x0 + 6, y0 + 6, x1 - x0 - 12, bh - 6, L.z, L.wall, L.roof, 'special', L.neon);
        buildings[buildings.length - 1].label = L.label;
        decor.push({ t: 'plaza', x: x0, y: y0 + bh + 6, w: x1 - x0, h: y1 - y0 - bh - 6, special: sk });
        special[sk] = { x: (x0 + x1) / 2, y: y0 + bh + (y1 - y0 - bh) / 2 + 10, bx: (x0 + x1) / 2, by: y0 + bh / 2 };
        continue;
      }
      split({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, d, 0);
    }
  }

  // הפארק: עצים, אגם ושבילים
  {
    const px0 = 23 * T, py0 = 23 * T, pw = 7 * T;
    decor.push({ t: 'pond', x: px0 + pw * 0.5, y: py0 + pw * 0.45, rx: 190, ry: 130 });
    decor.push({ t: 'path', x: px0 + 20, y: py0 + pw * 0.78, w: pw - 40, h: 34 });
    decor.push({ t: 'path', x: px0 + pw * 0.16, y: py0 + 20, w: 34, h: pw - 40 });
    for (let k = 0; k < 70; k++) {
      const x = px0 + rr(25, pw - 25), y = py0 + rr(25, pw - 25);
      const dx = (x - (px0 + pw * 0.5)) / 215, dy = (y - (py0 + pw * 0.45)) / 155;
      if (dx * dx + dy * dy < 1) continue;
      if (Math.abs(y - (py0 + pw * 0.78 + 17)) < 30 || Math.abs(x - (px0 + pw * 0.16 + 17)) < 30) continue;
      trees.push({ x, y, z: rr(70, 120), type: R() < 0.35 ? 'palm' : 'tree', r: 7, ph: rr(0, 6) });
    }
    special.park = { x: px0 + pw * 0.5, y: py0 + pw * 0.8 };
  }
  // דקלים לאורך טיילת החוף, ושמשיות על החול
  for (let j = 3; j <= 57; j++) {
    if (j % 4 === 2) continue;
    trees.push({ x: 55 * T + 14, y: j * T + 30, z: 110, type: 'palm', r: 6, ph: j });
    if (j % 2) trees.push({ x: 55 * T + 70 + rr(0, 60), y: j * T + 90, z: 100, type: 'palm', r: 6, ph: j * 2 });
    for (let k = 0; k < 2; k++) decor.push({ t: 'umbrella', x: 55 * T + rr(60, 210), y: j * T + rr(10, 110), c: rpick(NEONS) });
  }
  // עצים בביצות
  for (let k = 0; k < 260; k++) {
    const side = R() < 0.5;
    const x = side ? rr(10, 2 * T - 30) : rr(10, 55 * T), y = side ? rr(10, 59 * T) : rr(10, 2 * T - 30);
    trees.push({ x, y, z: rr(60, 110), type: 'tree', r: 7, ph: rr(0, 6) });
  }
  // פנסי רחוב בצמתים
  for (let j = 2; j <= 58; j += 4) for (let i = 2; i <= 54; i += 4) {
    if (connCount(conn(i, j)) < 3) continue;
    lamps.push({ x: i * T + 12, y: j * T + 12 }, { x: (i + 1) * T - 12, y: (j + 1) * T - 12 });
  }
  // פנסים גם באמצע קטעים ארוכים
  for (let j = 2; j <= 58; j++) for (let i = 2; i <= 54; i++) {
    if (!isRoad(i, j)) continue;
    const m = conn(i, j);
    if (m === 10 && i % 4 === 0) lamps.push({ x: (i + 0.5) * T, y: j * T + 10 });
    if (m === 5 && j % 4 === 0) lamps.push({ x: i * T + 10, y: (j + 0.5) * T });
  }

  // --- אינדקס מרחבי לפי משבצות ---
  const bGrid = Array.from({ length: N * N }, () => []);
  const tGrid = Array.from({ length: N * N }, () => []);
  const dGrid = Array.from({ length: N * N }, () => []);
  const lGrid = Array.from({ length: N * N }, () => []);
  buildings.forEach((b, k) => {
    b.id = k;
    for (let j = Math.floor(b.y / T); j <= Math.floor((b.y + b.h) / T); j++) for (let i = Math.floor(b.x / T); i <= Math.floor((b.x + b.w) / T); i++) if (inb(i, j)) bGrid[idx(i, j)].push(b);
  });
  // עץ שנפל בתוך בניין – מוסר
  const insideB = (x, y, m) => { const i = Math.floor(x / T), j = Math.floor(y / T); return inb(i, j) && bGrid[idx(i, j)].some((b) => x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m); };
  const keptTrees = trees.filter((t) => !insideB(t.x, t.y, 8));
  keptTrees.forEach((t) => { const i = Math.floor(t.x / T), j = Math.floor(t.y / T); if (inb(i, j)) tGrid[idx(i, j)].push(t); });
  decor.forEach((d) => { const i = Math.floor(d.x / T), j = Math.floor(d.y / T); if (inb(i, j)) dGrid[idx(i, j)].push(d); });
  lamps.forEach((l) => { const i = Math.floor(l.x / T), j = Math.floor(l.y / T); if (inb(i, j)) lGrid[idx(i, j)].push(l); });
  const goodSpots = parkSpots.filter((p) => !insideB(p.x, p.y, 20));

  // צבע קרקע לכל משבצת
  const groundColor = new Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) groundColor[idx(i, j)] = DISTRICTS[districtOfTile(i, j)].ground;

  const roadTiles = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (tiles[idx(i, j)] === ROAD) roadTiles.push([i, j]);

  // מרכז צומת לפי אינדקס כביש (a: 0..13, b: 0..14)
  const cross = (a, b) => ({ x: (2 + 4 * a + 0.5) * T, y: (2 + 4 * b + 0.5) * T });

  // המשבצת הקרובה ביותר שהיא כביש
  function nearestRoad(x, y) {
    const ci = NC.clamp(Math.floor(x / T), 0, N - 1), cj = NC.clamp(Math.floor(y / T), 0, N - 1);
    for (let r = 0; r < 8; r++) {
      let best = null, bd = 1e18;
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !isRoad(i, j)) continue;
        const d = ((i + 0.5) * T - x) ** 2 + ((j + 0.5) * T - y) ** 2;
        if (d < bd) { bd = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return [2, 2];
  }

  // --- רמזורים: בכל צומת שני (דוגמת שחמט), עם הפרשי זמן שיוצרים "גל ירוק" ---
  const CYCLE = 20;
  const signal = new Uint8Array(N * N);
  for (let j = 2; j <= 58; j += 4) for (let i = 2; i <= 54; i += 4) {
    if (connCount(conn(i, j)) >= 3 && (((i - 2) / 4 + (j - 2) / 4) % 2 === 0)) signal[idx(i, j)] = 1;
  }
  const signalAt = (i, j) => inb(i, j) && signal[idx(i, j)] === 1;
  // שלב: 0 ירוק צפון-דרום, 1 צהוב, 2 אדום לכולם, 3 ירוק מזרח-מערב, 4 צהוב, 5 אדום לכולם
  function lightPhase(i, j, time) {
    const t = (time + ((i - 2) / 4) * 3.5 + ((j - 2) / 4) * 6) % CYCLE;
    return t < 7.5 ? 0 : t < 9 ? 1 : t < 10 ? 2 : t < 17.5 ? 3 : t < 19 ? 4 : 5;
  }
  // 2 = ירוק, 1 = צהוב, 0 = אדום – לציר הנסיעה הנתון
  function canGo(i, j, axisNS, time) {
    const ph = lightPhase(i, j, time);
    return axisNS ? (ph === 0 ? 2 : ph === 1 ? 1 : 0) : (ph === 3 ? 2 : ph === 4 ? 1 : 0);
  }

  // --- קו ראייה: האם בניין גבוה מסתיר בין שתי נקודות ---
  function los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 26));
    for (let q = 1; q < n; q++) {
      const x = x0 + (x1 - x0) * q / n, y = y0 + (y1 - y0) * q / n, i = Math.floor(x / T), j = Math.floor(y / T);
      if (!inb(i, j)) continue;
      for (const b of bGrid[idx(i, j)]) if (b.z > 40 && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    }
    return true;
  }

  // --- שדה מרחקים על רשת הכבישים (BFS) מנקודה נתונה. out: Int16Array בגודל N*N ---
  const DIR4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function fieldFrom(x, y, out) {
    out.fill(-1);
    const [si, sj] = nearestRoad(x, y);
    const q = [si, sj]; out[idx(si, sj)] = 0;
    for (let h = 0; h < q.length; h += 2) {
      const i = q[h], j = q[h + 1], d = out[idx(i, j)] + 1;
      for (let k = 0; k < 4; k++) {
        const ni = i + DIR4[k][0], nj = j + DIR4[k][1];
        if (isRoad(ni, nj) && out[idx(ni, nj)] < 0) { out[idx(ni, nj)] = d; q.push(ni, nj); }
      }
    }
    return out;
  }
  // מרחק נסיעה בכבישים בין שתי נקודות, ביחידות עולם
  const tmpField = new Int16Array(N * N);
  function roadDist(ax, ay, bx, by) {
    fieldFrom(bx, by, tmpField);
    const [i, j] = nearestRoad(ax, ay), v = tmpField[idx(i, j)];
    return (v < 0 ? Math.hypot(ax - bx, ay - by) / T : v) * T;
  }
  // אריחי כביש ישרים (לא צמתים) – מקומות טובים לעצירה, לאיסוף נוסעים ולמחסומים
  const straightTiles = roadTiles.filter(([i, j]) => { const m = conn(i, j); return m === 5 || m === 10; });

  NC.map = {
    signalAt, lightPhase, canGo, los, fieldFrom, roadDist, straightTiles,
    T, N, WS, GROUND, ROAD, SAND, WATER, PARK, GLADE, tiles, idx, inb, isRoad, conn, connCount,
    tileAt: (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); return inb(i, j) ? tiles[idx(i, j)] : WATER; },
    // מים עמוקים (טובעים בהם). המשבצת הראשונה ליד החוף רדודה – רק מאטה
    isDeep: (x, y) => { const i = Math.floor(x / T), j = Math.floor(y / T); return !inb(i, j) || (tiles[idx(i, j)] === WATER && (i >= 58 || j >= 60)); },
    districtAt: (x, y) => districtOfTile(Math.floor(x / T), Math.floor(y / T)),
    DISTRICTS, buildings, trees: keptTrees, lamps, decor, parkSpots: goodSpots, special, bGrid, tGrid, dGrid, lGrid,
    groundColor, roadTiles, cross, nearestRoad, insideB,
  };
})();
