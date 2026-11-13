// color nodes. See nodes/API.md
const PALMAP_PRESETS = {
  '얼음': ['#1f4f9a', '#3aa0e8', '#9fdcf7', '#e0f6fd', '#ffffff'],
  '불꽃': ['#3a0a0a', '#a3200f', '#ff5a14', '#ffb52e', '#fff3b0'],
  '번개': ['#2a1f5c', '#5b6cff', '#a8c4ff', '#fff6a8', '#ffffff'],
  '독': ['#1b2b12', '#3f7a1f', '#7fd13b', '#c8ff6a', '#f4ffd6'],
  '마법': ['#2a0f4a', '#6a2bc4', '#b45cff', '#f0a8ff', '#ffffff'],
  '피': ['#1a0306', '#5c0a14', '#a8121f', '#e8303a', '#ff9a8a'],
  '황금': ['#3a2206', '#8a5a12', '#d9a21f', '#ffe066', '#fffbe0'],
  '연기': ['#1c1c22', '#3d3d48', '#6b6b78', '#a3a3ad', '#e6e6ea'],
  '흑백': ['#000000', '#ffffff'],
};
defNodes({
  palmap: { en: 'Palette Map', cat: 'color', label: '팔레트 맵', ins: ['강도'], params: [
    Pal('cols', '색 램프', PALMAP_PRESETS['얼음'], PALMAP_PRESETS),
    N('cut', '투명 컷', 0, 1, 0.01, 0.13), N('shift', '밴드 이동', -1, 1, 0.05, 0),
    Sel('interp', '보간', [['bands', '밴드(단계)'], ['smooth', '부드럽게']], 'bands'),
    Sel('src', '기준', [['la', '밝기×알파'], ['alpha', '알파'], ['luma', '밝기']], 'la'),
    N('op', '불투명도', 0, 1, 0.01, 1)],
    run(c, p, t, [im]) { // intensity -> colour ramp; below the cut becomes transparent, the rest is remapped 0..1
      c.drawImage(im, 0, 0);
      const id = c.getImageData(0, 0, S.W, S.H), d = id.data, P = (p.cols || []).map(hex), n = P.length, A = Math.round(255 * p.op);
      if (!n) return;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255, v = p.src === 'alpha' ? a : p.src === 'luma' ? (a > 0 ? lum(d, i) : 0) : lum(d, i) * a;
        if (v <= 0 || v <= p.cut) { d[i + 3] = 0; continue; }
        const u = clamp((v - p.cut) / Math.max(1e-6, 1 - p.cut) + p.shift);
        let k;
        if (p.interp === 'smooth' && n > 1) { const x = u * (n - 1), j = Math.min(n - 2, Math.floor(x)); k = lerpC(P[j], P[j + 1], x - j); }
        else k = P[Math.min(n - 1, Math.floor(u * n))];
        d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = A;
      }
      c.putImageData(id, 0, 0);
    } },
  ramp: { en: 'ColorRamp', cat: 'color', label: '색상 램프', ins: ['입력'], params: [
    Col('a', '색 A (0)', '#3a0a0a'), Col('b', '색 B (0.5)', '#ff5a14'), Col('c', '색 C (1)', '#ffe45c'),
    N('steps', '포스터화', 0, 8, 1, 0)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const id = c.getImageData(0, 0, S.W, S.H), d = id.data, A = hex(p.a), B = hex(p.b), C = hex(p.c);
      for (let i = 0; i < d.length; i += 4) {
        let v = lum(d, i) * d[i + 3] / 255;
        if (p.steps >= 2) v = Math.min(p.steps - 1, Math.floor(v * p.steps)) / (p.steps - 1);
        const k = v < 0.5 ? lerpC(A, B, v * 2) : lerpC(B, C, v * 2 - 1);
        d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2];
      }
      c.putImageData(id, 0, 0);
    } },
  quantize: { en: 'Quantize', cat: 'color', label: '팔레트 고정', ins: ['입력'], params: [
    N('count', '색 개수', 2, 6, 1, 5), N('threshold', '알파 임계', 1, 255, 1, 110), Chk('dither', '알파 디더(Bayer)', false),
    ...['#3a0a0a', '#c1370f', '#ff8a1f', '#ffd23f', '#ffffff', '#6cf0ff'].map((v, k) => Col('p' + k, '색 ' + (k + 1), v))],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const { W, H } = S, id = c.getImageData(0, 0, W, H), d = id.data;
      const pal = Array.from({ length: p.count }, (_, k) => hex(p['p' + k]));
      for (let i = 0; i < d.length; i += 4) {
        const px = i / 4, x = px % W, y = (px / W) | 0;
        const th = p.threshold + (p.dither ? ((BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * 128 : 0);
        if (d[i + 3] < th) { d[i + 3] = 0; continue; }
        d[i + 3] = 255;
        let best = pal[0], bd = Infinity;
        for (const q of pal) { const e = (q[0] - d[i]) ** 2 + (q[1] - d[i + 1]) ** 2 + (q[2] - d[i + 2]) ** 2; if (e < bd) { bd = e; best = q; } }
        d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2];
      }
      c.putImageData(id, 0, 0);
    } },
  dither: { en: 'Dither', cat: 'color', label: '디더', ins: ['입력'], params: [N('levels', '단계', 2, 8, 1, 4), Chk('alpha', '알파도 디더', false)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const { W, H } = S, id = c.getImageData(0, 0, W, H), d = id.data, L = Math.round(p.levels) - 1;
      for (let i = 0; i < d.length; i += 4) {
        const px = i / 4, th = (BAYER[((px / W | 0) & 3) * 4 + ((px % W) & 3)] + 0.5) / 16;
        for (let k = 0; k < (p.alpha ? 4 : 3); k++) d[i + k] = Math.min(L, Math.floor(d[i + k] / 255 * L + th)) / L * 255;
      }
      c.putImageData(id, 0, 0);
    } },
  adjust: { en: 'ColorAdjust', cat: 'color', label: '색 조정', ins: ['입력'], params: [N('hue', '색조(도)', -180, 180, 1, 0), N('sat', '채도', 0, 2, 0.05, 1), N('val', '명도', 0, 2, 0.05, 1), N('alpha', '알파 배율', 0, 2, 0.05, 1)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const id = c.getImageData(0, 0, S.W, S.H), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]), o = hsv2rgb((h + p.hue + 360) % 360, clamp(s * p.sat), clamp(v * p.val));
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] *= p.alpha;
      }
      c.putImageData(id, 0, 0);
    } },
  replace: { en: 'ColorReplace', cat: 'color', label: '색 치환', ins: ['입력'], params: [Col('from', '원본 색', '#ffffff'), Col('to', '바꿀 색', '#ff0000'), N('th', '허용 거리', 0, 441, 1, 60), Chk('clear', '나머지 투명', false)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const id = c.getImageData(0, 0, S.W, S.H), d = id.data, a = hex(p.from), b = hex(p.to);
      for (let i = 0; i < d.length; i += 4) {
        if (Math.hypot(d[i] - a[0], d[i + 1] - a[1], d[i + 2] - a[2]) <= p.th) { d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; }
        else if (p.clear) d[i + 3] = 0;
      }
      c.putImageData(id, 0, 0);
    } },
});
