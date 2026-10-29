// filter nodes. See nodes/API.md
defNodes({
  glow: { en: 'Glow', cat: 'filter', label: '글로우', ins: ['입력'], params: [
    N('radius', '반경', 0, 12, 0.5, 2), N('strength', '강도', 0, 3, 0.1, 1), Chk('pix', '픽셀로 되돌리기', false)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const tmp = mkCanvas().getContext('2d');
      tmp.filter = `blur(${p.radius}px)`; tmp.drawImage(im, 0, 0);
      c.globalCompositeOperation = 'lighter';
      for (let s = p.strength; s > 0; s--) { c.globalAlpha = Math.min(1, s); c.drawImage(tmp.canvas, 0, 0); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (p.pix) {
        const id = c.getImageData(0, 0, S.W, S.H), d = id.data;
        for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 96 ? 255 : 0;
        c.putImageData(id, 0, 0);
      }
    } },
  outline: { en: 'Outline', cat: 'filter', label: '외곽선', ins: ['입력'], params: [Col('color', '색', '#3a0a0a'), Chk('outside', '바깥쪽만', true)],
    run(c, p, t, [im]) {
      c.drawImage(im, 0, 0);
      const { W, H } = S, id = c.getImageData(0, 0, W, H), d = id.data, o = hex(p.color), A = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) A[i] = d[i * 4 + 3] > 0 ? 1 : 0;
      const nb = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A[y * W + x] === 1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const hit = p.outside ? !A[i] && (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1))
          : A[i] && !(nb(x - 1, y) && nb(x + 1, y) && nb(x, y - 1) && nb(x, y + 1));
        if (hit) { d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255; }
      }
      c.putImageData(id, 0, 0);
    } },
  shadow: { en: 'Shadow', cat: 'filter', label: '그림자', ins: ['입력'], params: [N('ox', '오프셋 X', -16, 16, 1, 2), N('oy', '오프셋 Y', -16, 16, 1, 2), Col('color', '색', '#000000'), N('opacity', '불투명도', 0, 1, 0.05, 0.6)],
    run(c, p, t, [im]) {
      const sh = mkCanvas().getContext('2d'); // tinted alpha silhouette
      sh.drawImage(im, 0, 0); sh.globalCompositeOperation = 'source-in'; sh.fillStyle = p.color; sh.fillRect(0, 0, S.W, S.H);
      c.globalAlpha = p.opacity; c.drawImage(sh.canvas, Math.round(p.ox), Math.round(p.oy));
      c.globalAlpha = 1; c.drawImage(im, 0, 0);
    } },
});
