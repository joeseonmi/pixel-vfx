// gen nodes. See nodes/API.md
// Shape node library: unit-space shapes (radius 1, pointing up = -y). make() returns (u,v) => inside, or null for legacy types.
const SHAPE_LIB = (() => {
  const T = Math.PI * 2;
  const inPoly = (P, x, y) => { let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
    return c; };
  const polar = (k, f) => Array.from({ length: k }, (_, i) => { const a = T * i / k - Math.PI / 2, rr = f(i); return [Math.cos(a) * rr, Math.sin(a) * rr]; });
  const curve = (k, f) => Array.from({ length: k }, (_, i) => f(T * i / k));
  const poly = P => (u, v) => inPoly(P, u, v);
  function make(type, n, inner, seed, thU) {
    n = Math.max(3, Math.round(n)); inner = Math.min(0.95, Math.max(0.05, inner));
    switch (type) {
      case 'tri': return poly(polar(3, () => 1.15).map(([x, y]) => [x, y + 0.28]));
      case 'square': return (u, v) => Math.abs(u) <= 0.72 && Math.abs(v) <= 0.72;
      case 'poly': return poly(polar(n, () => 1));
      case 'diamond': { const w = 0.3 + 0.7 * inner; return poly([[0, -1], [w, 0], [0, 1], [-w, 0]]); }
      case 'spike': return poly(polar(2 * n, i => (i % 2 ? inner : 1)));
      case 'burst': { const R = rng(seed * 7919 + n);
        const P = Array.from({ length: 2 * n }, (_, i) => { const a = T * (i + (R() - 0.5) * 0.5) / (2 * n) - Math.PI / 2,
          rr = i % 2 ? inner * (0.7 + 0.5 * R()) : 0.6 + 0.4 * R(); return [Math.cos(a) * rr, Math.sin(a) * rr]; });
        return poly(P); }
      case 'sparkle': { const k = 0.3 + 0.75 * inner; return (u, v) => Math.abs(u) ** k + Math.abs(v) ** k <= 1; }
      case 'saw': { const val = 0.5 + 0.45 * inner, P = polar(2 * n, i => (i % 2 ? val : 1)), hole = Math.max(0, val - thU);
        return (u, v) => u * u + v * v > hole * hole && inPoly(P, u, v); }
      case 'crystal': { const w = 0.12 + 0.5 * inner; return poly([[0, -1], [w, -0.5], [w, 0.55], [0, 1], [-w, 0.55], [-w, -0.5]]); }
      case 'shard': { // long taper to a sharp top, bulge low (widest at 72%), short rounded point at the bottom
        const w = 0.1 + 0.6 * inner, prof = t => (t <= 0.72 ? w * (t / 0.72) ** 0.9 : w * Math.max(0, 1 - ((t - 0.72) / 0.28) ** 1.6) ** 0.6), R = [], L = [];
        for (let i = 0; i <= 40; i++) { const t = i / 40, v = 2 * t - 1; R.push([prof(t), v]); L.unshift([-prof(t), v]); }
        return Object.assign(poly([...R, ...L]), { c: [0, 0.44] }); }
      case 'arrow': { const g = 1.5 * (1 - inner); return poly([[0, -1], [0.8, 0.7], [0, -1 + g * 1.13], [-0.8, 0.7]]); }
      case 'blade': { const w = Math.max(0.06, inner * 0.6), R = (w + 1 / w) / 2, o = (1 / w - w) / 2;
        return (u, v) => (u - o) ** 2 + v * v <= R * R && (u + o) ** 2 + v * v <= R * R; }
      case 'crescent': { const dd = 0.25 + 0.6 * (1 - inner); return (u, v) => u * u + v * v <= 1 && u * u + (v + dd) ** 2 > 1; }
      case 'drop': { const m = 1 + 2 * inner; return Object.assign(poly(curve(64, a => [Math.sin(a) * Math.abs(Math.sin(a / 2)) ** m, -Math.cos(a)])), { c: [0, 0.4] }); }
      case 'heart': return poly(curve(72, a => [Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 - 0.15]));
      default: return null;
    }
  }
  return { make };
})();

defNodes({
  particles: { en: 'Particles', cat: 'gen', label: '파티클', ins: [], params: [
    N('count', '개수', 1, 200, 1, 60), N('seed', '시드', 0, 99, 1, 1),
    N('ex', '발사 X', 0, 1, 0.01, 0.5), N('ey', '발사 Y', 0, 1, 0.01, 0.5),
    N('dir', '방향(도)', 0, 360, 1, 90), N('spread', '퍼짐(도)', 0, 360, 1, 40),
    N('speed', '속도', 0, 200, 1, 40), N('grav', '중력', -200, 200, 1, 0),
    N('life', '수명', 0.05, 1, 0.01, 0.6), N('s0', '크기 시작', 1, 32, 1, 6), N('s1', '크기 끝', 1, 32, 1, 2),
    Col('c0', '색 시작', '#ffcc33'), Col('c1', '색 끝', '#ff3300'),
    Sel('shape', '모양', [['square', '네모'], ['circle', '원']], 'square')],
    run(c, p, t) {
      const { W, H } = S, c0 = hex(p.c0), c1 = hex(p.c1);
      for (let i = 0; i < p.count; i++) {
        const sp0 = S.loop ? i / p.count : i / p.count * 0.3; // one-shot: emit within first 30%
        const e0 = t - sp0, el = S.loop ? e0 - Math.floor(e0) : e0, a = el / p.life;
        if (el < 0 || a > 1) continue;
        const r = rng(p.seed * 1000 + i), ang = (p.dir + (r() - 0.5) * p.spread) * Math.PI / 180, sp = p.speed * (0.6 + 0.4 * r());
        const x = p.ex * W + Math.cos(ang) * sp * el, y = p.ey * H - Math.sin(ang) * sp * el + 0.5 * p.grav * el * el;
        const sz = Math.max(1, Math.round(lerp(p.s0, p.s1, a)));
        c.globalAlpha = 1 - a; c.fillStyle = rgb(lerpC(c0, c1, a));
        if (p.shape === 'circle' && sz >= 3) disc(c, x, y, sz / 2);
        else c.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
      }
      c.globalAlpha = 1;
    } },
  shape: { en: 'Shape', cat: 'gen', label: '도형', ins: [], params: [
    Sel('type', '종류', [['circle', '원'], ['ring', '링'], ['star', '별(둥근)'], ['cross', '십자'],
      ['tri', '삼각형'], ['square', '네모'], ['diamond', '마름모'], ['poly', '다각형'],
      ['spike', '뾰족별'], ['burst', '가시 폭발'], ['sparkle', '반짝이'], ['saw', '톱니 링'],
      ['shard', '파편(shard)'], ['crystal', '수정(육각)'], ['arrow', '화살촉'], ['blade', '칼날(렌즈)'], ['crescent', '초승달'],
      ['drop', '물방울'], ['heart', '하트']], 'ring'),
    N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5),
    N('s0', '크기 시작', 1, 64, 1, 4), N('s1', '크기 끝', 1, 64, 1, 24),
    N('th', '두께', 1, 16, 1, 3), N('rot', '회전 속도', -720, 720, 15, 0),
    N('n', '꼭짓점/가시 수', 3, 32, 1, 5), N('inner', '안쪽 비율(작을수록 뾰족)', 0.05, 0.95, 0.01, 0.4),
    N('ang', '기본 각도', 0, 360, 1, 0), N('asp', '세로비', 0.25, 4, 0.05, 1), N('seed', '시드(가시 폭발)', 0, 99, 1, 1),
    N('fall', '중심감쇠', 0, 1, 0.05, 0), Sel('fmode', '감쇠 방식', [['bright', '어둡게'], ['alpha', '투명하게']], 'bright'), N('str', '강도', 0, 1, 0.01, 1),
    Col('color', '색', '#ffffff'), Chk('outline', '외곽선만', false), Chk('fade', '페이드', true)],
    run(c, p, t) {
      const { W, H } = S, id = c.createImageData(W, H), d = id.data, col = hex(p.color);
      const r = lerp(p.s0, p.s1, 1 - (1 - t) * (1 - t)), rot = (p.rot * t + (p.ang || 0)) * Math.PI / 180, al = p.fade ? 255 * (1 - t) : 255;
      const cr = Math.cos(rot), sr = Math.sin(rot), h = p.th / 2;
      const unit = SHAPE_LIB.make(p.type, p.n, p.inner, p.seed, r > 0 ? p.th / r : 1); // null = legacy shape
      const r2 = r - p.th, asp = p.asp || 1, str = p.str ?? 1, fall = p.fall || 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - p.cx * W, dy = y + 0.5 - p.cy * H, dist = Math.hypot(dx, dy);
        const rx = dx * cr + dy * sr, ry = (-dx * sr + dy * cr) / asp; // local frame, shapes point up (-y); 세로비 stretches y
        const ld = Math.hypot(rx, ry);
        let on;
        if (unit) {
          on = unit(rx / r, ry / r);
          if (on && p.outline && p.type !== 'saw' && r2 > 0) on = !unit(rx / r2, ry / r2);
        } else if (p.type === 'circle') on = ld <= r && !(p.outline && ld <= r - p.th);
        else if (p.type === 'ring') on = ld <= r && ld > r - p.th;
        else if (p.type === 'star') on = ld <= r * (0.4 + 0.6 * Math.pow(Math.abs(Math.cos(2.5 * Math.atan2(ry, rx))), 2));
        else on = (Math.abs(rx) <= r && Math.abs(ry) <= h) || (Math.abs(ry) <= r && Math.abs(rx) <= h);
        if (on) { // 중심감쇠: bright core fading toward the outline (k = 0 centre .. 1 edge, follows the shape)
          let k = 0;
          if (fall > 0) { if (unit) { const [ax, ay] = unit.c || [0, 0], u = rx / r - ax, v = ry / r - ay; let lo = 0, hi = 1; // shrink the shape toward its bright core until the pixel falls outside
              for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2; if (m > 0 && unit(ax + u / m, ay + v / m)) hi = m; else lo = m; } k = hi; } else k = Math.min(1, ld / r); }
          const g = 1 - fall * k, i = (y * W + x) * 4, b = p.fmode === 'alpha' ? str : str * g;
          d[i] = col[0] * b; d[i + 1] = col[1] * b; d[i + 2] = col[2] * b; d[i + 3] = p.fmode === 'alpha' ? al * str * g : al; }
      }
      c.putImageData(id, 0, 0);
    } },
  noise: { en: 'Noise', cat: 'gen', label: '노이즈', ins: [], params: [
    N('scale', '스케일', 1, 16, 1, 4), N('sx', '스크롤 X', -3, 3, 1, 0), N('sy', '스크롤 Y', -3, 3, 1, 1),
    N('oct', '옥타브', 1, 4, 1, 3), N('contrast', '대비', 0.5, 4, 0.1, 1.5), N('seed', '시드', 0, 99, 1, 1)],
    run(c, p, t) {
      const { W, H } = S, id = c.createImageData(W, H), d = id.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let v = 0, amp = 1, tot = 0;
        for (let o = 0; o < p.oct; o++) {
          const P = p.scale * 2 ** o; // scroll is whole periods per loop -> frame N == frame 0
          v += amp * vnoise((x + 0.5) / W * P + p.sx * P * t, (y + 0.5) / H * P + p.sy * P * t, P, p.seed + o);
          tot += amp; amp /= 2;
        }
        const g = clamp(((v / tot) - 0.5) * p.contrast + 0.5) * 255, i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
      }
      c.putImageData(id, 0, 0);
    } },
  arc: { en: 'Arc', cat: 'gen', label: '호/참격', ins: [], params: [
    N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5),
    N('radius', '반경', 4, 64, 1, 24), N('thick', '두께', 1, 32, 1, 12),
    N('start', '시작 각도', 0, 360, 1, 140), N('sweep', '휩쓸기(도)', 30, 360, 1, 150),
    Col('head', '머리 색', '#ffffff'), Col('tail', '꼬리 색', '#ff8a1f')],
    run(c, p, t) { // head sweeps in over first 40% of t, then tail erodes and thickness shrinks to 0
      const { W, H } = S, id = c.createImageData(W, H), d = id.data, hc = hex(p.head), tc = hex(p.tail);
      const k = clamp(t / 0.4), er = clamp((t - 0.4) / 0.6), a0 = p.sweep * er, a1 = p.sweep * (1 - (1 - k) * (1 - k)), th = p.thick * (1 - er);
      if (a1 > a0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - p.cx * W, dy = y + 0.5 - p.cy * H;
        const rel = ((Math.atan2(dy, dx) * 180 / Math.PI - p.start) % 360 + 360) % 360;
        if (rel < a0 || rel > a1) continue;
        const u = (rel - a0) / (a1 - a0), w = th * Math.pow(Math.sin(Math.PI * u), 0.6);
        if (Math.abs(Math.hypot(dx, dy) - p.radius) > w / 2) continue;
        const col = lerpC(tc, hc, u), i = (y * W + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      c.putImageData(id, 0, 0);
    } },
  lightning: { en: 'Lightning', cat: 'gen', label: '번개', ins: [], params: [
    N('x0', '시작 X', 0, 1, 0.01, 0.5), N('y0', '시작 Y', 0, 1, 0.01, 0), N('x1', '끝 X', 0, 1, 0.01, 0.5), N('y1', '끝 Y', 0, 1, 0.01, 1),
    N('seg', '분할 단계(2ⁿ)', 1, 6, 1, 4), N('jitter', '흔들림', 0, 30, 1, 8), N('branch', '가지 확률', 0, 1, 0.05, 0.25),
    N('thick', '두께', 1, 2, 1, 1), Col('core', '심 색', '#ffffff'), Col('glow', '빛 색', '#5ac8ff'), N('hold', '유지 프레임', 1, 16, 1, 2)],
    run(c, p, t, ins, n, f) {
      const { W, H } = S, r = rng(Math.floor((f % S.frames) / p.hold) * 131 + 7), th = Math.round(p.thick);
      const main = bolt([[p.x0 * W, p.y0 * H], [p.x1 * W, p.y1 * H]], p.jitter, p.seg, r), paths = [main];
      const ex = (p.x1 - p.x0) * W, ey = (p.y1 - p.y0) * H, len = Math.hypot(ex, ey);
      for (const q of main.slice(1, -1)) if (r() < p.branch)
        paths.push(bolt([q, [q[0] + ex * 0.25 + (r() - 0.5) * len * 0.5, q[1] + ey * 0.25 + (r() - 0.5) * len * 0.5]], p.jitter / 2, 3, r));
      for (const [col, s, o] of [[p.glow, th + 2, 1], [p.core, th, 0]]) {
        c.fillStyle = col;
        for (const pp of paths) for (let i = 1; i < pp.length; i++) line(c, pp[i - 1][0], pp[i - 1][1], pp[i][0], pp[i][1], s, o);
      }
    } },
});
