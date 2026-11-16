/* חוף ניאון – משימות הסיפור, עבודות צד (מונית, מרוצי זמן), פלמינגו זהב נסתרים, מוסך ריסוס ובית חולים */
'use strict';
(() => {
  const NC = window.NC, M = NC.map, T = M.T, N = M.N, G = NC.G, W = NC.world, Fx = NC.fx;
  const { rand, pick, clamp } = NC;
  const S = M.special;

  // אמצע קטע כביש ישר הקרוב לנקודה (מקום טוב לעצור בו)
  function straightNear(x, y) {
    let best = null, bd = 1e18;
    for (const [i, j] of M.straightTiles) {
      const d = ((i + 0.5) * T - x) ** 2 + ((j + 0.5) * T - y) ** 2;
      if (d < bd) { bd = d; best = { x: (i + 0.5) * T, y: (j + 0.5) * T, h: M.conn(i, j) === 10, i, j }; }
    }
    return best;
  }
  const curb = (p) => ({ x: p.x + (p.h ? 0 : 52), y: p.y + (p.h ? 52 : 0) }); // המדרכה שליד
  const X = (a, b) => M.cross(a, b);

  // מסלול שערים בין צמתים, לאורך כבישים קיימים בלבד (שער בכל צומת ובכל פנייה)
  function pathGates(wps) {
    const out = [], buf = new Int16Array(N * N), D = W.DIRS;
    const push = (i, j) => { const x = (i + 0.5) * T, y = (j + 0.5) * T, l = out[out.length - 1]; if (!l || l.x !== x || l.y !== y) out.push({ x, y }); };
    for (let q = 0; q + 1 < wps.length; q++) {
      const b = X(wps[q + 1][0], wps[q + 1][1]);
      M.fieldFrom(b.x, b.y, buf);
      let i = 2 + 4 * wps[q][0], j = 2 + 4 * wps[q][1], pd = -1, guard = 0;
      if (q === 0) push(i, j);
      while (buf[M.idx(i, j)] > 0 && guard++ < 500) {
        const cur = buf[M.idx(i, j)];
        let best = -1;
        for (const k of [pd, 0, 1, 2, 3]) { if (k < 0) continue; const ni = i + D[k][0], nj = j + D[k][1]; if (M.isRoad(ni, nj) && buf[M.idx(ni, nj)] === cur - 1) { best = k; break; } }
        if (best < 0) break;
        if (pd >= 0 && best !== pd) push(i, j); // פנייה
        i += D[best][0]; j += D[best][1]; pd = best;
        if (M.connCount(M.conn(i, j)) >= 3) push(i, j);
      }
      push(i, j);
    }
    return out;
  }
  const routeLen = (pts) => { let l = 0; for (let q = 1; q < pts.length; q++) l += Math.hypot(pts[q].x - pts[q - 1].x, pts[q].y - pts[q - 1].y); return l; };
  const corners = (pts) => { let n = 0; for (let q = 1; q + 1 < pts.length; q++) if ((pts[q].x - pts[q - 1].x) * (pts[q + 1].y - pts[q].y) - (pts[q].y - pts[q - 1].y) * (pts[q + 1].x - pts[q].x) !== 0) n++; return n; };
  // מקום בנתיב הנכון על אריח ישר, עם הפנים לכיוון היעד
  const laneBuf = new Int16Array(N * N);
  function laneSpot(p, toward, byRoad) {
    const horiz = p.h;
    let dir = horiz ? (toward.x >= p.x ? 0 : 2) : (toward.y >= p.y ? 1 : 3);
    if (byRoad) { // לפי מסלול הכבישים בפועל, לא לפי קו אווירי
      M.fieldFrom(toward.x, toward.y, laneBuf);
      const i = Math.floor(p.x / T), j = Math.floor(p.y / T), a = horiz ? 0 : 1, b = a + 2;
      const fa = laneBuf[M.idx(i + W.DIRS[a][0], j + W.DIRS[a][1])], fb = laneBuf[M.idx(i + W.DIRS[b][0], j + W.DIRS[b][1])];
      if (fa >= 0 && fb >= 0) dir = fa <= fb ? a : b;
    }
    const D = W.DIRS[dir];
    return { x: p.x - D[1] * W.LANE, y: p.y + D[0] * W.LANE, ang: Math.atan2(D[1], D[0]), dir };
  }

  const fareA = straightNear(S.park.x, S.park.y + 500), fareB = straightNear(S.tower.x - 300, S.tower.y + 200);
  const fareC = straightNear(S.club.x - 200, S.club.y), fareD = straightNear(S.hospital.x, S.hospital.y + 300);
  const fareE = straightNear(S.police.x + 300, S.police.y - 400), fareF = straightNear(S.docks.x - 700, S.docks.y - 200);
  const prize = { x: S.tower.x + 60, y: S.tower.y };
  const raceRoute = pathGates([[13, 5], [13, 7], [13, 9], [13, 11], [13, 13], [13, 14], [11, 14], [9, 14], [9, 12], [11, 12], [11, 10], [13, 10], [13, 7]]);
  const gpRoute = pathGates([[11, 14], [5, 14], [5, 10], [9, 10], [9, 6], [13, 6], [13, 10], [13, 14], [11, 14]]);
  const courierFrom = straightNear(X(8, 7).x + 240, X(8, 7).y), courierTo = straightNear(S.docks.x - 420, S.docks.y + 60);

  // --- פלמינגו זהב נסתרים ---
  const PKGS = NC.PKGS = [];
  const lots = M.decor.filter((d) => (d.t === 'plaza' || d.t === 'parking') && !d.special);
  {
    const step = Math.max(1, Math.floor(lots.length / 10));
    for (let i = 0; i < lots.length && PKGS.length < 10; i += step) PKGS.push({ x: lots[i].x + lots[i].w / 2, y: lots[i].y + lots[i].h / 2 });
    PKGS.push({ x: 56 * T, y: 9 * T }, { x: 56.3 * T, y: 33 * T }, { x: 56 * T, y: 52 * T }, { x: S.park.x + 250, y: S.park.y - 330 }, { x: 1.2 * T, y: 30 * T });
  }
  // מזוודות למשימת האיסוף: רחבות וחניונים קרובים לתחנת המוניות, שאין בהם פלמינגו
  const luggage = lots.map((d) => ({ x: d.x + d.w / 2, y: d.y + d.h / 2 }))
    .filter((p) => !PKGS.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < 60) && !M.insideB(p.x, p.y, 14))
    .map((p) => ({ p, d: Math.hypot(p.x - S.taxi.x, p.y - S.taxi.y) })).filter((o) => o.d > 350 && o.d < 3200).sort((a, b) => a.d - b.d).filter((o, q) => q % 2 === 0).slice(0, 6).map((o) => o.p);

  const WHO = { rosa: { name: 'Aunt Rosa', icon: 'R', col: '#ffd23f' }, mickey: { name: 'Mickey Keys', icon: 'M', col: '#ff9d3d' }, lola: { name: 'Lola Neon', icon: 'L', col: '#ff7ac8' }, ziv: { name: 'Captain Ziv', icon: 'Z', col: '#5fe9ff' } };

  const MISSIONS = NC.MISSIONS = [
    {
      id: 'welcome', title: 'Welcome to Neon Coast', by: 'rosa', start: S.home, reward: 150, requires: [],
      brief: 'You finally made it, sweetheart! This city is beautiful, but you will not get far without wheels. Find yourself a car – there is a pink one right by the house – and come see me at the taxi stand. I have work for you.',
      steps: [
        { t: 'car', text: 'Get into any car' },
        { t: 'goto', p: S.taxi, car: true, stop: true, text: 'Drive to Aunt Rosa\'s taxi stand 🚕' },
      ],
    },
    {
      id: 'shift', title: 'First Shift', by: 'rosa', start: S.taxi, reward: 350, requires: ['welcome'],
      brief: 'Three passengers are waiting, and they are not patient. Take the yellow taxi, pick each one up and get them where they are going before the clock runs out. And mind the paintwork, okay?',
      steps: [
        { t: 'spawn', type: 'taxi', at: { x: S.taxi.x - 70, y: S.taxi.y + 10 }, ang: 0 },
        { t: 'car', tag: true, text: 'Get into the yellow taxi' },
        { t: 'ped', at: curb(fareA) }, { t: 'goto', p: fareA, car: 'tag', stop: true, pickup: true, time: 'auto', text: 'Pick up the first passenger' },
        { t: 'goto', p: fareB, car: 'tag', stop: true, drop: true, time: 'auto', tip: 60, text: 'Take him to Glass Towers' },
        { t: 'ped', at: curb(fareC) }, { t: 'goto', p: fareC, car: 'tag', stop: true, pickup: true, time: 'auto', text: 'A passenger is waiting on the Neon Strip' },
        { t: 'goto', p: fareD, car: 'tag', stop: true, drop: true, time: 'auto', tip: 80, text: 'Take her to the hospital – fast!' },
        { t: 'ped', at: curb(fareE) }, { t: 'goto', p: fareE, car: 'tag', stop: true, pickup: true, time: 'auto', text: 'Last passenger, near the police station' },
        { t: 'goto', p: fareF, car: 'tag', stop: true, drop: true, time: 'auto', tip: 100, text: 'Take him to the Old Port' },
      ],
    },
    {
      id: 'delivery', title: 'Mickey\'s Delivery', by: 'mickey', start: S.garage, reward: 700, requires: ['shift'],
      brief: 'I hear you can drive. There is a blue sports car parked by the tallest tower in the city. My client wants it, and the owner... is not exactly selling. Bring it to me in one piece. The moment you touch it, the police will wake up.',
      steps: [
        { t: 'spawn', type: 'sports', at: prize, ang: 0, color: '#1f6fff' },
        { t: 'goto', p: prize, r: 130, text: 'Go to the tall tower in Glass Towers' },
        { t: 'car', tag: true, text: 'Get into the blue sports car' },
        { t: 'wanted', n: 2 },
        { t: 'goto', p: S.garage, car: 'tag', stop: true, text: 'Bring the car to Mickey\'s garage – in one piece!' },
      ],
    },
    {
      id: 'souvenirs', title: 'Lost Luggage', by: 'rosa', start: S.taxi, reward: 800, requires: ['shift'],
      brief: 'A tour bus dropped its whole luggage rack all over my side of town, and the tourists fly home tonight. Six suitcases, scattered around the lots and plazas near here. Grab them all before the clock runs out and bring them back to me.',
      steps: [
        { t: 'collect', pts: luggage, icon: '🧳', time: 'auto', text: 'Collect all six suitcases 🧳' },
        { t: 'goto', p: S.taxi, stop: true, add: 45, text: 'Bring the luggage back to Aunt Rosa' },
      ],
    },
    {
      id: 'tail', title: 'Eyes on the Courier', by: 'mickey', start: S.garage, reward: 1000, requires: ['delivery'],
      brief: 'A purple truck leaves the Color Market every day with parts that should have been mine. Follow it to wherever they unload. Stay back – if the driver sees you in his mirror, or you lose him, it is over. When he parks, the truck is yours.',
      steps: [
        { t: 'spawn', type: 'van', at: courierFrom, lane: courierTo, color: '#8e6bbf', as: 'target' },
        { t: 'goto', p: courierFrom, r: 300, car: true, text: 'Find the purple truck in the Color Market' },
        { t: 'tail', to: courierTo, text: 'Tail the truck – not too close, not too far' },
        { t: 'car', tag: true, text: 'He is gone. Take the truck!' },
        { t: 'wanted', n: 1 },
        { t: 'goto', p: S.garage, car: 'tag', stop: true, text: 'Bring the truck to Mickey\'s garage' },
      ],
    },
    {
      id: 'race', title: 'Sunset Race', by: 'lola', start: S.club, reward: 900, requires: ['delivery'],
      brief: 'Everyone here is talking about Rosa\'s new driver. Let us see if you are really that fast: a race down the boardwalk, around the port and back. Every gate adds a few seconds. Lose – and I am telling everyone.',
      steps: [
        { t: 'car', text: 'Get into a fast car' },
        ...raceRoute.map((p, q) => ({ t: 'goto', p, r: 80, race: true, car: true, time: q === 0 ? 22 : undefined, add: q === 0 ? undefined : 'gate', text: 'Race! Drive through every gate' })),
        { t: 'goto', p: S.club, r: 70, race: true, car: true, add: 12, text: 'Finish line – back to Lola\'s club!' },
      ],
    },
    {
      id: 'derby', title: 'Bumper Cars', by: 'lola', start: S.club, reward: 1100, requires: ['race'],
      brief: 'Three show-offs from out of town have been tearing up my street and scaring my guests. I want their cars off the road – permanently. Ram them until they smoke. Use something heavy, and get out of yours if it catches fire.',
      steps: [
        { t: 'car', text: 'Get into a sturdy car' },
        { t: 'smash', time: 210, targets: [{ type: 'muscle', color: '#ff5252', near: X(13, 6) }, { type: 'sports', color: '#ffe14d', near: X(12, 8) }, { type: 'muscle', color: '#3dff9e', near: X(11, 4) }], text: 'Wreck the three show-off cars' },
      ],
    },
    {
      id: 'heat', title: 'Heat in the City', by: 'lola', start: S.club, reward: 1200, requires: ['derby'],
      brief: 'We have a problem. Someone snitched on Mickey, and the police are looking for his driver – meaning you. They are already on their way. Lose them: get out of their sight, or find a spray shop 🎨 and change your color.',
      steps: [
        { t: 'wanted', n: 3 },
        { t: 'evade', text: 'Lose the police! (Get out of sight or drive into a spray shop 🎨)' },
      ],
    },
    {
      id: 'grandprix', title: 'Harbor Grand Prix', by: 'ziv', start: S.docks, reward: 2000, requires: ['heat'],
      brief: 'Once a year the dock crews race a full lap of the city, and this year my money is on you. Three rivals, one lap, first across the line takes the pot. There is a white sports car waiting for you – or bring your own.',
      steps: [
        { t: 'spawn', type: 'sports', at: { x: S.docks.x - 60, y: S.docks.y + 10 }, ang: Math.PI, color: '#f4f6f8', as: 'spare' },
        { t: 'car', text: 'Get into a fast car' },
        { t: 'rivals', route: gpRoute, rivals: [{ type: 'sports', color: '#ff5252', skill: 0.88 }, { type: 'muscle', color: '#ffe14d', skill: 0.93 }, { type: 'sports', color: '#9d5cff', skill: 0.97 }], text: 'Win the race! Drive through every gate' },
      ],
    },
    {
      id: 'cargo', title: 'The Port Cargo', by: 'ziv', start: S.docks, reward: 3000, requires: ['grandprix', 'tail', 'souvenirs'],
      brief: 'This is the big job. This truck has to reach the tallest tower in the city before the clock runs out. It is heavy and slow, and the cargo is fragile. Halfway there they will figure out what is going on – so do not stop for anyone.',
      steps: [
        { t: 'spawn', type: 'van', at: { x: S.docks.x - 60, y: S.docks.y + 10 }, ang: Math.PI, color: '#ecf0f1' },
        { t: 'car', tag: true, text: 'Get into the white truck' },
        { t: 'goto', p: X(9, 9), r: 110, car: 'tag', time: 'auto', fragile: 0.12, text: 'Drive north through the Color Market' },
        { t: 'wanted', n: 3 },
        { t: 'goto', p: S.tower, car: 'tag', stop: true, r: 70, add: 'auto', fragile: 0.12, text: 'The police are on you! Reach the tall tower' },
      ],
    },
  ];
  const byId = {};
  for (const m of MISSIONS) { byId[m.id] = m; Object.assign(m, { who: WHO[m.by].name, icon: WHO[m.by].icon, col: WHO[m.by].col }); }

  // --- מרוצי זמן (עבודת צד חוזרת) ---
  function trial(id, title, startAt, wps, text) {
    // זמני המדליות כוילו מול נהג-בדיקה אוטומטי ברכב ספורט: זהב קצת מעליו, ארד בהישג יד בכל רכב
    const route = pathGates(wps), len = routeLen(route), ref = len / 450 + corners(route) * 1.3;
    return { id, job: 'trial', title, who: 'Time Trial', icon: '🏁', col: '#ff9d3d', start: straightNear(startAt.x, startAt.y), route, gold: Math.round(ref * 1.15 + 1), silver: Math.round(ref * 1.38 + 1), bronze: Math.round(ref * 1.75 + 1), reward: 0, text, requires: ['shift'] };
  }
  const TRIALS = NC.TRIALS = [
    trial('tt_strip', 'Strip Sprint', X(13, 2), [[13, 2], [13, 12], [11, 12], [11, 2], [13, 2]], 'Down the Neon Strip and back up through the market.'),
    trial('tt_town', 'Downtown Dash', X(8, 1), [[8, 1], [8, 4], [11, 4], [11, 1], [8, 1], [8, 4], [11, 4], [11, 1], [8, 1]], 'Two tight laps around the glass towers.'),
    trial('tt_coast', 'Coast to Coast', X(1, 7), [[1, 7], [13, 7], [13, 9], [1, 9], [1, 7]], 'Across the whole city and back again.'),
  ];
  for (const t of TRIALS) byId[t.id] = t;
  const ALL = MISSIONS.concat(TRIALS);
  const MEDAL = { gold: ['🥇 Gold', 1000], silver: ['🥈 Silver', 500], bronze: ['🥉 Bronze', 250] };

  // ---------------- מנוע המשימות ----------------
  const immediate = { spawn: 1, ped: 1, wanted: 1 };
  let declined = null, sprayCd = 0, healCd = 0, startCd = 1.2; // startCd: הפסקה קצרה לפני התדריך הבא
  const isDone = (id) => G.done.includes(id);
  const available = (m) => !isDone(m.id) && m.requires.every(isDone);
  const storyDone = () => MISSIONS.filter((m) => isDone(m.id)).length;
  // אחרי כישלונות מקבלים קצת יותר זמן – כדי שאף אחד לא ייתקע
  const timeMult = (def) => NC.diff().time * (1 + 0.12 * Math.min(3, G.fails[def.id] || 0));
  const driveTime = (ax, ay, bx, by) => Math.max(16, M.roadDist(ax, ay, bx, by) / 185 + 14);

  function begin(def) {
    if (typeof def === 'number') def = MISSIONS[def]; else if (typeof def === 'string') def = byId[def];
    if (!def) return;
    const steps = def.job === 'trial' ? trialSteps(def) : def.steps;
    G.mission = { def, id: def.id, steps, step: -1, timer: null, watch: null, tag: null, target: null, ped: null, stopT: 0, t0: G.time, cars: [], items: null, hud: '', spook: 0, farT: 0, count: 0, total: 0, mult: timeMult(def), gate: 0, finished: 0, go: 0, fares: 0, earned: 0, outT: 0 };
    advance();
  }
  function cur() { return G.mission ? G.mission.steps[G.mission.step] : null; }
  function curText() { const s = cur(); return s ? s.text || '' : ''; }
  const prevPoint = (ms) => { for (let q = ms.step - 1; q >= 0; q--) if (ms.steps[q].p) return ms.steps[q].p; return W.playerPos(); };

  function spawnMissionCar(s, tag) {
    let x = s.at.x, y = s.at.y, ang = s.ang || 0;
    if (s.lane) { const l = laneSpot(s.at, s.lane, true); x = l.x; y = l.y; ang = l.ang; }
    G.cars = G.cars.filter((c) => Math.hypot(c.x - x, c.y - y) > 95 || c === G.player.car || c.tag);
    return W.makeCar(s.type, x, y, ang, { tag, color: s.color, parked: true });
  }

  function advance() {
    const ms = G.mission, steps = ms.steps, pp = W.playerPos();
    ms.step++; ms.stopT = 0; ms.hud = '';
    if (ms.step >= steps.length) { pass(); return; }
    const s = steps[ms.step];
    if (s.time === 'auto') ms.timer = (s.t === 'collect' ? collectTime(s.pts, pp) : driveTime(pp.x, pp.y, s.p.x, s.p.y)) * ms.mult;
    else if (s.time != null) ms.timer = s.time * ms.mult;
    else if (s.add != null) { const pv = prevPoint(ms); ms.timer = (ms.timer || 0) + (s.add === 'gate' ? Math.hypot(s.p.x - pv.x, s.p.y - pv.y) / 240 + 0.15 : s.add === 'auto' ? driveTime(pp.x, pp.y, s.p.x, s.p.y) : s.add) * ms.mult; }
    else if (!immediate[s.t] && !s.keep) ms.timer = null;
    if (s.t === 'spawn') {
      const c = spawnMissionCar(s, s.as || true);
      if (s.as === 'target') ms.target = c; else if (s.as === 'spare') ms.spare = c; else ms.tag = c;
      advance(); return;
    }
    if (s.t === 'ped') {
      if (ms.ped) ms.ped.tag = null;
      ms.ped = W.makePed(s.at.x, s.at.y, { tag: true, shirt: '#ff3fa4' }); ms.ped.st = 'wait';
      advance(); return;
    }
    if (s.t === 'wanted') { W.setWanted(s.n); advance(); return; }
    if (s.t === 'collect') { ms.items = s.pts.map((p) => ({ x: p.x, y: p.y, got: false })); ms.total = s.pts.length; ms.count = 0; }
    else if (s.t === 'tail') {
      const c = ms.target, to = s.to;
      c.parked = false; c.driver = 'ai'; c.ai = W.newAI(W.headingDir(c.ang), false); c.ai.cruise = 185;
      c.ai.route = M.fieldFrom(to.x, to.y, new Int16Array(N * N));
      ms.spook = 0; ms.farT = 0; ms.go = 0;
    } else if (s.t === 'smash') {
      ms.cars = s.targets.map((t) => {
        const sp = straightNear(t.near.x + rand(-200, 200), t.near.y + rand(-200, 200)), l = laneSpot(sp, pp);
        G.cars = G.cars.filter((c) => Math.hypot(c.x - l.x, c.y - l.y) > 95 || c === G.player.car || c.tag);
        const c = W.makeCar(t.type, l.x, l.y, l.ang, { tag: 'enemy', color: t.color, driver: 'ai' });
        c.ai = W.newAI(l.dir, false); c.ai.cruise = 200; c.hp = Math.min(c.hp, 80);
        return c;
      });
      ms.total = ms.cars.length; ms.count = 0;
    } else if (s.t === 'rivals') {
      // שורת זינוק: לפני השער הראשון, עם הפנים אליו
      const p0 = s.route[0], p1 = s.route[1], a = Math.atan2(p1.y - p0.y, p1.x - p0.x), ux = Math.cos(a), uy = Math.sin(a);
      ms.cars = s.rivals.map((r, q) => {
        const x = p0.x - ux * (150 + q * 74) + uy * (q % 2 ? 22 : -22), y = p0.y - uy * (150 + q * 74) - ux * (q % 2 ? 22 : -22);
        G.cars = G.cars.filter((c) => Math.hypot(c.x - x, c.y - y) > 95 || c === G.player.car || c.tag);
        const c = W.makeCar(r.type, x, y, a, { tag: 'rival', color: r.color, driver: 'ai' });
        c.ai = W.newAI(0, false); c.ai.racer = { pts: s.route, idx: 0, skill: r.skill, base: r.skill, r: 85, hold: true, done: false };
        return c;
      });
      ms.gate = 0; ms.finished = 0; ms.total = s.route.length; ms.go = 0;
    }
    NC.ui.objective(s.text || '');
  }
  function collectTime(pts, from) { // סיור "השכן הקרוב" בין הנקודות
    const left = pts.slice(); let x = from.x, y = from.y, t = 0;
    while (left.length) { let bi = 0, bd = 1e18; left.forEach((p, q) => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; bi = q; } }); const p = left.splice(bi, 1)[0]; t += M.roadDist(x, y, p.x, p.y) / 190 + 7; x = p.x; y = p.y; }
    return t + 12;
  }
  function trialSteps(def) {
    return [
      { t: 'car', text: 'Get into a car' },
      ...def.route.map((p, q) => ({ t: 'goto', p, r: 80, race: true, car: true, keep: true, watchStart: q === 0, text: q === 0 ? 'Drive through the first gate to start the clock' : 'Time trial – hit every gate!' })),
    ];
  }

  function cleanup() {
    const ms = G.mission; if (!ms) return;
    if (ms.tag) ms.tag.tag = null;
    if (ms.spare) ms.spare.tag = null;
    if (ms.target) { ms.target.tag = null; if (ms.target.ai) ms.target.ai.route = null; }
    if (ms.ped) { ms.ped.tag = null; if (ms.ped.st === 'wait') ms.ped.st = 'return'; }
    for (const c of ms.cars) { c.tag = null; if (c.ai) { if (c.ai.racer) { c.ai.racer = null; c.ai.tileKey = -1; c.ai.dir = W.headingDir(c.ang); c.ai.switched = true; } c.ai.route = null; c.ai.cruise = rand(150, 200); } c.boost = 1; }
  }
  function pass() {
    const ms = G.mission, m = ms.def, pp = W.playerPos(), secs = G.time - ms.t0;
    cleanup();
    G.mission = null; startCd = 5;
    NC.ui.objective('');
    if (m.job === 'trial') { finishTrial(m, ms.watch); return; }
    const reward = Math.round(m.reward * NC.diff().pay / 10) * 10;
    G.money += reward; G.stats.earned += reward;
    if (!isDone(m.id)) G.done.push(m.id);
    delete G.fails[m.id];
    NC.Sound.play('pass'); Fx.confetti(pp.x, pp.y, 60); NC.ui.buzz(80);
    NC.ui.banner('Mission passed!', `${m.title} · +$${reward.toLocaleString('en-US')}`, 'pass', [`Time ${NC.fmtTime(secs)}`, `Story ${storyDone()}/${MISSIONS.length}`]);
    if (storyDone() >= MISSIONS.length) setTimeout(() => NC.ui.isPlaying() && NC.ui.toast('🌴 You finished the story! The city is yours – taxi fares, time trials and flamingos are still waiting', 'good'), 5000);
    else { const fresh = MISSIONS.filter((x) => available(x) && x.requires.includes(m.id)); if (fresh.length) setTimeout(() => NC.ui.isPlaying() && NC.ui.toast(`📍 New job from ${fresh.map((x) => x.who).filter((v, q, a) => a.indexOf(v) === q).join(' and ')}`), 4500); }
    NC.saveGame();
  }
  function finishTrial(m, t) {
    const pp = W.playerPos(), old = G.best[m.id], medal = t <= m.gold ? 'gold' : t <= m.silver ? 'silver' : t <= m.bronze ? 'bronze' : null;
    const rank = { gold: 3, silver: 2, bronze: 1 }, had = old ? rank[old.medal] || 0 : 0, now = medal ? rank[medal] : 0;
    // פרס מלא רק על מדליה חדשה או טובה יותר; אחרת דמי השתתפות קטנים
    let pay = 0;
    if (now > had) { pay = MEDAL[medal][1] - (had ? MEDAL[old.medal][1] : 0); } else if (medal) pay = 60;
    pay = Math.round(pay * NC.diff().pay / 10) * 10;
    const record = !old || t < old.t;
    if (record) G.best[m.id] = { t: +t.toFixed(2), medal: now >= had ? medal : old.medal };
    else if (now > had) old.medal = medal;
    G.money += pay; G.stats.earned += pay; G.stats.jobs++;
    NC.Sound.play(medal ? 'pass' : 'check'); if (medal) Fx.confetti(pp.x, pp.y, 40);
    NC.ui.banner(medal ? MEDAL[medal][0] : 'Finished', `${m.title} · ${NC.fmtTime(t)}${pay ? ' · +$' + pay : ''}`, medal ? 'pass' : 'info', [record ? '★ New personal best' : `Best ${NC.fmtTime(old.t)}`, `🥇 ${NC.fmtTime(m.gold)}  🥈 ${NC.fmtTime(m.silver)}  🥉 ${NC.fmtTime(m.bronze)}`]);
    NC.saveGame();
  }
  function fail(reason) {
    const ms = G.mission; if (!ms) return;
    const m = ms.def;
    if (m.job === 'taxi') { endTaxi(reason); return; }
    cleanup(); G.mission = null; declined = m.id; startCd = 4;
    if (!m.job) G.fails[m.id] = (G.fails[m.id] || 0) + 1;
    NC.ui.objective('');
    NC.ui.banner(m.job ? 'Run over' : 'Mission failed', reason, 'fail', !m.job && G.fails[m.id] ? ['You will get a little more time on the next try'] : null);
    if (!G.dead) NC.Sound.play('fail');
  }

  // ---------------- מונית: נוסעים בלי סוף ----------------
  const TAXI = { id: 'job_taxi', job: 'taxi', title: 'Taxi Driver', who: 'Dispatch', icon: '🚕', col: '#ffd23f', requires: [] };
  function randomStop(from, minT, maxT) {
    for (let n = 0; n < 60; n++) {
      const [i, j] = pick(M.straightTiles), p = { x: (i + 0.5) * T, y: (j + 0.5) * T, h: M.conn(i, j) === 10 };
      const d = Math.hypot(p.x - from.x, p.y - from.y) / T;
      if (d >= minT && d <= maxT && !M.insideB(curb(p).x, curb(p).y, 10)) return p;
    }
    return straightNear(from.x + 900, from.y + 600);
  }
  function addFare(ms) {
    const pp = W.playerPos(), a = randomStop(pp, 5, 12), b = randomStop(a, 8, 20);
    const dist = M.roadDist(a.x, a.y, b.x, b.y), pay = Math.round((20 + dist / T * 2.5) * (1 + Math.min(5, ms.fares) * 0.1));
    const where = M.DISTRICTS[M.districtAt(b.x, b.y)].name;
    ms.steps.push({ t: 'ped', at: curb(a) }, { t: 'goto', p: a, car: 'tag', stop: true, pickup: true, time: 'auto', text: `Fare ${ms.fares + 1}: pick up the passenger` },
      { t: 'goto', p: b, car: 'tag', stop: true, drop: true, time: 'auto', pay, fare: true, text: `Take the passenger to ${where}` });
  }
  function startTaxi() {
    const c = G.player.car;
    if (!c || c.type !== 'taxi' || G.mission || G.wanted || G.dead) return;
    G.mission = { def: TAXI, id: TAXI.id, steps: [], step: -1, timer: null, watch: null, tag: c, target: null, ped: null, stopT: 0, t0: G.time, cars: [], items: null, hud: '', spook: 0, farT: 0, count: 0, total: 0, mult: NC.diff().time, gate: 0, finished: 0, go: 0, fares: 0, earned: 0, outT: 0 };
    c.forHire = true; c.tag = c.tag || 'job';
    addFare(G.mission); advance();
    NC.Sound.play('check'); NC.ui.toast('🚕 On duty! Deliver passengers for cash – the streak raises the fare', 'good');
  }
  function endTaxi(reason) {
    const ms = G.mission, c = ms.tag;
    if (c) { c.forHire = false; if (c.tag === 'job') c.tag = null; }
    if (ms.ped) { ms.ped.tag = null; if (ms.ped.st === 'wait') ms.ped.st = 'return'; }
    G.mission = null; startCd = 2; NC.ui.objective('');
    if (ms.fares > 0) G.stats.jobs++;
    if (ms.fares > (G.best.taxi || 0)) G.best.taxi = ms.fares;
    NC.ui.banner('Shift over', reason, ms.fares ? 'info' : 'fail', [`Fares ${ms.fares} · Earned $${ms.earned}`, `Best streak ${G.best.taxi || 0}`]);
    NC.Sound.play(ms.fares ? 'clear' : 'fail');
    NC.saveGame();
  }

  // ---------------- עדכון ----------------
  function services(dt, P, pp, sp) {
    // פלמינגו זהב
    for (let i = 0; i < PKGS.length; i++) {
      if (G.pkgs.includes(i)) continue;
      if (Math.abs(PKGS[i].x - pp.x) < 42 && Math.abs(PKGS[i].y - pp.y) < 42) {
        G.pkgs.push(i); G.money += 150; G.stats.earned += 150;
        NC.Sound.play('pickup'); Fx.sparkle(PKGS[i].x, PKGS[i].y, '#ffe14d', 18);
        W.addFloater(pp.x, pp.y - 30, '+$150', '#ffe14d');
        NC.ui.toast(`🦩 Golden flamingo ${G.pkgs.length}/${PKGS.length}`, 'good');
        if (G.pkgs.length === PKGS.length) { G.money += 2000; G.stats.earned += 2000; Fx.confetti(pp.x, pp.y, 70); NC.ui.toast('🦩 You found every flamingo! Bonus $2,000', 'good'); }
        NC.saveGame();
      }
    }
    // מוסך ריסוס: המחיר עולה עם מספר הכוכבים
    if (sprayCd > 0) sprayCd -= dt;
    if (P.car && sp < 60 && sprayCd <= 0) {
      for (const k of ['spray', 'spray2']) {
        if (Math.hypot(S[k].x - pp.x, S[k].y - pp.y) > 55) continue;
        const c = P.car, price = 100 + 60 * G.wanted;
        if (!G.wanted && c.hp >= c.d.hp) continue;
        sprayCd = 4;
        if (G.money < price) { NC.ui.toast(`🎨 Spray and repair costs $${price} – you do not have enough`, 'warn'); break; }
        G.money -= price; c.hp = c.d.hp; c.burnT = 0;
        if (c.type !== 'police' && c.type !== 'taxi') c.color = pick(['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#ff7eb6', '#ecf0f1'].filter((x) => x !== c.color));
        NC.Sound.play('spray');
        for (let q = 0; q < 16; q++) { const p = Fx.add(c.x + rand(-26, 26), c.y + rand(-16, 16), rand(-30, 30), rand(-30, 30), rand(0.5, 1), rand(5, 9), c.color, 14, 0.5, false, 0); p.drag = 2; }
        const had = G.wanted;
        W.clearWanted(false);
        NC.ui.toast(had ? `🎨 New paint, car repaired – and the police lost you! (-$${price})` : `🎨 Car repaired and repainted (-$${price})`, 'good');
        NC.saveGame();
      }
    }
    // בית חולים: טיפול מהיר ברגל
    if (healCd > 0) healCd -= dt;
    if (!P.car && P.hp < 85 && healCd <= 0 && !G.wanted && Math.hypot(S.hospital.x - pp.x, S.hospital.y - pp.y) < 50) {
      healCd = 5;
      if (G.money < 50) NC.ui.toast('🏥 A check-up costs $50 – you do not have enough', 'warn');
      else { G.money -= 50; P.hp = 100; NC.Sound.play('pickup'); Fx.sparkle(pp.x, pp.y, '#ff6b81', 14); NC.ui.toast('🏥 All patched up (-$50)', 'good'); }
    }
  }

  function update(dt) {
    const P = G.player, pp = W.playerPos(), sp = W.playerSpeed();
    services(dt, P, pp, sp);
    const ms = G.mission;
    if (startCd > 0) startCd -= dt;
    if (!ms) {
      if (G.dead) return;
      // נקודות פתיחה של משימות ושל מרוצי זמן
      if (declined) { const m = byId[declined]; if (!m || Math.hypot(m.start.x - pp.x, m.start.y - pp.y) > 90) declined = null; }
      for (const m of ALL) {
        if (!(m.job ? m.requires.every(isDone) : available(m))) continue;
        const d = Math.hypot(m.start.x - pp.x, m.start.y - pp.y);
        if (d >= 48 || sp >= 70 || declined === m.id || startCd > 0) continue;
        if (m.job && !P.car) continue;
        if (G.wanted) { declined = m.id; NC.ui.toast('Lose the police first, then we talk', 'warn'); break; }
        NC.ui.brief(m); return;
      }
      return;
    }
    const s = cur(), def = ms.def;
    if (ms.watch != null) { ms.watch += dt; if (def.job === 'trial' && ms.watch > def.bronze * 1.7) { fail('Too slow – the marshals went home'); return; } }
    if (ms.timer != null) { ms.timer -= dt; if (ms.timer <= 0) { fail(def.job === 'taxi' ? 'The passenger found another ride' : 'Out of time'); return; } }
    if (ms.tag && (ms.tag.dead || ms.tag.gone)) { fail(def.job === 'taxi' ? 'The taxi was wrecked' : 'The car was destroyed'); return; }
    if (def.job === 'taxi') { if (P.car !== ms.tag) { ms.outT += dt; if (ms.outT > 9) { endTaxi('You left the taxi'); return; } } else ms.outT = 0; }
    if (s.fragile && ms.tag && ms.tag.hp < ms.tag.d.hp * s.fragile) { fail('The cargo was smashed to pieces'); return; }
    if (s.t === 'car') { if (P.car && (!s.tag || P.car === ms.tag)) advance(); }
    else if (s.t === 'evade') { if (!G.wanted) advance(); }
    else if (s.t === 'goto') {
      const okCar = s.car === 'tag' ? P.car === ms.tag : s.car ? !!P.car : true;
      const d = Math.hypot(s.p.x - pp.x, s.p.y - pp.y);
      if (s.fragile && ms.tag) ms.hud = `📦 Cargo ${Math.max(0, Math.round((ms.tag.hp / ms.tag.d.hp - s.fragile) / (1 - s.fragile) * 100))}%`;
      if (d < (s.r || 58) && okCar) {
        // עם משטרה על הזנב קשה לעצור לגמרי – מספיק להאט
        if (s.stop && sp > (G.wanted ? 95 : 45)) ms.stopT = 0; else ms.stopT += dt;
        if (!s.stop || ms.stopT > (G.wanted ? 0.3 : 0.5)) {
          if (s.pickup && ms.ped) { G.peds = G.peds.filter((p) => p !== ms.ped); ms.ped = null; NC.Sound.play('door'); }
          if (s.drop) {
            const p = W.makePed(pp.x + 30, pp.y + 30, { shirt: '#ff3fa4' }); p.st = 'return';
            let cash = s.tip || 0;
            if (s.fare) { const tip = Math.round(Math.max(0, ms.timer || 0)); cash = Math.round((s.pay + tip) * NC.diff().pay); ms.fares++; ms.earned += cash; }
            if (cash) { G.money += cash; G.stats.earned += cash; W.addFloater(pp.x, pp.y - 30, '+$' + cash, '#7CFC9A'); NC.Sound.play('cash'); }
            if (s.fare) addFare(ms);
          }
          if (s.race) { NC.Sound.play('check'); Fx.ring(s.p.x, s.p.y, 30, '#19e3ff', 260, 0.4).glow = true; }
          if (s.watchStart) ms.watch = 0;
          advance();
        }
      }
      if (def.job === 'taxi' && G.mission === ms) ms.hud = `🚕 Fares ${ms.fares} · $${ms.earned}`;
    } else if (s.t === 'collect') {
      for (const it of ms.items) {
        if (it.got || Math.abs(it.x - pp.x) > 44 || Math.abs(it.y - pp.y) > 44) continue;
        it.got = true; ms.count++;
        NC.Sound.play('pickup'); Fx.sparkle(it.x, it.y, '#ffe14d', 12); W.addFloater(it.x, it.y - 24, `${ms.count}/${ms.total}`, '#ffe14d');
      }
      ms.hud = `${s.icon || '📦'} ${ms.count}/${ms.total}`;
      if (ms.count >= ms.total) advance();
    } else if (s.t === 'tail') {
      const c = ms.target;
      if (!c || c.dead || c.gone || c.burnT > 0) { fail('The truck was destroyed'); return; }
      const d = Math.hypot(c.x - pp.x, c.y - pp.y);
      if (G.time - c.ramT < 0.5) { fail('You rammed the truck – the driver panicked'); return; }
      ms.go += dt; // כמה שניות חסד בתחילת המעקב
      // הנהג חושד רק במי שנצמד אליו מאחור (רואה במראה) – לא במי שהוא חולף על פניו
      const behind = (pp.x - c.x) * Math.cos(c.ang) + (pp.y - c.y) * Math.sin(c.ang) < 20;
      if (ms.go < 3 || !behind) ms.spook = Math.max(0, ms.spook - dt * 0.22); else if (d < 150) ms.spook += dt * 0.42; else if (d < 230) ms.spook += dt * 0.1; else ms.spook = Math.max(0, ms.spook - dt * 0.22);
      if (d > 760) ms.farT += dt; else ms.farT = Math.max(0, ms.farT - dt * 2);
      if (ms.spook >= 1) { fail('The driver spotted you'); return; }
      if (ms.farT > 6) { fail('You lost the truck'); return; }
      const bar = Math.round(ms.spook * 5);
      ms.hud = d > 760 ? '⚠️ Too far – catch up!' : d < 150 && behind ? `👀 Too close! ${'▮'.repeat(bar)}${'▯'.repeat(5 - bar)}` : `👀 ${'▮'.repeat(bar)}${'▯'.repeat(5 - bar)} · ${Math.round(d / 10)} m`;
      if (Math.hypot(c.x - s.to.x, c.y - s.to.y) < 150) { // הגיע ליעד: חונה, והנהג הולך
        W.ejectDriver(c, false); c.driver = null; c.hb = true; c.tag = true; ms.tag = c; ms.target = null;
        NC.Sound.play('check'); advance();
      }
    } else if (s.t === 'smash') {
      let alive = 0;
      for (const c of ms.cars) {
        if (c.dead || c.gone || c.burnT > 0) continue;
        alive++;
      }
      const got = ms.total - alive;
      if (got > ms.count) { ms.count = got; NC.Sound.play('check'); if (alive) NC.ui.toast(`💥 ${got}/${ms.total} wrecked`, 'good'); }
      ms.hud = `💥 ${ms.count}/${ms.total}`;
      if (!alive) advance();
    } else if (s.t === 'rivals') {
      const pts = s.route, need = ms.need || (NC.settings.difficulty === 'easy' ? 2 : 1);
      // ספירה לאחור
      if (ms.go < 3.4) {
        if (!ms.count) { ms.count = 1; NC.ui.banner('3', '', 'info'); NC.Sound.play('tick'); }
        const b = Math.floor(ms.go); ms.go += dt;
        const e = Math.floor(ms.go);
        if (e > b && e <= 3) {
          const n = 3 - e;
          NC.ui.banner(n > 0 ? String(n) : 'GO!', '', n > 0 ? 'info' : 'pass'); NC.Sound.play(n > 0 ? 'tick' : 'go');
          if (n === 0) { for (const c of ms.cars) { if (c.ai && c.ai.racer) c.ai.racer.hold = false; } }
        }
      }
      let ahead = 0;
      const pd = ms.gate < pts.length ? Math.hypot(pts[ms.gate].x - pp.x, pts[ms.gate].y - pp.y) : 0;
      for (const c of ms.cars) {
        const R = c.ai && c.ai.racer; if (!R) continue;
        if (R.idx >= pts.length) { if (!R.done) { R.done = true; ms.finished++; } ahead++; continue; }
        if (c.dead) continue;
        const rd = Math.hypot(pts[R.idx].x - c.x, pts[R.idx].y - c.y);
        if (R.idx > ms.gate || (R.idx === ms.gate && rd < pd)) ahead++;
        // גומייה עדינה: מי שברח רחוק מאט, מי שנשאר מאחור מקבל דחיפה
        const gap = R.idx - ms.gate;
        R.skill = R.base * (gap >= 3 ? 0.84 : gap <= -3 ? 1.06 : 1); c.boost = gap <= -3 ? 1.08 : 1;
      }
      if (ms.finished >= need) { fail(need > 1 ? 'Two rivals beat you to the line' : 'A rival won the race'); return; }
      if (P.car && ms.go >= 3 && ms.gate < pts.length && pd < 85) {
        ms.gate++; NC.Sound.play('check'); Fx.ring(pts[ms.gate - 1].x, pts[ms.gate - 1].y, 30, '#19e3ff', 260, 0.4).glow = true;
        if (ms.gate >= pts.length) { advance(); return; }
      }
      ms.hud = `🏁 P${ahead + 1}/${ms.cars.length + 1} · Gate ${ms.gate}/${pts.length}`;
    }
  }

  // נקודות לציור ולמכ"ם
  function markers() {
    const out = [];
    const ms = G.mission;
    if (!ms) {
      if (G.attract) return out;
      for (const m of MISSIONS) if (available(m)) out.push({ x: m.start.x, y: m.start.y, kind: 'start', label: m.icon, col: m.col });
      if (G.player.car) for (const t of TRIALS) if (t.requires.every(isDone)) out.push({ x: t.start.x, y: t.start.y, kind: 'job', label: '🏁' });
      if (G.player.hp < 60) out.push({ x: S.hospital.x, y: S.hospital.y, kind: 'heal', label: '✚' });
    } else {
      const s = cur();
      if (!s) return out;
      if (s.t === 'goto') out.push({ x: s.p.x, y: s.p.y, kind: s.race ? 'check' : 'target', r: s.r || 58 });
      if (s.t === 'car' && ms.tag && s.tag) out.push({ x: ms.tag.x, y: ms.tag.y, kind: 'car' });
      if (s.t === 'goto' && s.car === 'tag' && G.player.car !== ms.tag && ms.tag) out.push({ x: ms.tag.x, y: ms.tag.y, kind: 'car' });
      if (s.t === 'evade') { out.push({ x: S.spray.x, y: S.spray.y, kind: 'spray' }, { x: S.spray2.x, y: S.spray2.y, kind: 'spray' }); }
      if (s.t === 'collect') for (const it of ms.items) if (!it.got) out.push({ x: it.x, y: it.y, kind: 'item', icon: s.icon });
      if (s.t === 'tail' && ms.target) out.push({ x: ms.target.x, y: ms.target.y, kind: 'car' });
      if (s.t === 'smash') for (const c of ms.cars) if (!c.dead && !c.gone && !c.burnT) out.push({ x: c.x, y: c.y, kind: 'enemy' });
      if (s.t === 'rivals') {
        if (ms.gate < s.route.length) out.push({ x: s.route[ms.gate].x, y: s.route[ms.gate].y, kind: 'check', r: 85 });
        if (ms.gate + 1 < s.route.length) out.push({ x: s.route[ms.gate + 1].x, y: s.route[ms.gate + 1].y, kind: 'next', r: 85 });
        for (const c of ms.cars) if (!c.dead && !c.gone) out.push({ x: c.x, y: c.y, kind: 'rival' });
      }
      // השער הבא במרוץ – רמז
      const nx = ms.steps[ms.step + 1];
      if (s.race && nx && nx.race) out.push({ x: nx.p.x, y: nx.p.y, kind: 'next', r: nx.r || 58 });
    }
    return out;
  }
  // היעד הראשי, לחץ הכיוון: היעד הקרוב ביותר שמתאים
  function target() {
    const m = markers(), pp = W.playerPos();
    if (!m.length) return null;
    // בזמן משימה: הסימון הראשי. כשיש כמה מאותו סוג (מזוודות, יריבים, מוסכים) – הקרוב ביותר
    const kind = G.mission ? m[0].kind : 'start';
    if (kind === 'next' || kind === 'rival') return null;
    let best = null, bd = 1e18;
    for (const k of m) { if (k.kind !== kind) continue; const d = (k.x - pp.x) ** 2 + (k.y - pp.y) ** 2; if (d < bd) { bd = d; best = k; } }
    return best;
  }

  NC.mission = {
    begin, update, fail, markers, target, cur, curText, pathGates,
    reset() { declined = null; sprayCd = 0; healCd = 0; startCd = 1.2; },
    decline(def) { if (def && def.id) declined = def.id; startCd = 0.5; },
    onEnterCar() {}, onExitCar() {},
    onCarDestroyed() {},
    // לממשק: שעון, שורת מצב, פעולה לפי הקשר, התקדמות
    clock() { const ms = G.mission; if (!ms) return null; if (ms.watch != null) return { v: ms.watch, up: true, low: false }; if (ms.timer != null) return { v: ms.timer, up: false, low: ms.timer <= 10 }; return null; },
    hud() { return G.mission ? G.mission.hud : ''; },
    prompt() {
      const c = G.player.car;
      if (G.mission) return G.mission.def.job === 'taxi' ? { key: 'T', label: 'End taxi shift', icon: '🛑' } : null;
      if (c && c.type === 'taxi' && !G.wanted && !G.dead) return { key: 'T', label: 'Start taxi fares', icon: '🚕' };
      return null;
    },
    action() { const ms = G.mission; if (ms && ms.def.job === 'taxi') endTaxi('You clocked off'); else startTaxi(); },
    progress() {
      const done = storyDone(), medals = TRIALS.filter((t) => G.best[t.id] && G.best[t.id].medal).length;
      const pct = Math.round((done / MISSIONS.length * 0.6 + G.pkgs.length / PKGS.length * 0.25 + medals / TRIALS.length * 0.15) * 100);
      return { done, total: MISSIONS.length, pct, medals, trials: TRIALS.length };
    },
    list() { return MISSIONS.map((m) => ({ id: m.id, title: m.title, who: m.who, col: m.col, state: isDone(m.id) ? 'done' : available(m) ? 'open' : 'locked' })); },
    briefInfo(def) { // טקסטים למסך התדריך
      if (def.job === 'trial') { const b = G.best[def.id]; return { text: `${def.text} Drive through the first gate and the clock starts.`, reward: `🥇 ${NC.fmtTime(def.gold)} · 🥈 ${NC.fmtTime(def.silver)} · 🥉 ${NC.fmtTime(def.bronze)}`, note: b ? `Your best: ${NC.fmtTime(b.t)}${b.medal ? ' ' + MEDAL[b.medal][0] : ''}` : 'No time set yet' }; }
      const f = G.fails[def.id] || 0;
      return { text: def.brief, reward: '$' + (Math.round(def.reward * NC.diff().pay / 10) * 10).toLocaleString('en-US'), note: f ? `Attempt ${f + 1} – you get ${Math.round(Math.min(3, f) * 12)}% extra time` : '' };
    },
  };
})();
