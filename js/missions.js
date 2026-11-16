/* חוף ניאון – משימות הסיפור, פלמינגו זהב נסתרים ומוסך הריסוס */
'use strict';
(() => {
  const NC = window.NC, M = NC.map, T = M.T, G = NC.G, W = NC.world;
  const S = M.special;

  // אמצע קטע כביש ישר הקרוב לנקודה (מקום טוב לעצור בו)
  function straightNear(x, y) {
    let best = null, bd = 1e18;
    for (const [i, j] of M.roadTiles) {
      const m = M.conn(i, j);
      if (m !== 5 && m !== 10) continue;
      const d = ((i + 0.5) * T - x) ** 2 + ((j + 0.5) * T - y) ** 2;
      if (d < bd) { bd = d; best = { x: (i + 0.5) * T, y: (j + 0.5) * T, h: m === 10 }; }
    }
    return best;
  }
  const curb = (p) => ({ x: p.x + (p.h ? 0 : 52), y: p.y + (p.h ? 52 : 0) }); // המדרכה שליד
  const X = (a, b) => M.cross(a, b);

  const fareA = straightNear(S.park.x, S.park.y + 500), fareB = straightNear(S.tower.x - 300, S.tower.y + 200);
  const fareC = straightNear(S.club.x - 200, S.club.y), fareD = straightNear(S.hospital.x, S.hospital.y + 300);
  const fareE = straightNear(S.police.x + 300, S.police.y - 400), fareF = straightNear(S.docks.x - 700, S.docks.y - 200);
  const prize = { x: S.tower.x + 60, y: S.tower.y };

  const MISSIONS = NC.MISSIONS = [
    {
      title: 'Welcome to Neon Coast', who: 'Aunt Rosa', icon: 'R', start: S.home, reward: 150,
      brief: 'You finally made it, sweetheart! This city is beautiful, but you will not get far without wheels. Find yourself a car – there is a pink one right by the house – and come see me at the taxi stand. I have work for you.',
      steps: [
        { t: 'car', text: 'Get into any car' },
        { t: 'goto', p: S.taxi, car: true, stop: true, text: 'Drive to Aunt Rosa\'s taxi stand 🚕' },
      ],
    },
    {
      title: 'First Shift', who: 'Aunt Rosa', icon: 'R', start: S.taxi, reward: 350,
      brief: 'Three passengers are waiting, and they are not patient. Take the yellow taxi, pick each one up and get them where they are going before the clock runs out. And mind the paintwork, okay?',
      steps: [
        { t: 'spawn', type: 'taxi', at: { x: S.taxi.x - 70, y: S.taxi.y + 10 }, ang: 0 },
        { t: 'car', tag: true, text: 'Get into the yellow taxi' },
        { t: 'ped', at: curb(fareA) }, { t: 'goto', p: fareA, car: 'tag', stop: true, pickup: true, time: 50, text: 'Pick up the first passenger' },
        { t: 'goto', p: fareB, car: 'tag', stop: true, drop: true, time: 55, tip: 60, text: 'Take him to Glass Towers' },
        { t: 'ped', at: curb(fareC) }, { t: 'goto', p: fareC, car: 'tag', stop: true, pickup: true, time: 50, text: 'A passenger is waiting on the Neon Strip' },
        { t: 'goto', p: fareD, car: 'tag', stop: true, drop: true, time: 70, tip: 80, text: 'Take her to the hospital – fast!' },
        { t: 'ped', at: curb(fareE) }, { t: 'goto', p: fareE, car: 'tag', stop: true, pickup: true, time: 55, text: 'Last passenger, near the police station' },
        { t: 'goto', p: fareF, car: 'tag', stop: true, drop: true, time: 65, tip: 100, text: 'Take him to the Old Port' },
      ],
    },
    {
      title: 'Mickey\'s Delivery', who: 'Mickey Keys', icon: 'M', start: S.garage, reward: 700,
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
      title: 'Sunset Race', who: 'Lola Neon', icon: 'L', start: S.club, reward: 900,
      brief: 'Everyone here is talking about Rosa\'s new driver. Let us see if you are really that fast: a race down the boardwalk, around the port and back. Every gate adds a few seconds. Lose – and I am telling everyone.',
      steps: [
        { t: 'car', text: 'Get into a fast car' },
        { t: 'goto', p: X(13, 5), r: 80, race: true, time: 20, text: 'Race! Drive through every gate' },
        ...[[13, 7], [13, 9], [13, 11], [13, 13], [13, 14], [11, 14], [9, 14], [9, 12], [11, 12], [11, 10], [13, 10], [13, 7]].map(([a, b]) => ({ t: 'goto', p: X(a, b), r: 80, race: true, add: 5, text: 'Race! Drive through every gate' })),
        { t: 'goto', p: S.club, r: 70, race: true, add: 12, text: 'Finish line – back to Lola\'s club!' },
      ],
    },
    {
      title: 'Heat in the City', who: 'Lola Neon', icon: 'L', start: S.club, reward: 1200,
      brief: 'We have a problem. Someone snitched on Mickey, and the police are looking for his driver – meaning you. They are already on their way. Lose them: get out of their sight, or find a spray shop 🎨 and change your color.',
      steps: [
        { t: 'wanted', n: 3 },
        { t: 'evade', text: 'Lose the police! (Get out of sight or drive into a spray shop 🎨)' },
      ],
    },
    {
      title: 'The Port Cargo', who: 'Captain Ziv', icon: 'Z', start: S.docks, reward: 3000,
      brief: 'This is the big job. This truck has to reach the tallest tower in the city before the clock runs out. It is heavy and slow, and the cargo is fragile. Halfway there they will figure out what is going on – so do not stop for anyone.',
      steps: [
        { t: 'spawn', type: 'van', at: { x: S.docks.x - 60, y: S.docks.y + 10 }, ang: Math.PI, color: '#ecf0f1' },
        { t: 'car', tag: true, text: 'Get into the white truck' },
        { t: 'goto', p: X(9, 9), r: 110, car: 'tag', time: 60, text: 'Drive north through the Color Market' },
        { t: 'wanted', n: 3 },
        { t: 'goto', p: S.tower, car: 'tag', stop: true, r: 70, add: 50, text: 'The police are on you! Reach the tall tower' },
      ],
    },
  ];

  // --- פלמינגו זהב נסתרים ---
  const PKGS = NC.PKGS = [];
  {
    const cand = M.decor.filter((d) => (d.t === 'plaza' || d.t === 'parking') && !d.special);
    const step = Math.max(1, Math.floor(cand.length / 10));
    for (let i = 0; i < cand.length && PKGS.length < 10; i += step) PKGS.push({ x: cand[i].x + cand[i].w / 2, y: cand[i].y + cand[i].h / 2 });
    PKGS.push({ x: 56 * T, y: 9 * T }, { x: 56.3 * T, y: 33 * T }, { x: 56 * T, y: 52 * T }, { x: S.park.x + 250, y: S.park.y - 330 }, { x: 1.2 * T, y: 30 * T });
  }

  const immediate = { spawn: 1, ped: 1, wanted: 1 };
  let declined = false, sprayCd = 0, startCd = 0; // startCd: הפסקה קצרה לפני התדריך הבא

  function begin(idx) {
    G.mission = { idx, step: -1, timer: null, tag: null, ped: null, stopT: 0, t0: G.time };
    advance();
    NC.ui.objective(curText());
  }
  function cur() { return G.mission ? MISSIONS[G.mission.idx].steps[G.mission.step] : null; }
  function curText() { const s = cur(); return s ? s.text || '' : ''; }

  function advance() {
    const ms = G.mission, steps = MISSIONS[ms.idx].steps;
    ms.step++; ms.stopT = 0;
    if (ms.step >= steps.length) { pass(); return; }
    const s = steps[ms.step];
    if (s.time != null) ms.timer = s.time; else if (s.add) ms.timer = (ms.timer || 0) + s.add; else if (!immediate[s.t] && !s.keep) ms.timer = null;
    if (s.t === 'spawn') {
      G.cars = G.cars.filter((c) => Math.hypot(c.x - s.at.x, c.y - s.at.y) > 90 || c === G.player.car);
      ms.tag = W.makeCar(s.type, s.at.x, s.at.y, s.ang || 0, { tag: true, color: s.color, parked: true });
      advance();
    } else if (s.t === 'ped') {
      if (ms.ped) ms.ped.tag = null;
      ms.ped = W.makePed(s.at.x, s.at.y, { tag: true, shirt: '#ff3fa4' }); ms.ped.st = 'wait';
      advance();
    } else if (s.t === 'wanted') {
      if (G.wanted < s.n) { G.wanted = s.n; G.hideT = 0; G.starFlash = 1.5; NC.Sound.play('star'); }
      advance();
    } else NC.ui.objective(s.text || '');
  }

  function cleanup() {
    const ms = G.mission; if (!ms) return;
    if (ms.tag) ms.tag.tag = null;
    if (ms.ped) { ms.ped.tag = null; ms.ped.st = 'return'; }
  }
  function pass() {
    const ms = G.mission, m = MISSIONS[ms.idx];
    cleanup();
    G.money += m.reward; G.story = Math.max(G.story, ms.idx + 1); G.mission = null; startCd = 6;
    NC.Sound.play('pass');
    NC.ui.objective('');
    NC.ui.banner('Mission passed!', `${m.title} · +$${m.reward}`, 'pass');
    if (G.story >= MISSIONS.length) setTimeout(() => NC.ui.toast('🌴 You finished the story! The city is yours – keep roaming, collecting flamingos and running from cops'), 4500);
    NC.saveGame();
  }
  function fail(reason) {
    if (!G.mission) return;
    cleanup(); G.mission = null; declined = true; startCd = 4;
    NC.ui.objective('');
    NC.ui.banner('Mission failed', reason, 'fail');
    if (!G.dead) NC.Sound.play('fail');
  }

  function update(dt) {
    const P = G.player, pp = W.playerPos(), sp = W.playerSpeed();
    // פלמינגו זהב
    for (let i = 0; i < PKGS.length; i++) {
      if (G.pkgs.includes(i)) continue;
      if (Math.abs(PKGS[i].x - pp.x) < 42 && Math.abs(PKGS[i].y - pp.y) < 42) {
        G.pkgs.push(i); G.money += 150;
        NC.Sound.play('pickup');
        W.addFloater(pp.x, pp.y - 30, '+$150', '#ffe14d');
        NC.ui.toast(`🦩 Golden flamingo ${G.pkgs.length}/${PKGS.length}`);
        if (G.pkgs.length === PKGS.length) { G.money += 2000; NC.ui.toast('🦩 You found every flamingo! Bonus $2,000'); }
        NC.saveGame();
      }
    }
    // מוסך ריסוס
    if (sprayCd > 0) sprayCd -= dt;
    if (P.car && sp < 60 && sprayCd <= 0) {
      for (const k of ['spray', 'spray2']) {
        if (Math.hypot(S[k].x - pp.x, S[k].y - pp.y) > 55) continue;
        const c = P.car;
        if (!G.wanted && c.hp >= c.d.hp) continue;
        sprayCd = 4;
        if (G.money < 100) { NC.ui.toast('🎨 Spray and repair costs $100 – you do not have enough'); break; }
        G.money -= 100; c.hp = c.d.hp; c.burnT = 0;
        if (c.type !== 'police' && c.type !== 'taxi') c.color = NC.pick(['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#ff7eb6', '#ecf0f1']);
        NC.Sound.play('spray');
        const had = G.wanted;
        W.clearWanted(false);
        NC.ui.toast(had ? '🎨 New paint, car repaired – and the police lost you! (-$100)' : '🎨 Car repaired and repainted (-$100)');
        NC.saveGame();
      }
    }

    const ms = G.mission;
    if (startCd > 0) startCd -= dt;
    if (!ms) {
      // סימון תחילת המשימה הבאה
      if (G.story < MISSIONS.length && !G.dead) {
        const st = MISSIONS[G.story].start, d = Math.hypot(st.x - pp.x, st.y - pp.y);
        if (d > 90) declined = false;
        if (d < 48 && sp < 70 && !declined && !G.wanted && startCd <= 0) NC.ui.brief(G.story);
        else if (d < 48 && G.wanted && !declined) { declined = true; NC.ui.toast('Lose the police first, then we talk'); }
      }
      return;
    }
    const s = cur();
    if (ms.timer != null) { ms.timer -= dt; if (ms.timer <= 0) { fail('Out of time'); return; } }
    if (ms.tag && (ms.tag.dead || ms.tag.gone)) { fail('The car was destroyed'); return; }
    if (s.t === 'car') { if (P.car && (!s.tag || P.car === ms.tag)) advance(); }
    else if (s.t === 'evade') { if (!G.wanted) advance(); }
    else if (s.t === 'goto') {
      const okCar = s.car === 'tag' ? P.car === ms.tag : s.car ? !!P.car : true;
      const d = Math.hypot(s.p.x - pp.x, s.p.y - pp.y);
      if (d < (s.r || 58) && okCar) {
        if (s.stop && sp > 45) ms.stopT = 0; else ms.stopT += dt;
        if (!s.stop || ms.stopT > 0.5) {
          if (s.pickup && ms.ped) { G.peds = G.peds.filter((p) => p !== ms.ped); ms.ped = null; NC.Sound.play('door'); }
          if (s.drop) {
            const p = W.makePed(pp.x + 30, pp.y + 30, { shirt: '#ff3fa4' }); p.st = 'return';
            if (s.tip) { G.money += s.tip; W.addFloater(pp.x, pp.y - 30, '+$' + s.tip, '#7CFC9A'); NC.Sound.play('cash'); }
          }
          if (s.race) NC.Sound.play('check');
          advance();
        }
      }
    }
  }

  // נקודות לציור ולמכ"ם
  function markers() {
    const out = [];
    const ms = G.mission;
    if (!ms) {
      if (G.story < MISSIONS.length) out.push({ x: MISSIONS[G.story].start.x, y: MISSIONS[G.story].start.y, kind: 'start', label: MISSIONS[G.story].icon });
    } else {
      const s = cur();
      if (s && s.t === 'goto') out.push({ x: s.p.x, y: s.p.y, kind: s.race ? 'check' : 'target', r: s.r || 58 });
      if (s && s.t === 'car' && ms.tag) out.push({ x: ms.tag.x, y: ms.tag.y, kind: 'car' });
      if (s && s.t === 'goto' && s.car === 'tag' && G.player.car !== ms.tag && ms.tag) out.push({ x: ms.tag.x, y: ms.tag.y, kind: 'car' });
      if (s && s.t === 'evade') { out.push({ x: S.spray.x, y: S.spray.y, kind: 'spray' }, { x: S.spray2.x, y: S.spray2.y, kind: 'spray' }); }
      // השער הבא במרוץ – רמז
      const nx = MISSIONS[ms.idx].steps[ms.step + 1];
      if (s && s.race && nx && nx.race) out.push({ x: nx.p.x, y: nx.p.y, kind: 'next', r: nx.r || 58 });
    }
    return out;
  }
  // היעד הראשי, לחץ הכיוון
  function target() { const m = markers(); return m.length ? m[0] : null; }

  NC.mission = {
    begin, update, fail, markers, target, cur, curText,
    decline() { declined = true; },
    onEnterCar() {}, onCarDestroyed() {},
  };
})();
