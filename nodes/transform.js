// transform nodes. See nodes/API.md
defNodes({
  transform: { en: 'Transform', cat: 'transform', label: '변형', ins: ['입력'], params: [
    N('ox', '이동 X', -64, 64, 1, 0), N('oy', '이동 Y', -64, 64, 1, 0), N('scale', '크기', 0.1, 4, 0.05, 1),
    N('rot', '회전', -180, 180, 1, 0), N('spin', '회전 속도', -720, 720, 15, 0)],
    run(c, p, t, [im]) {
      c.imageSmoothingEnabled = false;
      c.translate(S.W / 2 + Math.round(p.ox), S.H / 2 + Math.round(p.oy));
      c.rotate((p.rot + p.spin * t) * Math.PI / 180); c.scale(p.scale, p.scale);
      c.drawImage(im, -S.W / 2, -S.H / 2);
    } },
  echo: { en: 'Echo', cat: 'transform', label: '잔상', ins: ['입력'], params: [N('count', '개수', 1, 6, 1, 3), N('decay', '감쇠', 0.2, 0.9, 0.05, 0.6)],
    run(c, p, t, [im], n, f) {
      const src = byId(n.in[0]);
      if (src) for (let j = p.count; j >= 1; j--) {
        c.globalAlpha = Math.pow(p.decay, j);
        c.drawImage(evaluate(src, S.loop ? ((f - j) % S.frames + S.frames) % S.frames : Math.max(0, f - j)), 0, 0);
      }
      c.globalAlpha = 1; c.drawImage(im, 0, 0);
    } },
  displace: { en: 'Displace', cat: 'transform', label: '왜곡', ins: ['입력', '맵'], params: [N('strength', '세기', 0, 32, 1, 8), Sel('axis', '축', [['both', 'X+Y'], ['x', 'X'], ['y', 'Y']], 'both')],
    run(c, p, t, [im, mk]) {
      const { W, H } = S, s = pix(im), m = pix(mk), id = c.createImageData(W, H), d = id.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, o = Math.round((lum(m, i) - 0.5) * p.strength);
        const sx = x + (p.axis !== 'y' ? o : 0), sy = y + (p.axis !== 'x' ? o : 0);
        if (sx >= 0 && sy >= 0 && sx < W && sy < H) d.set(s.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), i);
      }
      c.putImageData(id, 0, 0);
    } },
  polar: { en: 'Polar', cat: 'transform', label: '극좌표', ins: ['입력'], params: [Chk('inv', '역변환', false)],
    run(c, p, t, [im]) { // forward: input x -> angle, input y -> radius
      const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data, R = Math.min(W, H) / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let sx, sy;
        if (p.inv) { const a = (x + 0.5) / W * 2 * Math.PI, r = (y + 0.5) / H * R; sx = Math.floor(W / 2 + Math.cos(a) * r); sy = Math.floor(H / 2 + Math.sin(a) * r); }
        else { const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2, r = Math.hypot(dx, dy) / R; if (r >= 1) continue; sx = Math.floor((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1 * W); sy = Math.floor(r * H); }
        if (sx >= 0 && sy >= 0 && sx < W && sy < H) d.set(s.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), (y * W + x) * 4);
      }
      c.putImageData(id, 0, 0);
    } },
  pixelate: { en: 'Pixelate', cat: 'transform', label: '픽셀화', ins: ['입력'], params: [N('size', '블록 크기', 1, 8, 1, 2)],
    run(c, p, t, [im]) {
      const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data, b = Math.round(p.size);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = (Math.min(H - 1, y - y % b + (b >> 1)) * W + Math.min(W - 1, x - x % b + (b >> 1))) * 4;
        d.set(s.subarray(j, j + 4), (y * W + x) * 4);
      }
      c.putImageData(id, 0, 0);
    } },
});
