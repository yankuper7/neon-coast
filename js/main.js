/* חוף ניאון – קלט (מקלדת, מגע, שלט), ממשק, שמירה ולולאת המשחק */
'use strict';
(() => {
  const NC = window.NC;
  const { $, clamp } = NC;
  const G = NC.G, W = NC.world, Sound = NC.Sound, M = NC.map, S = NC.settings, Wx = NC.weather;
  const SAVE_KEY = 'neonCoast.save';
  let state = 'menu'; // menu | play | pause | brief
  let last = 0, timeScale = 1, briefDef = null, bot = null, saveT = 0, endT = 0;
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
      else if (screen === 'ending') { if (e.code === 'Escape') $('btnEndPlay').click(); }
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
    Sound.play('hover');
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
  const SCREENS = ['menu', 'settings', 'howto', 'pause', 'brief', 'confirm', 'ending'];
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
      Sound.soft(kind === 'good' ? 'toastGood' : kind === 'warn' ? 'toastWarn' : 'toast');
      setTimeout(() => t.remove(), 3900);
    },
    objective(text) { const o = $('objective'); if (o.textContent !== text) { o.textContent = text; o.style.animation = 'none'; void o.offsetWidth; o.style.animation = ''; if (text) Sound.soft('objective'); } o.classList.toggle('hidden', !text); },
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
    retryHint() { return touchUI ? 'Tap ↻ to try again right away' : padUsed ? 'Press Y to try again right away' : 'Press T to try again right away'; },
    fade() { fadeIn(); },
    ending(delay) { endT = Math.max(0.1, delay || 0.1); }, // מסך הסיום יופיע בעוד כמה שניות, אחרי כרזת הניצחון
    nearCar(v) { if (cache.near !== v) { cache.near = v; $('btnEnter').classList.toggle('dim', !v && !G.player.car); } },
    buzz(ms) { if (S.vibrate && touchUI && tapped && navigator.vibrate && state === 'play') { try { navigator.vibrate(Math.round(ms)); } catch (e) { /* לא נתמך */ } } },
  };

  function updateMuteUI() { $('btnMute').textContent = Sound.muted ? '🔇' : '🔊'; }
  function toggleMute() { Sound.init(); Sound.setMuted(!Sound.muted); updateMuteUI(); if (!Sound.muted) Sound.play('toggle'); }
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
    if (dk !== lastDistrict && dk !== 'sea') {
      lastDistrict = dk; const el = $('district'); el.textContent = M.DISTRICTS[dk].name;
      // שם השיר של השכונה, כשמתנגן פסקול העיר
      const tr = Sound.DISTRICT[dk];
      if (tr && Sound.radioSel === 'local' && !Sound.muted && S.music > 0) { const sm = document.createElement('small'); sm.textContent = '♪ ' + tr.name; el.appendChild(sm); }
      el.classList.add('show'); districtT = 3.6;
      if (G.playTime > 3) Sound.soft('zone');
    }
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
  for (const el of document.querySelectorAll('.toggle input')) el.addEventListener('change', () => { Sound.init(); Sound.play('toggle'); S[el.dataset.key] = el.checked; settingChanged(el.dataset.key); });

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
    Sound.setZone(M.districtAt(G.player.x, G.player.y), true);
    lastDistrict = ''; cache.dead = null; shownMoney = G.money; stack.length = 0;
    NC.ui.objective(''); $('banner').className = 'hidden'; $('toasts').textContent = '';
    show(null); setPlayUI(true);
    state = 'play'; last = performance.now(); saveT = 0;
    Sound.music('game'); fadeIn(); Sound.play('start');
    endT = save && !G.ended && NC.mission.storyComplete() ? 2.5 : 0; // סיפור שהושלם בלי שמסך הסיום הוצג
    if (save) NC.ui.toast('Welcome back to Neon Coast 🌴');
    else if (touchUI) setTimeout(() => state === 'play' && NC.ui.toast('Drag anywhere to move'), 2500);
    NC.saveGame();
  }
  function pause() {
    if (state !== 'play') return;
    state = 'pause'; releaseAll(); Sound.silence(); Sound.music('pause'); Sound.play('pauseIn');
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
    $('btnEnding').classList.toggle('hidden', !NC.mission.storyComplete());
    stack.length = 0; show('pause');
  }
  function resume() { if (state !== 'pause') return; stack.length = 0; show(null); state = 'play'; last = performance.now(); Sound.music('game'); Sound.play('pauseOut'); }
  function toMenu() {
    NC.saveGame();
    state = 'menu'; Sound.silence(); setPlayUI(false); $('banner').className = 'hidden'; $('dead').className = 'hidden';
    attract(); refreshMenu(); stack.length = 0; show('menu'); fadeIn();
  }
  // ---------------- מסך הסיום ----------------
  const QUOTES = [
    ['R', '#ffd23f', 'Aunt Rosa', 'I knew it the day you walked in. The taxi stand is yours whenever you want it, sweetheart.'],
    ['M', '#ff9d3d', 'Mickey Keys', 'Barely a scratch on the cargo. You are the best driver I ever had – do not tell the others.'],
    ['L', '#ff7ac8', 'Lola Neon', 'Everyone on the Strip knows your name now. Your table is waiting. Forever.'],
    ['Z', '#5fe9ff', 'Captain Ziv', 'The port never saw driving like that. Fair winds, kid.'],
  ];
  function streetName(st) { // כינוי לפי סגנון המשחק
    if (G.pkgs.length >= NC.PKGS.length) return 'The Flamingo King';
    if (st.busted + st.wasted === 0) return 'The Ghost of Neon Coast';
    if (st.evaded >= 12) return 'Untouchable';
    if (st.topSpeed * 0.36 >= 175) return 'Speed Demon';
    if (st.wrecked >= 12) return 'The Wrecking Ball';
    if (st.pedsHit === 0) return 'The Gentle Driver';
    if (st.stolen >= 25) return 'Sticky Fingers';
    return 'The Boardwalk Legend';
  }
  function buildSkyline() { // קו רקיע של העיר מול השמש: בניינים כהים עם חלונות מוארים
    const el = $('endSkyline'); if (el.firstChild) return;
    const r = NC.rng(77), W = 1200, H = 260; let x = 0, rects = '', wins = '';
    while (x < W) {
      const w = 26 + r() * 54, mid = 1 - Math.abs(x + w / 2 - W / 2) / (W / 2), h = 30 + r() * 70 + mid * mid * 120 * (0.5 + r());
      rects += `<rect x="${x.toFixed(0)}" y="${(H - h).toFixed(0)}" width="${(w + 1).toFixed(0)}" height="${h.toFixed(0)}"/>`;
      if (r() < 0.3) rects += `<rect x="${(x + w / 2 - 1.5).toFixed(0)}" y="${(H - h - 18).toFixed(0)}" width="3" height="18"/>`;
      for (let wy = H - h + 8; wy < H - 10; wy += 13) for (let wx = x + 6; wx < x + w - 8; wx += 10) if (r() < 0.34) wins += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="6" fill="${r() < 0.5 ? '#ffe9a8' : r() < 0.5 ? '#ff7ac8' : '#7fefff'}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
      x += w;
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g fill="#120726">${rects}</g>${wins}</svg>`;
  }
  // זיקוקים על קנבס נפרד מעל השמיים
  const endCv = $('endFx'), eg = endCv.getContext('2d'), FW = ['#ff3fa4', '#19e3ff', '#ffe14d', '#9d5cff', '#3dff9e', '#ff9d3d', '#ffffff'];
  let rockets = [], sparks = [], fwT = 0, fwLast = 0, fwN = 0, fwOn = false;
  function fireworks(now) {
    if (screen !== 'ending') { fwOn = false; return; }
    requestAnimationFrame(fireworks);
    const dt = Math.min(0.05, Math.max(0, (now - fwLast) / 1000)); fwLast = now;
    const w = endCv.clientWidth, h = endCv.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
    if (endCv.width !== Math.round(w * d) || endCv.height !== Math.round(h * d)) { endCv.width = Math.round(w * d); endCv.height = Math.round(h * d); }
    eg.setTransform(d, 0, 0, d, 0, 0);
    eg.globalCompositeOperation = 'destination-out'; eg.fillStyle = 'rgba(0,0,0,0.16)'; eg.fillRect(0, 0, w, h);
    eg.globalCompositeOperation = 'lighter';
    fwT -= dt;
    if (fwT <= 0 && !document.hidden) { // רקטה חדשה; אחרי הפתיחה הקצב נרגע
      fwT = fwN < 6 ? 0.3 + Math.random() * 0.4 : fwN < 24 ? 0.6 + Math.random() * 1.1 : 1.6 + Math.random() * 2.4;
      const ty = h * (0.08 + Math.random() * 0.3), y0 = h * 0.72;
      rockets.push({ x: w * (0.08 + Math.random() * 0.84), y: y0, vy: (ty - y0) / 0.5, ty, col: FW[Math.floor(Math.random() * FW.length)] });
      Sound.play('firework', fwN < 8 ? 0.8 : 0.4); fwN++;
    }
    for (const k of rockets) {
      k.y += k.vy * dt; eg.fillStyle = '#fff3c4'; eg.beginPath(); eg.arc(k.x, k.y, 2, 0, 6.283); eg.fill();
      if (k.y <= k.ty) {
        k.done = true; const n = 44 + Math.floor(Math.random() * 30), pw = 90 + Math.random() * 130, two = Math.random() < 0.35 ? FW[Math.floor(Math.random() * FW.length)] : k.col;
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = pw * (0.35 + Math.random() * 0.65); sparks.push({ x: k.x, y: k.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 + Math.random() * 0.8, max: 1.8, col: i % 2 ? k.col : two }); }
      }
    }
    rockets = rockets.filter((k) => !k.done);
    for (const q of sparks) {
      q.life -= dt; const f = Math.exp(-1.6 * dt); q.vx *= f; q.vy = q.vy * f + 70 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      eg.globalAlpha = Math.max(0, Math.min(1, q.life)); eg.fillStyle = q.col; eg.beginPath(); eg.arc(q.x, q.y, 1.8, 0, 6.283); eg.fill();
    }
    eg.globalAlpha = 1;
    sparks = sparks.filter((q) => q.life > 0); if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
  }
  function countUp(el, to, fmt, delay) { // המספרים "רצים" אל הערך הסופי
    const t0 = performance.now() + delay; el.textContent = fmt(0);
    const step = (now) => { if (screen !== 'ending') { el.textContent = fmt(to); return; } const k = clamp((now - t0) / 1300, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to); };
    requestAnimationFrame(step);
  }
  function showEnding() {
    if (state !== 'play' && state !== 'pause') return;
    endT = 0; state = 'ending'; releaseAll(); Sound.silence(); Sound.music('ending'); Sound.play('fanfare');
    G.ended = true; NC.saveGame();
    buildSkyline();
    const Q = $('endQuotes'); Q.textContent = '';
    for (const [ic, col, who, text] of QUOTES) {
      const d = document.createElement('div'), i = document.createElement('i'), box = document.createElement('div'), b = document.createElement('b'), sp = document.createElement('span');
      d.className = 'end-quote'; i.textContent = ic; i.style.background = col; i.style.boxShadow = `0 0 12px ${col}`; b.textContent = who; sp.textContent = '“' + text + '”';
      box.appendChild(b); box.appendChild(sp); d.appendChild(i); d.appendChild(box); Q.appendChild(d);
    }
    const st = G.stats, pr = NC.mission.progress(), mins = Math.floor(G.playTime / 60);
    $('endRank').textContent = streetName(st);
    const cells = [
      [mins, (v) => (v < 60 ? Math.round(v) + ' min' : Math.floor(v / 60) + 'h ' + Math.round(v % 60) + 'm'), 'Time played'], [st.earned, (v) => NC.fmtMoney(v), 'Money earned', 1],
      [st.dist / 10000, (v) => v.toFixed(1) + ' km', 'Distance driven'], [st.topSpeed * 0.36, (v) => Math.round(v) + ' km/h', 'Top speed'],
      [st.evaded, (v) => String(Math.round(v)), 'Police escapes'], [st.stolen, (v) => String(Math.round(v)), 'Cars taken'],
      [G.pkgs.length, (v) => '🦩 ' + Math.round(v) + '/' + NC.PKGS.length, 'Flamingos'], [pr.pct, (v) => Math.round(v) + '%', 'Completion', 1],
    ];
    const SG = $('endStats'); SG.textContent = '';
    cells.forEach(([to, fmt, label, hl], n) => { const c = document.createElement('div'), b = document.createElement('b'), sp = document.createElement('span'); c.className = 'stat' + (hl ? ' hl' : ''); sp.textContent = label; c.appendChild(b); c.appendChild(sp); SG.appendChild(c); countUp(b, to, fmt, 3100 + n * 110); });
    const left = [];
    if (G.pkgs.length < NC.PKGS.length) left.push(`🦩 ${NC.PKGS.length - G.pkgs.length} golden flamingos`);
    if (pr.medals < pr.trials) left.push(`🏁 ${pr.trials - pr.medals} time-trial medals`);
    left.push('🚕 endless taxi fares');
    $('endLeft').textContent = pr.pct >= 100 ? '💯 You found and won everything. Absolute legend.' : 'Still out there: ' + left.join(' · ');
    stack.length = 0; show('ending');
    rockets = []; sparks = []; fwT = 0.9; fwN = 0; eg.clearRect(0, 0, endCv.width, endCv.height);
    if (!fwOn) { fwOn = true; fwLast = performance.now(); requestAnimationFrame(fireworks); }
  }
  function closeEnding(menu) {
    if (state !== 'ending') return;
    if (menu) { state = 'play'; toMenu(); return; }
    show(null); state = 'play'; last = performance.now(); Sound.music('game'); fadeIn();
    NC.ui.toast('🌴 The city is yours – taxi fares, time trials and flamingos are still waiting', 'good');
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
        if (endT > 0 && !G.dead) { endT -= dt; if (endT <= 0 && state === 'play') showEnding(); }
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
  const on = (id, fn, snd) => $(id).addEventListener('click', (e) => { Sound.init(); if (snd !== '') Sound.play(snd || 'click'); fn(e); });
  // מעבר עכבר על כפתור – תקתוק עדין
  for (const b of document.querySelectorAll('.btn, .icon-btn, .seg button')) b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') Sound.play('hover'); });
  on('btnNew', () => { if (!loadSave()) startGame(null); else ask('Start a new game?', 'Your saved progress will be replaced.', 'New game', () => startGame(null)); });
  on('btnContinue', () => startGame(loadSave()));
  on('btnSettings', () => { syncSettingsUI(); push('settings'); });
  on('btnPauseSettings', () => { syncSettingsUI(); push('settings'); });
  on('btnHowto', () => push('howto')); on('btnPauseHowto', () => push('howto'));
  on('btnHowtoBack', back, 'back'); on('btnSettingsBack', back, 'back');
  on('btnMute', toggleMute, '');
  on('btnPause', pause, ''); on('btnResume', resume, ''); on('btnQuit', toMenu, 'back');
  on('btnRadio', cycleRadio, '');
  on('btnAccept', () => { show(null); state = 'play'; last = performance.now(); NC.mission.begin(briefDef); }, 'accept');
  on('btnDecline', () => { NC.mission.decline(briefDef); show(null); state = 'play'; last = performance.now(); }, 'decline');
  on('btnConfirmNo', back, 'back');
  on('btnEndPlay', () => closeEnding(false), 'accept'); on('btnEndMenu', () => closeEnding(true), 'back');
  on('btnEnding', () => showEnding());
  on('btnConfirmYes', () => { const fn = confirmFn; confirmFn = null; back(); if (fn) fn(); });
  on('btnErase', () => ask('Erase saved game?', 'Money, missions, flamingos and records will be deleted. Settings are kept.', 'Erase', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* מצב פרטי */ }
    if (state !== 'menu') toMenu(); else refreshMenu();
    Sound.play('erase'); NC.ui.toast('Saved game erased');
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
    startGame, pause, resume, toMenu, loadSave, showEnding, perf: () => ({ avgMs, autoLevel, quality: NC.render.quality }),
  };
})();
