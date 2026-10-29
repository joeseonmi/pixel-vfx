// batch C: gradients, patterns, noises (gen). See nodes/API.md
(() => {
// Local helpers: md, fr, raster, fld, gn (tileable gradient noise), fbm, cell (tileable animated voronoi), hexc, D (node factory).
// Loop rule: scroll = whole periods (sx * per * t) and noise period = scale cells; phases are integer cycles of 2*PI*t.
const md = (a, P) => ((a % P) + P) % P, fr = x => x - Math.floor(x);
function raster(c, fn) { // fn(x,y) -> [r,g,b]
  const { W, H } = S, id = c.createImageData(W, H), d = id.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = fn(x, y), i = (y * W + x) * 4; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255; }
  c.putImageData(id, 0, 0);
}
function fld(c, p, t, per, fn) { // fn(u,v) -> 0..1 colorized A->B; u,v in cells (scale across canvas)
  const { W, H } = S, a = hex(p.ca), b = hex(p.cb), lut = Array.from({ length: 256 }, (_, i) => lerpC(a, b, i / 255));
  const sx = (p.sx || 0) * per * t, sy = (p.sy || 0) * per * t, q = p.lv > 1 ? p.lv - 1 : 0;
  raster(c, (x, y) => { let v = clamp(fn((x + 0.5) / W * p.scale + sx, (y + 0.5) / H * p.scale + sy)); if (q) v = Math.round(v * q) / q; return lut[Math.round(v * 255)]; });
}
function gn(u, v, P, s, r = 0, Q = P) { // tileable gradient (perlin) noise, period P in x, Q in y; r = gradient rotation (flow)
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
  const g = (i, j, dx, dy) => { const a = hash(md(i, P), md(j, Q), s) * 6.2832 + r; return Math.cos(a) * dx + Math.sin(a) * dy; };
  const q = f => f * f * f * (f * (f * 6 - 15) + 10), sx = q(fx), sy = q(fy);
  return lerp(lerp(g(x0, y0, fx, fy), g(x0 + 1, y0, fx - 1, fy), sx), lerp(g(x0, y0 + 1, fx, fy - 1), g(x0 + 1, y0 + 1, fx - 1, fy - 1), sx), sy) * 1.3 + 0.5;
}
function fbm(g, u, v, P, s, o, r) {
  let a = 0, w = 1, T = 0;
  for (let i = 0; i < o; i++) { const m = 1 << i; a += w * g(u * m, v * m, P * m, s + i, r); T += w; w /= 2; }
  return a / T;
}
function cell(u, v, P, s, ph = 0) { // tileable voronoi -> [F1, F2, id of nearest]; ph = integer cycles of point orbit
  const x0 = Math.floor(u), y0 = Math.floor(v); let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = x0 + i, cy = y0 + j, wx = md(cx, P), wy = md(cy, P), a = (hash(wx, wy, s) + ph) * 6.2832, r = 0.45 * hash(wx, wy, s + 77);
    const d = Math.hypot(cx + 0.5 + r * Math.cos(a) - u, cy + 0.5 + r * Math.sin(a) - v);
    if (d < f1) { f2 = f1; f1 = d; id = hash(wx, wy, s + 5); } else if (d < f2) f2 = d;
  }
  return [f1, f2, id];
}
function hexc(u, v) { // hex lattice (period 1 in u, 2 in v) -> [F1, F2, col, row]
  let f1 = 9, f2 = 9, bi = 0, br = 0;
  for (let r = Math.floor(v) - 1; r <= Math.floor(v) + 1; r++) {
    const o = (r & 1) * 0.5, i0 = Math.floor(u - o);
    for (let i = i0; i <= i0 + 1; i++) {
      const d = Math.hypot(u - i - o, (v - r) * 0.866);
      if (d < f1) { f2 = f1; f1 = d; bi = i; br = r; } else if (d < f2) f2 = d;
    }
  }
  return [f1, f2, bi, br];
}
const EV = p => p.scale + (p.scale & 1), OCT = N('oct', '옥타브', 1, 5, 1, 3);
const AN = [Sel('dir', '방향', [['h', '가로'], ['v', '세로']], 'h'), N('str', '늘임', 2, 12, 1, 6)];
const an = (p, u, v, s) => p.dir === 'v' ? gn(u * p.str, v, p.scale * p.str, s, 0, p.scale) : gn(u, v * p.str, p.scale, s, 0, p.scale * p.str);
// factory: o.per = scroll period (number | fn(p) | 0 = no scroll), o.sc = default scale
const D = (en, label, extra, setup, o = {}) => ({ en, label, cat: 'gen', ins: [], params: [
  N('scale', '스케일', 1, 32, 1, o.sc || 6), ...extra, N('seed', '시드', 0, 99, 1, 1), Col('ca', '색 A', '#000000'), Col('cb', '색 B', '#ffffff'),
  ...(o.per === 0 ? [] : [N('sx', '스크롤 X', -4, 4, 1, 0), N('sy', '스크롤 Y', -4, 4, 1, 1)]), N('lv', '단계(0=부드럽게)', 0, 16, 1, 0)],
  run(c, p, t) { fld(c, p, t, o.per === 0 ? 0 : typeof o.per === 'function' ? o.per(p) : p.scale, setup(p, t)); } });
const W1 = { per: () => 1 };

defNodes({
  gradient: { en: 'Draw Gradient', label: '그라디언트', cat: 'gen', ins: [], params: [
    Sel('type', '종류', [['linear', '선형'], ['radial', '방사'], ['angular', '각도'], ['diamond', '다이아']], 'linear'),
    N('angle', '각도', 0, 360, 15, 90), N('cyc', '순환(루프)', 0, 4, 1, 0), Chk('mid', '중간색 사용', false),
    Col('ca', '색 A', '#1a1c2c'), Col('cm', '중간색', '#b13e53'), Col('cc', '색 B', '#ffcd75')],
    run(c, p, t) {
      const { W, H } = S, a = p.angle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), A = hex(p.ca), M = hex(p.cm), C = hex(p.cc);
      raster(c, (x, y) => {
        const dx = (x + 0.5) / W - 0.5, dy = (y + 0.5) / H - 0.5;
        let k = p.type === 'linear' ? dx * co + dy * si + 0.5 : p.type === 'radial' ? Math.hypot(dx, dy) * 2
          : p.type === 'angular' ? fr((Math.atan2(dy, dx) - a) / (2 * Math.PI)) : (Math.abs(dx) + Math.abs(dy)) * 2;
        k = p.cyc ? fr(k + p.cyc * t) : clamp(k); // integer cycles -> seamless
        return p.mid ? (k < 0.5 ? lerpC(A, M, k * 2) : lerpC(M, C, k * 2 - 1)) : lerpC(A, C, k);
      });
    } },
  grad4: { en: '4 Points Gradient', label: '4점 그라디언트', cat: 'gen', ins: [], params: [
    Col('c1', '좌상', '#ff004d'), Col('c2', '우상', '#ffec27'), Col('c3', '우하', '#00e436'), Col('c4', '좌하', '#29adff'), N('spin', '회전(루프)', 0, 2, 1, 0)],
    run(c, p, t) {
      const { W, H } = S, ring = [p.c1, p.c2, p.c3, p.c4].map(hex), pos = p.spin * 4 * t, q = Math.floor(pos), f = pos - q;
      const [TL, TR, BR, BL] = [0, 1, 2, 3].map(i => lerpC(ring[(i + q) % 4], ring[(i + q + 1) % 4], f));
      raster(c, (x, y) => { const u = (x + 0.5) / W; return lerpC(lerpC(TL, TR, u), lerpC(BL, BR, u), (y + 0.5) / H); });
    } },
  solid: { en: 'Solid', label: '단색', cat: 'gen', ins: [], params: [Col('color', '색', '#5ac8ff')],
    run(c, p) { c.fillStyle = p.color; c.fillRect(0, 0, S.W, S.H); } },

  // ---- patterns ----
  checker: D('Checker', '체커', [], () => (u, v) => (Math.floor(u) + Math.floor(v)) & 1, { per: () => 2 }),
  dotted: D('Dotted', '도트', [N('r', '반경', 0.1, 0.7, 0.05, 0.35)], p => (u, v) => Math.hypot(fr(u) - 0.5, fr(v) - 0.5) < p.r ? 1 : 0, W1),
  stripe: D('Stripe', '줄무늬', [N('dir', '기울기', -3, 3, 1, 1), N('duty', '굵기', 0.1, 0.9, 0.05, 0.5)], p => (u, v) => fr(u + p.dir * v) < p.duty ? 1 : 0, W1),
  zigzag: D('Zigzag', '지그재그', [N('amp', '진폭', 0.1, 1, 0.05, 0.5)], p => (u, v) => fr(v + p.amp * Math.abs(2 * fr(u) - 1)) < 0.5 ? 1 : 0, W1),
  grid: D('Grid', '격자', [N('w', '선 두께', 0.02, 0.5, 0.02, 0.1)], p => (u, v) => fr(u) < p.w || fr(v) < p.w ? 1 : 0, W1),
  hexgrid: D('Hexagonal Grid', '육각 격자', [N('w', '선 두께', 0.02, 0.4, 0.02, 0.1)], p => (u, v) => { const h = hexc(u, v); return h[1] - h[0] < p.w ? 1 : 0; }, { per: EV }),
  trigrid: D('Triangular Grid', '삼각 격자', [N('w', '선 두께', 0.02, 0.4, 0.02, 0.1)], p => (u, v) => fr(u) < p.w || fr(v) < p.w || fr(u + v) < p.w ? 1 : 0, W1),
  boxpattern: D('Box Pattern', '박스 패턴', [N('n', '겹수', 1, 6, 1, 3)], p => (u, v) => Math.floor(Math.max(Math.abs(fr(u) - 0.5), Math.abs(fr(v) - 0.5)) * 2 * p.n) & 1, W1),
  crack: D('Crack Pattern', '균열', [N('w', '선 두께', 0.03, 0.4, 0.01, 0.1), N('warp', '뒤틀림', 0, 1.5, 0.1, 0.8)], p => (u, v) => {
    const P = p.scale, dx = (gn(u * 2, v * 2, 2 * P, p.seed + 1) - 0.5) * p.warp, dy = (gn(u * 2, v * 2, 2 * P, p.seed + 2) - 0.5) * p.warp;
    const c = cell(u + dx, v + dy, P, p.seed); return c[1] - c[0] < p.w ? 1 : 0; }),
  maze: D('Maze', '미로', [], p => { // recursive backtracker on (2N+1)^2 grid; wrapped by canvas period
    const N_ = p.scale, M = 2 * N_ + 1, g = new Uint8Array(M * M).fill(1), r = rng(p.seed + 1), st = [[1, 1]]; g[M + 1] = 0;
    while (st.length) {
      const [x, y] = st[st.length - 1], nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([a, b]) => x + a > 0 && x + a < M && y + b > 0 && y + b < M && g[(y + b) * M + x + a]);
      if (!nb.length) { st.pop(); continue; }
      const [a, b] = nb[Math.floor(r() * nb.length)]; g[(y + b / 2) * M + x + a / 2] = 0; g[(y + b) * M + x + a] = 0; st.push([x + a, y + b]);
    }
    return (u, v) => g[Math.floor(md(v, N_) / N_ * M) * M + Math.floor(md(u, N_) / N_ * M)] ? 1 : 0; }, { sc: 8 }),
  weave: D('Weave', '직조', [], () => (u, v) => { const i = Math.floor(u), j = Math.floor(v), a = Math.sin(Math.PI * fr(v)), b = Math.sin(Math.PI * fr(u));
    return (i + j) & 1 ? 0.45 + 0.55 * a : 0.15 + 0.55 * b; }, { per: () => 2 }),
  julia: D('Julia', '줄리아', [N('it', '반복', 8, 64, 1, 32), N('cr', 'c 실수', -1, 1, 0.01, -0.4), N('ci', 'c 허수', -1, 1, 0.01, 0.6), N('rad', 'c 반경', 0, 0.5, 0.01, 0.1)], (p, t) => {
    const cr = p.cr + p.rad * Math.cos(2 * Math.PI * t), ci = p.ci + p.rad * Math.sin(2 * Math.PI * t); // c orbits a circle -> seamless
    return (u, v) => { let x = (u / p.scale - 0.5) * 3.2 / p.scale, y = (v / p.scale - 0.5) * 3.2 / p.scale, n = 0;
      while (n < p.it && x * x + y * y < 4) { const xt = x * x - y * y + cr; y = 2 * x * y + ci; x = xt; n++; }
      return n / p.it; }; }, { per: 0, sc: 1 }),
  quasicrystal: D('Quasicrystal', '준결정', [N('n', '파동 수', 2, 7, 1, 5), N('fr', '주파수', 1, 4, 1, 2)], (p, t) => {
    const V = [[1, 0], [0, 1], [1, 1], [1, -1], [2, 1], [1, 2], [2, -1]].slice(0, p.n); // integer wave vectors keep it tileable
    return (u, v) => { let s = 0; V.forEach(([a, b], i) => { s += Math.cos(2 * Math.PI * (p.fr * (a * u + b * v) / p.scale + t) + hash(i, 0, p.seed) * 6.2832); });
      return fr(s / V.length * 1.5 + 0.5); }; }),
  waveinterfere: D('Wave Interfere', '물결 간섭', [N('src', '파원 수', 2, 5, 1, 3), N('fr', '주파수', 0.2, 3, 0.1, 0.5), N('spd', '속도(루프)', 0, 4, 1, 1)], (p, t) => {
    const S_ = Array.from({ length: p.src }, (_, i) => [hash(i, 1, p.seed) * p.scale, hash(i, 2, p.seed) * p.scale]);
    return (u, v) => { let s = 0; for (const [x, y] of S_) s += Math.sin(2 * Math.PI * (p.fr * Math.hypot(u - x, v - y) - p.spd * t));
      return 0.5 + 0.5 * s / S_.length; }; }, { per: 0 }),
  randomtile: D('Random Tile', '랜덤 타일', [], p => (u, v) => hash(md(Math.floor(u), p.scale), md(Math.floor(v), p.scale), p.seed)),
  herringbone: D('Herringbone', '헤링본', [N('gap', '틈', 0, 0.3, 0.05, 0.1)], p => { // 2x1 planks, period 4 cells
    const Q = 4 * Math.ceil(p.scale / 4);
    return (u, v) => { const i = Math.floor(u), j = Math.floor(v), s = md(i + j, 4);
      const ax = s === 1 ? i - 1 : i, ay = s === 3 ? j - 1 : j; // anchor cell of the plank
      if (u - ax < p.gap || v - ay < p.gap) return 0;
      return 0.3 + 0.7 * hash(md(ax, Q), md(ay, Q), p.seed); }; }, { per: p => 4 * Math.ceil(p.scale / 4) }),

  // ---- noises ----
  cellular: D('Cellular Noise', '셀룰러', [Sel('mode', '모드', [['f1', 'F1 거리'], ['edge', '경계(F2-F1)'], ['id', '셀 ID']], 'f1')], p => (u, v) => {
    const c = cell(u, v, p.scale, p.seed); return p.mode === 'f1' ? c[0] * 1.4 : p.mode === 'edge' ? (c[1] - c[0]) * 3 : c[2]; }),
  perlin: D('Perlin Noise', '펄린', [OCT], p => (u, v) => fbm(gn, u, v, p.scale, p.seed, p.oct)),
  simplex: D('Simplex Noise', '심플렉스', [OCT], p => (u, v) => fbm((a, b, P, s, r) => gn(a + b, b, P, s, r), u, v, p.scale, p.seed, p.oct)), // sheared lattice (approximation)
  ridge: D('Ridge Noise', '릿지', [OCT], p => (u, v) => { const r = 1 - clamp(Math.abs(fbm(gn, u, v, p.scale, p.seed, p.oct) - 0.5) * 3); return r * r; }),
  caustic: D('Caustic', '커스틱', [], (p, t) => (u, v) => { const c = cell(u, v, p.scale, p.seed, t % 1); return Math.pow(1 - clamp((c[1] - c[0]) * 2.2), 3); }),
  flownoise: D('Flow Noise', '플로우', [OCT], (p, t) => (u, v) => fbm(gn, u, v, p.scale, p.seed, p.oct, 2 * Math.PI * (t % 1))),
  bluenoise: D('Blue Noise', '블루 노이즈', [], p => { // high-passed white noise (approximation), 8 cells per scale unit
    const Pn = p.scale * 8, h = (i, j) => hash(md(i, Pn), md(j, Pn), p.seed);
    return (u, v) => { const i = Math.floor(u * 8), j = Math.floor(v * 8); return 0.5 + (h(i, j) - (h(i - 1, j) + h(i + 1, j) + h(i, j - 1) + h(i, j + 1)) / 4) * 0.8; }; }, { sc: 8 }),
  gaussnoise: D('Gaussian Noise', '가우시안 노이즈', [], p => { // sum of 4 uniforms ~ gaussian
    const Pn = p.scale * 8;
    return (u, v) => { const i = md(Math.floor(u * 8), Pn), j = md(Math.floor(v * 8), Pn);
      return 0.5 + ((hash(i, j, p.seed) + hash(i, j, p.seed + 1) + hash(i, j, p.seed + 2) + hash(i, j, p.seed + 3)) / 4 - 0.5) * 3; }; }, { sc: 8 }),
  honeycomb: D('Honeycomb Noise', '벌집', [N('w', '경계', 0, 0.3, 0.02, 0.06)], p => (u, v) => { const h = hexc(u, v), Pn = EV(p);
    return h[1] - h[0] < p.w ? 0 : 0.2 + 0.8 * hash(md(h[2], Pn), md(h[3], Pn), p.seed); }, { per: EV }),
  bubble: D('Bubble Noise', '버블', [], p => (u, v) => { const c = cell(u, v, p.scale, p.seed), r = 0.12 + 0.33 * c[2], k = c[0] / r;
    return k < 1 ? 0.25 + 0.6 * k * k : 0; }),
  scratch: D('Scratch Noise', '스크래치', AN, p => (u, v) => {
    const r = 1 - clamp(Math.abs(an(p, u, v, p.seed) - 0.5) * 8); return gn(u, v, p.scale, p.seed + 9) > 0.5 ? r * r * r : 0; }),
  strandnoise: D('Strand Noise', '가닥', [N('wob', '굴곡', 0, 8, 1, 3)], p => (u, v) => {
    const w = (gn(u, v, p.scale, p.seed + 3) - 0.5) * p.wob, n = gn(u, v * 8 + w, p.scale, p.seed, 0, p.scale * 8), r = 1 - clamp(Math.abs(n - 0.5) * 6); return r * r; }),
  shard: D('Shard Noise', '파편', [], p => (u, v) => { const c = cell(u + v, v, p.scale, p.seed); return c[1] - c[0] < 0.05 ? 0 : 0.25 + 0.75 * c[2]; }), // voronoi on sheared lattice
  fold: D('Fold Noise', '접힘', [OCT, N('k', '접힘', 1, 8, 1, 3)], p => (u, v) => 1 - Math.abs(2 * fr(fbm(gn, u, v, p.scale, p.seed, p.oct) * p.k) - 1)),
  anisotropic: D('Anisotropic Noise', '이방성', AN, p => (u, v) => (an(p, u, v, p.seed) - 0.5) * 1.8 + 0.5),
});
})();
