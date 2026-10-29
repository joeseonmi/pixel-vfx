// Collection effects (part b): filters, warps, decorations. Reuses DEFS.twirl / polarmirror / pixelate / glow.
(() => {
const TAU = Math.PI * 2;
const CTR = [N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5)];
// run an existing node on `ins`, return its result canvas
const use = (key, over, ins, t, n, f) => {
  const o = mkCanvas();
  DEFS[key].run(o.getContext('2d'), { ...defaults(DEFS[key]), ...over }, t, ins, n, f);
  return o;
};
// per-pixel output: fn(d, s, x, y, i, W, H) writes into d; s = input RGBA
const each = (c, im, fn) => {
  const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fn(d, s, x, y, (y * W + x) * 4, W, H);
  c.putImageData(id, 0, 0);
};
const put = (d, i, s, j) => { if (j >= 0) { d[i] = s[j]; d[i + 1] = s[j + 1]; d[i + 2] = s[j + 2]; d[i + 3] = s[j + 3]; } };
// source-warp around (cx,cy): fn(dx,dy) -> [sdx,sdy] (pixel offsets from centre)
const wp = (c, im, p, fn) => {
  const X = p.cx * S.W, Y = p.cy * S.H;
  each(c, im, (d, s, x, y, i, W, H) => {
    const r = fn(x + 0.5 - X, y + 0.5 - Y);
    put(d, i, s, sample(s, W, H, r[0] + X, r[1] + Y));
  });
};
const PAL = { gb: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], gray: ['#000000', '#555555', '#aaaaaa', '#ffffff'],
  gba: ['#1b1b2f', '#5b3a73', '#cc4a5a', '#f0a050', '#f4e8a0', '#ffffff'], sepia: ['#2b1a10', '#6b4428', '#b08050', '#e8d0a0'],
  ice: ['#0a1630', '#1f4a7a', '#4a9ad0', '#a8e0f0', '#ffffff'] };

defNodes({
  fx_channelextract: { en: 'Channel extract', label: '채널 분리', cat: 'fx', ins: ['입력'], params: [N('dist', '거리', 0, 12, 1, 3)],
    run(c, p, t, [im]) {
      const a = TAU * t;
      each(c, im, (d, s, x, y, i, W, H) => {
        let al = 0;
        for (let k = 0; k < 3; k++) {
          const j = sample(s, W, H, x + Math.round(Math.cos(a + k * TAU / 3) * p.dist), y + Math.round(Math.sin(a + k * TAU / 3) * p.dist));
          if (j >= 0) { d[i + k] = s[j + k]; al = Math.max(al, s[j + 3]); }
        }
        d[i + 3] = al;
      });
    } },
  fx_crosshatch: { en: 'Cross hatch', label: '크로스해칭', cat: 'fx', ins: ['입력'], params: [
    N('size', '해치 간격', 2, 10, 1, 4), N('width', '선 굵기', 1, 4, 1, 1), Col('ink', '선 색', '#222233'), Col('paper', '종이 색', '#f4ecd8')],
    run(c, p, t, [im]) {
      const g = p.size, w = p.width, ink = hex(p.ink), pa = hex(p.paper);
      each(c, im, (d, s, x, y, i) => {
        if (!s[i + 3]) return;
        const l = lum(s, i), m = (v) => ((v % g) + g) % g < w;
        const on = (l < 0.8 && m(x + y)) || (l < 0.55 && m(x - y)) || (l < 0.35 && m(y)) || (l < 0.18 && m(x));
        const q = on ? ink : pa; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
      });
    } },
  fx_crumpled: { en: 'Crumpled', label: '구김 종이', cat: 'fx', ins: ['입력'], params: [
    N('scale', '디테일 크기', 1, 8, 1, 3), N('level', '디테일 단계', 1, 4, 1, 3), N('strength', '강도', 0, 4, 0.1, 1.5), N('ambient', '주변광', 0, 1, 0.05, 0.5)],
    run(c, p, t, [im]) {
      const { W, H } = S, h = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let v = 0, a = 1;
        for (let o = 0; o < p.level; o++, a /= 2) v += a * Math.abs(vnoise(x / W * p.scale * 2 ** o, y / H * p.scale * 2 ** o, p.scale * 2 ** o, 7) * 2 - 1);
        h[y * W + x] = v;
      }
      const g = (x, y) => h[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
      each(c, im, (d, s, x, y, i) => {
        const nx = (g(x - 1, y) - g(x + 1, y)) * p.strength * 8, ny = (g(x, y - 1) - g(x, y + 1)) * p.strength * 8;
        const dot = (nx * -0.5 + ny * -0.5 + 0.7) / Math.hypot(nx, ny, 1);
        const m = p.ambient + (1 - p.ambient) * clamp(dot / 0.7, 0, 1.6);
        d[i] = s[i] * m; d[i + 1] = s[i + 1] * m; d[i + 2] = s[i + 2] * m; d[i + 3] = s[i + 3];
      });
    } },
  fx_dotmatrix: { en: 'Dot matrix', label: '도트 매트릭스', cat: 'fx', ins: ['입력'], params: [N('cell', '셀 크기', 2, 10, 1, 4), N('dot', '점 크기', 0.3, 1, 0.05, 0.8)],
    run(c, p, t, [im]) {
      const g = p.cell, r = g * p.dot / 2;
      each(c, im, (d, s, x, y, i, W, H) => {
        const cx = x - x % g + g / 2, cy = y - y % g + g / 2;
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) put(d, i, s, sample(s, W, H, Math.min(W - 1, cx), Math.min(H - 1, cy)));
      });
    } },
  fx_gba: { en: 'GBA', label: '게임보이 팔레트', cat: 'fx', ins: ['입력'], params: [
    Sel('pal', '팔레트', [['gb', '게임보이 초록'], ['gray', '회색 4톤'], ['gba', 'GBA 6색'], ['sepia', '세피아'], ['ice', '아이스']], 'gb'), N('contrast', '대비', 0.5, 2, 0.05, 1)],
    run(c, p, t, [im]) {
      const pal = PAL[p.pal].map(hex), n = pal.length;
      each(c, im, (d, s, x, y, i) => {
        if (!s[i + 3]) return;
        const q = pal[Math.min(n - 1, Math.floor(clamp((lum(s, i) - 0.5) * p.contrast + 0.5) * n))];
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
      });
    } },
  fx_glitch: { en: 'Glitch', label: '글리치', cat: 'fx', ins: ['입력'], params: [
    N('detail', '디테일(줄 수)', 2, 32, 1, 12), N('intensity', '강도', 0, 24, 1, 8), N('speed', '속도(루프당 횟수)', 1, 4, 1, 1), N('split', 'RGB 분리', 0, 6, 1, 2)],
    run(c, p, t, [im]) {
      each(c, im, (d, s, x, y, i, W, H) => {
        const P = p.detail, nz = vnoise(y / H * P, t * p.speed * P, P, 3) - 0.5;
        const dx = Math.abs(nz) < 0.12 ? 0 : Math.round(nz * 2 * p.intensity);
        const rj = sample(s, W, H, x + dx + p.split, y), gj = sample(s, W, H, x + dx, y), bj = sample(s, W, H, x + dx - p.split, y);
        if (rj >= 0) d[i] = s[rj]; if (gj >= 0) d[i + 1] = s[gj + 1]; if (bj >= 0) d[i + 2] = s[bj + 2];
        d[i + 3] = Math.max(rj >= 0 ? s[rj + 3] : 0, gj >= 0 ? s[gj + 3] : 0, bj >= 0 ? s[bj + 3] : 0);
      });
    } },
  fx_lcd: { en: 'LCD', label: 'LCD 서브픽셀', cat: 'fx', ins: ['입력'], params: [N('scale', '셀 크기(3배수 권장)', 3, 12, 1, 3)],
    run(c, p, t, [im]) {
      const g = p.scale;
      each(c, im, (d, s, x, y, i, W, H) => {
        const j = sample(s, W, H, Math.min(W - 1, x - x % g + g / 2), Math.min(H - 1, y - y % g + g / 2));
        if (j < 0 || !s[j + 3]) return;
        const ch = Math.min(2, Math.floor((x % g) / (g / 3))), dark = y % g === g - 1 ? 0.25 : 1;
        d[i + ch] = s[j + ch] * dark; d[i + 3] = 255;
      });
    } },
  fx_ledglow: { en: 'LED Glow', label: 'LED 발광', cat: 'fx', ins: ['입력'], params: [
    N('cell', 'LED 간격', 2, 10, 1, 4), N('radius', '발광 반경', 0, 8, 0.5, 2), N('bright', '밝기', 0.5, 3, 0.1, 1.5), N('strength', '발광 강도', 0, 3, 0.1, 1.2)],
    run(c, p, t, [im]) {
      const g = p.cell, dots = mkCanvas(), dc = dots.getContext('2d'), s = pix(im);
      for (let y = 0; y < S.H; y += g) for (let x = 0; x < S.W; x += g) {
        const j = sample(s, S.W, S.H, Math.min(S.W - 1, x + g / 2), Math.min(S.H - 1, y + g / 2));
        if (j < 0 || !s[j + 3]) continue;
        dc.fillStyle = rgb([0, 1, 2].map(k => Math.min(255, s[j + k] * p.bright)));
        disc(dc, x + g / 2, y + g / 2, g * 0.38);
      }
      c.drawImage(use('glow', { radius: p.radius, strength: p.strength }, [dots], t, null, 0), 0, 0);
    } },
  fx_pixelatefx: { en: 'Pixelate', label: '픽셀화(컬렉션)', cat: 'fx', ins: ['입력'], params: [N('size', '블록 크기', 1, 16, 1, 4)],
    run(c, p, t, [im], n, f) { c.drawImage(use('pixelate', { size: p.size }, [im], t, n, f), 0, 0); } },
  fx_rimlight: { en: 'Rim light', label: '림라이트', cat: 'fx', ins: ['입력'], params: [
    Col('color', '색', '#fff3b0'), N('thick', '두께', 1, 6, 1, 2), N('angle', '각도', 0, 360, 15, 45), N('alpha', '투명도', 0, 1, 0.05, 1)],
    run(c, p, t, [im]) {
      const a = p.angle * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a), col = hex(p.color);
      each(c, im, (d, s, x, y, i, W, H) => {
        if (!s[i + 3]) return;
        let lit = false;
        for (let k = 1; k <= p.thick && !lit; k++) { const j = sample(s, W, H, x + Math.round(dx * k), y + Math.round(dy * k)); lit = j >= 0 && !s[j + 3]; }
        const q = lit ? lerpC([s[i], s[i + 1], s[i + 2]], col, p.alpha) : [s[i], s[i + 1], s[i + 2]];
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = s[i + 3];
      });
    } },
  fx_wave: { en: 'Wave', label: '물결', cat: 'fx', ins: ['입력'], params: [
    N('amp', '진폭', 0, 16, 1, 3), N('angle', '각도', 0, 180, 15, 0), N('size', '파장', 4, 64, 1, 16), N('speed', '속도(루프당 횟수)', 0, 4, 1, 1)],
    run(c, p, t, [im]) {
      const a = p.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      each(c, im, (d, s, x, y, i, W, H) => {
        const o = p.amp * Math.sin(TAU * ((x * ca + y * sa) / p.size - t * p.speed));
        put(d, i, s, sample(s, W, H, Math.round(x - sa * o), Math.round(y + ca * o)));
      });
    } },

  fx_bubble: { en: 'Bubble', label: '버블', cat: 'fx', ins: ['입력'], params: [N('strength', '강도', 0, 1.5, 0.05, 0.7), N('radius', '반경', 4, 96, 1, 28), ...CTR],
    run(c, p, t, [im]) {
      const k = p.strength * (1 - Math.cos(TAU * t)) / 2;
      wp(c, im, p, (dx, dy) => { const r = Math.hypot(dx, dy), q = r >= p.radius ? 1 : Math.pow(r / p.radius, k); return [dx * q, dy * q]; });
    } },
  fx_hmmmm: { en: 'Hmmmm', label: '흐음', cat: 'fx', ins: ['입력'], params: [
    Sel('preset', '프리셋', [['soft', '약하게'], ['mid', '보통'], ['hard', '강하게'], ['rev', '반대 방향']], 'mid'), ...CTR],
    run(c, p, t, [im], n, f) {
      const q = { soft: [1.5, 32], mid: [3, 48], hard: [5, 64], rev: [-3, 48] }[p.preset];
      c.drawImage(use('twirl', { strength: q[0], radius: q[1], anim: true, cx: p.cx, cy: p.cy }, [im], t, n, f), 0, 0);
    } },
  fx_kaleidoscope: { en: 'Kaleidoscope', label: '만화경', cat: 'fx', ins: ['입력'], params: [
    N('n', '분할 수', 2, 16, 1, 6), N('rot', '회전', 0, 360, 5, 0), N('spin', '회전 바퀴 수(루프당)', -2, 2, 1, 0), ...CTR],
    run(c, p, t, [im], n, f) { c.drawImage(use('polarmirror', { n: p.n, rot: p.rot, spin: p.spin * 360, cx: p.cx, cy: p.cy }, [im], t, n, f), 0, 0); } },
  fx_ripple: { en: 'Ripple', label: '물결 퍼짐', cat: 'fx', ins: ['입력'], params: [
    N('strength', '강도', 0, 10, 0.5, 3), N('size', '파장', 4, 48, 1, 14), N('speed', '속도(루프당 횟수)', 1, 4, 1, 1), ...CTR],
    run(c, p, t, [im]) {
      wp(c, im, p, (dx, dy) => {
        const r = Math.hypot(dx, dy) || 1, o = p.strength * Math.sin(TAU * (r / p.size - t * p.speed)) * Math.max(0, 1 - r / (S.W * 0.9));
        return [dx + dx / r * o, dy + dy / r * o];
      });
    } },
  fx_twirlin: { en: 'Twirl in', label: '안쪽 소용돌이', cat: 'fx', ins: ['입력'], params: [N('strength', '강도', 0, 6, 0.1, 3), N('radius', '반경', 4, 128, 1, 48), ...CTR],
    run(c, p, t, [im], n, f) { c.drawImage(use('twirl', { strength: p.strength * Math.sin(Math.PI * t), radius: p.radius, cx: p.cx, cy: p.cy }, [im], t, n, f), 0, 0); } },
  fx_twirlout: { en: 'Twirl out', label: '바깥 소용돌이', cat: 'fx', ins: ['입력'], params: [N('strength', '강도', 0, 6, 0.1, 3), N('radius', '반경', 4, 128, 1, 48), ...CTR],
    run(c, p, t, [im], n, f) { c.drawImage(use('twirl', { strength: -p.strength * Math.sin(Math.PI * t), radius: p.radius, cx: p.cx, cy: p.cy }, [im], t, n, f), 0, 0); } },
  fx_warpspin: { en: 'Warp spin', label: '회전 왜곡', cat: 'fx', ins: ['입력'], params: [
    N('turns', '회전 수(루프당)', -2, 2, 1, 1), N('twist', '비틀림', -6, 6, 0.5, 2), N('radius', '반경', 4, 128, 1, 48), ...CTR],
    run(c, p, t, [im]) {
      wp(c, im, p, (dx, dy) => {
        const w = Math.max(0, 1 - Math.hypot(dx, dy) / p.radius), a = TAU * p.turns * t + p.twist * w * Math.sin(TAU * t), cs = Math.cos(a), sn = Math.sin(a);
        return [dx * cs - dy * sn, dx * sn + dy * cs];
      });
    } },
  fx_water: { en: 'Water', label: '물속 일렁임', cat: 'fx', ins: ['입력'], params: [
    N('strength', '강도', 0, 8, 0.5, 3), N('scale', '크기(셀 수)', 1, 8, 1, 3), N('speed', '속도(루프당 순환 수)', 0, 4, 1, 1)],
    run(c, p, t, [im]) {
      const P = p.scale;
      each(c, im, (d, s, x, y, i, W, H) => {
        const u = x / W * P, v = y / H * P, sh = t * p.speed * P;
        const ox = (vnoise(u + sh, v, P, 11) - 0.5) * 2 * p.strength, oy = (vnoise(u, v + sh, P, 12) - 0.5) * 2 * p.strength;
        put(d, i, s, sample(s, W, H, Math.round(x + ox), Math.round(y + oy)));
      });
    } },

  fx_corner: { en: 'Corner', label: '코너 장식', cat: 'fx', ins: ['입력'], params: [
    N('scale', '크기', 1, 4, 1, 2), N('margin', '여백', 0, 8, 1, 1), Col('c1', '색 1', '#ffd84a'), Col('c2', '색 2', '#a8542a')],
    run(c, p, t, [im]) {
      const B = ['11111111', '12222221', '12111111', '12120000', '12100000', '12100000', '12100000', '11100000'], k = p.scale, m = p.margin, cols = { 1: p.c1, 2: p.c2 };
      c.drawImage(im, 0, 0);
      B.forEach((row, y) => [...row].forEach((v, x) => {
        if (v === '0') return;
        c.fillStyle = cols[v];
        for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]])
          c.fillRect(fx ? S.W - m - (x + 1) * k : m + x * k, fy ? S.H - m - (y + 1) * k : m + y * k, k, k);
      }));
    } },
  fx_frame: { en: 'Frame', label: '액자 테두리', cat: 'fx', ins: ['입력'], params: [
    N('thick', '두께', 1, 16, 1, 4), Col('light', '밝은 면', '#f0e0a0'), Col('mid', '어두운 면', '#a8824a'), Col('dark', '외곽선', '#3a2410')],
    run(c, p, t, [im]) {
      const { W, H } = S, th = p.thick;
      c.drawImage(im, 0, 0);
      for (let d = 0; d < th; d++) {
        c.fillStyle = d === 0 || (d === th - 1 && th > 2) ? p.dark : p.light;
        c.fillRect(d, d, W - 2 * d, 1); c.fillRect(d, d, 1, H - 2 * d);
        c.fillStyle = d === 0 || (d === th - 1 && th > 2) ? p.dark : p.mid;
        c.fillRect(d, H - 1 - d, W - 2 * d, 1); c.fillRect(W - 1 - d, d + 1, 1, H - 2 * d - 1);
      }
    } },
});
})();
