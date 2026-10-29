// compose nodes. See nodes/API.md
defNodes({
  mask: { en: 'Mask', cat: 'compose', label: '마스크', ins: ['입력', '마스크'], params: [Chk('useAlpha', '마스크 알파 사용', false)],
    run(c, p, t, [im, mk]) {
      c.drawImage(im, 0, 0);
      const id = c.getImageData(0, 0, S.W, S.H), d = id.data, m = mk.getContext('2d').getImageData(0, 0, S.W, S.H).data;
      for (let i = 0; i < d.length; i += 4) d[i + 3] *= p.useAlpha ? m[i + 3] / 255 : lum(m, i);
      c.putImageData(id, 0, 0);
    } },
  blend: { en: 'Blend', cat: 'compose', label: '합성', ins: ['A', 'B'], params: [
    Sel('mode', '모드', [['source-over', '일반'], ['lighter', '더하기'], ['multiply', '곱하기'], ['screen', '스크린']], 'lighter'),
    N('opacity', 'B 불투명도', 0, 1, 0.01, 1)],
    run(c, p, t, [a, b]) {
      c.drawImage(a, 0, 0);
      c.globalCompositeOperation = p.mode; c.globalAlpha = p.opacity;
      c.drawImage(b, 0, 0);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    } },
});
