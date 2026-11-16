/* חוף ניאון – קלט (מקלדת, מגע, שלט), ממשק, שמירה ולולאת המשחק */
'use strict';
(() => {
  const NC = window.NC;
  const { $, clamp } = NC;
  const G = NC.G, W = NC.world, Sound = NC.Sound, M = NC.map, S = NC.settings, Wx = NC.weather;
  const SAVE_KEY = 'neonCoast.save';
  let state = 'menu'; // menu | play | pause | brief
  let last = 0, timeScale = 1, briefDef = null, bot = null, saveT = 0;
  let touchUI = NC.isTouch, playUI = false, tapped = false; // tapped: הדפדפן מרשה רטט רק אחרי נגיעה אמיתית

  // ---------------- קלט ----------------
  const I = NC.input = { mx: 0, my: 0, thr: 0, steer: 0, hb: false, sprint: false, analog: false };
  const keys = new Set();
  const joy = NC.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const tb = { hb: false, gas: false, rev: false }; // כפתורי מגע מוחזקים
  const padPrev = [];
  let padUsed = false;

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'range' && e.code.startsWith('Arrow')) return;
    keys.add(e.code);
    if (state === 'play') {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') W.enterExit();
        else if (e.code === 'KeyH') W.horn();
        else if (e.code === 'KeyR') cycleRadio();
        else if (e.code === 'KeyT') NC.mission.action();
      }
    } else if (screen) menuKeys(e);
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      if (state === 'play') pause();
      else if (screen === 'pause') resume();
      else if (screen === 'brief') { if (e.code === 'Escape') $('btnDecline').click(); }
      else if (screen === 'confirm') { if (e.code === 'Escape') $('btnConfirmNo').click(); }
      else if (screen === 'settings' || screen === 'howto') { if (e.code === 'Escape') back(); }
    }
    if (e.code === 'KeyM' && !e.repeat) toggleMute();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  const releaseAll = () => { keys.clear(); joy.active = false; tb.hb = tb.gas = tb.rev = false; for (const id of ['btnBrake', 'btnGas', 'btnRev']) $(id).classList.remove('on'); };
  window.addEventListener('blur', () => { releaseAll(); if (state === 'play') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play') pause(); else NC.saveGame(); Sound.suspend(true); } else Sound.suspend(false); });
  window.addEventListener('pagehide', () => NC.saveGame());

  // חיצים במסכי התפריט: מעבר בין כפתורים
  function menuKeys(e) {
    if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
    const el = $(screen); if (!el) return;
    const items = [...el.querySelectorAll('button, input')].filter((b) => b.offsetParent !== null);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    items[(i + (e.code === 'ArrowDown' ? 1 : items.length - 1) + (i < 0 && e.code === 'ArrowUp' ? 1 : 0)) % items.length].focus();
  }

  const cv = NC.render.canvas;
  function setTouch(on) {
    if (touchUI === on) return;
    touchUI = on; applyTouchUI();
  }
  cv.addEventListener('pointerdown', (e) => {
    Sound.init();
    if (e.pointerType !== 'mouse') setTouch(true);
    if (state !== 'play' || e.pointerType === 'mouse' || joy.active) return;
    e.preventDefault();
    joy.active = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* לא נתמך */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    joy.x = e.clientX; joy.y = e.clientY;
    // הבסיס נגרר אחרי האצבע כשמתרחקים – נוח יותר באגודל
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d > 90) { joy.ox += dx / d * (d - 90); joy.oy += dy / d * (d - 90); }
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) joy.active = false; };
  cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (state === 'play') e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // שלט משחק (Gamepad API)
  function pollPad() {
    if (!navigator.getGamepads) return null;
    let gp = null;
    for (const g of navigator.getGamepads()) if (g && g.connected && g.buttons.length >= 10) { gp = g; break; }
    if (!gp) return null;
    const b = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0), ax = (i) => (Math.abs(gp.axes[i] || 0) > 0.18 ? gp.axes[i] : 0);
    const hit = (i) => { const v = b(i) > 0.5, was = padPrev[i]; padPrev[i] = v; return v && !was; };
    const st = { x: ax(0), y: ax(1), gas: b(7), brake: b(6), hb: b(1) > 0.5 || b(5) > 0.5, run: b(10) > 0.5 || b(4) > 0.5 };
    if (hit(9)) { if (state === 'play') pause(); else if (screen === 'pause') resume(); }
    if (state === 'play') { if (hit(0)) W.enterExit(); if (hit(2)) W.horn(); if (hit(3)) NC.mission.action(); if (hit(14) || hit(15)) cycleRadio(); }
    else if (screen) { if (hit(0) && document.activeElement && document.activeElement.click) document.activeElement.click(); if (hit(1)) { if (screen === 'pause') resume(); else if (screen !== 'menu') { const bk = $(screen).querySelector('#btnHowtoBack, #btnSettingsBack, #btnDecline, #btnConfirmNo'); if (bk) bk.click(); } } }
    st.any = st.x || st.y || st.gas > 0.05 || st.brake > 0.05 || st.hb;
    return st;
  }

  function readInput() {
    const k = (c) => keys.has(c);
    const kx = (k('ArrowRight') || k('KeyD') ? 1 : 0) - (k('ArrowLeft') || k('KeyA') ? 1 : 0);
    const ky = (k('ArrowDown') || k('KeyS') ? 1 : 0) - (k('ArrowUp') || k('KeyW') ? 1 : 0);
    I.analog = false; I.mx = kx; I.my = ky; I.thr = -ky; I.steer = kx; I.hb = k('Space') || tb.hb; I.sprint = k('ShiftLeft') || k('ShiftRight');
    const inCar = !!G.player.car, pedals = touchUI && S.touchMode === 'pedals' && inCar;
    if (joy.active) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / 55);
      if (pedals) I.steer = clamp(dx / 50, -1, 1);
      else { I.analog = true; I.mx = d > 6 ? dx / d * m : 0; I.my = d > 6 ? dy / d * m : 0; }
    }
    if (pedals) I.thr = (tb.gas ? 1 : 0) - (tb.rev ? 1 : 0);
    const gp = pollPad();
    if (gp && gp.any) {
      padUsed = true; I.analog = false; I.hb = I.hb || gp.hb;
      if (inCar) { I.steer = gp.x; I.thr = gp.gas - gp.brake; } else { I.mx = gp.x; I.my = gp.y; I.sprint = gp.run || Math.hypot(gp.x, gp.y) > 0.93; }
    }
  }

  // ---------------- מסכים ----------------
  const SCREENS = ['menu', 'settings', 'howto', 'pause', 'brief', 'confirm'];
  const stack = [];
  let screen = 'menu';
  function show(id) {
    screen = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (id && !touchUI) { const f = $(id).querySelector('.btn.primary:not(.hidden)') || $(id).querySelector('.btn:not(.hidden)'); if (f) f.focus({ preventScroll: true }); }
    if (id) $(id).scrollTop = 0;
  }
  function push(id) { stack.push(screen); show(id); }
  function back() { show(stack.length ? stack.pop() : state === 'menu' ? 'menu' : state === 'pause' ? 'pause' : null); }
  let confirmFn = null;
  function ask(title, text, okLabel, fn) { $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('btnConfirmYes').textContent = okLabel; confirmFn = fn; push('confirm'); }

  function applyTouchUI() {
    document.body.classList.toggle('touch', touchUI);
    document.body.classList.toggle('pedals', touchUI && S.touchMode === 'pedals');
    $('touch').classList.toggle('hidden', !playUI || !touchUI);
    // במגע, המטרה עוברת לראש המסך – רחוק מהאגודלים
    const obj = $('objective'), home = touchUI ? $('hudCenter') : $('hudBottom');
    if (obj.parentNode !== home) home.insertBefore(obj, touchUI ? home.firstChild : null);
    cache.inCar = null; cache.act = null;
  }
  function setPlayUI(on) { playUI = on; $('hud').classList.toggle('hidden', !on); applyTouchUI(); if (on) NC.render.resize(); }

  // ---------------- ממשק ----------------
  let bannerT = 0, lastDistrict = '', districtT = 0, shownMoney = 0, moneyFx = 0;
  const cache = {};
  const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
  NC.ui = {
    toast(text, kind) {
      const box = $('toasts');
      for (const o of [...box.children]) if (o.textContent === text) o.remove(); // לא מציפים באותה הודעה
      while (box.children.length >= 3) box.firstChild.remove();
      const t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = text;
      box.appendChild(t);
      setTimeout(() => t.remove(), 3900);
    },
    objective(text) { const o = $('objective'); if (o.textContent !== text) { o.textContent = text; o.style.animation = 'none'; void o.offsetWidth; o.style.animation = ''; } o.classList.toggle('hidden', !text); },
    banner(title, sub, kind, lines) {
      const b = $('banner'); $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || '';
      const L = $('bannerLines'); L.textContent = '';
      for (const l of lines || []) { const s = document.createElement('span'); s.textContent = l; L.appendChild(s); }
      b.className = kind || 'info'; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bannerT = lines && lines.length ? 5.5 : sub ? 4 : 1.1;
    },
    brief(def) {
      if (state !== 'play') return;
      briefDef = def;
      const info = NC.mission.briefInfo(def), av = $('briefAvatar');
      av.textContent = def.icon; av.style.background = def.col || '#ffe14d'; av.style.boxShadow = `0 0 18px ${def.col || '#ffe14d'}`;
      $('briefWho').textContent = def.who; $('briefTitle').textContent = def.title; $('briefText').textContent = info.text; $('briefReward').textContent = info.reward;
      $('briefNote').textContent = info.note || ''; $('briefNote').classList.toggle('hidden', !info.note);
      state = 'brief'; releaseAll(); Sound.silence(); Sound.play('brief'); stack.length = 0; show('brief');
    },
    isPlaying() { return state === 'play'; },
    nearCar(v) { if (cache.near !== v) { cache.near = v; $('btnEnter').classList.toggle('dim', !v && !G.player.car); } },
    buzz(ms) { if (S.vibrate && touchUI && tapped && navigator.vibrate && state === 'play') { try { navigator.vibrate(Math.round(ms)); } catch (e) { /* לא נתמך */ } } },
  };

  function updateMuteUI() { $('btnMute').textContent = Sound.muted ? '🔇' : '🔊'; }
  function toggleMute() { Sound.init(); Sound.setMuted(!Sound.muted); updateMuteUI(); }
  function cycleRadio() { Sound.init(); NC.ui.toast('📻 ' + Sound.nextStation()); }

  let fpsN = 0, fpsT = 0;
  function updateHud(dt) {
    const P = G.player;
    // כסף – הספירה "רצה" אל הסכום החדש
    if (shownMoney !== G.money) {
      const d = G.money - shownMoney, el = $('hudMoney');
      if (Math.abs(d) < 1) shownMoney = G.money; else shownMoney += d * Math.min(1, dt * 7) + Math.sign(d) * 0.6;
      if ((d > 0 && shownMoney > G.money) || (d < 0 && shownMoney < G.money)) shownMoney = G.money;
      if (moneyFx <= 0) { el.classList.add('bump'); el.classList.toggle('drop', d < 0); }
      moneyFx = 0.25;
    } else if (moneyFx > 0) { moneyFx -= dt; if (moneyFx <= 0) $('hudMoney').classList.remove('bump', 'drop'); }
    setText('hudMoney', NC.fmtMoney(shownMoney));
    const hh = Math.floor(G.clock), mn = Math.floor((G.clock - hh) * 60);
    setText('hudClock', String(hh).padStart(2, '0') + ':' + String(Math.floor(mn / 10) * 10).padStart(2, '0'));
    setText('hudWx', Wx.info().icon);
    const sk = G.wanted + (G.starFlash > 0 ? 'f' : '') + (G.wanted && G.hideT > 1.5 ? 'h' : '');
    if (cache.stars !== sk) {
      cache.stars = sk; const el = $('hudStars');
      [...el.children].forEach((s, i) => s.classList.toggle('on', i < G.wanted));
      el.classList.toggle('flash', G.starFlash > 0); el.classList.toggle('hiding', G.wanted > 0 && G.hideT > 1.5 && G.starFlash <= 0);
    }
    const hp = Math.round(P.hp) + '%';
    if (cache.hp !== hp) { cache.hp = hp; $('barHp').style.width = hp; $('barHp').classList.toggle('low', P.hp < 30); }
    const inCar = !!P.car;
    if (cache.inCar !== inCar) {
      cache.inCar = inCar; $('carBox').classList.toggle('hidden', !inCar);
      $('btnEnter').textContent = inCar ? '🚶' : '🚗'; $('btnEnter').classList.toggle('dim', !inCar && !cache.near);
      const ped = S.touchMode === 'pedals';
      $('btnBrake').classList.toggle('hidden', !inCar); $('btnHorn').classList.toggle('hidden', !inCar);
      $('btnGas').classList.toggle('hidden', !inCar || !ped); $('btnRev').classList.toggle('hidden', !inCar || !ped);
      if (!inCar) { tb.hb = tb.gas = tb.rev = false; }
    }
    if (inCar) {
      const c = P.car, ch = Math.round(c.hp / c.d.hp * 100) + '%';
      setText('carName', c.d.name);
      if (cache.carHp !== ch) { cache.carHp = ch; $('barCar').style.width = ch; $('barCar').classList.toggle('low', c.hp / c.d.hp < 0.3); }
      setText('carSpeed', String(Math.round(Math.abs(c.speed) * 0.36)));
    }
    // שעון משימה ושורת מצב
    const ck = NC.mission.clock(), tm = ck ? (ck.up ? Math.floor(ck.v * 10) : Math.max(0, Math.ceil(ck.v))) : -1;
    if (cache.timer !== tm) {
      cache.timer = tm; const el = $('timer'); el.classList.toggle('hidden', tm < 0);
      if (tm >= 0) { el.textContent = ck.up ? NC.fmtTime(ck.v) : Math.floor(tm / 60) + ':' + String(tm % 60).padStart(2, '0'); el.classList.toggle('low', ck.low); el.classList.toggle('up', ck.up); if (ck.low && cache.tick !== tm) { cache.tick = tm; Sound.play('tick', 0.6); } }
    }
    const hud = NC.mission.hud();
    if (cache.prog !== hud) { cache.prog = hud; $('progress').textContent = hud; $('progress').classList.toggle('hidden', !hud); }
    // פעולה לפי הקשר: מקש במחשב, כפתור במגע
    const pr = NC.mission.prompt(), near = !inCar && cache.near;
    const key = pr ? pr.key + pr.label : near ? 'E' : '';
    if (cache.act !== key) {
      cache.act = key;
      $('btnAct').classList.toggle('hidden', !pr); if (pr) $('btnAct').textContent = pr.icon;
      const show = !!key && !touchUI && !padUsed;
      $('prompt').classList.toggle('hidden', !show);
      if (show) { $('promptKey').textContent = pr ? pr.key : 'E'; $('promptText').textContent = pr ? pr.label : 'Get in'; }
    }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').className = 'hidden'; }
    // שם השכונה כשנכנסים אליה
    const dk = M.districtAt(P.x, P.y);
    if (dk !== lastDistrict && dk !== 'sea') { lastDistrict = dk; $('district').textContent = M.DISTRICTS[dk].name; $('district').classList.add('show'); districtT = 3.2; }
    if (districtT > 0) { districtT -= dt; if (districtT <= 0) $('district').classList.remove('show'); }
    // מסך "נעצרת" / "מחוק"
    const dk2 = G.dead ? G.dead.kind : '';
    if (cache.dead !== dk2) { cache.dead = dk2; const el = $('dead'); el.className = dk2 || 'hidden'; $('deadText').textContent = dk2 === 'busted' ? 'BUSTED' : dk2 === 'wasted' ? 'WASTED' : ''; }
  }

  // ---------------- הגדרות ----------------
  const QL = { low: 0, medium: 1, high: 2 };
  let autoLevel = touchUI ? 1 : 2, slowT = 0, fastT = 0, holdUp = 0, avgMs = 16;
  function applyQuality() {
    const lv = S.quality === 'auto' ? autoLevel : QL[S.quality] != null ? QL[S.quality] : 2;
    if (NC.render.quality !== lv || !applyQuality.done) NC.render.setQuality(lv);
    applyQuality.done = true;
    NC.sim.cars = [16, 22, 26][lv]; NC.sim.peds = [20, 28, 36][lv];
  }
  function syncSettingsUI() {
    for (const el of document.querySelectorAll('.slider input')) { el.value = Math.round(S[el.dataset.key] * 100); el.parentNode.querySelector('b').textContent = el.value; }
    for (const g of document.querySelectorAll('.seg')) for (const b of g.children) b.classList.toggle('on', String(S[g.dataset.key]) === b.dataset.v);
    for (const el of document.querySelectorAll('.toggle input')) el.checked = !!S[el.dataset.key];
    const d = NC.diff();
    $('diffHint').textContent = S.difficulty === 'easy' ? 'More time, softer crashes, calmer police. Rewards are 10% lower.' : S.difficulty === 'hard' ? 'Tighter clocks, harder hits, relentless police. Rewards are 25% higher.' : 'The way the city was meant to be played.';
    $('hudFps').classList.toggle('hidden', !S.showFps);
    void d;
  }
  function settingChanged(key) {
    NC.saveSettings();
    if (key === 'master' || key === 'music' || key === 'sfx') Sound.applyVolumes();
    if (key === 'quality') { if (S.quality === 'auto') { autoLevel = touchUI ? 1 : 2; holdUp = 0; } applyQuality(); }
    if (key === 'touchMode') applyTouchUI();
    syncSettingsUI();
  }
  for (const el of document.querySelectorAll('.slider input')) el.addEventListener('input', () => { Sound.init(); S[el.dataset.key] = el.value / 100; settingChanged(el.dataset.key); });
  for (const el of document.querySelectorAll('.slider input')) el.addEventListener('change', () => { if (el.dataset.key !== 'music') Sound.play('click'); });
  for (const g of document.querySelectorAll('.seg')) for (const b of g.children) b.addEventListener('click', () => { Sound.init(); Sound.play('click'); S[g.dataset.key] = b.dataset.v; settingChanged(g.dataset.key); });
  for (const el of document.querySelectorAll('.toggle input')) el.addEventListener('change', () => { Sound.init(); Sound.play('click'); S[el.dataset.key] = el.checked; settingChanged(el.dataset.key); });

  // ---------------- שמירה ----------------
  NC.saveGame = () => { if (state === 'menu' || G.attract || G.dead) return; NC.store.set(SAVE_KEY, Object.assign({ v: 2, at: Date.now() }, W.serialize())); saveT = 0; };
  function loadSave() {
    const s = NC.store.get(SAVE_KEY, null);
    if (!s || typeof s !== 'object' || !Array.isArray(s.pkgs) || !(s.money >= 0)) return null;
    if (!Array.isArray(s.done)) { // שמירה מהגרסה הקודמת: מספר המשימות שהושלמו, לפי הסדר הישן
      const OLD = ['welcome', 'shift', 'delivery', 'race', 'heat', 'cargo'];
      s.done = OLD.slice(0, clamp(s.story | 0, 0, OLD.length)); s.v = 2;
    }
    const ids = NC.MISSIONS.map((m) => m.id);
    s.done = s.done.filter((id) => ids.includes(id));
    s.pkgs = s.pkgs.filter((i) => Number.isInteger(i) && i >= 0 && i < NC.PKGS.length);
    return s;
  }
  function refreshMenu() {
    const s = loadSave();
    $('btnContinue').classList.toggle('hidden', !s);
    if (s) $('saveInfo').textContent = `Day ${s.day || 1} · ${NC.fmtMoney(s.money)} · ${s.done.length}/${NC.MISSIONS.length} missions · 🦩 ${s.pkgs.length}`;
  }

  // ---------------- מצבים ----------------
  function fadeIn() { const f = $('fade'); f.classList.add('on'); void f.offsetWidth; requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  function startGame(save) {
    Sound.init();
    W.resetWorld(save); NC.mission.reset(); Sound.quiet = false; G.attract = false;
    lastDistrict = ''; cache.dead = null; shownMoney = G.money; stack.length = 0;
    NC.ui.objective(''); $('banner').className = 'hidden'; $('toasts').textContent = '';
    show(null); setPlayUI(true);
    state = 'play'; last = performance.now(); saveT = 0;
    Sound.music('game'); fadeIn();
    if (save) NC.ui.toast('Welcome back to Neon Coast 🌴');
    else if (touchUI) setTimeout(() => state === 'play' && NC.ui.toast('Drag anywhere to move'), 2500);
    NC.saveGame();
  }
  function pause() {
    if (state !== 'play') return;
    state = 'pause'; releaseAll(); Sound.silence(); Sound.music('pause');
    NC.saveGame();
    NC.render.drawBigMap($('bigmap'));
    const pr = NC.mission.progress(), st = G.stats, t = Math.floor(G.playTime / 60);
    const cell = (v, l, hl) => `<div class="stat${hl ? ' hl' : ''}"><b>${v}</b><span>${l}</span></div>`;
    $('pauseStats').innerHTML = cell(NC.fmtMoney(G.money), 'Money', 1) + cell(pr.done + '/' + pr.total, 'Story') + cell(pr.pct + '%', 'Complete')
      + cell('🦩 ' + G.pkgs.length + '/' + NC.PKGS.length, 'Flamingos') + cell('🏁 ' + pr.medals + '/' + pr.trials, 'Medals') + cell('Day ' + G.day, Wx.info().name)
      + cell((st.dist / 10000).toFixed(1) + ' km', 'Driven') + cell(Math.round(st.topSpeed * 0.36) + '', 'Top km/h') + cell(t < 60 ? t + ' min' : Math.floor(t / 60) + 'h ' + (t % 60) + 'm', 'Played')
      + cell(st.stolen, 'Cars taken') + cell(st.evaded, 'Escapes') + cell(st.busted + ' / ' + st.wasted, 'Busted / Wasted');
    const ml = $('pauseMissions'); ml.textContent = '';
    for (const m of NC.mission.list()) { const s = document.createElement('span'); s.className = m.state; s.textContent = (m.state === 'done' ? '✓ ' : m.state === 'locked' ? '🔒 ' : '● ') + (m.state === 'locked' ? '???' : m.title); ml.appendChild(s); }
    stack.length = 0; show('pause');
  }
  function resume() { if (state !== 'pause') return; stack.length = 0; show(null); state = 'play'; last = performance.now(); Sound.music('game'); }
  function toMenu() {
    NC.saveGame();
    state = 'menu'; Sound.silence(); setPlayUI(false); $('banner').className = 'hidden'; $('dead').className = 'hidden';
    attract(); refreshMenu(); stack.length = 0; show('menu'); fadeIn();
  }
  // העיר חיה מאחורי התפריט, בשעת השקיעה
  function attract() { W.resetWorld(null); NC.mission.reset(); Sound.quiet = true; G.attract = true; G.clock = 19.1; Sound.music('menu'); }

  // ---------------- לולאה ----------------
  function frame(now) {
    requestAnimationFrame(frame);
    let raw = (now - last) / 1000; last = now;
    if (!(raw > 0)) raw = 0;
    const dt = Math.min(0.1, raw);
    try {
      if (state === 'play') {
        readInput();
        const slow = G.dead ? 0.35 : 1, n = Math.max(1, Math.min(3, Math.ceil(dt / 0.034))), sdt = dt / n * slow; // צעדים קטנים גם כשהפריימים איטיים
        for (let r = 0; r < timeScale; r++) for (let i = 0; i < n && state === 'play'; i++) { if (bot) bot(sdt); W.update(sdt); }
        if (G.dead) { G.dead.t += dt; if (G.dead.t > 3.4) W.respawn(); }
        const P = G.player, c = P.car;
        Sound.drive(!!c && !G.dead, c ? c.speed : 0, c ? c.d.max : 1, c ? c.slip : 0, G.copDist, G.wanted, c);
        Sound.radio(!!c && !G.dead);
        Sound.ambience(dt);
        updateHud(dt);
        saveT += dt; if (saveT > 15 && !G.dead) NC.saveGame();
      } else {
        pollPad();
        if (state === 'menu') { I.mx = I.my = I.thr = I.steer = 0; I.hb = false; W.update(Math.min(dt, 0.05)); }
        Sound.ambience(dt);
      }
      NC.render.draw(state === 'play' || state === 'menu' ? dt : 0);
      // ג׳ויסטיק
      if (joy.active && state === 'play') {
        const g = cv.getContext('2d'), d = cv.width / window.innerWidth;
        g.setTransform(d, 0, 0, d, 0, 0);
        let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const l = Math.hypot(dx, dy); if (l > 55) { dx = dx / l * 55; dy = dy / l * 55; }
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
        g.beginPath(); g.arc(joy.ox, joy.oy, 55, 0, 6.283); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,63,164,0.8)'; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(joy.ox + dx, joy.oy + dy, 24, 0, 6.283); g.fill(); g.stroke();
      }
      // מדידת ביצועים והתאמת איכות אוטומטית
      if (raw > 0 && raw < 0.5) {
        avgMs += (raw * 1000 - avgMs) * 0.05;
        fpsN++; fpsT += raw; if (fpsT >= 0.5) { if (S.showFps) setText('hudFps', Math.round(fpsN / fpsT) + ' fps'); fpsN = 0; fpsT = 0; }
        if (S.quality === 'auto' && state === 'play' && timeScale === 1) {
          holdUp -= raw;
          if (avgMs > 23) { slowT += raw; fastT = 0; if (slowT > 3 && autoLevel > 0) { autoLevel--; slowT = 0; holdUp = 90; avgMs = 16; applyQuality(); } }
          else if (avgMs < 13.5) { fastT += raw; slowT = 0; if (fastT > 12 && holdUp <= 0 && autoLevel < 2) { autoLevel++; fastT = 0; holdUp = 30; applyQuality(); } }
          else { slowT = 0; fastT = 0; }
        }
      }
    } catch (err) { console.error(err); }
  }

  // ---------------- כפתורים ----------------
  const on = (id, fn) => $(id).addEventListener('click', (e) => { Sound.init(); Sound.play('click'); fn(e); });
  on('btnNew', () => { if (!loadSave()) startGame(null); else ask('Start a new game?', 'Your saved progress will be replaced.', 'New game', () => startGame(null)); });
  on('btnContinue', () => startGame(loadSave()));
  on('btnSettings', () => { syncSettingsUI(); push('settings'); });
  on('btnPauseSettings', () => { syncSettingsUI(); push('settings'); });
  on('btnHowto', () => push('howto')); on('btnPauseHowto', () => push('howto'));
  on('btnHowtoBack', back); on('btnSettingsBack', back);
  on('btnMute', toggleMute);
  on('btnPause', pause); on('btnResume', resume); on('btnQuit', toMenu);
  on('btnRadio', cycleRadio);
  on('btnAccept', () => { show(null); state = 'play'; last = performance.now(); NC.mission.begin(briefDef); });
  on('btnDecline', () => { NC.mission.decline(briefDef); show(null); state = 'play'; last = performance.now(); });
  on('btnConfirmNo', back);
  on('btnConfirmYes', () => { const fn = confirmFn; confirmFn = null; back(); if (fn) fn(); });
  on('btnErase', () => ask('Erase saved game?', 'Money, missions, flamingos and records will be deleted. Settings are kept.', 'Erase', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* מצב פרטי */ }
    if (state !== 'menu') toMenu(); else refreshMenu();
    NC.ui.toast('Saved game erased');
  }));
  const fsEl = document.documentElement, canFs = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  $('btnFullscreen').classList.toggle('hidden', !canFs);
  on('btnFullscreen', () => {
    const d = document, isFs = d.fullscreenElement || d.webkitFullscreenElement;
    try { if (isFs) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* לא נתמך */ }
  });

  // כפתורי מגע: מגיבים מיד בנגיעה, ותומכים בכמה אצבעות יחד
  const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); setTouch(true); if (state === 'play') fn(); });
  tap('btnEnter', () => W.enterExit());
  tap('btnHorn', () => W.horn());
  tap('btnAct', () => NC.mission.action());
  const hold = (id, key) => {
    const el = $(id);
    const down = (e) => { e.preventDefault(); e.stopPropagation(); setTouch(true); tb[key] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (err) { /* לא נתמך */ } };
    const up = () => { tb[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  hold('btnBrake', 'hb'); hold('btnGas', 'gas'); hold('btnRev', 'rev');

  // הדפדפן מרשה קול רק אחרי מגע או מקש ראשון
  const wake = (e) => { if (e && (e.type === 'touchend' || (e.pointerType && e.pointerType !== 'mouse'))) tapped = true; Sound.init(); if (state === 'menu') Sound.music('menu'); };
  window.addEventListener('pointerdown', wake, { passive: true }); window.addEventListener('keydown', wake); window.addEventListener('touchend', wake, { passive: true });
  window.addEventListener('gamepadconnected', () => NC.ui.toast('🎮 Gamepad connected'));

  let rsT = 0;
  const onResize = () => { clearTimeout(rsT); rsT = setTimeout(NC.render.resize, 60); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(NC.render.resize, 250));

  applyQuality(); applyTouchUI(); syncSettingsUI(); updateMuteUI();
  attract(); refreshMenu(); show('menu');
  requestAnimationFrame((t) => { last = t; frame(t); });

  // גישה לבדיקות אוטומטיות בלבד
  window.__nc = {
    NC, get state() { return state; }, get screen() { return screen; }, set timeScale(v) { timeScale = clamp(v | 0, 1, 12); }, set bot(f) { bot = f; },
    startGame, pause, resume, toMenu, loadSave, perf: () => ({ avgMs, autoLevel, quality: NC.render.quality }),
  };
})();
