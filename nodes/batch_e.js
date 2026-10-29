// batch E: MK effect nodes + animation timing nodes. See nodes/API.md
// local helpers (IIFE-scoped, nothing leaks to globals): TAU frac wrapi dot star fr src anim
(() => {
const TAU = Math.PI * 2, frac = v => v - Math.floor(v), wrapi = (v, m) => ((Math.round(v) % m) + m) % m;
const dot = (c, x, y, s = 1) => c.fillRect(Math.round(x), Math.round(y), s, s);
const star = (c, x, y, r) => { // 4-point twinkle: plus arms, diagonals when big
  x = Math.round(x); y = Math.round(y);
  for (let k = -r; k <= r; k++) { dot(c, x + k, y); dot(c, x, y + k); }
  if (r >= 3) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) dot(c, x + a, y + b);
};
const fr = g => { g = Math.round(g); return S.loop ? wrapi(g, S.frames) : clamp(g, 0, S.frames - 1); }; // remap frame: wrap if loop else clamp
const src = (n, g) => { const s = byId(n.in[0]); return s ? evaluate(s, fr(g)) : null; };
const anim = (en, label, params, gf) => ({ en, label, cat: 'anim', ins: ['입력'], params,
  run(c, p, t, ins, n, f) { const s = src(n, gf(p, f)); if (s) c.drawImage(s, 0, 0); } });
const hsvShift = (col, dh) => { const [h, s, v] = rgb2hsv(...col); return hsv2rgb((h + dh + 360) % 360, s, v).map(Math.round); };

defNodes({
  animloop: anim('Frame Loop', '프레임 루프', [N('start', '시작 프레임', 0, 64, 1, 0), N('len', '길이', 1, 64, 1, 8)],
    (p, f) => p.start + (f % p.len)),
  animspeed: anim('Animation Speed', '재생 속도', [N('speed', '속도 배율', 0.1, 4, 0.1, 1)], (p, f) => f * p.speed),
  delay: anim('Delay', '지연', [N('frames', '지연 프레임', -32, 32, 1, 4)], (p, f) => f - p.frames),
  reverse: anim('Reverse', '역재생', [], (p, f) => (S.loop ? S.frames : S.frames - 1) - f),
  rateremap: anim('Rate Remap', '프레임레이트 변경', [N('hold', '유지 프레임(N)', 1, 16, 1, 2)], (p, f) => Math.floor(f / p.hold) * p.hold),

  mkrain: { en: 'MK Rain', label: 'MK 비', cat: 'gen', ins: [], params: [
    Sel('kind', '종류', [['rain', '비'], ['snow', '눈']], 'rain'), N('count', '밀도', 1, 300, 1, 70), N('dir', '기울기', -1, 1, 0.05, 0.25),
    N('len', '길이', 1, 16, 1, 5), N('seed', '시드', 0, 99, 1, 1), Col('color', '색', '#9ad1ff')],
    run(c, p, t) {
      const { W, H } = S; c.fillStyle = p.color;
      for (let i = 0; i < p.count; i++) {
        const r = rng(p.seed * 977 + i), x0 = r() * W, cy = 1 + Math.floor(r() * 2), ph = frac(r() + t * cy), y = ph * H, sw = r(), big = r() < 0.2;
        if (p.kind === 'rain') for (let k = 0; k < p.len; k++) { c.globalAlpha = k < p.len / 2 ? 1 : 0.5; dot(c, wrapi(x0 + p.dir * (y - k), W), wrapi(y - k, H)); }
        else dot(c, wrapi(x0 + p.dir * y + 3 * Math.sin(TAU * (t * cy + sw)), W), wrapi(y, H), big ? 2 : 1); // cy integer -> seamless sway
      }
      c.globalAlpha = 1;
    } },
  mksparkle: { en: 'MK Sparkle', label: 'MK 반짝이', cat: 'gen', ins: [], params: [
    N('count', '개수', 1, 60, 1, 14), N('size', '최대 크기', 1, 8, 1, 4), N('speed', '깜빡임 횟수', 1, 4, 1, 1), N('seed', '시드', 0, 99, 1, 1),
    Col('color', '색', '#ffe27a'), Col('core', '중심색', '#ffffff')],
    run(c, p, t) {
      for (let i = 0; i < p.count; i++) {
        const r = rng(p.seed * 313 + i), x = r() * S.W, y = r() * S.H, ph = r(), cy = 1 + Math.floor(r() * p.speed);
        const rad = Math.round(p.size * Math.sin(Math.PI * frac(t * cy + ph)));
        if (rad < 1) continue;
        c.fillStyle = p.color; star(c, x, y, rad); c.fillStyle = p.core; dot(c, x, y);
      }
    } },
  mksaber: { en: 'MK Saber', label: 'MK 광선검', cat: 'gen', ins: [], params: [
    N('x0', '시작 X', 0, 1, 0.01, 0.3), N('y0', '시작 Y', 0, 1, 0.01, 0.75), N('x1', '끝 X', 0, 1, 0.01, 0.7), N('y1', '끝 Y', 0, 1, 0.01, 0.25),
    N('thick', '두께', 1, 6, 1, 2), N('swing', '스윙(도)', 0, 90, 1, 25), N('trace', '잔상 프레임', 0, 8, 1, 3),
    Col('core', '심 색', '#ffffff'), Col('glow', '빛 색', '#3ad0ff')],
    run(c, p, t, ins, n, f) {
      const { W, H } = S, th = Math.round(p.thick);
      const draw = (q, tt, a, parts) => {
        const x0 = q.x0 * W, y0 = q.y0 * H, an = q.swing * Math.sin(TAU * tt) * Math.PI / 180, dx = (q.x1 - q.x0) * W, dy = (q.y1 - q.y0) * H;
        const x1 = x0 + dx * Math.cos(an) - dy * Math.sin(an), y1 = y0 + dx * Math.sin(an) + dy * Math.cos(an);
        for (const [col, s, al] of parts) { c.fillStyle = col; c.globalAlpha = al * a; line(c, x0, y0, x1, y1, s, s >> 1); }
      };
      for (let j = p.trace; j >= 1; j--) { const g = fr(f - j); draw(resolveParams(n, g), tOf(g), 0.5 * (1 - j / (p.trace + 1)), [[p.glow, th + 2, 1]]); }
      draw(p, t, 1, [[p.glow, th + 4, 0.4], [p.glow, th + 2, 1], [p.core, th, 1]]);
      c.globalAlpha = 1;
    } },
  mksmoke: { en: 'MK Smoke', label: 'MK 연기', cat: 'gen', ins: [], params: [
    N('count', '퍼프 수', 2, 40, 1, 14), N('x', '위치 X', 0, 1, 0.01, 0.5), N('y', '위치 Y', 0, 1, 0.01, 0.9), N('rise', '상승', 8, 128, 1, 50),
    N('sway', '흔들림', 0, 24, 1, 6), N('r0', '시작 반경', 1, 16, 1, 3), N('r1', '끝 반경', 1, 32, 1, 9), N('seed', '시드', 0, 99, 1, 1),
    Col('c0', '색 시작', '#cfcfcf'), Col('c1', '색 끝', '#4a4a52')],
    run(c, p, t) {
      const { W, H } = S, a = hex(p.c0), b = hex(p.c1), order = [...Array(p.count).keys()].sort((i, j) => -frac(t + i / p.count) + frac(t + j / p.count));
      for (const i of order) { // oldest (largest) first
        const r = rng(p.seed * 211 + i), ph = frac(t + i / p.count), ox = (r() - 0.5) * 6, sp = 1 + Math.floor(r() * 2);
        const x = p.x * W + ox + p.sway * ph * Math.sin(TAU * (ph * sp + i * 0.37)), y = p.y * H - p.rise * ph;
        c.globalAlpha = Math.ceil((1 - ph * ph) * 4) / 4; c.fillStyle = rgb(lerpC(a, b, ph)); disc(c, x, y, lerp(p.r0, p.r1, ph));
      }
      c.globalAlpha = 1;
    } },
  mkflake: { en: 'MK Flake', label: 'MK 눈결정', cat: 'gen', ins: [], params: [
    N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5), N('spokes', '가지 수', 3, 12, 1, 6), N('len', '길이', 3, 60, 1, 22),
    N('branch', '곁가지 수', 0, 5, 1, 2), N('blen', '곁가지 길이', 0.1, 0.8, 0.05, 0.35), N('rot', '회전(바퀴/루프)', -3, 3, 1, 1), Col('color', '색', '#dff4ff')],
    run(c, p, t) {
      const cx = p.cx * S.W, cy = p.cy * S.H; c.fillStyle = p.color;
      for (let k = 0; k < p.spokes; k++) {
        const a = TAU * (k / p.spokes + p.rot * t / p.spokes), ca = Math.cos(a), sa = Math.sin(a);
        line(c, cx, cy, cx + ca * p.len, cy + sa * p.len, 1, 0);
        for (let j = 1; j <= p.branch; j++) { // rot cycles are whole spoke steps -> seamless
          const d = p.len * j / (p.branch + 1), bx = cx + ca * d, by = cy + sa * d, bl = p.len * p.blen * (1 - j / (p.branch + 2));
          for (const s of [-1, 1]) { const b = a + s * 0.8; line(c, bx, by, bx + Math.cos(b) * bl, by + Math.sin(b) * bl, 1, 0); }
        }
      }
      dot(c, cx, cy, 2);
    } },
  mkflare: { en: 'MK Lens Flare', label: 'MK 렌즈 플레어', cat: 'gen', ins: [], params: [
    N('ox', '광원 X', 0, 1, 0.01, 0.75), N('oy', '광원 Y', 0, 1, 0.01, 0.25), N('fx', '초점 X', 0, 1, 0.01, 0.5), N('fy', '초점 Y', 0, 1, 0.01, 0.5),
    N('ghosts', '고스트 수', 3, 6, 1, 4), N('intensity', '세기', 0.2, 1, 0.05, 1), N('drift', '흔들림', 0, 12, 1, 3), Col('color', '색', '#ffe9a0')],
    run(c, p, t) {
      const { W, H } = S, ox = p.ox * W + p.drift * Math.sin(TAU * t), oy = p.oy * H + p.drift * Math.cos(TAU * t), dx = p.fx * W - ox, dy = p.fy * H - oy, col = hex(p.color);
      c.fillStyle = rgb(col); c.globalAlpha = 0.2 * p.intensity; line(c, ox, oy, ox + dx * 2.4, oy + dy * 2.4, 1, 0);
      c.globalAlpha = 0.35 * p.intensity; disc(c, ox, oy, 7); c.globalAlpha = 1; c.fillStyle = '#fff'; disc(c, ox, oy, 2); star(c, ox, oy, Math.round(9 * p.intensity));
      for (let i = 0; i < p.ghosts; i++) {
        const r = rng(i * 77 + 5), s = [0.35, 0.8, 1.15, 1.5, 1.9, 2.3][i];
        c.fillStyle = rgb(hsvShift(col, (r() - 0.5) * 140)); c.globalAlpha = (0.25 + 0.25 * r()) * p.intensity;
        disc(c, ox + dx * s, oy + dy * s, W * (0.03 + 0.07 * r()));
      }
      c.globalAlpha = 1;
    } },
  mkgodray: { en: 'MK GodRay', label: 'MK 빛줄기', cat: 'gen', ins: [], params: [
    N('ox', '광원 X', 0, 1, 0.01, 0.5), N('oy', '광원 Y', -0.5, 1, 0.01, -0.1), N('count', '빛줄기 수', 2, 16, 1, 7), N('dir', '방향(도)', 0, 360, 1, 90),
    N('spread', '퍼짐(도)', 10, 180, 1, 70), N('sway', '흔들림(도)', 0, 30, 1, 6), N('power', '세기', 0.2, 1.5, 0.05, 0.9), Col('color', '색', '#fff3b0')],
    run(c, p, t) {
      const { W, H } = S, id = c.createImageData(W, H), d = id.data, col = hex(p.color), rad = Math.PI / 180, rays = [];
      for (let i = 0; i < p.count; i++) { // sway uses sin of t (1 cycle) -> seamless
        const r = rng(i * 31 + 9);
        rays.push([(p.dir + (i / Math.max(1, p.count - 1) - 0.5) * p.spread + p.sway * Math.sin(TAU * (t + r()))) * rad, p.spread / p.count * rad * (0.2 + 0.3 * r()), 0.6 + 0.4 * r()]);
      }
      const ox = p.ox * W, oy = p.oy * H, maxd = Math.hypot(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const an = Math.atan2(y + 0.5 - oy, x + 0.5 - ox), dist = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
        let a = 0;
        for (const [ra, hw, br] of rays) if (Math.abs(((an - ra + 3 * Math.PI) % TAU) - Math.PI) < hw) a = Math.max(a, br);
        if (a * p.power * (1 - dist / maxd) <= (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) continue;
        const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      c.putImageData(id, 0, 0);
    } },
  mkbrownian: { en: 'MK Brownian', label: 'MK 브라운 입자', cat: 'gen', ins: [], params: [
    N('count', '개수', 1, 80, 1, 24), N('range', '이동 범위', 2, 64, 1, 24), N('speed', '움직임(주기)', 1, 8, 1, 4), N('size', '크기', 1, 4, 1, 2),
    N('seed', '시드', 0, 99, 1, 1), Col('c0', '색 A', '#ffd45a'), Col('c1', '색 B', '#ff7a3a')],
    run(c, p, t) {
      const { W, H } = S;
      for (let i = 0; i < p.count; i++) {
        const r = rng(p.seed * 53 + i), bx = r() * W, by = r() * H, s = p.seed * 101 + i * 2; // periodic noise of t -> loops
        const x = bx + (vnoise(t * p.speed, 0, p.speed, s) - 0.5) * 2 * p.range, y = by + (vnoise(t * p.speed, 0, p.speed, s + 1) - 0.5) * 2 * p.range;
        c.fillStyle = i % 2 ? p.c0 : p.c1; dot(c, wrapi(x, W), wrapi(y, H), p.size);
      }
    } },
  mkfall: { en: 'MK Fall', label: 'MK 낙엽', cat: 'gen', ins: [], params: [
    N('count', '개수', 1, 60, 1, 18), N('wind', '바람', -64, 64, 1, 16), N('swing', '흔들림', 0, 24, 1, 6), N('size', '크기', 1, 4, 1, 2),
    N('seed', '시드', 0, 99, 1, 1), Col('c0', '색 A', '#d9731f'), Col('c1', '색 B', '#a32d1c')],
    run(c, p, t) {
      const { W, H } = S, a = hex(p.c0), b = hex(p.c1);
      for (let i = 0; i < p.count; i++) {
        const r = rng(p.seed * 71 + i), x0 = r() * W, ph = frac(r() + t), sw = 1 + Math.floor(r() * 3), sp = r(), k = r(), m = p.size;
        const ang = TAU * (t * sw + sp), x = x0 + p.wind * ph + p.swing * Math.sin(ang), y = ph * (H + 2 * m) - m;
        c.fillStyle = rgb(lerpC(a, b, k)); // heading flips with swing velocity: wide when going right, tall when going left
        const wide = Math.cos(ang) > 0; c.fillRect(wrapi(x, W), Math.round(y), wide ? m + 1 : m, wide ? m : m + 1);
      }
    } },
  mkflag: { en: 'MK Flag', label: 'MK 깃발', cat: 'gen', ins: ['텍스처'], params: [
    N('x', '깃대 X', 0, 1, 0.01, 0.25), N('y', '깃대 Y', 0, 1, 0.01, 0.2), N('w', '너비', 4, 96, 1, 40), N('h', '높이', 4, 64, 1, 24),
    N('amp', '펄럭임', 0, 12, 1, 4), N('waves', '파장 수', 1, 4, 1, 2), N('speed', '속도(주기)', 1, 4, 1, 1), Col('c0', '색 A', '#d83a3a'), Col('c1', '색 B', '#f3e4b8')],
    run(c, p, t, [im], n) {
      const { W, H } = S, hasTex = !!byId(n.in[0]), d = hasTex ? pix(im) : null, x0 = Math.round(p.x * W), y0 = Math.round(p.y * H);
      c.fillStyle = '#6b4a2a'; c.fillRect(x0 - 1, y0 - 2, 2, p.h + 14);
      for (let u = 0; u < p.w; u++) {
        const ph = TAU * (u / p.w * p.waves - t * p.speed), dy = Math.round(p.amp * Math.sin(ph) * (u / p.w)), sh = Math.cos(ph) * (u / p.w);
        for (let v = 0; v < p.h; v++) {
          let col;
          if (hasTex) { const i = sample(d, W, H, Math.floor(u / p.w * W), Math.floor(v / p.h * H), 'clamp'); if (d[i + 3] < 128) continue; col = [d[i], d[i + 1], d[i + 2]]; }
          else col = hex(v * 3 < p.h || v * 3 >= p.h * 2 ? p.c0 : p.c1);
          c.fillStyle = rgb(col.map(q => clamp(q + (sh > 0.5 ? 40 : sh < -0.5 ? -40 : 0), 0, 255)));
          c.fillRect(x0 + u, y0 + v + dy, 1, 1);
        }
      }
    } },
  mkblinker: { en: 'MK Blinker', label: 'MK 깜빡이', cat: 'filter', ins: ['입력'], params: [
    Col('target', '대상 색', '#ffffff'), N('tol', '허용 오차', 0, 255, 1, 60), Col('light', '밝은 색', '#fff2a8'), N('prob', '확률', 0, 1, 0.05, 0.4),
    N('block', '유지 프레임', 1, 8, 1, 2), N('seed', '시드', 0, 99, 1, 1)],
    run(c, p, t, [im], n, f) {
      const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data, tc = hex(p.target), lc = hex(p.light), blk = Math.floor((f % S.frames) / p.block);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
        if (s[i + 3] && Math.hypot(s[i] - tc[0], s[i + 1] - tc[1], s[i + 2] - tc[2]) <= p.tol && hash(x, y, p.seed * 997 + blk) < p.prob) { d[i] = lc[0]; d[i + 1] = lc[1]; d[i + 2] = lc[2]; }
      }
      c.putImageData(id, 0, 0);
    } },
  mkfracture: { en: 'MK Fracture', label: 'MK 파편화', cat: 'transform', ins: ['입력'], params: [
    N('cols', '가로 조각', 1, 16, 1, 6), N('rows', '세로 조각', 1, 16, 1, 6), N('speed', '튕김 세기', 0, 100, 1, 40), N('spin', '회전(도)', 0, 360, 1, 120),
    N('grav', '중력', 0, 200, 1, 60), N('seed', '시드', 0, 99, 1, 1), Chk('fade', '페이드', true)],
    run(c, p, t, [im]) {
      const { W, H } = S, cw = W / p.cols, ch = H / p.rows, e = S.loop ? 0.5 - 0.5 * Math.cos(TAU * t) : t; // loop: burst out and reassemble
      for (let gy = 0; gy < p.rows; gy++) for (let gx = 0; gx < p.cols; gx++) {
        const r = rng(p.seed * 389 + gy * 64 + gx), cx = (gx + 0.5) * cw, cy = (gy + 0.5) * ch, dx = cx - W / 2, dy = cy - H / 2, l = Math.hypot(dx, dy) || 1, k = p.speed * (0.5 + r());
        c.save(); c.globalAlpha = p.fade ? 1 - e * e : 1;
        c.translate(Math.round(cx + dx / l * k * e + (r() - 0.5) * 10 * e), Math.round(cy + dy / l * k * e + 0.5 * p.grav * e * e));
        c.rotate((r() - 0.5) * 2 * p.spin * e * Math.PI / 180);
        c.drawImage(im, gx * cw, gy * ch, cw, ch, -cw / 2, -ch / 2, cw, ch); c.restore();
      }
    } },
  mkdelay: { en: 'MK Delay Machine', label: 'MK 딜레이 머신', cat: 'anim', ins: ['입력'], params: [
    N('count', '복제 수', 1, 12, 1, 4), N('step', '프레임 간격', 1, 8, 1, 1), N('ox', '오프셋 X', -32, 32, 1, 4), N('oy', '오프셋 Y', -32, 32, 1, 0),
    N('rot', '회전/단계(도)', -45, 45, 1, 0), N('scale', '크기/단계', -0.3, 0.3, 0.01, 0), N('fall', '알파 감쇠', 0.2, 0.95, 0.05, 0.7)],
    run(c, p, t, [im], n, f) {
      for (let j = p.count; j >= 0; j--) {
        const s = j ? src(n, f - j * p.step) : im; if (!s) continue;
        c.save(); c.globalAlpha = Math.pow(p.fall, j); c.translate(S.W / 2 + j * p.ox, S.H / 2 + j * p.oy);
        c.rotate(j * p.rot * Math.PI / 180); const k = Math.max(0.1, 1 + j * p.scale); c.scale(k, k);
        c.drawImage(s, -S.W / 2, -S.H / 2); c.restore();
      }
    } },
  mkflameball: { en: 'MK Blast Flame Ball', label: 'MK 화염구 폭발', cat: 'gen', ins: [], params: [
    N('x', '중심 X', 0, 1, 0.01, 0.5), N('y', '중심 Y', 0, 1, 0.01, 0.6), N('count', '덩어리 수', 3, 16, 1, 9), N('radius', '반경', 4, 40, 1, 18),
    N('spread', '퍼짐', 0, 48, 1, 16), N('rise', '상승', 0, 48, 1, 12), N('seed', '시드', 0, 99, 1, 1),
    Col('c0', '코어', '#ffffff'), Col('c1', '노랑', '#ffe34a'), Col('c2', '주황', '#ff7a1a'), Col('c3', '어둠', '#4a1a14')],
    run(c, p, t) { // one burst per loop: empty at t=0 and t=1 so it loops seamlessly
      const { W, H } = S, a = t, grow = 1 - Math.pow(1 - Math.min(1, a * 3), 2), fade = Math.min(1, (1 - a) * 2.5), cols = [p.c3, p.c2, p.c1, p.c0];
      const bl = [...Array(p.count).keys()].map(i => { const r = rng(p.seed * 131 + i), an = r() * TAU, d = (i ? 0.3 + 0.7 * r() : 0) * p.spread * grow;
        return { x: p.x * W + Math.cos(an) * d, y: p.y * H + Math.sin(an) * d * 0.8 - p.rise * a, r: p.radius * (i ? 0.4 + 0.5 * r() : 1) * grow * fade }; });
      for (let l = 0; l < 4; l++) { // dark outer first; hot inner layers shrink faster as it cools
        c.fillStyle = cols[l];
        for (const b of bl) { const rl = b.r * (1 - l * (0.17 + 0.3 * a)); if (rl >= 1) disc(c, b.x, b.y - l * b.r * 0.08, rl); }
      }
    } },
  mkdrip: { en: 'MK Drip', label: 'MK 흘러내림', cat: 'filter', ins: ['입력'], params: [
    N('density', '밀도', 0, 1, 0.05, 0.5), N('len', '최대 길이', 2, 48, 1, 14), N('cycles', '속도(주기)', 1, 3, 1, 1), N('seed', '시드', 0, 99, 1, 1)],
    run(c, p, t, [im]) {
      const { W, H } = S, d = pix(im); c.drawImage(im, 0, 0);
      for (let x = 0; x < W; x++) for (let y = 0; y < H - 1; y++) {
        const i = (y * W + x) * 4;
        if (d[i + 3] < 128 || d[i + W * 4 + 3] >= 128 || hash(x, y, p.seed) > p.density) continue; // opaque pixel with transparent pixel below
        const ph = frac(hash(x, y, p.seed + 7) + t * p.cycles), top = ph < 0.7 ? 0 : (ph - 0.7) / 0.3 * p.len, bot = ph < 0.7 ? p.len * ph / 0.7 : p.len * (1 + (ph - 0.7) / 0.3 * 0.5);
        c.fillStyle = rgb([d[i], d[i + 1], d[i + 2]]); c.fillRect(x, y + 1 + Math.round(top), 1, Math.max(0, Math.round(bot - top)));
      }
    } },
});
})();
