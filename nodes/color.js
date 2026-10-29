// color nodes. See nodes/API.md
defNodes({
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
