// gen nodes. See nodes/API.md
// Shape node library: unit-space shapes (radius 1, pointing up = -y). make() returns (u,v) => inside, or null for legacy types.
const TAU0 = Math.PI * 2; // generate.js-local
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
      case 'sword': { // tip up: long blade, wide crossguard, grip, round pommel; 안쪽 비율 = blade width
        const w = 0.07 + 0.22 * inner, blade = [[0, -1], [w, -0.66], [w * 0.92, 0.34], [-w * 0.92, 0.34], [-w, -0.66]], g = Math.max(0.035, w * 0.32), pr = 0.06 + w * 0.4;
        return Object.assign((u, v) => inPoly(blade, u, v) || (Math.abs(u) <= w + 0.26 && v > 0.32 && v <= 0.43)
          || (Math.abs(u) <= g && v > 0.43 && v <= 0.82) || u * u + (v - 0.86) ** 2 <= pr * pr, { c: [0, -0.25] }); }
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
  emitter: { en: 'Particle Emitter', cat: 'gen', label: '파티클 방출기', ins: ['입자 모양(선택)'], params: [
    N('count', '개수', 1, 300, 1, 72), N('seed', '시드', 0, 999, 1, 1),
    Sel('emit', '방출', [['burst', '한번에 터짐(burst)'], ['stream', '계속 뿜기(stream)']], 'burst'),
    N('start', '시작 시점', 0, 1, 0.01, 0), N('span', '방출 구간', 0, 1, 0.01, 1),
    N('life', '수명(루프비)', 0.02, 1, 0.01, 0.5), N('lifeVar', '수명 편차', 0, 1, 0.05, 0.3),
    Sel('area', '방출 영역', [['point', '점'], ['circle', '원 안'], ['ring', '원 둘레'], ['box', '사각형'], ['line', '선']], 'point'),
    N('cx', 'x', 0, 1, 0.01, 0.5), N('cy', 'y', 0, 1, 0.01, 0.5), N('aw', '영역 폭', 0, 128, 1, 8), N('ah', '영역 높이', 0, 128, 1, 8),
    Sel('dmode', '방향 모드', [['fixed', '고정 방향'], ['outward', '영역 바깥으로']], 'fixed'),
    N('dir', '방향°', -180, 180, 1, -90), N('spread', '퍼짐°', 0, 360, 1, 360),
    N('speed', '속도(px/f)', 0, 8, 0.1, 1), N('speedVar', '속도 편차', 0, 1, 0.05, 0.5),
    N('grav', '중력', -0.5, 0.5, 0.01, 0), N('drag', '감속', 0, 0.3, 0.01, 0), N('wob', '흔들림', 0, 4, 0.1, 0),
    N('s0', '시작 크기', 1, 32, 1, 2), N('s1', '끝 크기', 1, 32, 1, 1),
    Sel('shape', '입자 모양', [['square', '네모'], ['circle', '원'], ['plus', '십자'], ['diamond', '마름모']], 'square'),
    Chk('orient', '방향 따라 회전(연결한 모양)', true), N('streak', '스트릭 늘림', 1, 8, 0.5, 1),
    Sel('fade', '페이드', [['out', '사라짐(out)'], ['in', '나타남(in)'], ['inout', '나타났다 사라짐'], ['none', '없음']], 'out'),
    N('bright', '밝기', 0, 1, 0.01, 1), N('brightVar', '밝기 편차', 0, 1, 0.05, 0), Col('color', '색', '#ffffff'),
    Chk('loop', '루프(반복 방출)', false), N('floor', '바닥 y(px, 0=없음)', 0, 128, 1, 0), N('bounce', '튕김', 0, 1, 0.05, 0.35)],
    run(c, p, t, ins, nd, f) { // deterministic: every particle is re-simulated from its birth, step by step, for this frame
      const { W, H } = S, F = S.frames, col = hex(p.color), buf = new Float32Array(W * H), n = Math.round(p.count);
      // optional sprite from the input: intensity (luma x alpha) inside its bounding box, normalised to 1
      let spr = null;
      if (nd?.in?.[0] != null) {
        const sd = pix(ins[0]), I = new Float32Array(W * H);
        let x0 = W, y0 = H, x1 = -1, y1 = -1, mx = 0;
        for (let q = 0; q < W * H; q++) { const v = lum(sd, q * 4) * sd[q * 4 + 3] / 255; if (v > 0.02) { I[q] = v; const qx = q % W, qy = (q / W) | 0; x0 = Math.min(x0, qx); y0 = Math.min(y0, qy); x1 = Math.max(x1, qx); y1 = Math.max(y1, qy); mx = Math.max(mx, v); } }
        if (x1 >= 0) spr = { I, x0, y0, x1, y1, mx, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, big: Math.max(x1 - x0 + 1, y1 - y0 + 1) };
      }
      const stamp = (x, y, sz, v, ang) => {
        if (spr) { // sprite drawn so its longer side = sz px, optionally turned to face the motion (sprites point up)
          const sc = sz / spr.big, R = Math.ceil(sz * 0.75) + 1, ca = Math.cos(ang), sa = Math.sin(ang);
          for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
            const px = Math.round(x) + ox, py = Math.round(y) + oy;
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const dx = px + 0.5 - x, dy = py + 0.5 - y, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
            const sx = Math.floor(spr.cx + lx / sc), sy = Math.floor(spr.cy + ly / sc);
            if (sx < spr.x0 || sy < spr.y0 || sx > spr.x1 || sy > spr.y1) continue;
            const iv = spr.I[sy * W + sx] / spr.mx, i = py * W + px;
            if (iv > 0 && v * iv > buf[i]) buf[i] = v * iv;
          }
          return;
        }
        const h = sz / 2;
        for (let oy = 0; oy < sz; oy++) for (let ox = 0; ox < sz; ox++) {
          const dx = ox - h + 0.5, dy = oy - h + 0.5;
          if (p.shape === 'circle' && sz >= 3 && dx * dx + dy * dy > h * h) continue;
          if (p.shape === 'plus' && sz >= 3 && Math.abs(dx) > 0.6 && Math.abs(dy) > 0.6) continue;
          if (p.shape === 'diamond' && sz >= 3 && Math.abs(dx) + Math.abs(dy) > h) continue;
          const px = Math.round(x - h + ox), py = Math.round(y - h + oy);
          if (px >= 0 && py >= 0 && px < W && py < H) { const i = py * W + px; if (v > buf[i]) buf[i] = v; }
        }
      };
      for (let i = 0; i < n; i++) {
        const R = rng(p.seed * 7919 + i * 13 + 1);
        const tb = p.start * F + (p.emit === 'stream' ? (i / n) * p.span * F : 0);
        const lifeF = Math.max(1, p.life * F * (1 - p.lifeVar * R()));
        let a = f - tb;
        if (p.loop) a = ((a % F) + F) % F;
        if (a < 0 || a >= lifeF) continue;
        // spawn point
        const cx = p.cx * W, cy = p.cy * H, ra = R() * TAU0, rr = Math.sqrt(R());
        let ox = 0, oy = 0;
        if (p.area === 'circle') { ox = Math.cos(ra) * rr * p.aw / 2; oy = Math.sin(ra) * rr * p.ah / 2; }
        else if (p.area === 'ring') { ox = Math.cos(ra) * p.aw / 2; oy = Math.sin(ra) * p.ah / 2; }
        else if (p.area === 'box') { ox = (R() - 0.5) * p.aw; oy = (R() - 0.5) * p.ah; }
        else if (p.area === 'line') { ox = (R() - 0.5) * p.aw; }
        const base = p.dmode === 'outward' && (ox || oy) ? Math.atan2(oy, ox) : p.dir * Math.PI / 180;
        const ang = base + (R() - 0.5) * p.spread * Math.PI / 180, sp = p.speed * (1 - p.speedVar * R());
        let x = cx + ox, y = cy + oy, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
        const ph = R() * TAU0, bv = p.bright * (1 - p.brightVar * R());
        for (let s = 0; s < Math.floor(a); s++) {
          x += vx; y += vy; vy += p.grav; vx *= 1 - p.drag; vy *= 1 - p.drag;
          if (p.floor > 0 && y > p.floor) { y = p.floor - (y - p.floor) * p.bounce; vy = -vy * p.bounce; vx *= 0.85; }
        }
        const k = a / lifeF, fd = p.fade === 'out' ? 1 - k : p.fade === 'in' ? k : p.fade === 'inout' ? Math.sin(Math.PI * k) : 1;
        const v = bv * fd, sz = Math.max(1, Math.round(lerp(p.s0, p.s1, k)));
        if (v <= 0.02) continue;
        const sl = Math.hypot(vx, vy) || 1, wx = p.wob ? -vy / sl * Math.sin(a * 0.9 + ph) * p.wob : 0, wy = p.wob ? vx / sl * Math.sin(a * 0.9 + ph) * p.wob : 0;
        const L = (p.streak - 1) * Math.hypot(vx, vy), steps = Math.ceil(L);
        const rot = spr && p.orient && Math.hypot(vx, vy) > 1e-3 ? Math.atan2(vy, vx) + Math.PI / 2 : 0;
        for (let s = 0; s <= steps; s++) { const q = steps ? s / steps : 0; stamp(x + wx - vx / sl * L * q, y + wy - vy / sl * L * q, sz, v * (1 - 0.6 * q), rot); }
      }
      const id = c.createImageData(W, H), d = id.data;
      for (let i = 0; i < W * H; i++) if (buf[i] > 0) { d[i * 4] = col[0] * buf[i]; d[i * 4 + 1] = col[1] * buf[i]; d[i * 4 + 2] = col[2] * buf[i]; d[i * 4 + 3] = 255; }
      c.putImageData(id, 0, 0);
    } },
  shape: { en: 'Shape', cat: 'gen', label: '도형', ins: [], params: [
    Sel('type', '종류', [['circle', '원'], ['ring', '링'], ['star', '별(둥근)'], ['cross', '십자'],
      ['tri', '삼각형'], ['square', '네모'], ['diamond', '마름모'], ['poly', '다각형'],
      ['spike', '뾰족별'], ['burst', '가시 폭발'], ['sparkle', '반짝이'], ['saw', '톱니 링'],
      ['shard', '파편(shard)'], ['crystal', '수정(육각)'], ['arrow', '화살촉'], ['blade', '칼날(렌즈)'], ['crescent', '초승달'],
      ['sword', '큰 칼'], ['drop', '물방울'], ['heart', '하트']], 'ring'),
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
      const OUT8 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      const r2 = r - p.th, asp = p.asp || 1, str = p.str ?? 1, fall = p.fall || 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - p.cx * W, dy = y + 0.5 - p.cy * H, dist = Math.hypot(dx, dy);
        const rx = dx * cr + dy * sr, ry = (-dx * sr + dy * cr) / asp; // local frame, shapes point up (-y); 세로비 stretches y
        const ld = Math.hypot(rx, ry);
        let on;
        if (unit) {
          on = unit(rx / r, ry / r);
          if (on && p.outline && p.type !== 'saw') { const T = p.th, s2 = T * 0.7071; // pixel erosion: even thickness on every shape
            on = !OUT8.every(([ox, oy]) => unit((rx + ox * T + oy * 0) / r, (ry + oy * T) / r)) || !DIAG.every(([ox, oy]) => unit((rx + ox * s2) / r, (ry + oy * s2) / r)); }
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
