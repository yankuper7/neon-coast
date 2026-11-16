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
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17], MAJOR = [0, 2, 4, 7, 9, 12, 14, 16];
  const _ = null;

  // ---------------- מוזיקת השכונות ----------------
  // לכל שכונה שיר משלה: מקצב, סולם, כלים ואופי אחרים. local: true = פסקול עירוני (מתנגן גם ברגל)
  // שדות נוספים: swing (דחיית הצעדים האי-זוגיים), perc (כלי הקשה נוספים), stab (אקורדים קצרים), scale (סולם המנגינה)
  const DISTRICT = {
    // מגדלי הזכוכית: האוס אלגנטי ונוצץ
    downtown: { name: 'Chrome Skyline', local: true, gain: 0.7, key: 57, bpm: 118, chords: [[57, 1], [53, 0], [60, 0], [55, 0]], kick: X('x...x...x...x...'), snare: X('....x.......x...'), hat: X('..x...x...x...x.'),
      bass: [0, _, 0, 12, _, 0, _, 12, 0, _, 0, 12, _, 0, 7, 12], bassWave: 'sawtooth', arp: [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 2, 1, 3, 2, 3], arpWave: 'sawtooth', stab: X('x..x..x.........'), stabWave: 'square',
      lead: [[0, 4, 3], [3, 5, 3], [6, 7, 4], [12, 5, 2], [14, 4, 2], [16, 3, 6], [24, 4, 2], [26, 5, 2], [28, 3, 4]], leadWave: 'square', pad: 0.4 },
    // רצועת הניאון: דיסקו-פאנק של מועדונים
    strip: { name: 'Neon Nights', local: true, gain: 0.66, key: 52, bpm: 124, chords: [[52, 1], [55, 0], [50, 0], [57, 1]], kick: X('x...x...x...x...'), snare: X('....x.......x..x'), hat: X('x.xxx.xxx.xxx.xx'), perc: [[7, X('....x.......x...'), 0.5]],
      bass: [0, _, 12, _, 0, 12, _, 0, _, 12, 0, _, 10, 12, _, 7], bassWave: 'square', arp: [_, 2, _, 3, _, 2, _, 1, _, 2, _, 3, _, 2, 3, _], arpWave: 'square', stab: X('..x...x...x...x.'), stabWave: 'sawtooth',
      lead: [[0, 2, 2], [2, 4, 2], [4, 5, 4], [10, 4, 2], [12, 2, 4], [16, 5, 2], [18, 6, 2], [20, 7, 4], [26, 5, 2], [28, 4, 4]], leadWave: 'sawtooth', pad: 0.3 },
    // שוק הצבעים: מקצב לטיני עם קלאווה ומרימבה
    market: { name: 'Mercado Sol', local: true, gain: 0.6, key: 60, bpm: 104, scale: MAJOR, chords: [[60, 0], [57, 1], [53, 0], [55, 0]], kick: X('x..x..x.x..x..x.'), snare: X('................'), hat: X('................'),
      perc: [[3, X('x..x..x...x.x...'), 0.9], [4, X('x.x.x.x.x.x.x.x.'), 0.7], [5, X('....x..x......xx'), 0.8]],
      bass: [0, _, _, 7, _, _, 12, _, 0, _, _, 7, _, 12, _, 7], bassWave: 'triangle', arp: [0, _, 2, 1, _, 3, _, 2, 0, _, 2, 1, _, 3, 2, _], arpWave: 'steel',
      lead: [[0, 2, 2], [2, 3, 1], [3, 4, 3], [6, 5, 2], [8, 4, 4], [14, 3, 2], [16, 2, 2], [18, 4, 1], [19, 5, 3], [22, 6, 2], [24, 5, 6]], leadWave: 'steel', pad: 0.25 },
    // גבעות הדקלים: לואו-פיי רגוע ליד הבריכה
    palms: { name: 'Poolside', local: true, gain: 0.66, key: 53, bpm: 84, scale: MAJOR, swing: 0.2, chords: [[53, 0], [50, 1], [58, 0], [60, 0]], kick: X('x.....x...x.....'), snare: X('....x.......x...'), hat: X('x.x.x.x.x.x.x.x.'),
      bass: [0, _, _, _, _, _, 0, _, 7, _, _, _, 5, _, 7, _], bassWave: 'sine', arp: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], arpWave: 'ep', stab: X('x.....x.....x...'), stabWave: 'ep', stabLen: 5,
      lead: [[4, 4, 3], [8, 3, 2], [10, 2, 6], [20, 5, 3], [24, 4, 2], [26, 2, 5]], leadWave: 'ep', pad: 0.35 },
    // הנמל הישן: בלוז תעשייתי כבד
    port: { name: 'Rust and Tide', local: true, gain: 0.8, key: 50, bpm: 92, chords: [[50, 1], [50, 1], [46, 0], [45, 0]], kick: X('x.....x.x.......'), snare: X('....x.......x...'), hat: X('..x...x...x...x.'), perc: [[6, X('x.........x..x..'), 0.8]],
      bass: [0, _, 0, _, _, 0, _, 3, 0, _, 0, _, 7, _, 5, 3], bassWave: 'square', arp: [_, _, 2, _, _, _, 1, _, _, _, 2, _, _, _, _, 3], arpWave: 'triangle',
      lead: [[0, 0, 6], [8, 2, 2], [10, 1, 6], [16, 2, 4], [20, 3, 2], [22, 2, 2], [24, 0, 8]], leadWave: 'sawtooth', leadOct: 0, pad: 0.5 },
    // פארק הפלמינגו: תיבת נגינה עדינה
    park: { name: 'Flamingo Garden', local: true, gain: 1.5, key: 55, bpm: 96, scale: MAJOR, chords: [[55, 0], [52, 1], [60, 0], [62, 0]], kick: X('................'), snare: X('................'), hat: X('................'), perc: [[4, X('..x...x...x...x.'), 0.5]],
      bass: [0, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _], bassWave: 'sine', arp: [0, _, 2, _, 3, _, 2, _, 1, _, 2, _, 3, _, 2, _], arpWave: 'bell',
      lead: [[0, 4, 4], [4, 5, 2], [6, 4, 2], [8, 2, 6], [16, 3, 4], [20, 4, 2], [22, 5, 2], [24, 7, 6]], leadWave: 'bell', pad: 0.45 },
    // חוף השקיעה: רגאיי טרופי עם תופי פלדה
    beach: { name: 'Sunset Sway', local: true, gain: 0.95, key: 57, bpm: 88, scale: MAJOR, swing: 0.16, chords: [[57, 0], [62, 0], [57, 0], [64, 0]], kick: X('........x.......'), snare: X('................'), hat: X('x.x.x.x.x.x.x.x.'), perc: [[7, X('........x.......'), 0.7], [4, X('..x...x...x...x.'), 0.4]],
      bass: [0, _, _, 0, _, _, 7, _, _, _, 0, _, 4, _, 7, _], bassWave: 'sine', arp: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], arpWave: 'steel', stab: X('..x...x...x...x.'), stabWave: 'triangle', stabLen: 1.4,
      lead: [[0, 4, 2], [2, 5, 2], [4, 4, 4], [10, 2, 2], [12, 3, 4], [16, 4, 2], [18, 5, 2], [20, 7, 4], [26, 5, 2], [28, 4, 4]], leadWave: 'steel', pad: 0.3 },
    // הביצות: אמביינט מסתורי ואיטי
    glade: { name: 'Glade Mist', local: true, gain: 1.0, key: 52, bpm: 72, chords: [[52, 1], [48, 0], [45, 1], [47, 1]], kick: X('................'), snare: X('................'), hat: X('................'), perc: [[8, X('x.........x.....'), 0.7]],
      bass: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], bassWave: 'sine', arp: [0, _, _, _, 2, _, _, _, 3, _, _, _, 1, _, _, _], arpWave: 'bell',
      lead: [[0, 2, 8], [12, 3, 4], [16, 4, 10], [28, 2, 4]], leadWave: 'sine', pad: 0.95 },
  };
  DISTRICT.sea = DISTRICT.beach;
  // נעימת הסיום: חגיגית, בסולם מז'ורי
  const ENDING = { name: 'ending', key: 60, bpm: 100, scale: MAJOR, always: true, chords: [[60, 0], [55, 0], [57, 1], [53, 0]], kick: X('x...x...x...x...'), snare: X('....x.......x...'), hat: X('..x...x...x...x.'), perc: [[4, X('x.x.x.x.x.x.x.x.'), 0.4]],
    bass: [0, _, _, 0, _, _, 7, _, 0, _, _, 0, _, 12, 7, _], bassWave: 'sawtooth', arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2], arpWave: 'bell',
    lead: [[0, 2, 4], [4, 3, 2], [6, 4, 2], [8, 5, 6], [16, 4, 2], [18, 5, 2], [20, 7, 4], [24, 5, 2], [26, 4, 2], [28, 2, 4]], leadWave: 'steel', pad: 0.6 };
  const RADIO = ['local', 1, 2, 3, 4, 'off'];
  const loadRadio = () => { const r = NC.store.get('neonCoast.radio', null); if (RADIO.includes(r)) return r; return NC.store.get('neonCoast.station', 1) === 0 ? 'off' : 'local'; };

  // צלילי ממשק נשמעים גם בתפריט הראשי; GAPS = מרווח מינימלי (באלפיות שנייה) בין שתי השמעות של אותו צליל
  const UI_SOUNDS = { click: 1, back: 1, hover: 1, toggle: 1, start: 1, deny: 1, erase: 1, pauseIn: 1, pauseOut: 1, accept: 1, decline: 1, brief: 1, radio: 1, fanfare: 1, firework: 1, toast: 1 };
  const GAPS = { crash: 110, thud: 150, honk: 400, horn: 250, step: 180, stepSoft: 180, wade: 220, spark: 80, tick: 200, click: 40, thunder: 800, hover: 45, toast: 160, toastGood: 160, toastWarn: 160, objective: 300,
    crackle: 70, yelp: 450, bump: 140, rustle: 260, dispatch: 2600, warn: 900, brake: 800, gear: 230, hideTick: 900, lowhp: 1000, alarm: 600, beep: 650, handbrake: 320, whistle: 1600, hurt: 260, zone: 2000, deny: 250, firework: 120 };
  const S = NC.Sound = {
    ctx: null, master: null, sfx: null, mus: null, amb: null, rev: null, musFilter: null, radioGain: null, noiseBuf: null,
    muted: !!NC.store.get('neonCoast.muted', false), quiet: false, last: {},
    radioSel: loadRadio(), DISTRICT, zone: 'palms', zoneT: 0,
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
    // צליל רקע עדין (הודעה, יעד חדש): מושמע רק אם לא נשמע צליל אחר ממש עכשיו, כדי לא להעמיס
    soft(name) { if (!this.lastAny || performance.now() - this.lastAny > 170) this.play(name); },
    // אפקט חד-פעמי. x (אופציונלי) – מיקום בעולם, בשביל ימין/שמאל
    play(name, vol = 1, x = null) {
      const c = this.ctx;
      if (!c || this.muted || c.state !== 'running') return;
      if (this.quiet && !UI_SOUNDS[name]) return; // בתפריט הראשי נשמעים רק צלילי הממשק
      const now = performance.now(), gap = GAPS[name] || 0;
      if (gap && this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now; this.lastAny = now;
      let D = this.sfx;
      if (x != null && c.createStereoPanner && NC.cam) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (x - NC.cam.x) / 650)); p.connect(this.sfx); D = p; }
      const seq = (notes, st, type, v, len, d0 = 0) => notes.forEach((f, i) => this.tone(f, len, type, v, null, d0 + i * st, D));
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
        // --- הליכה על משטחים אחרים ---
        case 'stepSoft': this.noise(0.07, 0.045 * vol, 2600 + Math.random() * 800, 0, 'highpass'); this.noise(0.04, 0.03 * vol, 400, 0, 'lowpass'); break;
        case 'wade': this.noise(0.16, 0.08 * vol, 1100 + Math.random() * 400, 0, 'lowpass'); this.noise(0.08, 0.03 * vol, 4500, 0.03, 'highpass'); break;
        // --- ממשק ---
        case 'back': this.tone(520, 0.06, 'square', 0.03, 360); break;
        case 'hover': this.tone(1250, 0.02, 'sine', 0.022); break;
        case 'toggle': this.tone(660, 0.04, 'square', 0.03); this.tone(990, 0.05, 'square', 0.03, null, 0.045); break;
        case 'pauseIn': seq([784, 523], 0.07, 'triangle', 0.07, 0.13); break;
        case 'pauseOut': seq([523, 784], 0.07, 'triangle', 0.07, 0.13); break;
        case 'start': seq([392, 523, 659, 784, 1046], 0.07, 'triangle', 0.09, 0.22); this.tone(196, 0.5, 'sawtooth', 0.04); break;
        case 'deny': this.tone(150, 0.09, 'square', 0.06); this.tone(120, 0.13, 'square', 0.06, null, 0.1); break;
        case 'erase': this.noise(0.4, 0.1, 2400, 0, 'bandpass', null, 1); this.tone(300, 0.4, 'sawtooth', 0.04, 60); break;
        case 'toast': this.tone(988, 0.07, 'sine', 0.04); break;
        case 'toastGood': seq([784, 1175], 0.07, 'sine', 0.05, 0.13); break;
        case 'toastWarn': seq([494, 392], 0.09, 'triangle', 0.06, 0.15); break;
        case 'objective': seq([880, 1318], 0.06, 'sine', 0.04, 0.11); break;
        case 'accept': seq([523, 659, 784], 0.06, 'square', 0.04, 0.12); this.tone(1046, 0.28, 'triangle', 0.07, null, 0.18); break;
        case 'decline': seq([440, 330], 0.08, 'triangle', 0.05, 0.15); break;
        case 'zone': this.tone(659, 0.5, 'sine', 0.03); this.tone(988, 0.7, 'sine', 0.026, null, 0.12); break;
        // --- רכב ---
        case 'ignite': this.noise(0.24, 0.1, 700, 0, 'lowpass'); this.tone(46, 0.12, 'square', 0.05); this.tone(55, 0.38, 'sawtooth', 0.08, 125, 0.06); break;
        case 'engineOff': this.tone(110, 0.32, 'sawtooth', 0.05, 38); this.noise(0.1, 0.04, 500, 0.22); break;
        case 'handbrake': for (let i = 0; i < 3; i++) this.noise(0.02, 0.1, 2600, i * 0.035, 'bandpass', null, 3); break;
        case 'brake': this.noise(0.24, 0.05 * vol, 2700, 0, 'bandpass', null, 6); break;
        case 'beep': this.tone(1150, 0.18, 'square', 0.022); break;
        case 'gear': this.noise(0.03, 0.045, 1400, 0, 'bandpass', null, 2); this.tone(210, 0.03, 'square', 0.018); break;
        case 'lowhp': this.tone(880, 0.09, 'square', 0.03); this.tone(880, 0.09, 'square', 0.03, null, 0.16); break;
        case 'alarm': seq([1175, 880, 1175, 880], 0.09, 'square', 0.045, 0.08); break;
        case 'crackle': this.noise(0.03 + Math.random() * 0.04, 0.09 * vol, 2500 + Math.random() * 3000, 0, 'bandpass', D, 1.5); break;
        case 'bump': this.noise(0.07, 0.12 * vol, 380, 0, 'lowpass', D); this.tone(90, 0.06, 'sine', 0.08 * vol, 60, 0, D); break;
        case 'rustle': this.noise(0.3, 0.08 * vol, 3800, 0, 'highpass', D); this.noise(0.1, 0.1 * vol, 500, 0, 'lowpass', D); break;
        case 'repair': for (let i = 0; i < 5; i++) this.noise(0.025, 0.09, 3000, i * 0.07, 'bandpass', null, 5); this.tone(392, 0.12, 'triangle', 0.06, 784, 0.4); break;
        // --- אנשים ---
        case 'yelp': { const f = 620 + Math.random() * 380; this.tone(f, 0.11, 'triangle', 0.05 * vol, f * 1.55, 0, D); this.tone(f * 1.5, 0.16, 'triangle', 0.045 * vol, f * 0.8, 0.1, D); break; }
        case 'hurt': this.tone(220, 0.16, 'sawtooth', 0.09, 110); this.noise(0.1, 0.12, 600); break;
        case 'heal': seq([523, 659, 784, 1046, 1318], 0.07, 'sine', 0.08, 0.24); break;
        case 'pay': seq([1568, 1318, 1046], 0.06, 'square', 0.03, 0.09); break;
        case 'passenger': this.tone(1318, 0.09, 'sine', 0.06, null, 0.14); this.tone(1760, 0.15, 'sine', 0.06, null, 0.24); break;
        // --- משטרה ---
        case 'dispatch': this.noise(0.12, 0.045, 2600, 0, 'bandpass', null, 1.2); this.tone(1480, 0.05, 'square', 0.02, null, 0.12); this.tone(1180, 0.05, 'square', 0.02, null, 0.19); this.noise(0.08, 0.035, 2600, 0.26, 'bandpass', null, 1.2); break;
        case 'whistle': for (let i = 0; i < 6; i++) this.tone(2350 + (i % 2) * 180, 0.045, 'sine', 0.04 * vol, null, i * 0.045, D); break;
        case 'busted': this.noise(0.03, 0.14, 3200, 0, 'bandpass', null, 4); this.noise(0.03, 0.14, 3600, 0.12, 'bandpass', null, 4); seq([330, 262, 196], 0.22, 'sawtooth', 0.07, 0.4, 0.3); this.tone(98, 1.1, 'sine', 0.15, 60, 0.3); break;
        case 'hideTick': this.tone(196, 0.06, 'sine', 0.05); this.tone(98, 0.08, 'sine', 0.05, null, 0.02); break;
        case 'warn': this.tone(740, 0.09, 'square', 0.045); this.tone(554, 0.12, 'square', 0.045, null, 0.11); break;
        // --- משימות ---
        case 'flamingo': seq([1046, 1318, 1568, 2093, 1568, 2093, 2637], 0.055, 'sine', 0.075, 0.16); this.tone(523, 0.5, 'triangle', 0.05); break;
        case 'wreck': this.tone(196, 0.3, 'sawtooth', 0.08, 82); seq([659, 988], 0.08, 'triangle', 0.1, 0.16, 0.1); break;
        case 'retry': this.tone(260, 0.35, 'sine', 0.06, 1300); this.noise(0.35, 0.07, 1800, 0, 'bandpass', null, 0.8); break;
        case 'bonus': seq([1318, 1760, 2093, 2637], 0.055, 'square', 0.032, 0.1, 0.9); break;
        case 'newjob': seq([880, 1108, 1318], 0.08, 'triangle', 0.065, 0.16); break;
        case 'medal': seq([784, 988, 1175, 1568], 0.09, 'triangle', 0.1, 0.3); this.tone(392, 0.6, 'sawtooth', 0.04); break;
        case 'fanfare': seq([523, 523, 523, 659, 784, 659, 784, 1046], 0.16, 'triangle', 0.13, 0.36); seq([262, 330, 392, 523], 0.32, 'sawtooth', 0.05, 0.5); seq([1046, 1318, 1568, 2093], 0.12, 'sine', 0.06, 0.6, 1.3); break;
        case 'firework': this.tone(500 + Math.random() * 300, 0.45, 'sine', 0.025 * vol, 1700 + Math.random() * 500); this.noise(0.6, 0.22 * vol, 1800 + Math.random() * 1500, 0.45, 'bandpass', D, 0.6); this.tone(90, 0.3, 'sine', 0.12 * vol, 45, 0.45, D); for (let i = 0; i < 6; i++) this.noise(0.03, 0.06 * vol, 5000, 0.6 + Math.random() * 0.6, 'highpass', D); break;
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
      if (gear !== this.gear && inCar && k > 0.12) this.play('gear');
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
      const G = NC.G, M = NC.map, Wx = NC.weather, P = G.player;
      // פסקול לפי שכונה: מחליפים רק אחרי שנייה וחצי בשכונה החדשה, כדי שלא יקפוץ על הגבול
      if (this.mode === 'game') {
        const zd = M.districtAt(P.x, P.y), z = zd === 'sea' ? 'beach' : zd;
        if (z !== this.zone && DISTRICT[z]) { if (this.zoneWant !== z) { this.zoneWant = z; this.zoneT = 0; } this.zoneT += dt; if (this.zoneT > 1.5) this.zone = z; } else this.zoneWant = this.zone;
      }
      this.tickMusic();
      const t = c.currentTime, live = this.mode === 'game' && !this.quiet;
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
    // R מחליף בין: פסקול העיר (שיר אחר לכל שכונה, גם ברגל), ארבע תחנות רדיו (ברכב) ושקט
    radioName() { const r = this.radioSel; return r === 'off' ? 'Music off' : r === 'local' ? 'City Sound · ' + this.zoneTrack().name : TRACKS[r].name + (this.inCar ? '' : ' (in the car)'); },
    nextStation() { this.radioSel = RADIO[(RADIO.indexOf(this.radioSel) + 1) % RADIO.length]; NC.store.set('neonCoast.radio', this.radioSel); this.play('radio'); return this.radioName(); },
    zoneTrack() { return DISTRICT[this.zone] || DISTRICT.palms; },
    // השיר שאמור להתנגן עכשיו במשחק (null = שקט)
    gameTrack() { const r = this.radioSel; if (r === 'off') return null; if (r !== 'local' && this.inCar) return TRACKS[r]; return this.zoneTrack(); },
    setZone(d, instant) { if (DISTRICT[d]) { this.zone = d === 'sea' ? 'beach' : d; this.zoneT = 0; if (instant) this.zoneWant = this.zone; } },
    radio(on) { this.inCar = on; },
    music(mode) {
      this.mode = mode;
      if (!this.ctx) return; const t = this.ctx.currentTime;
      this.musFilter.frequency.setTargetAtTime(mode === 'pause' ? 500 : 18000, t, 0.15);
    },
    note(f, t, dur, type, vol, cut, rev) { // תו עם מעטפת ומסנן נסגר. סוגים מיוחדים: bell (פעמון), steel (תוף פלדה / מרימבה), ep (פסנתר חשמלי)
      const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter();
      let parts;
      if (type === 'bell') { parts = [['sine', 1, 1], ['sine', 2.76, 0.35], ['sine', 5.4, 0.12]]; dur *= 1.8; vol *= 1.5; cut = 9000; }
      else if (type === 'steel') { parts = [['sine', 1, 1], ['triangle', 2, 0.5], ['sine', 3.01, 0.18]]; vol *= 1.5; cut = 6000; }
      else if (type === 'ep') { parts = [['sine', 1, 1], ['triangle', 1.003, 0.6], ['sine', 4, 0.12]]; dur *= 1.5; vol *= 1.6; cut = 4200; }
      else parts = [[type, 1, 1]];
      fl.type = 'lowpass'; fl.Q.value = parts.length > 1 ? 0.5 : 2; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      fl.connect(g); g.connect(this.radioGain); if (rev) g.connect(this.revMus);
      for (const [w, mul, lv] of parts) {
        const o = c.createOscillator(); o.type = w; o.frequency.setValueAtTime(f * mul, t);
        if (lv === 1) o.connect(fl); else { const pg = c.createGain(); pg.gain.value = lv; o.connect(pg); pg.connect(fl); }
        o.start(t); o.stop(t + dur + 0.05);
      }
    },
    padChord(notes, t, dur, vol) {
      const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 1100; fl.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.25); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.08);
      fl.connect(g); g.connect(this.radioGain); g.connect(this.revMus);
      for (const n of notes) for (const det of [-6, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur * 1.1); }
    },
    // תופים וכלי הקשה: 0 בס, 1 סנר, 2 היי-האט, 3 קלאווה, 4 שייקר, 5 קונגה, 6 מתכת, 7 מחיאת כף, 8 טם עמוק
    drum(kind, t, vol = 1) {
      const c = this.ctx, g = c.createGain(); g.connect(this.radioGain);
      const sweep = (f0, f1, len, v, type) => { const o = c.createOscillator(); if (type) o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.65); g.gain.setValueAtTime(v * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g); o.start(t); o.stop(t + len + 0.02); };
      if (kind === 0) { sweep(150, 42, 0.2, 0.5); return; }
      if (kind === 3) { sweep(2300, 2100, 0.05, 0.16, 'triangle'); return; }
      if (kind === 5) { sweep(260, 170, 0.16, 0.22); return; }
      if (kind === 8) { sweep(95, 55, 0.5, 0.4); g.connect(this.revMus); return; }
      const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.noiseBuf;
      let len = 0.2;
      if (kind === 1) { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; g.gain.setValueAtTime(0.26 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); g.connect(this.revMus); const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); og.gain.setValueAtTime(0.14 * vol, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og); og.connect(this.radioGain); o.start(t); o.stop(t + 0.12); }
      else if (kind === 4) { f.type = 'highpass'; f.frequency.value = 5200; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); }
      else if (kind === 6) { f.type = 'bandpass'; f.frequency.value = 3100; f.Q.value = 14; g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); g.connect(this.revMus); len = 0.35; }
      else if (kind === 7) { f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.4; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.004); g.gain.setValueAtTime(0.08 * vol, t + 0.012); g.gain.linearRampToValueAtTime(0.2 * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); g.connect(this.revMus); }
      else { f.type = 'highpass'; f.frequency.value = 7500; g.gain.setValueAtTime(0.06 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); }
      s.connect(f); f.connect(g); s.start(t, Math.random()); s.stop(t + len);
    },
    // מתזמן: מקדים בכרבע שנייה את התווים הבאים
    tickMusic() {
      const c = this.ctx; if (!c || c.state !== 'running') return;
      const want = this.mode === 'menu' ? MENU : this.mode === 'ending' ? ENDING : this.gameTrack();
      const t = c.currentTime;
      if (want !== this.track) {
        // מעבר בין שירים: דעיכה קצרה, ואז השיר החדש נכנס בהדרגה
        if (this.track && this.radioGain.gain.value > 0.02 && !this.fading) { this.fading = true; this.radioGain.gain.cancelScheduledValues(t); this.radioGain.gain.setTargetAtTime(0, t, want && want.local ? 0.16 : 0.08); this.fadeAt = t + (want && want.local ? 0.6 : 0.3); return; }
        if (this.fading && t < this.fadeAt) return;
        this.fading = false; this.track = want; this.step = 0; this.nextNote = t + 0.08;
        this.radioGain.gain.cancelScheduledValues(t);
      }
      const tr = this.track;
      if (!tr || this.muted || ST.music <= 0.001) { if (!tr) this.radioGain.gain.setTargetAtTime(0, t, 0.1); this.nextNote = t + 0.05; return; }
      // פסקול השכונה שקט יותר ברגל – רקע ולא רדיו
      if (!this.fading) this.radioGain.gain.setTargetAtTime(tr.local ? (this.inCar ? 0.85 : 0.62) * (tr.gain || 1) : 1, t, 0.3);
      if (this.nextNote < t - 0.3) this.nextNote = t + 0.05; // חזרנו מהשהיה – לא "רודפים" אחרי תווים שעבר זמנם
      const sp = 60 / tr.bpm / 4, simple = tr === MENU || tr.local || tr.always;
      const chase = tr.local && NC.G && NC.G.wanted > 0 && this.mode === 'game'; // במרדף מצטרף מקצב דוחק
      while (this.nextNote < t + 0.25) {
        const s = this.step, st = s % 16, bar = Math.floor(s / 16), ch = tr.chords[bar % tr.chords.length];
        const at = this.nextNote + (tr.swing && (st & 1) ? sp * tr.swing : 0);
        const sec = Math.floor(bar / 8) % 4, full = simple ? true : sec !== 0 || bar % 8 >= 4, brk = !simple && sec === 2 && bar % 8 < 4;
        const tones = [ch[0], ch[0] + (ch[1] ? 3 : 4), ch[0] + 7, ch[0] + 12];
        if (st === 0) this.padChord(tones.slice(0, 3), at, sp * 16, 0.016 * tr.pad);
        if (full && !brk) { if (tr.kick[st]) this.drum(0, at); if (tr.snare[st]) this.drum(1, at); if (tr.hat[st]) this.drum(2, at); if (tr.perc) for (const pc of tr.perc) if (pc[1][st]) this.drum(pc[0], at, pc[2]); }
        if (chase) { if (st % 4 === 0 && !tr.kick[st]) this.drum(0, at, 0.8); if (st % 2 === 0) this.drum(2, at, 1.3); if (st % 8 === 4 && !tr.snare[st]) this.drum(7, at, 0.6); }
        const b = tr.bass[st]; if (b != null && !brk) { const bw = tr.bassWave || 'sawtooth'; this.note(mtof(ch[0] - 24 + b), at, sp * (bw === 'sine' ? 3 : 1.7), bw, bw === 'sine' ? 0.16 : bw === 'triangle' ? 0.13 : 0.085, 700); }
        const a = tr.arp[st]; if (a != null) { const w = tr.arpWave; this.note(mtof(tones[a] + 12), at, sp * 1.5, w, w === 'triangle' ? 0.05 : w === 'bell' || w === 'steel' || w === 'ep' ? 0.034 : 0.026, 2600, true); }
        if (tr.stab && tr.stab[st]) for (const n of tones.slice(0, 3)) this.note(mtof(n + 12), at, sp * (tr.stabLen || 1.1), tr.stabWave || 'square', tr.stabWave === 'ep' ? 0.03 : tr.stabWave === 'triangle' ? 0.04 : 0.014, 2200, true);
        // מנגינה: מופיעה בחלק מהתיבות, על הסולם של השיר
        const melody = tr === MENU || tr.always ? true : tr.local ? bar % 8 >= 2 && bar % 8 !== 5 : sec >= 1 && (Math.floor(bar / 2) % 2 === 0 || sec === 3);
        if (melody) { const sc = tr.scale || PENTA; for (const l of tr.lead) if (l[0] === s % 32) this.note(mtof(tr.key + (tr.leadOct != null ? tr.leadOct : 12) + sc[l[1]]), at, sp * l[2], tr.leadWave, tr.leadWave === 'sine' ? 0.06 : tr.leadWave === 'square' || tr.leadWave === 'sawtooth' ? 0.03 : 0.042, 3200, true); }
        this.nextNote += sp; this.step++;
      }
    },
  };
})();
