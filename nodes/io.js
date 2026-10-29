// io nodes. See nodes/API.md
defNodes({
  image: { en: 'Image', cat: 'io', label: '이미지', ins: [], params: [{ k: 'imgs', l: '이미지', t: 'i', def: [] },
    Sel('fit', '맞춤', [['orig', '원본'], ['fit', '맞춤']], 'orig'), N('scale', '배율', 1, 4, 1, 1),
    N('ox', '오프셋 X', -64, 64, 1, 0), N('oy', '오프셋 Y', -64, 64, 1, 0), N('index', '이미지 번호', 0, 99, 1, 0)],
    run(c, p) {
      const im = IMG.get(p.imgs[clamp(Math.round(p.index), 0, p.imgs.length - 1)]);
      if (!im?.width) return;
      const k = (p.fit === 'fit' ? Math.min(S.W / im.width, S.H / im.height) : 1) * Math.round(p.scale);
      const w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
      c.imageSmoothingEnabled = false;
      c.drawImage(im, Math.round((S.W - w) / 2 + p.ox), Math.round((S.H - h) / 2 + p.oy), w, h);
    } },
});
