// fx_c: collection generators (patterns, color table, texture map, starfield, explosion, lightning). See nodes/API.md
(() => {
  const K = [0, 0, 0], WH = [255, 255, 255], PI2 = Math.PI * 2;
  const M = lerpC, C = (p, k) => hex(p[k]);
  const D = {};
  // per-pixel node: mk(p, t, f) returns (x, y) => [r,g,b] | null
  const G = (key, en, label, params, mk) => {
    D[key] = { en, label, cat: 'fx', ins: [], params, run(c, p, t, i, n, f) {
      const id = c.createImageData(S.W, S.H), d = id.data, fn = mk(p, t, f);
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
        const v = fn(x, y); if (!v) continue;
        const o = (y * S.W + x) * 4; d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = 255;
      }
      c.putImageData(id, 0, 0);
    } };
  };
  // tile coords: v pixel-center, n tiles over length L -> [tile index, local pos, tile length]
  const tl = (v, n, L) => { const t = L / n, i = Math.floor(v / t); return [i, v - i * t, t]; };
  // rounded rect test in a tx*ty tile (lx,ly local), inset px, corner radius rad
  const rr = (lx, ly, tx, ty, ins, rad) => {
    const dx = Math.min(lx, tx - lx) - ins, dy = Math.min(ly, ty - ly) - ins;
    if (dx < 0 || dy < 0) return false;
    return !(dx < rad && dy < rad && (rad - dx) ** 2 + (rad - dy) ** 2 > rad * rad);
  };
  const oct = (a, b) => Math.max(Math.abs(a), Math.abs(b), (Math.abs(a) + Math.abs(b)) * 0.7071);
  const NT = N('n', '타일 수', 1, 8, 1, 2);

  G('fx_beveledtile', 'Beveled Tile', '베벨 타일', [NT, N('th', '두께', 1, 6, 1, 3), N('rough', '거칠기', 0, 1, 0.05, 0.3), Col('col', '색', '#b8c4dc'), N('seed', '시드', 0, 99, 1, 1)], p => {
    const b = C(p, 'col'), lt = M(b, WH, 0.5), dk = M(b, K, 0.45), dd = M(b, K, 0.8);
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H), e = Math.min(lx, ly, t - lx, u - ly);
      if (e < 1) return dd;
      if (e < p.th) return Math.min(lx, ly) < Math.min(t - lx, u - ly) ? lt : dk;
      return hash(x, y, p.seed) < p.rough * 0.25 ? lt : b;
    };
  });

  G('fx_checkerbg', 'Checker BG', '체커 배경', [N('ts', '타일 크기', 2, 32, 1, 8), Col('c1', '타일색 1', '#f5d5b5'), Col('c2', '타일색 2', '#e0b090'), Col('b1', '배경색 1', '#9a7078'), Col('b2', '배경색 2', '#7a5058')], p => {
    const [c1, c2, b1, b2] = ['c1', 'c2', 'b1', 'b2'].map(k => C(p, k)), s = p.ts;
    const inT = (x, y) => { const i = Math.floor(x / s), j = Math.floor(y / s); return !((i + j) & 1) && rr(x - i * s + 0.5, y - j * s + 0.5, s, s, 0, s * 0.3); };
    return (x, y) => inT(x, y) ? ((y % s) < s * 0.6 ? c1 : c2) : inT(x - 1, y - 1) ? b2 : b1;
  });

  G('fx_checker', 'Checker', '체커(컬렉션)', [NT, N('rad', '모서리 둥글기', 0, 16, 1, 8), Col('c1', '색 1', '#f5d5b5'), Col('c2', '색 2', '#9a7078'), Col('b1', '배경색 1', '#ffffff'), Col('b2', '배경색 2', '#d8d8d8')], p => {
    const [c1, c2, b1, b2] = ['c1', 'c2', 'b1', 'b2'].map(k => C(p, k));
    return (x, y) => {
      const [i, lx, t] = tl(x + 0.5, p.n, S.W), [j, ly, u] = tl(y + 0.5, p.n, S.H), par = (i + j) & 1;
      return rr(lx, ly, t, u, 0, p.rad) ? (par ? c2 : c1) : (par ? b2 : b1);
    };
  });

  G('fx_cinnamon', 'Cinnamon Rolls', '시나몬롤', [N('n', '타일 수', 1, 4, 1, 1), N('rev', '회전 수', 1, 6, 0.5, 3), Col('c1', '어두운 색', '#2a2a30'), Col('c2', '밝은 색', '#f0f0f4')], p => {
    const a = C(p, 'c1'), b = C(p, 'c2');
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H), da = (lx - t / 2) / t, db = (ly - u / 2) / u, r = Math.hypot(da, db) * 2;
      if (r > 0.9 && r < 1.0) return M(a, K, 0.5);
      const s = (((r * p.rev - Math.atan2(db, da) / PI2) % 1) + 1) % 1;
      return M(a, b, Math.floor(s * 4) / 3);
    };
  });

  G('fx_corners', 'Corners', '모서리 줄무늬', [NT, N('w', '줄 두께', 1, 6, 1, 2), N('g', '줄 간격', 1, 6, 1, 2), Col('c1', '줄 색', '#ffffff'), Col('c2', '배경색', '#101010')], p => {
    const a = C(p, 'c1'), b = C(p, 'c2');
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H), m = Math.floor(Math.min(lx, t - lx, ly, u - ly));
      return m % (p.w + p.g) < p.w ? a : b;
    };
  });

  G('fx_cutbrick', 'Cut Brick', '잘린 벽돌', [NT, N('seed', '시드', 0, 99, 1, 1), N('cut', '자름 양', 0, 1, 0.05, 0.5), N('rad', '모서리 반경', 0, 8, 1, 2), Col('col', '색', '#9a9a9a')], p => {
    const b = C(p, 'col'), lt = M(b, WH, 0.45), dk = M(b, K, 0.35), dd = M(b, K, 0.8);
    return (x, y) => {
      const [i, lx, t] = tl(x + 0.5, p.n, S.W), [j, ly, u] = tl(y + 0.5, p.n, S.H);
      if (!rr(lx, ly, t, u, 1, p.rad)) return dd;
      for (let k = 0; k < 4; k++) {
        const cx = k & 1 ? t - lx : lx, cy = k & 2 ? u - ly : ly, h = q => hash(i * 7 + q, j, p.seed * 11 + k);
        if (h(1) < 0.6 && cx < h(2) * p.cut * t * 0.4 && cy < h(3) * p.cut * u * 0.4) return dd;
      }
      return Math.min(lx, ly) < 2.5 ? lt : Math.min(t - lx, u - ly) < 2.5 ? dk : b;
    };
  });

  G('fx_dotgrid', 'Dot Grid', '점 격자', [N('gs', '격자 크기', 4, 32, 1, 16), N('th', '두께', 1, 4, 1, 1), N('dot', '점 크기', 1, 12, 1, 5), Chk('fill', '속 채움', false), Col('fg', '점 색', '#ffffff'), Col('bg', '배경색', '#000000')], p => {
    const fg = C(p, 'fg'), bg = C(p, 'bg'), ln = M(bg, fg, 0.45), g = p.gs;
    return (x, y) => {
      const d = Math.hypot(x % g + 0.5 - g / 2, y % g + 0.5 - g / 2);
      if (d <= p.dot && (p.fill || d > p.dot - p.th)) return fg;
      return x % g === 0 || y % g === 0 ? ln : bg;
    };
  });

  G('fx_dots', 'Dots', '육각 점', [N('size', '크기', 0.2, 1, 0.05, 0.85), N('scale', '스케일', 2, 16, 2, 4), Col('c1', '어두운 색', '#18181c'), Col('c2', '밝은 색', '#ffffff')], p => {
    const a = C(p, 'c1'), b = C(p, 'c2'), s = p.scale, cw = S.W / s, rh = S.H / s, R = p.size * cw / 2;
    return (x, y) => {
      let best = 1e9;
      const j0 = Math.floor((y + 0.5) / rh);
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const off = (j & 1) * cw / 2, i = Math.round((x + 0.5 - off) / cw - 0.5);
        best = Math.min(best, Math.hypot(x + 0.5 - off - (i + 0.5) * cw, y + 0.5 - (j + 0.5) * rh));
      }
      return best > R ? a : M(a, b, Math.min(3, Math.floor((1 - best / R) * 3) + 1) / 3);
    };
  });

  G('fx_flower', 'Flower', '꽃 패턴', [N('n', '타일 수', 1, 3, 1, 1), N('size', '꽃 크기', 0.1, 0.35, 0.01, 0.2), N('th', '두께', 1, 6, 1, 3), N('corner', '모서리', 0, 0.5, 0.05, 0.2), Col('fg', '선 색', '#e8e8e8'), Col('bg', '배경색', '#404040')], p => {
    const fg = C(p, 'fg'), bg = C(p, 'bg');
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H), a = lx - t / 2, b = ly - u / 2, R = p.size * t;
      let F = R * 0.9 - Math.hypot(a, b);
      for (const [ox, oy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) F = Math.max(F, R - Math.hypot(a - ox, b - oy));
      const dc = Math.hypot(Math.min(lx, t - lx), Math.min(ly, u - ly)), cr = p.corner * t;
      return (F >= 0 && F < p.th) || (dc < cr && dc >= cr - p.th) ? fg : bg;
    };
  });

  G('fx_leaf', 'Leaf', '잎 패턴', [N('n', '타일 수', 1, 3, 1, 1), N('width', '잎 너비', 0.05, 0.4, 0.01, 0.15), N('th', '두께', 1, 4, 1, 2), N('circle', '중앙 원', 0.02, 0.2, 0.01, 0.08), Col('fg', '선 색', '#ffffff'), Col('bg', '배경색', '#000000')], p => {
    const fg = C(p, 'fg'), bg = C(p, 'bg'), mid = M(bg, fg, 0.5);
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H), a = lx - t / 2, b = ly - u / 2, h = t / 2, R = h * 0.9, o = oct(a, b);
      if (o > R) return bg;
      if (o > R - p.th) return fg;
      const d = Math.hypot(a, b), c0 = p.circle * h;
      if (d <= c0) return d > c0 - p.th ? fg : bg;
      for (const [u1, v1] of [[Math.abs(a), Math.abs(b)], [Math.abs(b), Math.abs(a)]]) {
        const L = R * 0.8, tt = (u1 - c0) / (L - c0);
        if (tt > 0 && tt < 1) { const g = p.width * h * 4 * tt * (1 - tt) - v1; if (g >= 0) return g < 1.2 ? fg : mid; }
      }
      return bg;
    };
  });

  G('fx_rope', 'Rope', '밧줄', [N('amount', '줄 수', 2, 8, 1, 3), N('tw', '꼬임 수', 1, 8, 1, 4), N('skew', '기울기', 0, 1.5, 0.05, 0.6), Col('c1', '밝은 색', '#f0f0f0'), Col('c2', '어두운 색', '#303030')], p => {
    const lt = C(p, 'c1'), dk = C(p, 'c2'), rh = S.H / p.amount;
    return (x, y) => {
      const j = Math.floor((y + 0.5) / rh), ly = (y + 0.5) / rh - j, prof = 1 - Math.abs(2 * ly - 1);
      if (prof < 0.12) return dk;
      const on = (((x + 0.5) / S.W * p.tw + ly * p.skew) % 1 + 1) % 1 < 0.6;
      return M(dk, lt, on ? (prof > 0.55 ? 1 : prof > 0.3 ? 0.66 : 0.33) : 0.1);
    };
  });

  G('fx_starring', 'Star Ring', '별 고리', [N('th', '고리 두께', 1, 8, 1, 3), N('ring', '고리 크기', 0.5, 1, 0.05, 0.9), N('star', '별 크기', 0.2, 1, 0.05, 0.6), N('rot', '회전(도)', 0, 45, 1, 0), N('corner', '모서리 장식', 0, 0.5, 0.05, 0.15), Col('fg', '밝은 색', '#f2f2f2'), Col('bg', '어두운 색', '#1a1a1a')], p => {
    const fg = C(p, 'fg'), bg = C(p, 'bg'), mid = M(bg, fg, 0.5), h = S.W / 2, R = p.ring * h, rot = p.rot * Math.PI / 180;
    return (x, y) => {
      const a = x + 0.5 - h, b = y + 0.5 - S.H / 2, o = oct(a, b), r = Math.hypot(a, b);
      if (o > R) return Math.hypot(Math.min(x + 0.5, S.W - x - 0.5), Math.min(y + 0.5, S.H - y - 0.5)) < p.corner * S.W ? fg : mid;
      if (o > R - p.th) return fg;
      if (o > R - 2 * p.th) return bg;
      const rs = p.star * h * (0.3 + 0.7 * Math.abs(Math.cos(4 * (Math.atan2(b, a) - rot))) ** 3);
      return r < rs ? (r < rs * 0.45 ? fg : mid) : bg;
    };
  });

  G('fx_tube', 'Tube', '튜브', [N('n', '타일 수', 1, 4, 1, 1), N('scale', '모양 크기', 0.3, 1, 0.05, 0.7), N('out', '외곽선 두께', 1, 3, 1, 1), N('donut', '도넛 구멍', 0, 0.9, 0.05, 0.5), N('height', '높이감', 0, 1, 0.1, 1), Col('c1', '색', '#d8d8e8'), Col('c2', '외곽선 색', '#202030')], p => {
    const a = C(p, 'c1'), dk = C(p, 'c2');
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H);
      const s = [[lx - t / 2, ly - u / 2], [lx < t / 2 ? lx : lx - t, ly < u / 2 ? ly : ly - u]].sort((q, r) => Math.hypot(...q) - Math.hypot(...r))[0];
      const d = Math.hypot(...s), R = p.scale * t / 2, hr = R * p.donut, lit = Math.floor((0.5 - s[1] / R * 0.5 * p.height) * 3) / 3;
      const bgc = M(a, dk, Math.floor((0.2 + 0.3 * ly / u) * 3) / 3);
      if (d > R) return bgc;
      if (d > R - p.out) return dk;
      if (hr > 0 && d < hr) return d >= hr - p.out ? dk : bgc;
      return M(dk, a, clamp(0.35 + lit));
    };
  });

  G('fx_weavechecker', 'Weave Checker', '직조 체커', [N('n', '칸 수', 1, 8, 1, 4), N('amount', '줄 수', 1, 4, 1, 2), Col('c1', '색 1', '#e8e8e8'), Col('c2', '색 2', '#505050')], p => {
    const a = C(p, 'c1'), b = C(p, 'c2');
    return (x, y) => {
      const [i, lx, t] = tl(x + 0.5, p.n, S.W), [j, ly, u] = tl(y + 0.5, p.n, S.H), hor = (i + j) & 1;
      const base = Math.floor((hor ? ly / u : lx / t) * p.amount) & 1 ? a : b;
      return (hor ? Math.min(lx, t - lx) : Math.min(ly, u - ly)) < 1 ? M(base, K, 0.5) : base;
    };
  });

  G('fx_weave', 'Weave', '직조(컬렉션)', [N('scale', '칸 수', 2, 8, 1, 4), N('width', '줄 너비', 0.3, 0.95, 0.05, 0.7), N('shadow', '그림자', 0, 4, 1, 2), Col('fg', '줄 색', '#f2f2f2'), Col('bg', '배경색', '#1c1c1c')], p => {
    const fg = C(p, 'fg'), bg = C(p, 'bg'), sh = M(fg, K, 0.45);
    return (x, y) => {
      const [i, lx, t] = tl(x + 0.5, p.scale, S.W), [j, ly, u] = tl(y + 0.5, p.scale, S.H), hor = !((i + j) & 1);
      const da = Math.abs(lx - t / 2), db = Math.abs(ly - u / 2), hw = p.width * t / 2, hh = p.width * u / 2, hb = db <= hh, vb = da <= hw;
      if (hb && vb) return fg;
      if (hb) return !hor && da - hw <= p.shadow ? sh : fg;
      if (vb) return hor && db - hh <= p.shadow ? sh : fg;
      return bg;
    };
  });

  G('fx_wooddiamond', 'Wood Diamond', '나뭇결 다이아몬드', [N('n', '타일 수', 1, 3, 1, 1), N('amount', '결 간격', 2, 12, 1, 4), N('ratio', '결 비율', 0.2, 0.8, 0.05, 0.5), N('ns', '노이즈 크기', 1, 8, 1, 3), N('er', '침식 강도', 0, 8, 0.5, 3), Col('c1', '밝은 색', '#f4f4f4'), Col('c2', '어두운 색', '#101010')], p => {
    const a = C(p, 'c1'), b = C(p, 'c2');
    return (x, y) => {
      const [, lx, t] = tl(x + 0.5, p.n, S.W), [, ly, u] = tl(y + 0.5, p.n, S.H), ma = Math.abs(lx - t / 2), mb = Math.abs(ly - u / 2);
      const nz = (vnoise(ma / t * p.ns * 2, mb / u * p.ns * 2, 1000, 5) - 0.5) * p.er, s = ma > mb ? ma * 0.5 + mb : mb * 0.5 + ma;
      const on = ((((s + nz) / p.amount) % 1) + 1) % 1 < p.ratio, dia = ma + mb < 0.3 * t;
      return on !== dia ? a : b;
    };
  });

  G('fx_colortable', 'Color Table', '컬러 테이블', [N('dim', '기본 차원', 2, 8, 1, 4)], p => {
    const d = p.dim, g = Math.ceil(Math.sqrt(d ** 3)), tw = S.W / g, th = S.H / g;
    return (x, y) => {
      const i = Math.floor(y / th) * g + Math.floor(x / tw);
      if (i >= d ** 3) return null;
      return [i % d, Math.floor(i / d) % d, Math.floor(i / (d * d))].map(v => Math.round(v / (d - 1) * 255));
    };
  });

  G('fx_texturemap', 'Texture map', 'UV 맵', [], () => (x, y) => [Math.round(x / Math.max(1, S.W - 1) * 255), Math.round((1 - y / Math.max(1, S.H - 1)) * 255), 0]);

  G('fx_starfield', 'Starfield', '별밭', [N('px', '위치 X', 0, 1, 0.01, 0), N('py', '위치 Y', 0, 1, 0.01, 0), N('speed', '속도(폭/루프)', 0, 4, 1, 1), N('shift', '레이어 차이', 0, 3, 1, 1), N('scale', '스케일', 2, 16, 1, 4), N('size', '별 크기', 1, 4, 1, 2), Col('star', '별 색', '#ffffff'), Col('bg', '배경색', '#0a0e24')], (p, t) => {
    const st = C(p, 'star'), bg = C(p, 'bg');
    return (x, y) => {
      for (let l = 2; l >= 0; l--) {
        const Nc = p.scale * (l + 1), cw = S.W / Nc, ch = S.H / Nc;
        const X = ((x + Math.round(t * (p.speed + l * p.shift) * S.W + p.px * S.W)) % S.W + S.W) % S.W, Y = ((y + Math.round(p.py * S.H)) % S.H + S.H) % S.H;
        const cx = Math.floor((X + 0.5) / cw), cy = Math.floor((Y + 0.5) / ch), sd = l * 3;
        if (hash(cx, cy, sd + 2) > 0.3) continue;
        const sz = Math.max(1, Math.round(p.size * (l + 1) / 3)), dx = Math.floor(X - cx * cw) - Math.floor((0.15 + 0.6 * hash(cx, cy, sd)) * cw), dy = Math.floor(Y - cy * ch) - Math.floor((0.15 + 0.6 * hash(cx, cy, sd + 1)) * ch);
        if (dx >= 0 && dx < sz && dy >= 0 && dy < sz) return M(bg, st, [0.4, 0.7, 1][l]);
      }
      return bg;
    };
  });

  D.fx_explosion = { en: 'Explosion', label: '파티클 폭발', cat: 'fx', ins: [], params: [
    N('life', '수명', 0.3, 1, 0.05, 0.85), N('size', '입자 크기', 2, 16, 1, 12), N('amount', '개수', 4, 60, 1, 24), N('vel', '속도', 0, 60, 1, 30), N('seed', '시드', 0, 99, 1, 1),
    Col('c0', '색 1(중심)', '#ffe566'), Col('c1', '색 2', '#ff8a1f'), Col('c2', '색 3', '#c2301f')],
  run(c, p, t) {
    const { W, H } = S, r = rng(p.seed * 97 + 3), c2 = hex(p.c2), cols = [hex(p.c0), hex(p.c1), c2, M(c2, [60, 50, 60], 0.7)], ps = [];
    ps.push({ x: W / 2, y: H * 0.6, a: t / p.life, s: p.size * 1.8 });
    for (let i = 0; i < p.amount; i++) {
      const ang = r() * PI2, sp = (0.4 + 0.6 * r()) * p.vel, a = t / (p.life * (0.55 + 0.45 * r())), s0 = p.size * (0.5 + 0.5 * r()), d = sp * (1 - (1 - Math.min(1, t * 1.3)) ** 2);
      ps.push({ x: W / 2 + Math.cos(ang) * d, y: H * 0.6 + Math.sin(ang) * d * 0.8 - t * 8, a, s: s0 });
    }
    for (let b = 3; b >= 0; b--) for (const q of ps) {
      if (q.a >= 0.95 || Math.min(3, Math.floor(q.a / 0.27)) !== b) continue;
      c.fillStyle = rgb(cols[b]); disc(c, q.x, q.y, Math.max(1, q.s * (1 - q.a * 0.6) / 2));
    }
    const id = c.getImageData(0, 0, W, H), d = id.data, al = Uint8Array.from({ length: W * H }, (_, i) => d[i * 4 + 3]), ol = M(c2, K, 0.7);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (al[i] > 0 || !(al[i - 1] > 0 && x > 0 || al[i + 1] > 0 && x < W - 1 || al[i - W] > 0 || al[i + W] > 0)) continue;
      d[i * 4] = ol[0]; d[i * 4 + 1] = ol[1]; d[i * 4 + 2] = ol[2]; d[i * 4 + 3] = 255;
    }
    c.putImageData(id, 0, 0);
  } };

  D.fx_lightning = { en: 'Lightning', label: '번개(컬렉션)', cat: 'fx', ins: [], params: [
    N('angle', '각도(도)', -60, 60, 1, 0), N('bloom', '블룸', 0, 3, 1, 1), N('wiggle', '흔들림', 0, 30, 1, 8), N('hold', '깜빡임 프레임', 1, 16, 1, 2),
    Col('core', '심 색', '#ffffff'), Col('glow', '빛 색', '#5ac8ff')],
  run(c, p, t, ins, n, f) {
    const a = p.angle * Math.PI / 180, dx = Math.sin(a) * 0.6, dy = Math.cos(a) * 0.6, L = DEFS.lightning, tmp = mkCanvas();
    L.run(tmp.getContext('2d'), { ...defaults(L), x0: 0.5 - dx, y0: 0.5 - dy, x1: 0.5 + dx, y1: 0.5 + dy, jitter: p.wiggle, hold: p.hold, core: p.core, glow: p.glow }, t, [], n, f);
    if (p.bloom > 0) {
      const h = mkCanvas(), hc = h.getContext('2d'), b = p.bloom;
      for (const [ox, oy] of [[-b, 0], [b, 0], [0, -b], [0, b], [-b, -b], [b, b], [-b, b], [b, -b]]) hc.drawImage(tmp, ox, oy);
      hc.globalCompositeOperation = 'source-in'; hc.fillStyle = rgb(M(hex(p.glow), K, 0.35)); hc.fillRect(0, 0, S.W, S.H);
      c.drawImage(h, 0, 0);
    }
    c.drawImage(tmp, 0, 0);
  } };

  defNodes(D);
})();
