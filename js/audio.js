/* חוף ניאון – קול: מנוע עם הילוכים, סירנה, מסוק, אווירה (ים, גשם, רוח, ציפורים, צרצרים), אפקטים ומוזיקה. הכול מסונתז בקוד, בלי קובצי שמע */
'use strict';
(() => {
  const NC = window.NC, ST = NC.settings;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------------- תחנות הרדיו ----------------
  // אקורד: [תו בסיס MIDI, מינורי?]. דפוסים באורך 16 צעדים (חלקי 16)
  const X = (s) => s.split('').map((c) => c !== '.');
  const TRACKS = [
    null,
    { name: 'Neon Wave 98.6', key: 57, bpm: 104, chords: [[57, 1], [53, 0], [48, 0], [55, 0]], kick: X('x...x...x...x...'), snare: X('....x.......x...'), hat: X('..x...x...x...x.'), bass: [0, null, 0, null, 0, null, 0, 12, 0, null, 0, null, 0, null, 7, null],
      arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2], arpWave: 'sawtooth', lead: [[0, 4, 4], [4, 2, 2], [6, 3, 2], [8, 4, 6], [16, 2, 4], [20, 3, 2], [22, 4, 2], [24, 5, 6]], leadWave: 'square', pad: 0.5 },
    { name: 'Coast FM 94.2', key: 57, bpm: 96, chords: [[53, 0], [52, 1], [50, 1], [55, 0]], kick: X('x..x..x.x..x..x.'), snare: X('....x.......x..x'), hat: X('x.x.x.x.x.x.x.x.'), bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, null, 12, null, null],
      arp: [0, null, 2, null, 1, null, 3, 2, null, 0, null, 2, 1, null, 3, null], arpWave: 'triangle', lead: [[2, 4, 2], [4, 3, 2], [6, 2, 4], [12, 3, 2], [14, 4, 2], [18, 5, 4], [24, 4, 2], [26, 2, 5]], leadWave: 'sine', pad: 0.35 },
    { name: 'City Nights 101', key: 52, bpm: 112, chords: [[52, 1], [48, 0], [50, 0], [47, 1]], kick: X('x.....x.x.x.....'), snare: X('....x.......x...'), hat: X('xxx.xxx.xxx.xxxx'), bass: [0, null, 0, 12, null, 0, null, 10, 0, null, 12, null, 7, null, 10, 12],
      arp: [null, null, 2, null, null, 3, null, null, 2, null, null, 1, null, null, 2, 3], arpWave: 'square', lead: [[0, 2, 3], [3, 3, 3], [6, 4, 2], [8, 3, 6], [18, 4, 2], [20, 5, 2], [22, 4, 2], [24, 2, 6]], leadWave: 'sawtooth', pad: 0.3 },
    { name: 'Sunset Drive 88.1', key: 50, bpm: 120, chords: [[50, 1], [46, 0], [53, 0], [48, 0]], kick: X('x...x...x...x...'), snare: X('....x.......x.x.'), hat: X('..x...x...x...xx'), bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 0],
      arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 1, 2], arpWave: 'sawtooth', lead: [[0, 4, 6], [8, 5, 2], [10, 4, 2], [12, 3, 4], [16, 2, 6], [24, 3, 2], [26, 4, 2], [28, 5, 4]], leadWave: 'square', pad: 0.45 },
  ];
  const MENU = { name: 'menu', key: 57, bpm: 84, chords: [[57, 1], [53, 0], [48, 0], [55, 0]], kick: X('x...............'), snare: X('................'), hat: X('....x.......x...'), bass: [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, 7, null],
    arp: [0, null, 1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null], arpWave: 'triangle', lead: [[0, 4, 8], [8, 3, 4], [12, 2, 4], [16, 3, 8], [24, 5, 6]], leadWave: 'sine', pad: 0.7 };
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

  const S = NC.Sound = {
    ctx: null, master: null, sfx: null, mus: null, amb: null, rev: null, musFilter: null, radioGain: null, noiseBuf: null,
    muted: !!NC.store.get('neonCoast.muted', false), quiet: false, last: {},
    station: NC.store.get('neonCoast.station', 1), STATIONS: TRACKS.map((t) => (t ? t.name : 'Radio off')),
    mode: 'menu', inCar: false, nextNote: 0, step: 0, track: null, gear: 0, birdT: 3, cricketT: 1,

    init() {
      if (this.ctx) { if (this.ctx.state !== 'running' && !document.hidden) { try { this.ctx.resume(); } catch (e) { /* לא נתמך */ } } return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        const c = this.ctx = new AC();
        const G = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2; comp.connect(c.destination);
        this.master = G(this.muted ? 0 : ST.master, comp);
        this.sfx = G(ST.sfx, this.master); this.amb = G(ST.sfx * 0.85, this.master);
        this.musFilter = c.createBiquadFilter(); this.musFilter.type = 'lowpass'; this.musFilter.frequency.value = 18000; this.musFilter.connect(this.master);
        this.mus = G(ST.music, this.musFilter); this.radioGain = G(0, this.mus);
        // רעש לבן משותף
        this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // הדהוד: תגובת הלם מסונתזת
        const len = Math.floor(c.sampleRate * 1.7), ir = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        this.rev = c.createConvolver(); this.rev.buffer = ir; this.rev.connect(G(0.5, this.master));
        this.revSfx = G(0.16, this.rev); this.sfx.connect(this.revSfx);
        this.revMus = G(1, this.rev);
        const loop = (type, freq, q, vol, to) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; const g = G(vol, to); s.connect(f); f.connect(g); s.start(); return { f, g }; };
        // מנוע: שני מתנדים + תת-בס + רעם
        this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400; this.engFilter.Q.value = 1.2;
        this.engGain = G(0, this.sfx); this.engFilter.connect(this.engGain);
        this.eng = []; for (const [type, mul, vol] of [['sawtooth', 1, 0.5], ['square', 2.012, 0.12], ['sine', 0.5, 0.55]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = 50; o.connect(G(vol, this.engFilter)); o.start(); this.eng.push({ o, mul }); }
        this.rumble = loop('lowpass', 180, 0, 0, this.sfx);
        // חריקת צמיגים, סירנה, מסוק
        this.scr = loop('bandpass', 1900, 3.2, 0, this.sfx);
        this.sir = c.createOscillator(); this.sir.type = 'sawtooth'; this.sir.frequency.value = 700;
        const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1100; sf.Q.value = 0.9;
        this.sirGain = G(0, this.sfx); this.sir.connect(sf); sf.connect(this.sirGain); this.sir.start();
        this.heli = loop('lowpass', 210, 0, 0, this.sfx);
        const chop = c.createOscillator(); chop.type = 'square'; chop.frequency.value = 12.5; const chopG = G(0, null); chop.connect(chopG); chopG.connect(this.heli.g.gain); chop.start(); this.heliChop = chopG;
        // אווירה
        this.sea = loop('lowpass', 520, 0, 0, this.amb); this.rain = loop('highpass', 2400, 0, 0, this.amb); this.wind = loop('bandpass', 420, 0.8, 0, this.amb); this.hum = loop('lowpass', 150, 0, 0, this.amb);
        const lfo = c.createOscillator(); lfo.frequency.value = 0.11; const lg = G(0, null); lfo.connect(lg); lg.connect(this.sea.g.gain); lfo.start(); this.seaLfo = lg;
      } catch (e) { this.ctx = null; }
    },
    suspend(on) { if (!this.ctx) return; try { if (on) this.ctx.suspend(); else this.ctx.resume(); } catch (e) { /* לא נתמך */ } },
    applyVolumes() {
      if (!this.ctx) return; const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.muted ? 0 : ST.master, t, 0.03); this.sfx.gain.setTargetAtTime(ST.sfx, t, 0.03); this.amb.gain.setTargetAtTime(ST.sfx * 0.85, t, 0.03); this.mus.gain.setTargetAtTime(ST.music, t, 0.03);
    },
    setMuted(m) { this.muted = m; NC.store.set('neonCoast.muted', m); this.applyVolumes(); },

    // ---------------- אבני בניין ----------------
    tone(f, dur, type = 'square', vol = 0.1, slide = null, delay = 0, dest = null) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, freq = 1200, delay = 0, type = 'lowpass', dest = null, q = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = freq; if (q) fl.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(dest || this.sfx); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.03);
    },
    // אפקט חד-פעמי. x (אופציונלי) – מיקום בעולם, בשביל ימין/שמאל
    play(name, vol = 1, x = null) {
      const c = this.ctx;
      if (!c || this.muted || this.quiet || c.state !== 'running') return;
      const now = performance.now(), gap = { crash: 110, thud: 150, honk: 400, horn: 250, step: 180, spark: 80, tick: 200, click: 40, thunder: 800 }[name] || 0;
      if (gap && this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      let D = this.sfx;
      if (x != null && c.createStereoPanner && NC.cam) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (x - NC.cam.x) / 650)); p.connect(this.sfx); D = p; }
      const seq = (notes, st, type, v, len) => notes.forEach((f, i) => this.tone(f, len, type, v, null, i * st, D));
      switch (name) {
        case 'crash': this.noise(0.28, 0.34 * vol, 950, 0, 'lowpass', D); this.noise(0.12, 0.16 * vol, 2800, 0, 'bandpass', D, 2); this.tone(95, 0.2, 'square', 0.13 * vol, 48, 0, D); break;
        case 'thud': this.noise(0.12, 0.22 * vol, 500, 0, 'lowpass', D); this.tone(140, 0.1, 'sine', 0.16 * vol, 70, 0, D); break;
        case 'door': this.noise(0.05, 0.14, 900, 0, 'lowpass', D); this.tone(170, 0.05, 'square', 0.05, 110, 0, D); this.noise(0.06, 0.12, 600, 0.09, 'lowpass', D); break;
        case 'honk': this.tone(415, 0.26, 'square', 0.05 * vol, null, 0, D); this.tone(523, 0.26, 'square', 0.045 * vol, null, 0, D); break;
        case 'horn': this.tone(349, 0.42, 'sawtooth', 0.07); this.tone(440, 0.42, 'sawtooth', 0.06); this.tone(175, 0.42, 'square', 0.03); break;
        case 'boom': this.noise(1.1, 0.6, 380, 0, 'lowpass', D); this.noise(0.5, 0.25, 1800, 0.02, 'bandpass', D, 0.7); this.tone(85, 0.7, 'sawtooth', 0.22, 28, 0, D); this.tone(48, 0.9, 'sine', 0.3, 30, 0, D); break;
        case 'pickup': seq([784, 1046, 1568], 0.06, 'sine', 0.1, 0.16); break;
        case 'cash': seq([1318, 1760, 2093], 0.06, 'square', 0.04, 0.1); break;
        case 'star': this.tone(880, 0.12, 'square', 0.07); this.tone(660, 0.2, 'square', 0.07, null, 0.1); this.tone(880, 0.12, 'square', 0.05, null, 0.3); break;
        case 'clear': seq([523, 659, 784, 1046], 0.09, 'triangle', 0.1, 0.18); break;
        case 'check': this.tone(988, 0.08, 'triangle', 0.12); this.tone(1318, 0.16, 'triangle', 0.12, null, 0.07); break;
        case 'pass': seq([392, 494, 587, 784, 587, 784, 988], 0.13, 'triangle', 0.13, 0.28); seq([196, 196, 294, 392], 0.26, 'sawtooth', 0.045, 0.32); seq([784, 988, 1175], 0.13, 'sine', 0.05, 0.5); break;
        case 'fail': seq([392, 349, 294, 220], 0.2, 'sawtooth', 0.075, 0.34); break;
        case 'wasted': seq([220, 196, 165, 110], 0.3, 'sawtooth', 0.09, 0.55); this.tone(55, 1.4, 'sine', 0.2, 40); break;
        case 'click': this.tone(700, 0.035, 'square', 0.035); this.tone(1400, 0.02, 'sine', 0.03, null, 0.01); break;
        case 'brief': seq([659, 880], 0.09, 'sine', 0.08, 0.2); break;
        case 'tick': this.tone(880, 0.07, 'square', 0.06 * vol); break;
        case 'go': this.tone(1320, 0.45, 'square', 0.08); this.tone(660, 0.45, 'square', 0.05); break;
        case 'radio': this.noise(0.18, 0.06, 3000, 0, 'highpass'); this.tone(1200, 0.05, 'sine', 0.03, 400, 0.05); break;
        case 'spray': this.noise(0.8, 0.13, 5200, 0, 'highpass'); break;
        case 'splash': this.noise(0.7, 0.3, 1300, 0, 'lowpass', D); this.noise(0.35, 0.12, 4200, 0.05, 'highpass', D); break;
        case 'step': this.noise(0.04, 0.05 * vol, 700 + Math.random() * 300, 0, 'lowpass'); break;
        case 'thunder': this.noise(2.6, 0.5 * vol, 240, 0, 'lowpass'); this.noise(0.5, 0.3 * vol, 900, 0, 'lowpass'); this.tone(52, 2, 'sine', 0.22 * vol, 30); break;
      }
    },

    // ---------------- צלילים רציפים: מנוע, חריקה, סירנה, מסוק ----------------
    drive(inCar, speed, maxSpeed, slip, copDist, wanted, car) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime;
      const k = inCar ? Math.min(1.15, Math.abs(speed) / maxSpeed) : 0;
      // חמישה הילוכים: הסל"ד עולה בכל הילוך ונופל בהחלפה
      const gp = k * 4.6, gear = Math.min(4, Math.floor(gp)), rpm = 0.34 + 0.66 * (gp - gear) * (gear >= 4 ? 0.7 : 1);
      const thr = car ? Math.abs(car.thr) : 0, f = 46 + rpm * 118 + gear * 9;
      for (const e of this.eng) e.o.frequency.setTargetAtTime(f * e.mul, t, gear !== this.gear ? 0.12 : 0.05);
      this.gear = gear;
      this.engFilter.frequency.setTargetAtTime(280 + rpm * 900 + thr * 700, t, 0.08);
      this.engGain.gain.setTargetAtTime(inCar ? 0.028 + rpm * 0.03 + thr * 0.03 : 0, t, 0.1);
      this.rumble.g.gain.setTargetAtTime(inCar ? 0.02 + k * 0.07 : 0, t, 0.15);
      const wet = NC.weather.wet;
      this.scr.f.frequency.setTargetAtTime(wet > 0.5 ? 1300 : 1900, t, 0.2);
      this.scr.g.gain.setTargetAtTime(inCar && slip > 120 ? Math.min(0.13, (slip - 120) / 1400) * (1 - wet * 0.5) : 0, t, 0.05);
      // סירנה: יללה איטית, ו"יֶלְפּ" מהיר כשהמרדף חם
      const sv = wanted > 0 && copDist < 950 ? 0.045 * (1 - copDist / 950) + 0.006 : 0;
      this.sirGain.gain.setTargetAtTime(sv, t, 0.12);
      const per = wanted >= 3 ? 0.36 : 3.1, ph = (t % per) / per;
      this.sir.frequency.setTargetAtTime(wanted >= 3 ? 640 + 620 * (ph < 0.5 ? ph * 2 : 2 - ph * 2) : 620 + 560 * (0.5 - 0.5 * Math.cos(ph * 6.283)), t, 0.02);
      const H = NC.G.heli, hv = H && H.on ? Math.max(0, 1 - Math.hypot(H.x - NC.G.player.x, H.y - NC.G.player.y) / 1300) : 0;
      this.heli.g.gain.setTargetAtTime(hv * 0.16, t, 0.2); this.heliChop.gain.setTargetAtTime(hv * 0.13, t, 0.2);
    },
    silence() {
      if (!this.ctx) return; const t = this.ctx.currentTime;
      for (const g of [this.engGain, this.rumble.g, this.scr.g, this.sirGain, this.heli.g, this.heliChop]) g.gain.setTargetAtTime(0, t, 0.05);
    },

    // ---------------- אווירה: ים, גשם, רוח, ציפורים וצרצרים ----------------
    ambience(dt) {
      const c = this.ctx; if (!c) return;
      this.tickMusic();
      const t = c.currentTime, G = NC.G, M = NC.map, Wx = NC.weather, P = G.player, live = this.mode === 'game' && !this.quiet;
      const k = live ? 1 : this.mode === 'menu' ? 0.5 : 0.25;
      const coast = Math.max(0, 1 - Math.min(Math.abs(P.x - 56.5 * M.T), Math.abs(P.y - 59 * M.T)) / 900);
      this.sea.g.gain.setTargetAtTime(coast * 0.11 * k, t, 0.5); this.seaLfo.gain.setTargetAtTime(coast * 0.06 * k, t, 0.5);
      const inside = P.car ? 0.6 : 1;
      this.rain.g.gain.setTargetAtTime(Wx.rain * 0.12 * k * inside, t, 0.4);
      this.wind.g.gain.setTargetAtTime((Wx.wind * 0.035 + Wx.rain * 0.02) * k * (1 + Wx.gust * 0.4), t, 0.4); this.wind.f.frequency.setTargetAtTime(380 + Wx.gust * 140, t, 0.6);
      const night = NC.nightAmount ? NC.nightAmount(G.clock) : 0;
      this.hum.g.gain.setTargetAtTime((0.05 - night * 0.03) * k, t, 1);
      if (!live || c.state !== 'running' || this.muted) return;
      const d = M.districtAt(P.x, P.y), green = d === 'park' || d === 'palms' || d === 'glade' || d === 'beach';
      if (green && Wx.rain < 0.2) {
        if (night < 0.3) { this.birdT -= dt; if (this.birdT <= 0) { this.birdT = 1.5 + Math.random() * 5; const f = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) this.tone(f * (1 + i * 0.06), 0.09, 'sine', 0.018, f * 1.35, i * 0.11, this.amb); } }
        else if (night > 0.7) { this.cricketT -= dt; if (this.cricketT <= 0) { this.cricketT = 0.55 + Math.random() * 0.5; const f = 4300 + Math.random() * 500; for (let i = 0; i < 3; i++) this.tone(f, 0.035, 'triangle', 0.012, null, i * 0.055, this.amb); } }
      }
    },

    // ---------------- מוזיקה ----------------
    nextStation() { this.station = (this.station + 1) % TRACKS.length; NC.store.set('neonCoast.station', this.station); this.play('radio'); this.track = null; return this.STATIONS[this.station]; },
    radio(on) { this.inCar = on; },
    music(mode) {
      this.mode = mode;
      if (!this.ctx) return; const t = this.ctx.currentTime;
      this.musFilter.frequency.setTargetAtTime(mode === 'pause' ? 500 : 18000, t, 0.15);
    },
    note(f, t, dur, type, vol, cut, rev) { // תו עם מעטפת ומסנן נסגר
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
      o.type = type; o.frequency.setValueAtTime(f, t);
      fl.type = 'lowpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(this.radioGain); if (rev) g.connect(this.revMus);
      o.start(t); o.stop(t + dur + 0.05);
    },
    padChord(notes, t, dur, vol) {
      const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 1100; fl.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.25); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.08);
      fl.connect(g); g.connect(this.radioGain); g.connect(this.revMus);
      for (const n of notes) for (const det of [-6, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur * 1.1); }
    },
    drum(kind, t) {
      const c = this.ctx, g = c.createGain(); g.connect(this.radioGain);
      if (kind === 0) { const o = c.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); o.start(t); o.stop(t + 0.22); return; }
      const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.noiseBuf;
      if (kind === 1) { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; g.gain.setValueAtTime(0.26, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); g.connect(this.revMus); const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); og.gain.setValueAtTime(0.14, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og); og.connect(this.radioGain); o.start(t); o.stop(t + 0.12); }
      else { f.type = 'highpass'; f.frequency.value = 7500; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); }
      s.connect(f); f.connect(g); s.start(t, Math.random()); s.stop(t + 0.2);
    },
    // מתזמן: מקדים בכרבע שנייה את התווים הבאים
    tickMusic() {
      const c = this.ctx; if (!c || c.state !== 'running') return;
      const want = this.mode === 'menu' ? MENU : this.inCar && this.station ? TRACKS[this.station] : null;
      const t = c.currentTime;
      if (want !== this.track) {
        if (this.track && this.radioGain.gain.value > 0.02 && !this.fading) { this.fading = true; this.radioGain.gain.cancelScheduledValues(t); this.radioGain.gain.setTargetAtTime(0, t, 0.08); this.fadeAt = t + 0.3; return; }
        if (this.fading && t < this.fadeAt) return;
        this.fading = false; this.track = want; this.step = 0; this.nextNote = t + 0.08;
        if (want) { this.radioGain.gain.cancelScheduledValues(t); this.radioGain.gain.setTargetAtTime(1, t, 0.25); }
      }
      const tr = this.track;
      if (!tr || this.muted || ST.music <= 0.001) { if (!tr) this.radioGain.gain.setTargetAtTime(0, t, 0.1); this.nextNote = t + 0.05; return; }
      if (this.nextNote < t - 0.3) this.nextNote = t + 0.05; // חזרנו מהשהיה – לא "רודפים" אחרי תווים שעבר זמנם
      const sp = 60 / tr.bpm / 4;
      while (this.nextNote < t + 0.25) {
        const s = this.step, at = this.nextNote, st = s % 16, bar = Math.floor(s / 16), ch = tr.chords[bar % tr.chords.length];
        const sec = Math.floor(bar / 8) % 4, full = tr === MENU ? true : sec !== 0 || bar % 8 >= 4, brk = tr !== MENU && sec === 2 && bar % 8 < 4;
        const tones = [ch[0], ch[0] + (ch[1] ? 3 : 4), ch[0] + 7, ch[0] + 12];
        if (st === 0) this.padChord(tones.slice(0, 3), at, sp * 16, 0.016 * tr.pad);
        if (full && !brk) { if (tr.kick[st]) this.drum(0, at); if (tr.snare[st]) this.drum(1, at); if (tr.hat[st]) this.drum(2, at); }
        const b = tr.bass[st]; if (b != null && !brk) this.note(mtof(ch[0] - 24 + b), at, sp * 1.7, 'sawtooth', 0.085, 700);
        const a = tr.arp[st]; if (a != null) this.note(mtof(tones[a] + 12), at, sp * 1.5, tr.arpWave, tr.arpWave === 'triangle' ? 0.05 : 0.026, 2600, true);
        // מנגינה: מופיעה בחלק מהתיבות, על סולם פנטטוני מעל בסיס השיר
        if (tr === MENU || (sec >= 1 && (Math.floor(bar / 2) % 2 === 0 || sec === 3))) for (const l of tr.lead) if (l[0] === s % 32) this.note(mtof(tr.key + 12 + PENTA[l[1]]), at, sp * l[2], tr.leadWave, tr.leadWave === 'sine' ? 0.06 : 0.03, 3200, true);
        this.nextNote += sp; this.step++;
      }
    },
  };
})();
