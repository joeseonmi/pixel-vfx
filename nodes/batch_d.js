// batch D: drawing, populate, transform nodes. See nodes/API.md
// Local helpers (all inside this IIFE, nothing leaks): remap, paint, inPoly, drawPoly, ngon, place.
(() => {
  const TAU = Math.PI * 2, rad = d => d * Math.PI / 180;
  // inverse mapping: for each dest pixel centre fn(x,y) -> [srcX,srcY] | null; nearest sampling
  function remap(c, im, fn, mode) {
    const { W, H } = S, s = pix(im), id = c.createImageData(W, H), d = id.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const q = fn(x + 0.5, y + 0.5); if (!q) continue;
      const j = sample(s, W, H, q[0], q[1], mode);
      if (j >= 0) d.set(s.subarray(j, j + 4), (y * W + x) * 4);
    }
    c.putImageData(id, 0, 0);
  }
  // hard per-pixel fill where test(x,y) is true
  function paint(c, hexCol, test) {
    const { W, H } = S, id = c.createImageData(W, H), d = id.data, col = hex(hexCol);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(x + 0.5, y + 0.5)) { const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; }
    c.putImageData(id, 0, 0);
  }
  function inPoly(P, x, y) { // even-odd
    let o = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++)
      if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) o = !o;
    return o;
  }
  function drawPoly(c, P, col, fill, th) {
    if (fill) return paint(c, col, (x, y) => inPoly(P, x, y));
    c.fillStyle = col; th = Math.round(th);
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; line(c, a[0], a[1], b[0], b[1], th, th >> 1); }
  }
  const ngon = (cx, cy, n, r, rot) => Array.from({ length: n }, (_, i) => [cx + Math.cos(rot + TAU * i / n) * r, cy + Math.sin(rot + TAU * i / n) * r]);
  // draw copy of image rotated/scaled around the canvas centre, then shifted by (x,y)
  function place(c, im, x, y, rot, sc, a) {
    c.save(); c.globalAlpha = a; c.imageSmoothingEnabled = false;
    c.translate(Math.round(S.W / 2 + x), Math.round(S.H / 2 + y)); c.rotate(rot); c.scale(sc, sc);
    c.drawImage(im, -S.W / 2, -S.H / 2); c.restore();
  }
  const FILL = Sel('fill', '채움', [['fill', '채움'], ['line', '외곽선']], 'fill');
  const CX = N('cx', '중심 X', 0, 1, 0.01, 0.5), CY = N('cy', '중심 Y', 0, 1, 0.01, 0.5), TH = N('th', '두께', 1, 16, 1, 2);
  const tile8 = (u, v, k) => [k & 1 ? 1 - u : u, k & 2 ? 1 - v : v].map((q, i, a) => k & 4 ? a[1 - i] : q); // 8 dihedral variants of unit coords

  defNodes({
    drawline: { en: 'Draw Line', cat: 'gen', label: '선', ins: [], params: [
      N('x0', '시작 X', 0, 1, 0.01, 0.1), N('y0', '시작 Y', 0, 1, 0.01, 0.9), N('x1', '끝 X', 0, 1, 0.01, 0.9), N('y1', '끝 Y', 0, 1, 0.01, 0.1),
      TH, Col('color', '색', '#ffffff'), N('prog', '진행도', 0, 1, 0.01, 1), Chk('anim', '그려지기 애니', false)],
      run(c, p, t) {
        const { W, H } = S, k = p.anim ? 1 - Math.abs(2 * t - 1) : p.prog, x0 = p.x0 * W, y0 = p.y0 * H, th = Math.round(p.th);
        c.fillStyle = p.color; line(c, x0, y0, lerp(x0, p.x1 * W, k), lerp(y0, p.y1 * H, k), th, th >> 1); // ping-pong progress keeps loop seamless
      } },
    polygon: { en: 'Draw Polygon', cat: 'gen', label: '다각형', ins: [], params: [
      N('sides', '변 수', 3, 12, 1, 5), N('r', '반지름', 1, 64, 1, 24), N('rot', '회전', 0, 360, 1, 0), N('spin', '회전 횟수', -4, 4, 1, 0),
      CX, CY, FILL, TH, Col('color', '색', '#ffd23f')],
      run(c, p, t) { drawPoly(c, ngon(p.cx * S.W, p.cy * S.H, p.sides, p.r, rad(p.rot - 90) + p.spin * TAU * t), p.color, p.fill === 'fill', p.th); } },
    ellipse: { en: 'Draw Ellipse', cat: 'gen', label: '타원', ins: [], params: [
      CX, CY, N('rx', '반지름 X', 1, 64, 1, 28), N('ry', '반지름 Y', 1, 64, 1, 18), FILL, TH, Col('color', '색', '#5ac8ff')],
      run(c, p) {
        const mx = p.cx * S.W, my = p.cy * S.H, e = (x, y, a, b) => ((x - mx) / a) ** 2 + ((y - my) / b) ** 2;
        paint(c, p.color, (x, y) => e(x, y, p.rx, p.ry) <= 1 && (p.fill === 'fill' || e(x, y, Math.max(0.5, p.rx - p.th), Math.max(0.5, p.ry - p.th)) > 1));
      } },
    rect: { en: 'Draw Rectangle', cat: 'gen', label: '사각형', ins: [], params: [
      CX, CY, N('w', '너비', 1, 128, 1, 40), N('h', '높이', 1, 128, 1, 28), N('r', '모서리 반경', 0, 32, 1, 4), FILL, TH, Col('color', '색', '#ff6b6b')],
      run(c, p) {
        const mx = p.cx * S.W, my = p.cy * S.H, hw = p.w / 2, hh = p.h / 2, r = Math.min(p.r, hw, hh);
        paint(c, p.color, (x, y) => { // rounded-box signed distance
          const qx = Math.abs(x - mx) - hw + r, qy = Math.abs(y - my) - hh + r, d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
          return d <= 0 && (p.fill === 'fill' || d > -p.th);
        });
      } },
    randshape: { en: 'Random Shape', cat: 'gen', label: '랜덤 도형', ins: [], params: [
      N('seed', '시드', 0, 99, 1, 1), N('n', '꼭짓점', 3, 16, 1, 8), N('r', '반지름', 1, 64, 1, 24), N('rough', '울퉁불퉁', 0, 1, 0.05, 0.5),
      N('every', '재생성 간격(프레임)', 1, 16, 1, 4), CX, CY, FILL, TH, Col('color', '색', '#7bd88f')],
      run(c, p, t, ins, nd, f) {
        const r = rng(p.seed * 1000 + Math.floor((f % S.frames) / p.every)), P = [];
        for (let i = 0; i < p.n; i++) { const a = TAU * i / p.n, rr = p.r * (1 - p.rough * r() * 0.7); P.push([p.cx * S.W + Math.cos(a) * rr, p.cy * S.H + Math.sin(a) * rr]); }
        drawPoly(c, P, p.color, p.fill === 'fill', p.th);
      } },
    text: { en: 'Draw Text', cat: 'gen', label: '텍스트', ins: [], params: [
      Txt('str', '문구', 'HIT'),
      N('size', '크기(px)', 6, 64, 1, 20), CX, CY, Sel('align', '정렬', [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], 'center'), Col('color', '색', '#ffffff')],
      run(c, p) {
        const { W, H } = S, col = hex(p.color);
        c.font = `bold ${Math.round(p.size)}px monospace`; c.textAlign = p.align; c.textBaseline = 'middle'; c.fillStyle = p.color;
        c.fillText(p.str, Math.round(p.cx * W), Math.round(p.cy * H));
        const id = c.getImageData(0, 0, W, H), d = id.data; // hard-threshold antialiased edges
        for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] >= 128; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = on ? 255 : 0; }
        c.putImageData(id, 0, 0);
      } },

    repeat: { en: 'Repeat', cat: 'compose', label: '반복', ins: ['입력'], params: [
      N('n', '개수', 1, 32, 1, 5), Sel('mode', '배치', [['linear', '직선'], ['radial', '방사']], 'linear'),
      N('dx', '간격 X / 반경', -64, 64, 1, 12), N('dy', '간격 Y', -64, 64, 1, 0), N('rot', '복사본 회전(도)', -90, 90, 1, 0),
      N('sc', '복사본 크기 배율', 0.5, 1.5, 0.05, 1), N('fade', '알파 감쇠', 0, 1, 0.05, 0.3), N('spin', '방사 회전 횟수', -4, 4, 1, 0)],
      run(c, p, t, [im]) {
        for (let i = p.n - 1; i >= 0; i--) { // copy 0 on top
          const a = 1 - p.fade * i / p.n;
          if (p.mode === 'radial') { const th = TAU * i / p.n + p.spin * TAU * t; place(c, im, Math.cos(th) * p.dx, Math.sin(th) * p.dx, rad(p.rot) * i, p.sc ** i, a); }
          else place(c, im, p.dx * i, p.dy * i, rad(p.rot) * i, p.sc ** i, a);
        }
      } },
    scatter: { en: 'Scatter', cat: 'compose', label: '흩뿌리기', ins: ['입력'], params: [
      N('n', '개수', 1, 64, 1, 12), N('seed', '시드', 0, 99, 1, 1), N('area', '범위', 0, 1, 0.05, 1), N('rot', '회전 범위(도)', 0, 360, 5, 0),
      N('smin', '최소 크기', 0.1, 2, 0.05, 0.3), N('smax', '최대 크기', 0.1, 2, 0.05, 0.6), Chk('twinkle', '반짝임', false)],
      run(c, p, t, [im]) {
        const r = rng(p.seed * 977 + 13);
        for (let i = 0; i < p.n; i++) {
          const x = (r() - 0.5) * S.W * p.area, y = (r() - 0.5) * S.H * p.area, a = (r() - 0.5) * rad(p.rot), s = lerp(p.smin, p.smax, r()), ph = r();
          place(c, im, x, y, a, s, p.twinkle ? 0.5 + 0.5 * Math.sin(TAU * (t + ph)) : 1); // one full cycle per loop
        }
      } },

    flip: { en: 'Flip', cat: 'transform', label: '뒤집기', ins: ['입력'], params: [Sel('mode', '방향', [['h', '가로'], ['v', '세로'], ['both', '둘 다']], 'h')],
      run(c, p, t, [im]) { remap(c, im, (x, y) => [p.mode !== 'v' ? S.W - x : x, p.mode !== 'h' ? S.H - y : y]); } },
    offset: { en: 'Offset', cat: 'transform', label: '오프셋', ins: ['입력'], params: [
      N('ox', '이동 X', -128, 128, 1, 0), N('oy', '이동 Y', -128, 128, 1, 0), N('sx', '스크롤 X(바퀴)', -4, 4, 1, 0), N('sy', '스크롤 Y(바퀴)', -4, 4, 1, 0)],
      run(c, p, t, [im]) { const ox = Math.round(p.ox + p.sx * S.W * t), oy = Math.round(p.oy + p.sy * S.H * t); remap(c, im, (x, y) => [x - ox, y - oy], 'wrap'); } },
    scale: { en: 'Scale', cat: 'transform', label: '크기', ins: ['입력'], params: [N('sx', '가로 배율', 0.1, 4, 0.05, 1), N('sy', '세로 배율', 0.1, 4, 0.05, 1)],
      run(c, p, t, [im]) { const { W, H } = S; remap(c, im, (x, y) => [(x - W / 2) / p.sx + W / 2, (y - H / 2) / p.sy + H / 2]); } },
    scalealgo: { en: 'Scale Algorithm', cat: 'transform', label: '픽셀 스케일', ins: ['입력'], params: [Sel('k', '배율', [['2', '×2'], ['4', '×4']], '2')],
      run(c, p, t, [im]) { // EPX / Scale2x applied once or twice, then centre-cropped back to canvas
        const { W, H } = S, k = +p.k, id0 = im.getContext('2d').getImageData(0, 0, W, H);
        let src = new Uint32Array(id0.data.buffer.slice(0)), w = W, h = H;
        for (let s = 1; s < k; s *= 2) {
          const o = new Uint32Array(w * h * 4), g = (x, y) => src[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const P = g(x, y), A = g(x, y - 1), B = g(x + 1, y), C = g(x - 1, y), D = g(x, y + 1), i = y * 2 * w * 2 + x * 2;
            o[i] = C === A && C !== D && A !== B ? A : P; o[i + 1] = A === B && A !== C && B !== D ? B : P;
            o[i + w * 2] = D === C && D !== B && C !== A ? C : P; o[i + w * 2 + 1] = B === D && B !== A && D !== C ? D : P;
          }
          src = o; w *= 2; h *= 2;
        }
        const out = c.createImageData(W, H), u = new Uint32Array(out.data.buffer), ox = (w - W) >> 1, oy = (h - H) >> 1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) u[y * W + x] = src[(y + oy) * w + x + ox];
        c.putImageData(out, 0, 0);
      } },
    crop: { en: 'Crop', cat: 'transform', label: '자르기', ins: ['입력'], params: [
      N('x', 'X(px)', 0, 128, 1, 0), N('y', 'Y(px)', 0, 128, 1, 0), N('w', '너비(px)', 1, 128, 1, 64), N('h', '높이(px)', 1, 128, 1, 64)],
      run(c, p, t, [im]) { const x = Math.round(p.x), y = Math.round(p.y), w = Math.round(p.w), h = Math.round(p.h); c.drawImage(im, x, y, w, h, x, y, w, h); } },
    tile: { en: 'Tile', cat: 'transform', label: '타일', ins: ['입력'], params: [N('nx', '가로 개수', 1, 8, 1, 2), N('ny', '세로 개수', 1, 8, 1, 2), N('gap', '간격(px)', 0, 16, 1, 0)],
      run(c, p, t, [im]) { remap(c, im, tileMap(p, () => 0)); } },
    tilerandom: { en: 'Tile Random', cat: 'transform', label: '랜덤 타일', ins: ['입력'], params: [
      N('nx', '가로 개수', 1, 8, 1, 3), N('ny', '세로 개수', 1, 8, 1, 3), N('gap', '간격(px)', 0, 16, 1, 0), N('seed', '시드', 0, 99, 1, 1)],
      run(c, p, t, [im]) { remap(c, im, tileMap(p, (i, j) => Math.floor(hash(i, j, p.seed) * 8))); } },
    skew: { en: 'Skew', cat: 'transform', label: '기울이기', ins: ['입력'], params: [N('ax', '가로 기울기(도)', -60, 60, 1, 20), N('ay', '세로 기울기(도)', -60, 60, 1, 0)],
      run(c, p, t, [im]) {
        const { W, H } = S, a = Math.tan(rad(p.ax)), b = Math.tan(rad(p.ay)), det = 1 - a * b;
        remap(c, im, (x, y) => { const dx = x - W / 2, dy = y - H / 2; return [(dx - a * dy) / det + W / 2, (dy - b * dx) / det + H / 2]; });
      } },
    stretch: { en: 'Stretch', cat: 'transform', label: '늘이기', ins: ['입력'], params: [
      Sel('dir', '방향', [['x', '가로'], ['y', '세로']], 'x'), N('amt', '배율', 0.25, 4, 0.05, 1.5), N('anchor', '기준점', 0, 1, 0.05, 0.5)],
      run(c, p, t, [im]) {
        const { W, H } = S, ax = p.anchor * W, ay = p.anchor * H;
        remap(c, im, (x, y) => p.dir === 'x' ? [(x - ax) / p.amt + ax, y] : [x, (y - ay) / p.amt + ay]);
      } },
    warp4: { en: 'Warp', cat: 'transform', label: '4점 변형', ins: ['입력'],
      params: ['tl', 'tr', 'br', 'bl'].flatMap(k => [N(k + 'x', k.toUpperCase() + ' X', -64, 64, 1, 0), N(k + 'y', k.toUpperCase() + ' Y', -64, 64, 1, 0)]),
      run(c, p, t, [im]) { // inverse bilinear: find (u,v) in the warped quad for each pixel
        const { W, H } = S, A = [p.tlx, p.tly], B = [W + p.trx, p.try], C = [W + p.brx, H + p.bry], D = [p.blx, H + p.bly];
        const e = [B[0] - A[0], B[1] - A[1]], f = [D[0] - A[0], D[1] - A[1]], g = [A[0] - B[0] + C[0] - D[0], A[1] - B[1] + C[1] - D[1]];
        const X = (a, b) => a[0] * b[1] - a[1] * b[0], k2 = X(g, f);
        remap(c, im, (x, y) => {
          const h = [x - A[0], y - A[1]], k1 = X(e, f) + X(h, g), k0 = X(h, e);
          let v;
          if (Math.abs(k2) < 1e-6) v = -k0 / k1;
          else { const w = k1 * k1 - 4 * k0 * k2; if (w < 0) return null; const s = Math.sqrt(w); v = (-k1 - s) / (2 * k2); if (v < 0 || v > 1) v = (-k1 + s) / (2 * k2); }
          const dxu = e[0] + g[0] * v, dyu = e[1] + g[1] * v, u = Math.abs(dxu) > Math.abs(dyu) ? (h[0] - f[0] * v) / dxu : (h[1] - f[1] * v) / dyu;
          return u < 0 || u > 1 || v < 0 || v > 1 || !isFinite(u + v) ? null : [u * W, v * H];
        });
      } },
    bend: { en: 'Bend', cat: 'transform', label: '휘기', ins: ['입력'], params: [Sel('axis', '축', [['x', '가로 휨'], ['y', '세로 휨']], 'x'), N('amt', '휨 정도(px)', -64, 64, 1, 12)],
      run(c, p, t, [im]) { // parabolic arc approximation: displacement = amt * u^2, u in -1..1 across the axis
        const { W, H } = S;
        remap(c, im, (x, y) => p.axis === 'x' ? [x, y - p.amt * (((x - W / 2) / (W / 2)) ** 2 - 1)] : [x - p.amt * (((y - H / 2) / (H / 2)) ** 2 - 1), y]);
      } },
    background: { en: 'Background', cat: 'compose', label: '배경', ins: ['입력'], params: [Col('color', '색', '#1a1a2e'), N('alpha', '불투명도', 0, 1, 0.05, 1)],
      run(c, p, t, [im]) { c.globalAlpha = p.alpha; c.fillStyle = p.color; c.fillRect(0, 0, S.W, S.H); c.globalAlpha = 1; c.drawImage(im, 0, 0); } },
  });

  // tile inverse map: cell size includes gap; pick(i,j) -> 0..7 dihedral variant
  function tileMap(p, pick) {
    const { W, H } = S, cw = (W + p.gap) / p.nx, ch = (H + p.gap) / p.ny, tw = cw - p.gap, th = ch - p.gap;
    return (x, y) => {
      const i = Math.floor(x / cw), j = Math.floor(y / ch), lx = x - i * cw, ly = y - j * ch;
      if (lx >= tw || ly >= th) return null;
      const [u, v] = tile8(lx / tw, ly / th, pick(i, j));
      return [u * W, v * H];
    };
  }
})();
