// gen nodes. See nodes/API.md
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
    Sel('type', '종류', [['circle', '원'], ['ring', '링'], ['star', '별'], ['cross', '십자']], 'ring'),
    N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5),
    N('s0', '크기 시작', 1, 64, 1, 4), N('s1', '크기 끝', 1, 64, 1, 24),
    N('th', '두께', 1, 16, 1, 3), N('rot', '회전 속도', -720, 720, 15, 0),
    Col('color', '색', '#ffffff'), Chk('fade', '페이드', true)],
    run(c, p, t) {
      const { W, H } = S, id = c.createImageData(W, H), d = id.data, col = hex(p.color);
      const r = lerp(p.s0, p.s1, 1 - (1 - t) * (1 - t)), rot = p.rot * t * Math.PI / 180, al = p.fade ? 255 * (1 - t) : 255;
      const cr = Math.cos(rot), sr = Math.sin(rot), h = p.th / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - p.cx * W, dy = y + 0.5 - p.cy * H, dist = Math.hypot(dx, dy);
        let on;
        if (p.type === 'circle') on = dist <= r;
        else if (p.type === 'ring') on = dist <= r && dist > r - p.th;
        else if (p.type === 'star') on = dist <= r * (0.4 + 0.6 * Math.pow(Math.abs(Math.cos(2.5 * (Math.atan2(dy, dx) - rot))), 2));
        else { const rx = dx * cr + dy * sr, ry = -dx * sr + dy * cr;
          on = (Math.abs(rx) <= r && Math.abs(ry) <= h) || (Math.abs(ry) <= r && Math.abs(rx) <= h); }
        if (on) { const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = al; }
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
