// batch B: extra filter effects + warps. See nodes/API.md
(() => {
// local helpers
const px = (c, fn) => { const id = c.createImageData(S.W, S.H); fn(id.data, S.W, S.H); c.putImageData(id, 0, 0); };
const cp = (d, i, s, j) => { d[i] = s[j]; d[i + 1] = s[j + 1]; d[i + 2] = s[j + 2]; d[i + 3] = s[j + 3]; };
const rgba = (a, o) => `rgba(${a[0]},${a[1]},${a[2]},${o})`;
const mask = s => { const A = new Uint8Array(s.length / 4); for (let i = 0; i < A.length; i++) A[i] = s[i * 4 + 3] > 0 ? 1 : 0; return A; };
const at = (A, x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H && A[y * S.W + x] === 1;
const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
// per-pixel source warp around a centre (fractions cx,cy); fn(dx,dy px offsets) -> [sdx,sdy] or null
const warp = (c, im, cx, cy, fn) => {
  const s = pix(im), X = cx * S.W, Y = cy * S.H;
  px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = fn(x + 0.5 - X, y + 0.5 - Y); if (!r) continue;
    const sx = Math.floor(r[0] + X), sy = Math.floor(r[1] + Y);
    if (sx >= 0 && sy >= 0 && sx < W && sy < H) cp(d, (y * W + x) * 4, s, (sy * W + sx) * 4);
  } });
};
const CTR = [N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5)];
const KP = { sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0], blur: [1, 1, 1, 1, 1, 1, 1, 1, 1], edge: [-1, -1, -1, -1, 8, -1, -1, -1, -1] };
const lumA = (s, x, y) => { const i = sample(s, S.W, S.H, x, y, 'clamp'); return lum(s, i) * s[i + 3] / 255; };

defNodes({
  edgedetect: { en: 'Edge Detect', cat: 'filter', label: '윤곽 검출', ins: ['입력'], params: [
    N('thresh', '임계값', 0.02, 1, 0.02, 0.2), Col('color', '색', '#ffffff'), Chk('keep', '원본 유지', false)],
    run(c, p, t, [im]) {
      const s = pix(im), o = hex(p.color);
      px(c, (d, W, H) => {
        if (p.keep) d.set(s);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const gx = lumA(s, x + 1, y) - lumA(s, x - 1, y), gy = lumA(s, x, y + 1) - lumA(s, x, y - 1);
          if (Math.hypot(gx, gy) > p.thresh) { const i = (y * W + x) * 4; d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }
        }
      });
    } },
  erode: { en: 'Erode', cat: 'filter', label: '침식', ins: ['입력'], params: [N('r', '반경', 1, 8, 1, 1)],
    run(c, p, t, [im]) {
      const s = pix(im), A = mask(s), r = p.r;
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!A[y * W + x]) continue;
        let ok = true;
        for (let j = -r; j <= r && ok; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r && !at(A, x + i, y + j)) { ok = false; break; }
        if (ok) cp(d, (y * W + x) * 4, s, (y * W + x) * 4);
      } });
    } },
  dilatepx: { en: 'Pixel Expand', cat: 'filter', label: '픽셀 확장', ins: ['입력'], params: [N('r', '반경', 1, 8, 1, 1)],
    run(c, p, t, [im]) {
      const s = pix(im), A = mask(s), r = p.r;
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (A[y * W + x]) { cp(d, i, s, i); continue; }
        let best = r * r + 1, bj = -1;
        for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
          const q = j * j + k * k;
          if (q <= r * r && q < best && at(A, x + k, y + j)) { best = q; bj = ((y + j) * W + x + k) * 4; }
        }
        if (bj >= 0) cp(d, i, s, bj);
      } });
    } },
  emboss: { en: 'Emboss', cat: 'filter', label: '엠보스', ins: ['입력'], params: [
    N('angle', '각도', 0, 360, 15, 135), N('strength', '세기', 0, 4, 0.1, 1), Chk('keepA', '알파 유지', true)],
    run(c, p, t, [im]) {
      const s = pix(im), a = p.angle * Math.PI / 180, dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, v = 128 + (lumA(s, x + dx, y + dy) - lumA(s, x - dx, y - dy)) * 255 * p.strength;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = p.keepA ? s[i + 3] : 255;
      } });
    } },
  convolution: { en: 'Convolution', cat: 'filter', label: '컨볼루션', ins: ['입력'], params: [
    Sel('preset', '프리셋', [['sharpen', '샤픈'], ['blur', '블러'], ['edge', '엣지'], ['custom', '커스텀']], 'sharpen'),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => N('k' + i, '커널 ' + (i + 1), -8, 8, 0.5, i === 4 ? 1 : 0)), N('bias', '보정', -128, 128, 1, 0)],
    run(c, p, t, [im]) {
      const s = pix(im), k = KP[p.preset] || [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => p['k' + i]);
      const div = k.reduce((a, b) => a + b, 0) || 1;
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; if (!s[i + 3]) continue;
        for (let ch = 0; ch < 3; ch++) {
          let v = 0;
          for (let j = 0; j < 9; j++) v += k[j] * s[sample(s, W, H, x + j % 3 - 1, y + (j / 3 | 0) - 1, 'clamp') + ch];
          d[i + ch] = v / div + p.bias;
        }
        d[i + 3] = s[i + 3];
      } });
    } },
  interlace: { en: 'Interlace', cat: 'filter', label: '인터레이스', ins: ['입력'], params: [
    N('period', '주기', 2, 16, 1, 2), N('thick', '두께', 1, 15, 1, 1), N('scroll', '스크롤(주기 배수면 루프)', -32, 32, 1, 0),
    N('dark', '강도', 0, 1, 0.05, 0.5), Sel('mode', '방식', [['dark', '어둡게'], ['cut', '투명']], 'dark')],
    run(c, p, t, [im]) {
      const s = pix(im), sh = Math.round(p.scroll * t), P = p.period;
      px(c, (d, W, H) => { d.set(s); for (let y = 0; y < H; y++) {
        if ((((y + sh) % P) + P) % P >= p.thick) continue;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, m = 1 - p.dark;
          if (p.mode === 'cut') d[i + 3] = s[i + 3] * m; else { d[i] *= m; d[i + 1] *= m; d[i + 2] *= m; }
        }
      } });
    } },
  blobify: { en: 'Blobify', cat: 'filter', label: '블롭', ins: ['입력'], params: [N('radius', '블러', 0, 16, 0.5, 3), N('thresh', '임계값', 0.05, 0.95, 0.05, 0.5)],
    run(c, p, t, [im]) {
      const b = mkCanvas().getContext('2d'); b.filter = `blur(${p.radius}px)`; b.drawImage(im, 0, 0);
      const id = b.getImageData(0, 0, S.W, S.H), d = id.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= p.thresh * 255 ? 255 : 0;
      c.putImageData(id, 0, 0);
    } },
  sdf: { en: 'SDF', cat: 'filter', label: '거리장', ins: ['입력'], params: [N('max', '최대 거리', 1, 64, 1, 16), Chk('invert', '반전', false)],
    run(c, p, t, [im]) {
      const s = pix(im), { W, H } = S, D = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) D[i] = s[i * 4 + 3] > 0 ? 0 : 1e9;
      const pass = (ys, ye, dy, xs, xe, dx) => { for (let y = ys; y !== ye; y += dy) for (let x = xs; x !== xe; x += dx)
        for (const [ox, oy, w] of [[-dx, 0, 1], [-dx, -dy, 1.414], [0, -dy, 1], [dx, -dy, 1.414]]) {
          const nx = x + ox, ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) D[y * W + x] = Math.min(D[y * W + x], D[ny * W + nx] + w);
        } };
      pass(0, H, 1, 0, W, 1); pass(H - 1, -1, -1, W - 1, -1, -1);
      px(c, d => { for (let i = 0; i < W * H; i++) {
        const k = clamp(D[i] / p.max), v = 255 * (p.invert ? k : 1 - k);
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
      } });
    } },
  roundcorner: { en: 'Round Corner', cat: 'filter', label: '모서리 둥글게', ins: ['입력'], params: [N('r', '반경', 0, 64, 1, 8), N('inset', '안쪽 여백', 0, 32, 1, 0)],
    run(c, p, t, [im]) {
      const s = pix(im), r = p.r, a = p.inset + r;
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const X = x + 0.5, Y = y + 0.5;
        const dx = Math.max(a - X, 0, X - (W - a)), dy = Math.max(a - Y, 0, Y - (H - a));
        if (dx * dx + dy * dy <= r * r + 1e-6 && X > p.inset && Y > p.inset && X < W - p.inset && Y < H - p.inset) cp(d, (y * W + x) * 4, s, (y * W + x) * 4);
      } });
    } },
  pixelsort: { en: 'Pixel Sort', cat: 'filter', label: '픽셀 정렬', ins: ['입력'], params: [
    Sel('axis', '방향', [['h', '가로'], ['v', '세로']], 'h'), N('thresh', '임계값', 0, 1, 0.05, 0.3), Chk('rev', '역순', false)],
    run(c, p, t, [im]) {
      const { W, H } = S, d = new Uint32Array(pix(im).buffer.slice(0)), hor = p.axis === 'h';
      const L = v => 0.299 * (v & 255) + 0.587 * (v >> 8 & 255) + 0.114 * (v >> 16 & 255);
      let run = [];
      const flush = () => {
        const vals = run.map(i => d[i]).sort((a, b) => L(a) - L(b)); if (p.rev) vals.reverse();
        run.forEach((i, k) => { d[i] = vals[k]; }); run = [];
      };
      for (let a = 0; a < (hor ? H : W); a++) {
        for (let b = 0; b < (hor ? W : H); b++) {
          const i = hor ? a * W + b : b * W + a, v = d[i];
          if (v >>> 24 && L(v) / 255 >= p.thresh) run.push(i); else flush();
        }
        flush();
      }
      px(c, o => o.set(new Uint8Array(d.buffer)));
    } },
  shuffle: { en: 'Shuffle', cat: 'filter', label: '셔플', ins: ['입력'], params: [
    N('block', '블록 크기', 2, 32, 1, 8), N('seed', '시드', 0, 999, 1, 1), N('every', '갱신 간격(프레임)', 1, 60, 1, 4)],
    run(c, p, t, [im], n, f) {
      const s = pix(im), B = p.block, cw = Math.ceil(S.W / B), M = cw * Math.ceil(S.H / B);
      let k = Math.floor(f / p.every); if (S.loop) k %= Math.ceil(S.frames / p.every);
      const r = rng(p.seed * 1000 + k), perm = [...Array(M).keys()];
      for (let i = M - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      px(c, (d, W, H) => { for (let b = 0; b < M; b++) {
        const q = perm[b], dx = (b % cw) * B, dy = (b / cw | 0) * B, sx = (q % cw) * B, sy = (q / cw | 0) * B;
        for (let y = 0; y < B; y++) for (let x = 0; x < B; x++)
          if (dx + x < W && dy + y < H && sx + x < W && sy + y < H) cp(d, ((dy + y) * W + dx + x) * 4, s, ((sy + y) * W + sx + x) * 4);
      } });
    } },
  bloom: { en: 'Bloom', cat: 'filter', label: '블룸', ins: ['입력'], params: [N('thresh', '임계값', 0, 1, 0.05, 0.6), N('radius', '반경', 1, 16, 0.5, 4), N('strength', '강도', 0, 3, 0.1, 1)],
    run(c, p, t, [im]) {
      const br = mkCanvas().getContext('2d'), id = br.createImageData(S.W, S.H), s = pix(im);
      for (let i = 0; i < s.length; i += 4) if (lum(s, i) * s[i + 3] / 255 >= p.thresh) cp(id.data, i, s, i);
      br.putImageData(id, 0, 0);
      const bl = mkCanvas().getContext('2d'); bl.filter = `blur(${p.radius}px)`; bl.drawImage(br.canvas, 0, 0);
      c.drawImage(im, 0, 0); c.globalCompositeOperation = 'lighter';
      for (let k = p.strength; k > 0; k--) { c.globalAlpha = Math.min(1, k); c.drawImage(bl.canvas, 0, 0); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    } },
  chroma: { en: 'Chromatic Aberration', cat: 'filter', label: '색수차', ins: ['입력'], params: [
    N('amount', '세기', 0, 8, 0.5, 2), N('angle', '각도', 0, 360, 15, 0), Chk('radial', '방사형', false)],
    run(c, p, t, [im]) {
      const s = pix(im), a = p.angle * Math.PI / 180;
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let ux = Math.cos(a), uy = Math.sin(a), m = p.amount;
        if (p.radial) { const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2, r = Math.hypot(dx, dy) || 1; ux = dx / r; uy = dy / r; m *= r / (Math.min(W, H) / 2); }
        const ox = Math.round(ux * m), oy = Math.round(uy * m), i = (y * W + x) * 4;
        const R = sample(s, W, H, x - ox, y - oy), B = sample(s, W, H, x + ox, y + oy), G = i;
        d[i] = R < 0 ? 0 : s[R]; d[i + 1] = s[G + 1]; d[i + 2] = B < 0 ? 0 : s[B + 2];
        d[i + 3] = Math.max(R < 0 ? 0 : s[R + 3], s[G + 3], B < 0 ? 0 : s[B + 3]);
      } });
    } },
  grain: { en: 'Grain', cat: 'filter', label: '그레인', ins: ['입력'], params: [
    N('amount', '세기', 0, 1, 0.05, 0.2), N('size', '크기', 1, 8, 1, 1), N('seed', '시드', 0, 999, 1, 1), Chk('mono', '흑백', true), Chk('anim', '프레임마다 변화', true)],
    run(c, p, t, [im], n, f) {
      const s = pix(im), fr = p.anim ? (S.loop ? f % S.frames : f) : 0;
      px(c, (d, W, H) => { d.set(s); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; if (!s[i + 3]) continue;
        const bx = Math.floor(x / p.size), by = Math.floor(y / p.size);
        for (let ch = 0; ch < 3; ch++)
          d[i + ch] += (hash(bx, by, p.seed + fr * 7919 + (p.mono ? 0 : ch * 131)) - 0.5) * 2 * p.amount * 255;
      } });
    } },
  vignette: { en: 'Vignette', cat: 'filter', label: '비네트', ins: ['입력'], params: [
    N('strength', '세기', 0, 1, 0.05, 0.6), N('radius', '안쪽 반경', 0, 1, 0.05, 0.5), Col('color', '색', '#000000'), Chk('atop', '오브젝트 위만', false)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const o = hex(p.color), R = Math.hypot(S.W, S.H) / 2, g = c.createRadialGradient(S.W / 2, S.H / 2, p.radius * R, S.W / 2, S.H / 2, R);
      g.addColorStop(0, rgba(o, 0)); g.addColorStop(1, rgba(o, p.strength));
      if (p.atop) c.globalCompositeOperation = 'source-atop';
      c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); c.globalCompositeOperation = 'source-over';
    } },
  light2d: { en: '2D Light', cat: 'filter', label: '2D 조명', ins: ['입력'], params: [
    N('x', '위치 X', 0, 1, 0.01, 0.5), N('y', '위치 Y', 0, 1, 0.01, 0.5), N('radius', '반경', 1, 128, 1, 48), Col('color', '색', '#ffd080'),
    N('intensity', '밝기', 0, 2, 0.05, 1), N('falloff', '감쇠', 0.5, 4, 0.1, 1.5), N('ambient', '주변광', 0, 1, 0.05, 0.3), Sel('mode', '합성', [['multiply', '곱하기'], ['add', '더하기']], 'multiply')],
    run(c, p, t, [im]) {
      const s = pix(im), o = hex(p.color), X = p.x * S.W, Y = p.y * S.H;
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, k = Math.pow(clamp(1 - Math.hypot(x + 0.5 - X, y + 0.5 - Y) / p.radius), p.falloff) * p.intensity;
        for (let ch = 0; ch < 3; ch++) d[i + ch] = p.mode === 'add' ? s[i + ch] + o[ch] * k : s[i + ch] * (p.ambient + k * o[ch] / 255);
        d[i + 3] = s[i + 3];
      } });
    } },
  castshadow: { en: 'Cast Shadow', cat: 'filter', label: '그림자 투사', ins: ['입력'], params: [
    N('angle', '각도', 0, 360, 15, 45), N('length', '길이', 1, 64, 1, 24), N('steps', '단계', 1, 64, 1, 24), Col('color', '색', '#000000'), N('opacity', '불투명도', 0, 1, 0.05, 0.5)],
    run(c, p, t, [im]) {
      const sh = mkCanvas().getContext('2d'), a = p.angle * Math.PI / 180;
      sh.drawImage(im, 0, 0); sh.globalCompositeOperation = 'source-in'; sh.fillStyle = p.color; sh.fillRect(0, 0, S.W, S.H);
      const acc = mkCanvas().getContext('2d');
      for (let i = p.steps; i >= 1; i--) { const l = p.length * i / p.steps; acc.drawImage(sh.canvas, Math.round(Math.cos(a) * l), Math.round(Math.sin(a) * l)); }
      c.globalAlpha = p.opacity; c.drawImage(acc.canvas, 0, 0); c.globalAlpha = 1; c.drawImage(im, 0, 0);
    } },
  corner: { en: 'Corner Detect', cat: 'filter', label: '모서리 검출', ins: ['입력'], params: [
    Sel('kind', '종류', [['convex', '볼록'], ['concave', '오목'], ['both', '둘 다']], 'both'), Col('color', '색', '#ff0000'), Chk('keep', '원본 유지', true)],
    run(c, p, t, [im]) {
      const s = pix(im), A = mask(s), o = hex(p.color);
      px(c, (d, W, H) => {
        if (p.keep) d.set(s);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (!A[y * W + x]) continue;
          const U = at(A, x, y - 1), D = at(A, x, y + 1), L = at(A, x - 1, y), R = at(A, x + 1, y);
          const vex = (!U || !D) && (!L || !R) && !(U && D && L && R) && ((!U && !L) || (!U && !R) || (!D && !L) || (!D && !R));
          const cav = (U && L && !at(A, x - 1, y - 1)) || (U && R && !at(A, x + 1, y - 1)) || (D && L && !at(A, x - 1, y + 1)) || (D && R && !at(A, x + 1, y + 1));
          if ((p.kind !== 'concave' && vex) || (p.kind !== 'convex' && cav)) { const i = (y * W + x) * 4; d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }
        }
      });
    } },
  decorner: { en: 'De-Corner', cat: 'filter', label: '모서리 정리', ins: ['입력'], params: [N('passes', '반복', 1, 3, 1, 1)],
    run(c, p, t, [im]) {
      let s = pix(im).slice();
      for (let k = 0; k < p.passes; k++) {
        const A = mask(s), o = s.slice();
        for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
          if (!A[y * S.W + x]) continue;
          const U = at(A, x, y - 1), D = at(A, x, y + 1), L = at(A, x - 1, y), R = at(A, x + 1, y);
          // L-shaped joint (exactly two perpendicular neighbours, open diagonal between them)
          const l = (U && L && !D && !R && !at(A, x - 1, y - 1)) || (U && R && !D && !L && !at(A, x + 1, y - 1))
            || (D && L && !U && !R && !at(A, x - 1, y + 1)) || (D && R && !U && !L && !at(A, x + 1, y + 1));
          if (l) o[(y * S.W + x) * 4 + 3] = 0;
        }
        s = o;
      }
      px(c, d => d.set(s));
    } },
  destray: { en: 'De-Stray', cat: 'filter', label: '튀는 픽셀 제거', ins: ['입력'], params: [N('minN', '최소 이웃 수', 1, 8, 1, 1)],
    run(c, p, t, [im]) {
      const s = pix(im), A = mask(s);
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!A[y * W + x]) continue;
        let n = 0; for (const [i, j] of N8) if (at(A, x + i, y + j)) n++;
        if (n >= p.minN) cp(d, (y * W + x) * 4, s, (y * W + x) * 4);
      } });
    } },

  // ---- warps ----
  barrel: { en: 'Barrel Distort', cat: 'transform', label: '배럴 왜곡', ins: ['입력'], params: [N('k', '강도', -1, 1, 0.05, 0.5), ...CTR],
    run(c, p, t, [im]) {
      const R = Math.min(S.W, S.H) / 2;
      warp(c, im, p.cx, p.cy, (dx, dy) => { const f = 1 + p.k * (dx * dx + dy * dy) / (R * R); return [dx * f, dy * f]; });
    } },
  spherize: { en: 'Spherize', cat: 'transform', label: '구면화', ins: ['입력'], params: [N('amount', '강도', -0.8, 3, 0.05, 0.6), N('radius', '반경', 4, 128, 1, 40), ...CTR],
    run(c, p, t, [im]) {
      warp(c, im, p.cx, p.cy, (dx, dy) => {
        const r = Math.hypot(dx, dy); if (r >= p.radius || r === 0) return [dx, dy];
        const k = p.radius * Math.pow(r / p.radius, 1 + p.amount) / r; return [dx * k, dy * k];
      });
    } },
  mirror: { en: 'Mirror', cat: 'transform', label: '미러', ins: ['입력'], params: [
    N('angle', '축 각도', 0, 180, 15, 90), N('off', '축 이동', -64, 64, 1, 0), Sel('side', '유지할 쪽', [['a', 'A'], ['b', 'B']], 'a'), ...CTR],
    run(c, p, t, [im]) {
      const a = p.angle * Math.PI / 180, nx = -Math.sin(a), ny = Math.cos(a), sg = p.side === 'a' ? 1 : -1;
      warp(c, im, p.cx, p.cy, (dx, dy) => { const s = dx * nx + dy * ny - p.off; return s * sg >= 0 ? [dx, dy] : [dx - 2 * s * nx, dy - 2 * s * ny]; });
    } },
  polarmirror: { en: 'Polar Mirror', cat: 'transform', label: '방사 미러', ins: ['입력'], params: [
    N('n', '분할 수', 2, 16, 1, 6), N('rot', '회전', 0, 360, 5, 0), N('spin', '회전 속도(360 배수면 루프)', -720, 720, 15, 0), ...CTR],
    run(c, p, t, [im]) {
      const seg = 2 * Math.PI / p.n, rot = (p.rot + p.spin * t) * Math.PI / 180;
      warp(c, im, p.cx, p.cy, (dx, dy) => {
        const r = Math.hypot(dx, dy); let a = ((Math.atan2(dy, dx) - rot) % seg + seg) % seg;
        if (a > seg / 2) a = seg - a; a += rot; return [r * Math.cos(a), r * Math.sin(a)];
      });
    } },
  twirl: { en: 'Twirl', cat: 'transform', label: '소용돌이', ins: ['입력'], params: [
    N('strength', '강도', -6, 6, 0.1, 2), N('radius', '반경', 4, 128, 1, 48), Chk('anim', '강도 애니메이션', false), ...CTR],
    run(c, p, t, [im]) {
      const st = p.strength * (p.anim ? Math.sin(2 * Math.PI * t) : 1);
      warp(c, im, p.cx, p.cy, (dx, dy) => {
        const r = Math.hypot(dx, dy); if (r >= p.radius) return [dx, dy];
        const a = st * Math.pow(1 - r / p.radius, 2), cs = Math.cos(a), sn = Math.sin(a);
        return [dx * cs - dy * sn, dx * sn + dy * cs];
      });
    } },
  refract: { en: 'Refract', cat: 'transform', label: '굴절', ins: ['입력', '맵'], params: [
    N('strength', '세기', 0, 32, 1, 6), Sel('mode', '맵 종류', [['height', '높이맵'], ['normal', '노멀맵']], 'height')],
    run(c, p, t, [im, mk]) {
      const s = pix(im), m = pix(mk);
      px(c, (d, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let gx, gy;
        if (p.mode === 'normal') { const i = (y * W + x) * 4; gx = (m[i] / 255 - 0.5) * 2; gy = (m[i + 1] / 255 - 0.5) * 2; }
        else { gx = lum(m, sample(m, W, H, x + 1, y, 'clamp')) - lum(m, sample(m, W, H, x - 1, y, 'clamp')); gy = lum(m, sample(m, W, H, x, y + 1, 'clamp')) - lum(m, sample(m, W, H, x, y - 1, 'clamp')); }
        const j = sample(s, W, H, x + Math.round(gx * p.strength), y + Math.round(gy * p.strength));
        if (j >= 0) cp(d, (y * W + x) * 4, s, j);
      } });
    } },
  timeremap: { en: 'Time Remap', cat: 'transform', label: '시간 리맵', ins: ['입력', '맵'], params: [N('range', '범위(프레임)', 0, 60, 1, 8)],
    run(c, p, t, [im, mk], n, f) {
      const src = byId(n.in[0]); if (!src) { c.drawImage(im, 0, 0); return; }
      const m = pix(mk), cache = {};
      const frame = k => cache[k] || (cache[k] = pix(evaluate(src, S.loop ? ((f - k) % S.frames + S.frames) % S.frames : Math.max(0, f - k))));
      px(c, (d, W, H) => { for (let i = 0; i < W * H * 4; i += 4) {
        const k = Math.round(lum(m, i) * p.range); cp(d, i, frame(k), i);
      } });
    } },
  texremap: { en: 'Texture Remap', cat: 'transform', label: '텍스처 리맵', ins: ['텍스처', 'UV 맵'], params: [
    N('tile', '타일', 1, 8, 1, 1), N('sx', '스크롤 X(px/루프)', -64, 64, 1, 0), N('sy', '스크롤 Y(px/루프)', -64, 64, 1, 0)],
    run(c, p, t, [tx, uv]) {
      const s = pix(tx), m = pix(uv), { W, H } = S, ox = Math.round(p.sx * t), oy = Math.round(p.sy * t);
      px(c, d => { for (let i = 0; i < W * H * 4; i += 4) {
        if (!m[i + 3]) continue;
        const x = (((Math.round(m[i] / 255 * (W - 1) * p.tile) + ox) % W) + W) % W, y = (((Math.round(m[i + 1] / 255 * (H - 1) * p.tile) + oy) % H) + H) % H;
        cp(d, i, s, (y * W + x) * 4);
      } });
    } },
});
})();
