// fx_d: collection effects (transform motions, fake 3D, procedural sprites). See nodes/API.md
(() => {
  const TAU = Math.PI * 2;
  // draw input with nearest sampling: translate (tx,ty), scale, rotate (rad) around pivot (px,py)
  const aff = (c, im, tx, ty, sx, sy, rot, px = S.W / 2, py = S.H / 2) => {
    c.imageSmoothingEnabled = false; c.save();
    c.translate(Math.round(tx + px), Math.round(ty + py)); c.rotate(rot); c.scale(sx, sy);
    c.drawImage(im, -px, -py); c.restore();
  };
  // copy of im with its opaque pixels blended toward color
  const tint = (im, col, a) => {
    const cv = mkCanvas(), x = cv.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, S.W, S.H);
    return cv;
  };
  // replace canvas pixels: transparent pixels within w steps (4-neighbour) of opaque ones get color
  const outline = (cv, col, w) => {
    const x = cv.getContext('2d'), { W, H } = S, id = x.getImageData(0, 0, W, H), d = id.data, k = hex(col);
    for (let s = 0; s < w; s++) {
      const src = d.slice();
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        const i = (y * W + xx) * 4;
        if (src[i + 3]) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const j = sample(src, W, H, xx + a, y + b); return j >= 0 && src[j + 3]; })) { d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255; }
      }
    }
    x.putImageData(id, 0, 0);
  };
  // hard filled ellipse
  const ell = (c, cx, cy, rx, ry, col) => {
    c.fillStyle = col;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const q = 1 - ((y + 0.5 - cy) / ry) ** 2;
      if (q < 0) continue;
      const hw = rx * Math.sqrt(q), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
      c.fillRect(x0, y, Math.max(1, x1 - x0), 1);
    }
  };
  const move = (en, label, dx, dy) => ({ en, label, cat: 'fx', ins: ['입력'], params: [N('dist', '거리(루프 꺼짐)', 1, 128, 1, 32)],
    run(c, p, t, [im]) {
      const per = dx ? S.W : S.H, off = S.loop ? per * t : p.dist * t;
      aff(c, im, dx * off, dy * off, 1, 1, 0);
      if (S.loop) aff(c, im, dx * (off - per), dy * (off - per), 1, 1, 0);
    } });
  const scl = (en, label, def, mn, mx) => ({ en, label, cat: 'fx', ins: ['입력'], params: [N('k', '목표 배율', mn, mx, 0.05, def)],
    run(c, p, t, [im]) { const e = S.loop ? Math.sin(Math.PI * t) : t, s = lerp(1, p.k, e); aff(c, im, 0, 0, s, s, 0); } });
  const ext = (c, im, n, dx, dy, shade, grad) => { // stacked darkened copies behind input, farthest first
    for (let i = n; i >= 1; i--) aff(c, tint(im, '#000', shade * (grad ? lerp(0.6, 1, i / n) : 1)), dx * i, dy * i, 1, 1, 0);
    c.drawImage(im, 0, 0);
  };

  defNodes({
    fx_hitsubtle: { en: 'Hit subtle', label: '살짝 타격', cat: 'fx', ins: ['입력'], params: [N('squash', '찌그러짐', 0, 0.6, 0.02, 0.25), N('rot', '회전', 0, 45, 1, 8), N('flash', '흰색 번쩍임', 0, 1, 0.05, 0.6)],
      run(c, p, t, [im]) {
        const u = Math.max(0, (t - 0.1) / 0.9), d = t < 0.1 ? 0 : (1 - u) ** 3, w = Math.cos(2 * TAU * u), sx = 1 + p.squash * d * w;
        aff(c, tint(im, '#fff', p.flash * d * d), 0, 0, sx, 1 / sx, p.rot * d * Math.sin(2 * TAU * u) * Math.PI / 180, S.W / 2, S.H * 0.9);
      } },
    fx_hover: { en: 'Hover', label: '둥실', cat: 'fx', ins: ['입력'], params: [N('ax', '진폭 X', 0, 32, 1, 2), N('ay', '진폭 Y', 0, 32, 1, 4), N('fx', '속도 X(횟수)', 0, 8, 1, 1), N('fy', '속도 Y(횟수)', 0, 8, 1, 1)],
      run(c, p, t, [im]) { aff(c, im, p.ax * Math.sin(TAU * p.fx * t), p.ay * Math.sin(TAU * p.fy * t), 1, 1, 0); } },
    fx_movedown: move('Move down', '아래 이동', 0, 1),
    fx_moveleft: move('Move left', '왼쪽 이동', -1, 0),
    fx_moveright: move('Move right', '오른쪽 이동', 1, 0),
    fx_moveup: move('Move up', '위로 이동', 0, -1),
    fx_scaledown: scl('Scale down', '작아짐', 0.2, 0.05, 1),
    fx_scaleup: scl('Scale up', '커짐', 2, 1, 4),
    fx_swing: { en: 'Swing', label: '흔들림', cat: 'fx', ins: ['입력'], params: [N('ang', '각도', 0, 90, 1, 20), N('pivy', '축 높이', 0, 1, 0.05, 0.1), N('cyc', '횟수', 1, 4, 1, 1)],
      run(c, p, t, [im]) { aff(c, im, 0, 0, 1, 1, p.ang * Math.sin(TAU * p.cyc * t) * Math.PI / 180, S.W / 2, S.H * p.pivy); } },
    fx_wiggle: { en: 'Wiggle', label: '꿈틀', cat: 'fx', ins: ['입력'], params: [N('amp', '세기', 0, 32, 1, 3), N('freq', '빈도(정수)', 1, 16, 1, 4), N('seed', '시드', 0, 999, 1, 1)],
      run(c, p, t, [im]) {
        const P = Math.round(p.freq), u = t * P, o = s => (vnoise(u, 0.5, P, p.seed + s) - 0.5) * 2 * p.amp;
        aff(c, im, o(0), o(7), 1, 1, 0);
      } },

    fx_bevellight: { en: 'Bevel light', label: '베벨 조명', cat: 'fx', ins: ['입력'], params: [N('inten', '조명 세기', 0, 2, 0.05, 1), N('range', '범위', 1, 16, 1, 5), N('lx', '조명 X', 0, 1, 0.05, 0.2), N('ly', '조명 Y', 0, 1, 0.05, 0.2), N('height', '높이', 0.1, 3, 0.1, 1), N('blend', '혼합', 0, 1, 0.05, 1)],
      run(c, p, t, [im]) {
        const { W, H } = S, s = pix(im), id = c.createImageData(W, H), o = id.data, h = new Float32Array(W * H);
        const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : h[y * W + x]);
        for (let i = 0; i < W * H; i++) h[i] = s[i * 4 + 3] ? 1e3 : 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (h[i]) h[i] = Math.min(h[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4); }
        for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (h[i]) h[i] = Math.min(h[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4); }
        for (let i = 0; i < W * H; i++) h[i] = Math.min(h[i], p.range) * p.height;
        const L = [p.lx - 0.5, p.ly - 0.5, 0.5], ll = Math.hypot(...L), flat = L[2] / ll;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4; if (!s[i + 3]) continue;
          const nx = -(at(x + 1, y) - at(x - 1, y)) / 2, ny = -(at(x, y + 1) - at(x, y - 1)) / 2, nl = Math.hypot(nx, ny, 1);
          const k = 1 + p.inten * 2 * ((nx * L[0] + ny * L[1] + L[2]) / (nl * ll) - flat);
          for (let j = 0; j < 3; j++) o[i + j] = lerp(s[i + j], clamp(s[i + j] * k, 0, 255), p.blend);
          o[i + 3] = s[i + 3];
        }
        c.putImageData(id, 0, 0);
      } },
    fx_cointoss: { en: 'Coin toss', label: '동전 던지기', cat: 'fx', ins: [], params: [Col('side', '옆면 색', '#a8741a'), Col('border', '테두리 색', '#d9a21f'), Col('inside', '안쪽 색', '#ffe070'), N('r', '크기', 4, 60, 1, 20), N('th', '두께', 1, 24, 1, 6), N('bw', '테두리 폭', 1, 10, 1, 3), N('flips', '회전 수', 1, 4, 1, 2), N('hop', '점프 높이', 0, 32, 1, 8)],
      run(c, p, t) {
        const a = TAU * p.flips * t, cs = Math.abs(Math.cos(a)), e = p.th / 2 * Math.abs(Math.sin(a)), sg = Math.cos(a) >= 0 ? 1 : -1;
        const cx = S.W / 2, cy = S.H / 2 - p.hop * Math.sin(Math.PI * t), rx = Math.max(1, p.r * cs);
        for (let x = -Math.round(e); x <= Math.round(e); x++) ell(c, cx + x, cy, rx, p.r, p.side);
        const fx = cx + sg * e;
        ell(c, fx, cy, rx, p.r, p.border); ell(c, fx, cy, Math.max(0.5, (p.r - p.bw) * cs), p.r - p.bw, p.inside);
      } },
    fx_extrude2d: { en: 'Extrude 2D', label: '2D 돌출', cat: 'fx', ins: ['입력'], params: [N('dist', '거리', 1, 48, 1, 10), N('ang', '각도', -180, 180, 5, 45), N('shade', '어둡기', 0, 1, 0.05, 0.5)],
      run(c, p, t, [im]) { const a = p.ang * Math.PI / 180; ext(c, im, p.dist, Math.cos(a), Math.sin(a), p.shade, false); } },
    fx_extrude: { en: 'Extrude', label: '돌출', cat: 'fx', ins: ['입력'], params: [N('th', '두께', 1, 32, 1, 8), N('skew', '기울기', -1, 1, 0.1, 0.4), N('shade', '어둡기', 0, 1, 0.05, 0.6)],
      run(c, p, t, [im]) { ext(c, im, p.th, p.skew, 1, p.shade, true); } },
    fx_stack: { en: 'Stack', label: '스프라이트 스택', cat: 'fx', ins: ['입력'], params: [N('n', '층 수', 2, 32, 1, 8), N('sp', '층 간격', 1, 4, 1, 1), N('spin', '회전 수', 0, 3, 1, 1), Col('oc', '외곽선 색', '#000000'), N('ow', '외곽선 폭', 0, 3, 1, 1)],
      run(c, p, t, [im]) {
        const g = mkCanvas(), x = g.getContext('2d');
        for (let i = 0; i < p.n; i++) {
          const rot = TAU * p.spin * t, k = tint(im, '#000', 0.5 * (1 - i / (p.n - 1)));
          x.save(); x.translate(0, Math.round(p.n * p.sp / 2 - i * p.sp)); x.imageSmoothingEnabled = false;
          aff(x, k, 0, 0, 1, 1, rot); x.restore();
        }
        if (p.ow) outline(g, p.oc, p.ow);
        c.drawImage(g, 0, 0);
      } },
  });
})();
