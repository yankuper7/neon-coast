/* חוף ניאון – צלילים מסונתזים: מנוע, סירנה, התנגשויות ורדיו. בלי קובצי שמע */
'use strict';
(() => {
  const NC = window.NC;
  const S = NC.Sound = {
    ctx: null, master: null, noiseBuf: null, muted: !!NC.store.get('neonCoast.muted', false),
    eng: null, engGain: null, engFilter: null, scr: null, scrGain: null, sir: null, sirGain: null,
    last: {}, station: NC.store.get('neonCoast.station', 1), nextNote: 0, step: 0, radioOn: false,
    STATIONS: ['Radio off', 'Neon Wave 98.6', 'Coast FM', 'City Nights 101'],
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(c.destination);
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // מנוע
        this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 50;
        this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400;
        this.engGain = c.createGain(); this.engGain.gain.value = 0;
        this.eng.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master); this.eng.start();
        // חריקת צמיגים
        this.scr = c.createBufferSource(); this.scr.buffer = this.noiseBuf; this.scr.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 3;
        this.scrGain = c.createGain(); this.scrGain.gain.value = 0;
        this.scr.connect(bp); bp.connect(this.scrGain); this.scrGain.connect(this.master); this.scr.start();
        // סירנה
        this.sir = c.createOscillator(); this.sir.type = 'square'; this.sir.frequency.value = 700;
        const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1600;
        this.sirGain = c.createGain(); this.sirGain.gain.value = 0;
        this.sir.connect(sf); sf.connect(this.sirGain); this.sirGain.connect(this.master); this.sir.start();
      } catch (e) { this.ctx = null; }
    },
    setMuted(m) {
      this.muted = m; NC.store.set('neonCoast.muted', m);
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.03);
    },
    tone(f, dur, type = 'square', vol = 0.1, slide = null, delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, freq = 1200, delay = 0, type = 'lowpass') {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.03);
    },
    play(name, vol = 1) {
      if (!this.ctx || this.muted) return;
      const now = performance.now(), gap = { crash: 110, thud: 150, honk: 400, step: 200, spark: 80 }[name] || 0;
      if (gap && this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      const seq = (notes, st, type, v, len) => notes.forEach((f, i) => this.tone(f, len, type, v, null, i * st));
      switch (name) {
        case 'crash': this.noise(0.25, 0.3 * vol, 900); this.tone(90, 0.18, 'square', 0.12 * vol, 50); break;
        case 'thud': this.noise(0.12, 0.2 * vol, 500); this.tone(140, 0.1, 'sine', 0.15 * vol, 70); break;
        case 'door': this.noise(0.07, 0.15, 700); this.tone(180, 0.06, 'square', 0.06, 120); break;
        case 'honk': this.tone(392, 0.28, 'square', 0.07 * vol); this.tone(494, 0.28, 'square', 0.06 * vol); break;
        case 'boom': this.noise(0.9, 0.5, 420); this.tone(80, 0.6, 'sawtooth', 0.2, 30); break;
        case 'pickup': seq([784, 1046, 1568], 0.06, 'sine', 0.1, 0.14); break;
        case 'cash': seq([1318, 1760], 0.07, 'square', 0.05, 0.1); break;
        case 'star': this.tone(880, 0.12, 'square', 0.07); this.tone(660, 0.18, 'square', 0.07, null, 0.1); break;
        case 'clear': seq([523, 659, 784], 0.09, 'triangle', 0.1, 0.16); break;
        case 'check': this.tone(988, 0.08, 'triangle', 0.12); this.tone(1318, 0.14, 'triangle', 0.12, null, 0.07); break;
        case 'pass': seq([392, 494, 587, 784, 587, 784, 988], 0.13, 'triangle', 0.13, 0.26); seq([196, 196, 294, 392], 0.26, 'sawtooth', 0.05, 0.3); break;
        case 'fail': seq([392, 349, 294, 220], 0.2, 'sawtooth', 0.08, 0.32); break;
        case 'wasted': seq([220, 196, 165, 110], 0.3, 'sawtooth', 0.1, 0.5); break;
        case 'click': this.tone(640, 0.04, 'square', 0.04); break;
        case 'radio': this.noise(0.15, 0.06, 3000, 0, 'highpass'); break;
        case 'spray': this.noise(0.7, 0.12, 5000, 0, 'highpass'); break;
        case 'splash': this.noise(0.6, 0.3, 1400); break;
      }
    },
    // מתעדכן בכל פריים: מנוע, חריקה וסירנה
    drive(inCar, speed, maxSpeed, slip, copDist, wanted) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime;
      const k = inCar ? Math.min(1.2, Math.abs(speed) / maxSpeed) : 0;
      this.eng.frequency.setTargetAtTime(48 + k * 150, t, 0.06);
      this.engFilter.frequency.setTargetAtTime(300 + k * 1300, t, 0.08);
      this.engGain.gain.setTargetAtTime(inCar ? 0.035 + k * 0.05 : 0, t, 0.1);
      this.scrGain.gain.setTargetAtTime(inCar && slip > 120 ? Math.min(0.12, (slip - 120) / 1500) : 0, t, 0.05);
      const sv = wanted > 0 && copDist < 900 ? 0.05 * (1 - copDist / 900) + 0.008 : 0;
      this.sirGain.gain.setTargetAtTime(sv, t, 0.1);
      this.sir.frequency.setTargetAtTime((t * 1.6) % 1 < 0.5 ? 760 : 580, t, 0.03);
    },
    silence() { if (!this.ctx) return; const t = this.ctx.currentTime; this.engGain.gain.setTargetAtTime(0, t, 0.05); this.scrGain.gain.setTargetAtTime(0, t, 0.05); this.sirGain.gain.setTargetAtTime(0, t, 0.05); },
    nextStation() { this.station = (this.station + 1) % this.STATIONS.length; NC.store.set('neonCoast.station', this.station); this.play('radio'); return this.STATIONS[this.station]; },
    // רדיו: שלוש "תחנות" סינת'ווייב קצרות
    radio(on) {
      if (!this.ctx || this.muted || !on || !this.station || this.ctx.state !== 'running') return;
      const c = this.ctx, st = this.station;
      const tempo = [0, 0.15, 0.2, 0.17][st];
      if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.05;
      const prog = [null, [110, 110, 87.3, 98], [130.8, 98, 110, 87.3], [82.4, 98, 73.4, 110]][st];
      const arp = [null, [1, 1.5, 2, 3, 2, 1.5, 2, 3], [1, 1.25, 1.5, 2, 1.5, 1.25, 2, 2.5], [1, 1.2, 1.5, 1.8, 2, 1.8, 1.5, 1.2]][st];
      while (this.nextNote < c.currentTime + 0.25) {
        const d = this.nextNote - c.currentTime, s = this.step, root = prog[(s >> 4) % 4];
        if (s % 2 === 0) this.tone(root, tempo * 1.8, 'sawtooth', 0.045, null, d);
        this.tone(root * 2 * arp[s % 8], tempo * 0.9, st === 2 ? 'triangle' : 'square', 0.02, null, d);
        if (s % 4 === 0) this.tone(120, 0.12, 'sine', 0.12, 40, d);
        if (s % 8 === 4) this.noise(0.1, 0.07, 2500, d, 'highpass');
        if (s % 2 === 1) this.noise(0.03, 0.025, 7000, d, 'highpass');
        if (s % 16 === 0 || s % 16 === 6) this.tone(root * 4, tempo * 3, 'sine', 0.03, null, d);
        this.nextNote += tempo; this.step++;
      }
    },
  };
})();
