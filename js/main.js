/* חוף ניאון – קלט, ממשק, שמירה ולולאת המשחק */
'use strict';
(() => {
  const NC = window.NC;
  const { $, clamp } = NC;
  const G = NC.G, W = NC.world, Sound = NC.Sound, M = NC.map;
  const SAVE_KEY = 'neonCoast.save';
  let state = 'menu'; // menu | play | pause | brief
  let last = 0, timeScale = 1, briefIdx = 0;

  // ---------------- קלט ----------------
  const I = NC.input = { mx: 0, my: 0, thr: 0, steer: 0, hb: false, sprint: false, analog: false };
  const keys = new Set();
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const touchHb = { on: false };

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (state === 'play') {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if ((e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') && !e.repeat) W.enterExit();
      if (e.code === 'KeyH' && !e.repeat && G.player.car) Sound.play('honk');
      if (e.code === 'KeyR' && !e.repeat) cycleRadio();
    }
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) { if (state === 'play') pause(); else if (state === 'pause') resume(); }
    if (e.code === 'KeyM' && !e.repeat) toggleMute();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); joy.active = false; if (state === 'play') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

  const cv = NC.render.canvas;
  cv.addEventListener('pointerdown', (e) => {
    Sound.init();
    if (state !== 'play' || e.pointerType === 'mouse') return;
    e.preventDefault();
    joy.active = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* לא נתמך */ }
  });
  cv.addEventListener('pointermove', (e) => { if (joy.active && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
  const endJoy = (e) => { if (e.pointerId === joy.id) joy.active = false; };
  cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  function readInput() {
    const k = (c) => keys.has(c);
    const kx = (k('ArrowRight') || k('KeyD') ? 1 : 0) - (k('ArrowLeft') || k('KeyA') ? 1 : 0);
    const ky = (k('ArrowDown') || k('KeyS') ? 1 : 0) - (k('ArrowUp') || k('KeyW') ? 1 : 0);
    if (joy.active) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / 55);
      I.analog = true; I.mx = d > 6 ? dx / d * m : 0; I.my = d > 6 ? dy / d * m : 0;
    } else {
      I.analog = false; I.mx = kx; I.my = ky;
    }
    I.thr = -ky; I.steer = kx; I.hb = k('Space') || touchHb.on; I.sprint = k('ShiftLeft') || k('ShiftRight');
  }
  NC.joy = joy;

  // ---------------- ממשק ----------------
  let toastT = 0, bannerT = 0, lastDistrict = '', districtT = 0;
  const cache = {};
  const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
  NC.ui = {
    toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; toastT = 3.6; },
    objective(text) { const o = $('objective'); o.textContent = text; o.classList.toggle('hidden', !text); },
    banner(title, sub, kind) { const b = $('banner'); $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || ''; b.className = kind; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bannerT = 4; },
    brief(idx) {
      if (state !== 'play') return;
      const m = NC.MISSIONS[idx]; briefIdx = idx;
      $('briefWho').textContent = m.who; $('briefTitle').textContent = m.title; $('briefText').textContent = m.brief; $('briefReward').textContent = '$' + m.reward.toLocaleString('en-US');
      state = 'brief'; keys.clear(); joy.active = false; Sound.silence(); show('brief');
    },
    nearCar(v) { if (cache.near !== v) { cache.near = v; $('btnEnter').classList.toggle('dim', !v && !G.player.car); } },
  };

  const SCREENS = ['menu', 'howto', 'pause', 'brief'];
  function show(id) { SCREENS.forEach((s) => $(s).classList.toggle('hidden', s !== id)); }
  function hideAll() { SCREENS.forEach((s) => $(s).classList.add('hidden')); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  function setPlayUI(on) { $('hud').classList.toggle('hidden', !on); $('btnEnter').classList.toggle('hidden', !on); $('btnBrake').classList.toggle('hidden', !on); if (on) NC.render.resize(); }

  function updateMuteUI() { $('btnMute').textContent = Sound.muted ? '🔇' : '🔊'; $('btnMuteMenu').textContent = Sound.muted ? '🔇 Sound: off' : '🔊 Sound: on'; }
  function toggleMute() { Sound.init(); Sound.setMuted(!Sound.muted); updateMuteUI(); }
  function cycleRadio() { Sound.init(); NC.ui.toast('📻 ' + Sound.nextStation()); }

  function updateHud(dt) {
    const P = G.player;
    setText('hudMoney', '$' + Math.floor(G.money).toLocaleString('en-US'));
    const hh = Math.floor(G.clock), mn = Math.floor((G.clock - hh) * 60);
    setText('hudClock', String(hh).padStart(2, '0') + ':' + String(Math.floor(mn / 10) * 10).padStart(2, '0'));
    const sk = G.wanted + (G.starFlash > 0 ? 'f' : '') + (G.wanted && G.hideT > 1.5 ? 'h' : '');
    if (cache.stars !== sk) {
      cache.stars = sk; const el = $('hudStars');
      [...el.children].forEach((s, i) => s.classList.toggle('on', i < G.wanted));
      el.classList.toggle('flash', G.starFlash > 0); el.classList.toggle('hiding', G.wanted > 0 && G.hideT > 1.5 && G.starFlash <= 0);
    }
    const hp = Math.round(P.hp) + '%';
    if (cache.hp !== hp) { cache.hp = hp; $('barHp').style.width = hp; $('barHp').classList.toggle('low', P.hp < 30); }
    const inCar = !!P.car;
    if (cache.inCar !== inCar) { cache.inCar = inCar; $('carBox').classList.toggle('hidden', !inCar); $('btnEnter').textContent = inCar ? '🚶' : '🚗'; $('btnEnter').classList.toggle('dim', !inCar && !cache.near); }
    if (inCar) {
      const c = P.car, ch = Math.round(c.hp / c.d.hp * 100) + '%';
      setText('carName', c.d.name);
      if (cache.carHp !== ch) { cache.carHp = ch; $('barCar').style.width = ch; $('barCar').classList.toggle('low', c.hp / c.d.hp < 0.3); }
      setText('carSpeed', String(Math.round(Math.abs(c.speed) * 0.36)));
    }
    const ms = G.mission, tm = ms && ms.timer != null ? Math.max(0, Math.ceil(ms.timer)) : -1;
    if (cache.timer !== tm) { cache.timer = tm; const el = $('timer'); el.classList.toggle('hidden', tm < 0); if (tm >= 0) { el.textContent = Math.floor(tm / 60) + ':' + String(tm % 60).padStart(2, '0'); el.classList.toggle('low', tm <= 10); } }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden'); }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').className = 'hidden'; }
    // שם השכונה כשנכנסים אליה
    const dk = M.districtAt(P.x, P.y);
    if (dk !== lastDistrict && dk !== 'sea') { lastDistrict = dk; $('district').textContent = M.DISTRICTS[dk].name; $('district').classList.add('show'); districtT = 3.2; }
    if (districtT > 0) { districtT -= dt; if (districtT <= 0) $('district').classList.remove('show'); }
    // מסך "נעצרת" / "מחוק"
    const dk2 = G.dead ? G.dead.kind : '';
    if (cache.dead !== dk2) { cache.dead = dk2; const el = $('dead'); el.className = dk2 || 'hidden'; $('deadText').textContent = dk2 === 'busted' ? 'BUSTED!' : dk2 === 'wasted' ? 'WASTED!' : ''; }
  }

  // ---------------- שמירה ----------------
  NC.saveGame = () => { if (state === 'menu') return; NC.store.set(SAVE_KEY, { v: 1, money: G.money, story: G.story, pkgs: G.pkgs, playTime: G.playTime }); };
  function loadSave() { const s = NC.store.get(SAVE_KEY, null); return s && typeof s === 'object' && Array.isArray(s.pkgs) && s.story >= 0 ? s : null; }

  // ---------------- מצבים ----------------
  function startGame(save) {
    Sound.init();
    W.resetWorld(save);
    lastDistrict = ''; cache.dead = null;
    NC.ui.objective(''); $('banner').className = 'hidden'; $('toast').classList.add('hidden');
    hideAll(); setPlayUI(true);
    state = 'play'; last = performance.now();
    if (save && save.story > 0) NC.ui.toast('Welcome back to Neon Coast 🌴');
    NC.saveGame();
  }
  function pause() {
    if (state !== 'play') return;
    state = 'pause'; keys.clear(); joy.active = false; Sound.silence();
    NC.render.drawBigMap($('bigmap'));
    const t = Math.floor(G.playTime / 60);
    $('pauseStats').innerHTML = `Money: <b>$${Math.floor(G.money).toLocaleString('en-US')}</b> · Missions: ${Math.min(G.story, NC.MISSIONS.length)}/${NC.MISSIONS.length} · 🦩 ${G.pkgs.length}/${NC.PKGS.length} · Play time: ${t} min`;
    show('pause');
  }
  function resume() { if (state !== 'pause') return; hideAll(); state = 'play'; last = performance.now(); }
  function toMenu() {
    NC.saveGame();
    state = 'menu'; Sound.silence(); setPlayUI(false); $('banner').className = 'hidden'; $('dead').className = 'hidden';
    W.resetWorld(null);
    $('btnContinue').classList.toggle('hidden', !loadSave());
    show('menu');
  }

  // ---------------- לולאה ----------------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    try {
      if (state === 'play') {
        readInput();
        const slow = G.dead ? 0.35 : 1;
        for (let i = 0; i < timeScale && state === 'play'; i++) W.update(dt * slow);
        if (G.dead) { G.dead.t += dt; if (G.dead.t > 3.4) W.respawn(); }
        const P = G.player, c = P.car;
        Sound.drive(!!c && !G.dead, c ? c.speed : 0, c ? c.d.max : 1, c ? c.slip : 0, G.copDist, G.wanted);
        Sound.radio(!!c && !G.dead);
        updateHud(dt);
      } else if (state === 'menu') {
        // העיר חיה ברקע התפריט
        I.mx = I.my = I.thr = I.steer = 0; I.hb = false;
        W.update(dt);
        G.player.hp = 100; G.dead = null; G.wanted = 0;
      }
      NC.render.draw(dt);
      // ג׳ויסטיק
      if (joy.active && state === 'play') {
        const g = cv.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 2);
        g.setTransform(d, 0, 0, d, 0, 0);
        let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const l = Math.hypot(dx, dy); if (l > 55) { dx = dx / l * 55; dy = dy / l * 55; }
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
        g.beginPath(); g.arc(joy.ox, joy.oy, 55, 0, 6.283); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,63,164,0.75)'; g.beginPath(); g.arc(joy.ox + dx, joy.oy + dy, 22, 0, 6.283); g.fill();
      }
    } catch (err) { console.error(err); }
  }

  // ---------------- כפתורים ----------------
  const on = (id, fn) => $(id).addEventListener('click', (e) => { Sound.init(); Sound.play('click'); fn(e); $(id).blur(); });
  on('btnNew', () => { if (!loadSave() || confirm('Start a new game? Your saved progress will be erased.')) startGame(null); });
  on('btnContinue', () => startGame(loadSave()));
  on('btnHowto', () => show('howto'));
  on('btnHowtoBack', () => show('menu'));
  on('btnMuteMenu', toggleMute); on('btnMute', toggleMute);
  on('btnPause', pause); on('btnResume', resume); on('btnQuit', toMenu);
  on('btnRadio', cycleRadio);
  on('btnAccept', () => { hideAll(); state = 'play'; last = performance.now(); NC.mission.begin(briefIdx); });
  on('btnDecline', () => { NC.mission.decline(); hideAll(); state = 'play'; last = performance.now(); });
  const be = $('btnEnter');
  be.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); if (state === 'play') W.enterExit(); });
  const bb = $('btnBrake');
  const hbOn = (e) => { e.preventDefault(); e.stopPropagation(); touchHb.on = true; bb.classList.add('on'); };
  const hbOff = () => { touchHb.on = false; bb.classList.remove('on'); };
  bb.addEventListener('pointerdown', hbOn); bb.addEventListener('pointerup', hbOff); bb.addEventListener('pointercancel', hbOff); bb.addEventListener('pointerleave', hbOff);

  window.addEventListener('resize', NC.render.resize);
  window.addEventListener('orientationchange', () => setTimeout(NC.render.resize, 200));

  NC.render.resize();
  W.resetWorld(null);
  updateMuteUI();
  $('btnContinue').classList.toggle('hidden', !loadSave());
  show('menu');
  requestAnimationFrame((t) => { last = t; frame(t); });

  // גישה לבדיקות אוטומטיות בלבד
  window.__nc = { NC, get state() { return state; }, set timeScale(v) { timeScale = clamp(v | 0, 1, 12); }, startGame, pause, resume };
})();
