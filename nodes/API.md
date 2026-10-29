# Node API

Add nodes in your own file with `defNodes({ key: {...} })` (core `DotVFX.html` defines it; it throws on
duplicate key or missing `en`/`label`/`cat`/`run`). Plain classic scripts: no `import`, file:// friendly.

## Def shape
```js
defNodes({
  mynode: {
    en: 'MyNode',            // English name
    label: '내 노드',         // Korean name
    cat: 'gen',              // gen | filter | transform | compose | color | anim | fx | io
    ins: ['입력'],            // one label per input socket ([] = generator)
    params: [ N(...), Col(...), Sel(...), Chk(...) ],
    run(c, p, t, ins, n, f) { ... draws into c ... }
  }
});
```
`run` arguments:
- `c`  2D context of a blank S.W x S.H canvas (draw the result here; return value ignored).
- `p`  resolved params for this frame (keyframes already applied; keyed by param `k`).
- `t`  loop phase: `f / S.frames` when `S.loop` (so t=1 == frame N == frame 0), else `f/(S.frames-1)` (0..1 over the clip).
- `ins` array of input canvases (missing input = blank canvas), index = socket order. Read with `pix(ins[0])`
  or `ins[0].getContext('2d').getImageData(...)`, or `c.drawImage(ins[0], 0, 0)`.
- `n`  the node, `f` the frame index. Globals: `S.W S.H S.frames S.fps S.loop`.
- Evaluate an input at another frame (like Echo): `evaluate(byId(n.in[i]), g)` -> canvas.
  Looping: `((f - k) % S.frames + S.frames) % S.frames` ; one-shot: `Math.max(0, f - k)`.

## Param builders (first arg `k` = key in `p`, `l` = Korean label)
- `N(k, l, min, max, step, def)` number slider
- `Col(k, l, '#rrggbb')` color
- `Sel(k, l, [['value','표시'], ...], def)` dropdown
- `Chk(k, l, bool)` checkbox
- `Txt(k, l, 'str')` free text

## Helpers (all in core, defined once)
- `lerp(a,b,k)`, `clamp(v,a=0,b=1)`, `lerpC(rgbA,rgbB,k)` (rounded rgb arrays)
- `hex('#rrggbb') -> [r,g,b]`, `rgb([r,g,b]) -> 'rgb(r,g,b)'`
- `rgb2hsv(r,g,b) -> [h 0..360, s 0..1, v 0..1]`, `hsv2rgb(h,s,v) -> [r,g,b]` (0..255, unrounded)
- `lum(d, i) -> 0..1` luminance of RGBA data at byte index i
- `rng(seed) -> () => 0..1` (mulberry32), `hash(x,y,seed) -> 0..1` (integers)
- `vnoise(u, v, P, seed) -> 0..1` value noise, tileable with integer period P (use for loops)
- `BAYER` 4x4 ordered-dither matrix (16 numbers, 0..15)
- `mkCanvas() -> canvas` blank S.W x S.H; `pix(canvas) -> RGBA data`
- `sample(d, W, H, x, y, mode='nearest') -> byte index or -1`; mode `nearest` (outside = -1) | `wrap` | `clamp`
- `disc(c,cx,cy,r)` hard filled circle; `line(c,x0,y0,x1,y1,size,offset)` Bresenham; `bolt(pts,jit,depth,rand)` midpoint displacement
- `c.createImageData(S.W,S.H)` / `c.putImageData(id,0,0)` for per-pixel output; `tOf(f)` = t for frame f

## Rules
1. Deterministic per frame: no `Math.random`; seed with `rng(p.seed)` / `hash`.
2. Loop-seamless when `S.loop`: frame 0 must equal frame N. Drive motion by `t` (use `Math.sin(2*Math.PI*t)`,
   integer cycles, `vnoise` with period) and avoid state that depends on `f` without wrapping.
3. Hard pixels: no antialiasing, no smoothing, round coordinates; only soft if the effect is inherently soft.
4. No external dependencies, no DOM access inside `run` (canvas helpers above are fine).
5. Keep each node <= ~40 lines; reuse helpers instead of copying them.
6. Use a unique key; one file per author/batch; every node must run with default params and no inputs
   (selfCheck evaluates each one at load, "selfCheck ok" in the console).
