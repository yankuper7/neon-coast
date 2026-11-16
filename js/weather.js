/* חוף ניאון – מזג אוויר: בהיר, מעונן, גשם, סערה וערפל, עם מעברים חלקים */
'use strict';
(() => {
  const NC = window.NC;
  const { clamp, rand } = NC;
  const TYPES = {
    clear: { rain: 0, cloud: 0.12, fog: 0, wind: 0.25, name: 'Clear', icon: '☀️', dur: [110, 200] },
    cloudy: { rain: 0, cloud: 0.75, fog: 0, wind: 0.45, name: 'Cloudy', icon: '⛅', dur: [70, 130] },
    rain: { rain: 0.55, cloud: 0.92, fog: 0.1, wind: 0.6, name: 'Rain', icon: '🌧️', dur: [60, 110] },
    storm: { rain: 1, cloud: 1, fog: 0.16, wind: 1, name: 'Storm', icon: '⛈️', dur: [40, 75] },
    fog: { rain: 0, cloud: 0.55, fog: 0.85, wind: 0.08, name: 'Fog', icon: '🌫️', dur: [50, 90] },
  };
  // מה בא אחרי מה, עם משקלים
  const NEXT = {
    clear: [['clear', 1.2], ['cloudy', 3.5], ['rain', 0.7], ['fog', 0.5]],
    cloudy: [['clear', 2], ['rain', 3.2], ['storm', 0.5], ['fog', 0.4]],
    rain: [['cloudy', 2.5], ['storm', 1.2], ['rain', 0.8], ['clear', 0.8]],
    storm: [['rain', 3], ['cloudy', 1]],
    fog: [['clear', 2], ['cloudy', 2]],
  };
  const Wx = NC.weather = {
    TYPES, type: 'clear', rain: 0, cloud: 0.12, fog: 0, wind: 0.25, wet: 0, flash: 0, timer: 150, boltT: 6, thunderT: -1, thunderVol: 0, gust: 0,
    reset(save) {
      this.set(save && TYPES[save.type] ? save.type : 'clear', true);
      this.wet = save ? clamp(save.wet || 0, 0, 1) : 0;
      this.timer = save && save.timer > 5 ? save.timer : rand(110, 180);
      this.flash = 0; this.thunderT = -1; this.boltT = rand(4, 9);
    },
    set(type, instant) {
      const t = TYPES[type]; if (!t) return;
      this.type = type; this.timer = rand(t.dur[0], t.dur[1]);
      if (instant) { this.rain = t.rain; this.cloud = t.cloud; this.fog = t.fog; this.wind = t.wind; if (t.rain > 0.3) this.wet = 1; }
    },
    pickNext(clock) {
      const opts = NEXT[this.type]; let tot = 0;
      for (const o of opts) tot += o[1];
      let r = Math.random() * tot, pick = opts[0][0];
      for (const o of opts) { r -= o[1]; if (r <= 0) { pick = o[0]; break; } }
      if (pick === 'fog' && clock > 9 && clock < 19) pick = 'cloudy'; // ערפל רק בלילה ובבוקר
      return pick;
    },
    update(dt, clock, quiet) {
      const t = TYPES[this.type], k = Math.min(1, dt / 9); // מעבר של כמה שניות
      this.rain += (t.rain - this.rain) * k; this.cloud += (t.cloud - this.cloud) * k;
      this.fog += (t.fog - this.fog) * k; this.wind += (t.wind - this.wind) * k;
      if (this.rain < 0.004) this.rain = 0; if (this.fog < 0.004) this.fog = 0;
      // הקרקע נרטבת מהר ומתייבשת לאט
      if (this.rain > 0.08) this.wet = Math.min(1, this.wet + dt * this.rain / 9); else this.wet = Math.max(0, this.wet - dt / 55);
      this.gust = Math.sin(clock * 9.1) * 0.5 + Math.sin(clock * 23.7) * 0.5;
      this.timer -= dt;
      if (this.timer <= 0) this.set(this.pickNext(clock), false);
      // ברקים ורעמים
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
      if (this.type === 'storm' && this.rain > 0.7) {
        this.boltT -= dt;
        if (this.boltT <= 0) { this.boltT = rand(4, 12); this.flash = 1; this.thunderT = rand(0.25, 1.6); this.thunderVol = rand(0.5, 1); }
      }
      if (this.thunderT >= 0) { this.thunderT -= dt; if (this.thunderT < 0 && !quiet) NC.Sound.play('thunder', this.thunderVol); }
    },
    // אחיזת הכביש יורדת כשרטוב
    grip() { return 1 - 0.24 * this.wet; },
    // כמה "קודר" בחוץ (0..1) – מדליק פנסים גם ביום סוער
    gloom() { return clamp(this.cloud * 0.35 + this.rain * 0.4 + this.fog * 0.3 - 0.12, 0, 0.75); },
    info() { return TYPES[this.type]; },
    serialize() { return { type: this.type, wet: +this.wet.toFixed(2), timer: Math.round(this.timer) }; },
  };
})();
