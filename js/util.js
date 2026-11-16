/* חוף ניאון – כלי עזר משותפים. כל הקבצים נטענים כסקריפטים רגילים וחולקים את window.NC */
'use strict';
window.NC = {};
(() => {
  const NC = window.NC;
  NC.TAU = Math.PI * 2;
  NC.$ = (id) => document.getElementById(id);
  NC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  NC.lerp = (a, b, t) => a + (b - a) * t;
  NC.rand = (a, b) => a + Math.random() * (b - a);
  NC.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  NC.angDiff = (a, b) => {
    let d = (a - b) % NC.TAU;
    if (d > Math.PI) d -= NC.TAU;
    if (d < -Math.PI) d += NC.TAU;
    return d;
  };
  // מחולל אקראי עם זרע קבוע – כדי שהעיר תהיה זהה בכל הפעלה
  NC.rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  NC.hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  NC.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* מצב פרטי */ } },
  };
  NC.shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  NC.hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  NC.rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  NC.smooth = (t) => { t = NC.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  NC.approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
  NC.fmtMoney = (v) => '$' + Math.floor(v).toLocaleString('en-US');
  NC.fmtTime = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
  NC.isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  // הגדרות המשתמש – נשמרות בנפרד מהתקדמות המשחק
  const DEFAULTS = { master: 0.8, music: 0.7, sfx: 0.9, quality: 'auto', difficulty: 'normal', touchMode: 'point', vibrate: true, shake: true, showFps: false };
  NC.settings = Object.assign({}, DEFAULTS, NC.store.get('neonCoast.settings', {}));
  NC.saveSettings = () => NC.store.set('neonCoast.settings', NC.settings);
  NC.DIFF = {
    easy: { name: 'Easy', time: 1.25, dmg: 0.65, cops: 0.8, pay: 0.9 },
    normal: { name: 'Normal', time: 1, dmg: 1, cops: 1, pay: 1 },
    hard: { name: 'Hard', time: 0.85, dmg: 1.35, cops: 1.25, pay: 1.25 },
  };
  NC.diff = () => NC.DIFF[NC.settings.difficulty] || NC.DIFF.normal;
})();
