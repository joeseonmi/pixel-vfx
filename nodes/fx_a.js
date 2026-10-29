// Collection FX (A): disappear + transition effects. Progress q: auto = t over the clip, else manual slider.
(() => {
  const PR = [Chk('auto', '자동 진행', true), N('prog', '진행', 0, 1, 0.01, 0.5)];
  const Q = (p, t) => clamp(p.auto ? t : p.prog);
  const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; // 0..1 threshold; keep if bay > q
  // reverse-map warp: map(x,y)->[sx,sy] (nearest), keep(x,y)->bool filters dest pixels
  function warp(c, im, map, keep) {
    const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (keep && !keep(x, y)) continue;
      const m = map ? map(x, y) : [x, y];
      if (!m) continue;
      const sx = Math.round(m[0]), sy = Math.round(m[1]);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const j = (sy * W + sx) * 4;
      d.set(s.subarray(j, j + 4), (y * W + x) * 4);
    }
    c.putImageData(id, 0, 0);
  }
  const use = (key, ov, ins, t, n, f) => {
    const o = mkCanvas();
    DEFS[key].run(o.getContext('2d'), { ...defaults(DEFS[key]), ...ov }, t, ins, n, f);
    return o;
  };
  const dis = (key, en, label, params, run) => ({ [key]: { en, label, cat: 'fx', ins: ['입력'], params: [...PR, ...params], run(c, p, t, ins, n, f) { run(c, p, Q(p, t), ins[0], t, n, f); } } });
  const slide = (key, en, label, vx, vy) => {
    const run = (c, p, t, [a, b]) => {
      const q = Q(p, t), dx = Math.round(vx * S.W * q), dy = Math.round(vy * S.H * q);
      c.drawImage(a, dx, dy); c.drawImage(b, dx - vx * S.W, dy - vy * S.H);
    };
    return { [key]: { en, label, cat: 'fx', ins: ['A', 'B'], params: PR, run } };
  };
  const cellOf = (x, y, cs, seed) => { // nearest jittered grid point -> [gx, gy, px, py]
    let best = 1e9, r;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = Math.floor(x / cs) + i, gy = Math.floor(y / cs) + j;
      const px = (gx + hash(gx, gy, seed)) * cs, py = (gy + hash(gx, gy, seed + 7)) * cs, dd = (px - x) ** 2 + (py - y) ** 2;
      if (dd < best) { best = dd; r = [gx, gy, px, py]; }
    }
    return r;
  };

  defNodes(Object.assign({},
    dis('fx_cloak', 'Cloak', '클로킹', [N('amp', '일렁임', 0, 12, 1, 4)], (c, p, q, im) =>
      warp(c, im, (x, y) => [x + Math.sin(y * 0.5 + q * 6) * q * p.amp, y], (x, y) => bay(x, y) > q)),
    dis('fx_colorremove', 'Color Remove', '색 제거', [Col('col', '제거할 색', '#ffffff'), N('tol', '허용 거리', 0, 441, 1, 60)],
      (c, p, q, im, t, n, f) => c.drawImage(use('removecolor', { col: p.col, tol: p.tol }, [im], t, n, f), 0, 0)),
    dis('fx_dissolve', 'Dissolve', '디졸브', [N('seed', '시드', 0, 99, 1, 1)], (c, p, q, im) =>
      warp(c, im, null, (x, y) => hash(x, y, p.seed) > q)),
    dis('fx_erode', 'Erode', '깎여 사라짐', [], (c, p, q, im) => { // chamfer distance to transparent, keep dist > q*max
      const { W, H } = S, s = pix(im), D = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) D[i] = s[i * 4 + 3] ? 1e4 : 0;
      const rel = (i, j, w) => { if (D[j] + w < D[i]) D[i] = D[j] + w; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x;
        if (x) rel(i, i - 1, 1); if (y) { rel(i, i - W, 1); if (x) rel(i, i - W - 1, 1.4); if (x < W - 1) rel(i, i - W + 1, 1.4); } }
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x;
        if (x < W - 1) rel(i, i + 1, 1); if (y < H - 1) { rel(i, i + W, 1); if (x < W - 1) rel(i, i + W + 1, 1.4); if (x) rel(i, i + W - 1, 1.4); } }
      let mx = 0; for (let i = 0; i < W * H; i++) if (D[i] < 1e4) mx = Math.max(mx, D[i]);
      warp(c, im, null, (x, y) => D[y * W + x] > q * mx);
    }),
    dis('fx_explode', 'Explode', '조각 폭발', [N('size', '조각 크기', 3, 32, 1, 10), N('seed', '시드', 0, 99, 1, 1)], (c, p, q, im) => {
      const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4; if (!s[j + 3]) continue;
        const [gx, gy, px, py] = cellOf(x, y, p.size, p.seed), r = hash(gx, gy, p.seed + 3);
        let vx = px - W / 2, vy = py - H / 2, l = Math.hypot(vx, vy);
        if (l < 1) { const a = r * 6.283; vx = Math.cos(a); vy = Math.sin(a); l = 1; }
        const k = q * q * W * (0.9 + 0.6 * r) / l, nx = Math.round(x + vx * k), ny = Math.round(y + vy * k + q * q * H * 0.3);
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) d.set(s.subarray(j, j + 4), (ny * W + nx) * 4);
      }
      c.putImageData(id, 0, 0);
    }),
    dis('fx_fadeup', 'Fade up', '위로 사라짐', [N('dist', '이동 거리', 0, 64, 1, 24)], (c, p, q, im) =>
      warp(c, im, (x, y) => [x, y + q * p.dist], (x, y) => bay(x, y) > q)),
    dis('fx_mosaicscale', 'Mosaic scale', '모자이크 확대 소멸', [N('max', '최대 블록', 2, 32, 1, 16), N('seed', '시드', 0, 99, 1, 1)], (c, p, q, im) => {
      const b = 1 + Math.floor(q * p.max);
      warp(c, im, (x, y) => [x - x % b + (b >> 1), y - y % b + (b >> 1)], (x, y) => hash(Math.floor(x / b), Math.floor(y / b), p.seed) > q * q);
    }),
    dis('fx_mosaic', 'Mosaic', '모자이크 소멸', [N('size', '블록 크기', 2, 16, 1, 6), N('seed', '시드', 0, 99, 1, 1)], (c, p, q, im) => {
      const b = Math.round(p.size);
      warp(c, im, (x, y) => [x - x % b + (b >> 1), y - y % b + (b >> 1)], (x, y) => hash(Math.floor(x / b), Math.floor(y / b), p.seed) > q);
    }),
    dis('fx_pixelwipe', 'Pixel wipe', '픽셀 와이프', [N('angle', '각도', 0, 360, 1, 0), N('band', '확산 폭', 0.1, 1, 0.05, 0.4), N('seed', '시드', 0, 99, 1, 1)], (c, p, q, im) => {
      const a = p.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ext = S.W * Math.abs(ca) + S.H * Math.abs(sa) || 1, w = p.band;
      const dd = (x, y) => (q * (1 + w) - (((x - S.W / 2) * ca + (y - S.H / 2) * sa) / ext + 0.5)) / w;
      warp(c, im, (x, y) => { const k = clamp(dd(x, y)) * hash(x, y, p.seed + 1) * 8; return [x - ca * k, y - sa * k]; },
        (x, y) => { const k = dd(x, y); return k <= 0 || (k < 1 && hash(x, y, p.seed) > k); });
    }),
    dis('fx_rgbscale', 'RGB Scale', 'RGB 분리 확대', [N('spread', '분리 정도', 0, 2, 0.05, 0.5)], (c, p, q, im) => {
      const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (bay(x, y) <= q) continue;
        for (let ch = 0; ch < 3; ch++) {
          const k = 1 + q * p.spread * ch, sx = Math.round((x - W / 2) / k + W / 2), sy = Math.round((y - H / 2) / k + H / 2);
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
          const j = (sy * W + sx) * 4, i = (y * W + x) * 4;
          d[i + ch] = s[j + ch]; d[i + 3] = Math.max(d[i + 3], s[j + 3]);
        }
      }
      c.putImageData(id, 0, 0);
    }),
    dis('fx_speedaway', 'Speed away', '질주 소멸', [N('angle', '각도', 0, 360, 1, 0), N('len', '블러 길이', 0, 32, 1, 16)], (c, p, q, im, t, n, f) => {
      const a = p.angle * Math.PI / 180, o = q * q * Math.max(S.W, S.H) * 1.5;
      c.drawImage(use('dirblur', { angle: p.angle, len: q * p.len }, [im], t, n, f), Math.round(Math.cos(a) * o), Math.round(Math.sin(a) * o));
    }),
    dis('fx_tvoff', 'TV off', 'TV 꺼짐', [], (c, p, q, im) => {
      const { W, H } = S, a = clamp(q * 2), b = clamp(q * 2 - 1), sy = Math.max(1 - a, 0.03), sx = 1 - b;
      if (sx < 0.01) return;
      warp(c, im, (x, y) => [(x - W / 2) / sx + W / 2, (y - H / 2) / sy + H / 2]);
      const id = c.getImageData(0, 0, W, H), d = id.data, m = a * 0.8;
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] += (255 - d[i + k]) * m;
      c.putImageData(id, 0, 0);
    }),
    dis('fx_vanish', 'Vanish', '밀려 사라짐', [N('band', '줄 높이', 1, 16, 1, 4)], (c, p, q, im) =>
      warp(c, im, (x, y) => [x + (Math.floor(y / p.band) & 1 ? 1 : -1) * q * S.W * 1.2, y])),
    {
      fx_blurswap: { en: 'Blur swap', label: '블러 전환', cat: 'fx', ins: ['A', 'B'], params: [...PR, N('r', '블러', 0, 8, 1, 6)],
        run(c, p, t, [a, b], n, f) {
          const q = Q(p, t), ba = use('blur', { r: q * p.r }, [a], t, n, f), bb = use('blur', { r: (1 - q) * p.r }, [b], t, n, f);
          const { W, H } = S, x = pix(ba), y = pix(bb), id = c.createImageData(W, H);
          for (let i = 0; i < W * H; i++) id.data.set((bay(i % W, (i / W) | 0) > q ? x : y).subarray(i * 4, i * 4 + 4), i * 4);
          c.putImageData(id, 0, 0);
        } },
      fx_flip: { en: 'Flip', label: '뒤집기 전환', cat: 'fx', ins: ['A', 'B'], params: PR,
        run(c, p, t, [a, b]) {
          const q = Q(p, t), w = S.W, sx = Math.abs(Math.cos(q * Math.PI));
          if (sx < 0.01) return;
          warp(c, q < 0.5 ? a : b, (x, y) => [(x - w / 2) / sx + w / 2, y]);
        } },
    },
    slide('fx_slidedown', 'Slide down', '아래로 밀기', 0, 1),
    slide('fx_slideleft', 'Slide left', '왼쪽 밀기', -1, 0),
    slide('fx_slideright', 'Slide right', '오른쪽 밀기', 1, 0),
    slide('fx_slideup', 'Slide up', '위로 밀기', 0, -1)
  ));
})();
