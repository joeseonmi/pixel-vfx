// batch A: blur + color nodes. See nodes/API.md
(() => {
  // ---- local helpers ----
  const load = (c, im) => { c.drawImage(im, 0, 0); return c.getImageData(0, 0, S.W, S.H); };
  // per-pixel edit: fn(d, i, x, y) mutates RGBA bytes
  const each = (c, im, fn) => {
    const id = load(c, im), d = id.data, W = S.W;
    for (let i = 0; i < d.length; i += 4) { const q = i >> 2; fn(d, i, q % W, (q / W) | 0); }
    c.putImageData(id, 0, 0);
  };
  const lutRGB = (c, im, fn) => {
    const lut = Array.from({ length: 256 }, (_, v) => clamp(fn(v / 255)) * 255);
    each(c, im, (d, i) => { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; });
  };
  const prem = d => { const f = new Float32Array(d.length); for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; f[i] = d[i] * a; f[i + 1] = d[i + 1] * a; f[i + 2] = d[i + 2] * a; f[i + 3] = d[i + 3]; } return f; };
  const unprem = (f, d) => { for (let i = 0; i < d.length; i += 4) { const a = f[i + 3]; if (a <= 0) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; } const k = 255 / a; d[i] = f[i] * k; d[i + 1] = f[i + 1] * k; d[i + 2] = f[i + 2] * k; d[i + 3] = a; } };
  // one running-sum box pass over premultiplied floats (outside = transparent)
  const box = (f, r, horiz) => {
    const { W, H } = S, n = horiz ? W : H, lines = horiz ? H : W, st = horiz ? 4 : 4 * W, ls = horiz ? 4 * W : 4, o = new Float32Array(f.length), k = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) for (let ch = 0; ch < 4; ch++) {
      const b = l * ls + ch; let s = 0;
      for (let j = 0; j < Math.min(n, r + 1); j++) s += f[b + j * st];
      for (let j = 0; j < n; j++) { o[b + j * st] = s * k; if (j + r + 1 < n) s += f[b + (j + r + 1) * st]; if (j - r >= 0) s -= f[b + (j - r) * st]; }
    }
    return o;
  };
  const blurF = (f, r, passes) => { for (let i = 0; i < passes; i++) f = box(box(f, r, true), r, false); return f; };
  const blurRun = (c, im, r, passes) => {
    const id = load(c, im); r = Math.round(r);
    if (r >= 1) { unprem(blurF(prem(id.data), r, passes), id.data); c.putImageData(id, 0, 0); }
  };
  // average K samples along a per-pixel path; path(x, y, u in [-1,1]) -> [sx, sy]
  const pathBlur = (c, im, K, path) => {
    const { W, H } = S, id = load(c, im), d = id.data, f = prem(d), o = new Float32Array(f.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      for (let k = 0; k < K; k++) {
        const [sx, sy] = path(x, y, K > 1 ? k / (K - 1) * 2 - 1 : 0), j = sample(f, W, H, Math.round(sx), Math.round(sy));
        if (j >= 0) { o[i] += f[j]; o[i + 1] += f[j + 1]; o[i + 2] += f[j + 2]; o[i + 3] += f[j + 3]; }
      }
      o[i] /= K; o[i + 1] /= K; o[i + 2] /= K; o[i + 3] /= K;
    }
    unprem(o, d); c.putImageData(id, 0, 0);
  };
  const dist = (d, i, a) => Math.hypot(d[i] - a[0], d[i + 1] - a[1], d[i + 2] - a[2]);
  const nearest = (d, i, pal) => { let b = 0, bd = Infinity; pal.forEach((q, k) => { const e = dist(d, i, q); if (e < bd) { bd = e; b = k; } }); return b; };
  const palOf = (p, key, n) => Array.from({ length: Math.round(n) }, (_, k) => hex(p[key + k]));
  const grey = (d, i, v) => { d[i] = d[i + 1] = d[i + 2] = v; };
  const DEFPAL = ['#1a0f2e', '#6a2c70', '#e84a5f', '#ffb86c', '#ffffff', '#6cf0ff'];
  const palParams = (n = 6) => DEFPAL.slice(0, n).map((v, k) => Col('p' + k, '색 ' + (k + 1), v));

  defNodes({
    // ---------------- blur group ----------------
    blur: { en: 'Blur', label: '블러', cat: 'filter', ins: ['입력'], params: [N('r', '반경', 0, 8, 1, 2)],
      run(c, p, t, [im]) { blurRun(c, im, p.r, 3); } },
    boxblur: { en: 'Box Blur', label: '박스 블러', cat: 'filter', ins: ['입력'], params: [N('r', '반경', 0, 8, 1, 2)],
      run(c, p, t, [im]) { blurRun(c, im, p.r, 1); } },
    dirblur: { en: 'Directional Blur', label: '방향 블러', cat: 'filter', ins: ['입력'], params: [N('angle', '각도', 0, 360, 1, 0), N('len', '길이', 0, 16, 1, 6)],
      run(c, p, t, [im]) {
        const a = p.angle * Math.PI / 180, dx = Math.cos(a) * p.len / 2, dy = Math.sin(a) * p.len / 2;
        pathBlur(c, im, Math.round(p.len) + 1, (x, y, u) => [x + dx * u, y + dy * u]);
      } },
    radblur: { en: 'Radial Blur', label: '회전 블러', cat: 'filter', ins: ['입력'], params: [N('angle', '각도', 0, 90, 1, 12), N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5)],
      run(c, p, t, [im]) {
        const cx = p.cx * S.W, cy = p.cy * S.H;
        pathBlur(c, im, 13, (x, y, u) => { const a = u * p.angle * Math.PI / 360, co = Math.cos(a), si = Math.sin(a); return [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]; });
      } },
    zoomblur: { en: 'Zoom Blur', label: '줌 블러', cat: 'filter', ins: ['입력'], params: [N('amt', '강도', 0, 0.5, 0.01, 0.1), N('cx', '중심 X', 0, 1, 0.01, 0.5), N('cy', '중심 Y', 0, 1, 0.01, 0.5)],
      run(c, p, t, [im]) {
        const cx = p.cx * S.W, cy = p.cy * S.H;
        pathBlur(c, im, 13, (x, y, u) => [cx + (x - cx) * (1 + u * p.amt), cy + (y - cy) * (1 + u * p.amt)]);
      } },
    kuwahara: { en: 'Kuwahara', label: '쿠와하라', cat: 'filter', ins: ['입력'], params: [N('r', '반경', 1, 4, 1, 2)],
      run(c, p, t, [im]) {
        const { W, H } = S, id = load(c, im), src = id.data.slice(), d = id.data, r = Math.round(p.r);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let best = Infinity, out = null;
          for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
            let n = 0, s = 0, s2 = 0, R = 0, G = 0, B = 0, A = 0;
            for (let j = 0; j <= r; j++) for (let k = 0; k <= r; k++) {
              const q = sample(src, W, H, x + sx * k, y + sy * j); if (q < 0) continue;
              const l = lum(src, q); n++; s += l; s2 += l * l; R += src[q]; G += src[q + 1]; B += src[q + 2]; A += src[q + 3];
            }
            const v = s2 / n - (s / n) ** 2;
            if (n && v < best) { best = v; out = [R / n, G / n, B / n, A / n]; }
          }
          const i = (y * W + x) * 4; if (out) { d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = out[3]; }
        }
        c.putImageData(id, 0, 0);
      } },
    highpass: { en: 'High Pass', label: '하이패스', cat: 'filter', ins: ['입력'], params: [N('r', '반경', 1, 8, 1, 3), N('gain', '강도', 0, 4, 0.1, 1)],
      run(c, p, t, [im]) {
        const id = load(c, im), d = id.data, f = blurF(prem(d), Math.round(p.r), 2);
        for (let i = 0; i < d.length; i += 4) {
          const a = f[i + 3];
          for (let k = 0; k < 3; k++) d[i + k] = 128 + (d[i + k] - (a > 0 ? f[i + k] * 255 / a : d[i + k])) * p.gain;
        }
        c.putImageData(id, 0, 0);
      } },
    smear: { en: 'Smear', label: '번짐', cat: 'filter', ins: ['입력'], params: [N('angle', '각도', 0, 360, 1, 270), N('len', '길이', 0, 16, 1, 6)],
      run(c, p, t, [im]) {
        const { W, H } = S, id = load(c, im), src = id.data.slice(), d = id.data, a = p.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let best = -1, bs = -1;
          for (let k = 0; k <= p.len; k++) {
            const q = sample(src, W, H, Math.round(x - ca * k), Math.round(y - sa * k)); if (q < 0) continue;
            const s = src[q + 3] * (1 + lum(src, q)); if (s > bs) { bs = s; best = q; }
          }
          if (best >= 0) { const i = (y * W + x) * 4; d[i] = src[best]; d[i + 1] = src[best + 1]; d[i + 2] = src[best + 2]; d[i + 3] = src[best + 3]; }
        }
        c.putImageData(id, 0, 0);
      } },

    // ---------------- color group ----------------
    alphacut: { en: 'Alpha Cutoff', label: '알파 컷', cat: 'color', ins: ['입력'], params: [N('th', '임계값', 1, 255, 1, 128)],
      run(c, p, t, [im]) { each(c, im, (d, i) => { d[i + 3] = d[i + 3] >= p.th ? 255 : 0; }); } },
    gamma: { en: 'Gamma Map', label: '감마', cat: 'color', ins: ['입력'], params: [N('g', '감마', 0.1, 4, 0.05, 1.5)],
      run(c, p, t, [im]) { lutRGB(c, im, v => v ** (1 / p.g)); } },
    invert: { en: 'Invert', label: '반전', cat: 'color', ins: ['입력'], params: [Chk('alpha', '알파도 반전', false)],
      run(c, p, t, [im]) { each(c, im, (d, i) => { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; if (p.alpha) d[i + 3] = 255 - d[i + 3]; }); } },
    levels: { en: 'Level', label: '레벨', cat: 'color', ins: ['입력'], params: [N('lo', '입력 최소', 0, 254, 1, 0), N('hi', '입력 최대', 1, 255, 1, 255), N('g', '감마', 0.1, 4, 0.05, 1), N('olo', '출력 최소', 0, 255, 1, 0), N('ohi', '출력 최대', 0, 255, 1, 255)],
      run(c, p, t, [im]) {
        lutRGB(c, im, v => (p.olo + (p.ohi - p.olo) * clamp((v * 255 - p.lo) / Math.max(1, p.hi - p.lo)) ** (1 / p.g)) / 255);
      } },
    threshold: { en: 'Threshold', label: '임계값', cat: 'color', ins: ['입력'], params: [N('th', '임계값', 0, 1, 0.01, 0.5), Col('hi', '밝은 색', '#ffffff'), Col('lo', '어두운 색', '#000000'), Chk('clear', '어두운 곳 투명', false)],
      run(c, p, t, [im]) {
        const H = hex(p.hi), L = hex(p.lo);
        each(c, im, (d, i) => { const on = lum(d, i) >= p.th, k = on ? H : L; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; if (!on && p.clear) d[i + 3] = 0; });
      } },
    colorize: { en: 'Colorize', label: '색입히기', cat: 'color', ins: ['입력'], params: [Sel('n', '색 개수', [['2', '2색'], ['3', '3색']], '3'), Col('a', '어두운 색', '#1a0f2e'), Col('b', '중간 색', '#e84a5f'), Col('c', '밝은 색', '#ffe9a8')],
      run(c, p, t, [im]) {
        const A = hex(p.a), B = hex(p.b), C = hex(p.c), three = p.n == 3;
        each(c, im, (d, i) => {
          const v = lum(d, i), k = !three ? lerpC(A, C, v) : v < 0.5 ? lerpC(A, B, v * 2) : lerpC(B, C, v * 2 - 1);
          d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2];
        });
      } },
    errdither: { en: 'Error Diffuse Dither', label: '오차확산 디더', cat: 'color', ins: ['입력'], params: [N('count', '색 개수', 2, 6, 1, 4), N('amt', '확산량', 0, 1, 0.05, 1), ...palParams()],
      run(c, p, t, [im]) {
        const { W, H } = S, id = load(c, im), d = id.data, pal = palOf(p, 'p', p.count), buf = new Float32Array(W * H * 3);
        for (let q = 0; q < W * H; q++) for (let k = 0; k < 3; k++) buf[q * 3 + k] = d[q * 4 + k];
        const push = (x, y, e, w) => { if (x < 0 || x >= W || y >= H) return; const b = (y * W + x) * 3; for (let k = 0; k < 3; k++) buf[b + k] += e[k] * w * p.amt; };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const q = y * W + x, i = q * 4, v = [buf[q * 3], buf[q * 3 + 1], buf[q * 3 + 2]];
          if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
          const m = pal[nearest(v, 0, pal)], e = [v[0] - m[0], v[1] - m[1], v[2] - m[2]];
          d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2]; d[i + 3] = 255;
          push(x + 1, y, e, 7 / 16); push(x - 1, y + 1, e, 3 / 16); push(x, y + 1, e, 5 / 16); push(x + 1, y + 1, e, 1 / 16);
        }
        c.putImageData(id, 0, 0);
      } },
    mulalpha: { en: 'Multiply Alpha', label: '알파 곱', cat: 'color', ins: ['입력', '마스크'], params: [N('amt', '배율', 0, 2, 0.05, 1), Chk('mask', '마스크 입력 사용', false)],
      run(c, p, t, [im, mk]) {
        const m = p.mask ? pix(mk) : null;
        each(c, im, (d, i) => { d[i + 3] *= p.amt * (m ? lum(m, i) * m[i + 3] / 255 : 1); });
      } },
    palshift: { en: 'Palette Shift', label: '팔레트 이동', cat: 'color', ins: ['입력'], params: [N('count', '색 개수', 2, 6, 1, 4), N('cycles', '반복 횟수', -4, 4, 1, 1), ...palParams()],
      run(c, p, t, [im]) {
        const pal = palOf(p, 'p', p.count), n = pal.length, sh = Math.floor(t * p.cycles * n + 1e-6);
        each(c, im, (d, i) => { const k = pal[(((nearest(d, i, pal) + sh) % n) + n) % n]; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; });
      } },
    posterize: { en: 'Posterize', label: '포스터화', cat: 'color', ins: ['입력'], params: [N('lv', '단계', 2, 16, 1, 4)],
      run(c, p, t, [im]) { const L = Math.round(p.lv) - 1; lutRGB(c, im, v => Math.round(v * L) / L); } },
    alpha2grey: { en: 'Alpha to Grey', label: '알파→회색', cat: 'color', ins: ['입력'], params: [],
      run(c, p, t, [im]) { each(c, im, (d, i) => { grey(d, i, d[i + 3]); d[i + 3] = 255; }); } },
    grey2alpha: { en: 'Grey to Alpha', label: '회색→알파', cat: 'color', ins: ['입력'], params: [Col('col', '색', '#ffffff'), Chk('keep', '원래 색 유지', false)],
      run(c, p, t, [im]) {
        const k = hex(p.col);
        each(c, im, (d, i) => { d[i + 3] = lum(d, i) * 255; if (!p.keep) { d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; } });
      } },
    bw: { en: 'BW', label: '흑백', cat: 'color', ins: ['입력'], params: [N('bright', '밝기', -1, 1, 0.05, 0), N('contrast', '대비', -1, 1, 0.05, 0.3)],
      run(c, p, t, [im]) {
        const k = Math.tan((clamp(p.contrast, -0.99, 0.99) + 1) * Math.PI / 4);
        each(c, im, (d, i) => grey(d, i, clamp((lum(d, i) - 0.5) * k + 0.5 + p.bright) * 255));
      } },
    greyscale: { en: 'Greyscale', label: '그레이스케일', cat: 'color', ins: ['입력'], params: [Sel('mode', '방식', [['lum', '휘도'], ['avg', '평균'], ['max', '최대'], ['min', '최소']], 'lum')],
      run(c, p, t, [im]) {
        each(c, im, (d, i) => {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          grey(d, i, p.mode == 'avg' ? (r + g + b) / 3 : p.mode == 'max' ? Math.max(r, g, b) : p.mode == 'min' ? Math.min(r, g, b) : lum(d, i) * 255);
        });
      } },
    swizzle: { en: 'Channel Swizzle', label: '채널 교환', cat: 'color', ins: ['입력'],
      params: ['r', 'g', 'b', 'a'].map((k, n) => Sel('c' + n, k.toUpperCase() + ' 출력', [['r', 'R'], ['g', 'G'], ['b', 'B'], ['a', 'A'], ['0', '0'], ['1', '1']], k)),
      run(c, p, t, [im]) {
        each(c, im, (d, i) => {
          const o = [0, 1, 2, 3].map(n => { const s = p['c' + n]; return s == '0' ? 0 : s == '1' ? 255 : d[i + 'rgba'.indexOf(s)]; });
          d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = o[3];
        });
      } },
    removecolor: { en: 'Remove Color', label: '색 제거', cat: 'color', ins: ['입력'], params: [Col('col', '제거할 색', '#000000'), N('tol', '허용 거리', 0, 441, 1, 40)],
      run(c, p, t, [im]) { const a = hex(p.col); each(c, im, (d, i) => { if (dist(d, i, a) <= p.tol) d[i + 3] = 0; }); } },
    selecthsv: { en: 'Select HSV', label: 'HSV 선택', cat: 'color', ins: ['입력'], params: [N('h', '색조', 0, 360, 1, 30), N('hr', '색조 범위', 0, 180, 1, 30), N('smin', '채도 최소', 0, 1, 0.01, 0.2), N('smax', '채도 최대', 0, 1, 0.01, 1), N('vmin', '명도 최소', 0, 1, 0.01, 0.2), N('vmax', '명도 최대', 0, 1, 0.01, 1)],
      run(c, p, t, [im]) {
        each(c, im, (d, i) => {
          const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]), dh = Math.abs(((h - p.h + 540) % 360) - 180);
          if (dh > p.hr || s < p.smin || s > p.smax || v < p.vmin || v > p.vmax) d[i + 3] = 0;
        });
      } },
    normalize: { en: 'Normalize', label: '정규화', cat: 'color', ins: ['입력'], params: [],
      run(c, p, t, [im]) {
        const id = load(c, im), d = id.data; let lo = 255, hi = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) for (let k = 0; k < 3; k++) { lo = Math.min(lo, d[i + k]); hi = Math.max(hi, d[i + k]); }
        const s = hi > lo ? 255 / (hi - lo) : 1;
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = (d[i + k] - lo) * s;
        c.putImageData(id, 0, 0);
      } },
    replacepal: { en: 'Replace Palette', label: '팔레트 교체', cat: 'color', ins: ['입력'],
      params: [N('count', '쌍 개수', 1, 4, 1, 2), N('tol', '허용 거리', 0, 441, 1, 40),
        ...[['#ffffff', '#ff4040'], ['#000000', '#2040ff'], ['#ff0000', '#ffff40'], ['#00ff00', '#ff40ff']].flatMap(([f, to], k) => [Col('f' + k, '원본 ' + (k + 1), f), Col('t' + k, '대체 ' + (k + 1), to)])],
      run(c, p, t, [im]) {
        const from = palOf(p, 'f', p.count), to = palOf(p, 't', p.count);
        each(c, im, (d, i) => {
          const k = nearest(d, i, from); if (dist(d, i, from[k]) > p.tol) return;
          d[i] = to[k][0]; d[i + 1] = to[k][1]; d[i + 2] = to[k][2];
        });
      } },
    rgbaextract: { en: 'RGBA Extract', label: '채널 추출', cat: 'color', ins: ['입력'], params: [Sel('ch', '채널', [['0', 'R'], ['1', 'G'], ['2', 'B'], ['3', 'A']], '0')],
      run(c, p, t, [im]) { each(c, im, (d, i) => { grey(d, i, d[i + +p.ch]); d[i + 3] = 255; }); } },
    hsvextract: { en: 'HSV Extract', label: 'HSV 추출', cat: 'color', ins: ['입력'], params: [Sel('ch', '채널', [['0', 'H 색조'], ['1', 'S 채도'], ['2', 'V 명도']], '2')],
      run(c, p, t, [im]) {
        each(c, im, (d, i) => { const hsv = rgb2hsv(d[i], d[i + 1], d[i + 2]), ch = +p.ch; grey(d, i, (ch == 0 ? hsv[0] / 360 : hsv[ch]) * 255); });
      } },
  });
})();
