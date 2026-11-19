# Census of the weapon mount positions on the Mandator II source model (assets/source/mandator-stl, gunzip it first).
#
#   python3 -I scripts/stl-measure/mandator_mount_census.py MODEL.STL OUT_DIR [design.json.gz]
#
# Writes OUT_DIR/mounts.json, OUT_DIR/census_numbers.txt and OUT_DIR/renders/*.png. Needs numpy; PIL for the pictures
# (without PIL the pictures are skipped and the numbers are still written). Nothing in the repository is read except the
# optional design file, which is only compared against.
#
# The model is split into shells (triangles joined by shared vertices). The mount positions are repeated shells:
#   utl      octagonal recess with a raised rim      54 or 72 triangles, about 129 m across the base
#   twin175  framed square recess                    34 or 48 triangles, about 45 m square (its frame is a separate shell)
#   ionBall  ball in a louvred box                   88 triangles (ball) with a 100-triangle box
#   pd       rounded pad with a step on top          56, 58 or 60 triangles, about 42 m by 33 m by 9.4 m
# Which shell is which was decided by looking at renders next to the user's pictures, not by size alone: see
# docs/benchmarks/mandator2-rebuild-2026-11-19/census.md.
#
# Frame: STL y runs along the hull (stern at +y), x across, z up. Ship frame: x from the stern, y up, z to starboard.
#   ship_x = (STL_Y_STERN - stl_y) * S,  ship_z = stl_x * S,  ship_y = stl_z * S + Y_OFFSET
# Y_OFFSET 348 puts the model's lowest point at y 0 and the middle of its side band (z -32.0 to +27.9 m) on the middle of
# the example hull's side band (y 312 to 380); the engines of the present example were placed with the same offset.
import sys, os, json, struct, gzip, collections
import numpy as np

S = 70.9
STL_Y_STERN = 57.87188
Y_OFFSET = 348.0
Y_OFFSET_REQUESTED = 374.0


def load(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[80:84])[0]
    a = np.frombuffer(b, dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]), count=n, offset=84)
    return a['v'].astype(np.float64)


def components(T):
    V = T.reshape(-1, 3)
    key = np.round(V * 1e4).astype(np.int64)
    u, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1, 3)
    par = np.arange(len(u))

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    for t in inv:
        r = f(t[0])
        for k in (1, 2):
            s = f(t[k])
            if s != r:
                par[s] = r
    root = np.array([f(t[0]) for t in inv])
    return np.unique(root, return_inverse=True)[1]


def to_ship(p, yoff=Y_OFFSET):
    return [round((STL_Y_STERN - p[1]) * S, 1), round(p[2] * S + yoff, 1), round(p[0] * S, 1)]


def dir_ship(v):  # direction vector STL -> ship
    return [round(-v[1], 3), round(v[2], 3), round(v[0], 3)]


class Shell:
    def __init__(self, cid, P):
        self.id = cid
        self.P = P
        V = P.reshape(-1, 3)
        self.lo, self.hi = V.min(0), V.max(0)
        self.c = (self.lo + self.hi) / 2
        self.d = (self.hi - self.lo) * S
        N = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
        self.A = np.linalg.norm(N, axis=1) / 2
        ok = self.A > 1e-12
        self.n = np.zeros_like(N)
        self.n[ok] = N[ok] / (2 * self.A[ok, None])
        self.area = self.A.sum() * S * S
        self.tris = len(P)

    def axis(self):
        M = (self.n * self.A[:, None]).T @ self.n
        w, v = np.linalg.eigh(M)
        return v[:, -1]

    def levels(self, ax, tol=0.004):
        """Flat faces square to ax, merged by height: [height (STL units), area m2, sign of normal, vertices]."""
        par = np.abs(self.n @ ax) > 0.97
        lv = self.P[par].mean(1) @ ax
        sg = np.sign(self.n[par] @ ax)
        a = self.A[par] * S * S
        Pp = self.P[par]
        out = []
        for i in np.argsort(lv):
            if out and abs(out[-1][0] - lv[i]) < tol and out[-1][2] == sg[i]:
                out[-1][1] += a[i]
                out[-1][3].append(Pp[i])
            else:
                out.append([lv[i], a[i], sg[i], [Pp[i]]])
        for o in out:
            o[3] = np.array(o[3]).reshape(-1, 3)
        return out


def plane_frame(ax):
    f = np.array([0, -1.0, 0])  # toward the bow
    u = f - ax * (f @ ax)
    if np.linalg.norm(u) < 1e-6:
        u = np.array([1.0, 0, 0]) - ax * ax[0]
    u /= np.linalg.norm(u)
    return u, np.cross(ax, u)


def min_rect(V, ax):
    """Smallest rectangle around the vertices in the plane square to ax: long m, short m, yaw of the long side from the
    bow direction (degrees, 0 to 180), centre (STL)."""
    u, v = plane_frame(ax)
    a, b = V @ u, V @ v
    best = None
    for deg in np.arange(0, 180, 0.5):
        t = np.radians(deg)
        p = a * np.cos(t) + b * np.sin(t)
        q = -a * np.sin(t) + b * np.cos(t)
        ar = np.ptp(p) * np.ptp(q)
        if best is None or ar < best[0] - 1e-12:
            best = (ar, deg, np.ptp(p), np.ptp(q), (p.max() + p.min()) / 2, (q.max() + q.min()) / 2)
    _, deg, lp, lq, cp, cq = best
    if lq > lp + 1e-9:
        lp, lq, deg = lq, lp, (deg + 90) % 180
    return round(lp * S, 1), round(lq * S, 1), round(float(deg), 1)


def facing_word(n):
    if n[2] > 0.985:
        return 'up'
    if n[2] < -0.985:
        return 'down'
    if abs(n[2]) < 0.2:
        if abs(n[0]) > 0.95:
            return 'side (starboard)' if n[0] > 0 else 'side (port)'
        if abs(n[1]) > 0.95:
            return 'aft' if n[1] > 0 else 'forward'
        return ('aft' if n[1] > 0 else 'forward') + ' and ' + ('starboard' if n[0] > 0 else 'port') + ', oblique'
    return 'sloped up' if n[2] > 0 else 'sloped down'


def ray_clear(T, tri_mask_skip, origin, direction, tmax):
    """Distance (STL units) to the first triangle along the ray, or None."""
    sel = ~tri_mask_skip
    lo = T[sel].min(1)
    hi = T[sel].max(1)
    a, b = origin, origin + direction * tmax
    box = (hi >= np.minimum(a, b) - 1e-6).all(1) & (lo <= np.maximum(a, b) + 1e-6).all(1)
    Q = T[sel][box]
    if not len(Q):
        return None
    e1, e2 = Q[:, 1] - Q[:, 0], Q[:, 2] - Q[:, 0]
    h = np.cross(direction, e2)
    det = (e1 * h).sum(1)
    ok = np.abs(det) > 1e-14
    inv = np.zeros_like(det)
    inv[ok] = 1 / det[ok]
    s = origin - Q[:, 0]
    uu = (s * h).sum(1) * inv
    q = np.cross(s, e1)
    vv = (q @ direction) * inv
    t = (q * e2).sum(1) * inv
    hit = ok & (uu >= 0) & (vv >= 0) & (uu + vv <= 1) & (t > 1e-6) & (t <= tmax)
    return float(t[hit].min()) if hit.any() else None


# ---------------------------------------------------------------- pictures (optional)
def view_matrix(name):
    return {'top': np.array([[0, -1, 0], [-1, 0, 0], [0, 0, 1.]]),     # bow to the right, port up
            'stbd': np.array([[0, -1, 0], [0, 0, 1], [1, 0, 0.]]) * np.array([[-1], [1], [1]]),  # from starboard, bow left
            'port': np.array([[0, -1, 0], [0, 0, 1], [-1, 0, 0.]]),   # from port, bow right
            'stern': np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0.]])}[name]


def oblique(az, el):
    a, e = np.radians(az), np.radians(el)
    d = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
    r = np.cross([0, 0, 1.], d)
    r /= np.linalg.norm(r)
    return np.array([r, np.cross(d, r), d])


def render(T, M, center, half, px=900, hl=None, light=(0.35, 0.5, 0.8)):
    P = (T - np.asarray(center)) @ M.T
    hw, hh = half if isinstance(half, tuple) else (half, half)
    W, H = px, int(round(px * hh / hw))
    lo, hi = P.min(1), P.max(1)
    idx = np.nonzero((hi[:, 0] > -hw) & (lo[:, 0] < hw) & (hi[:, 1] > -hh) & (lo[:, 1] < hh))[0]
    P = P[idx]
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    ln = np.linalg.norm(n, axis=1)
    ln[ln == 0] = 1
    n /= ln[:, None]
    L = np.asarray(light, float)
    L /= np.linalg.norm(L)
    sh = 0.25 + 0.75 * np.clip(np.abs(n @ L) * 0.75 + 0.25 * np.abs(n[:, 2]), 0, 1)
    sc = W / (2 * hw)
    X, Y, Z = (P[:, :, 0] + hw) * sc, (hh - P[:, :, 1]) * sc, P[:, :, 2]
    zb = np.full((H, W), -1e30)
    img = np.zeros((H, W, 3), np.uint8)
    img[:] = (245, 246, 250)
    base, red = np.array([70, 120, 225.]), np.array([235, 90, 60.])
    for k in range(len(idx)):
        x, y, z = X[k], Y[k], Z[k]
        x0, x1 = max(int(np.floor(x.min())), 0), min(int(np.ceil(x.max())) + 1, W)
        y0, y1 = max(int(np.floor(y.min())), 0), min(int(np.ceil(y.max())) + 1, H)
        if x0 >= x1 or y0 >= y1:
            continue
        den = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(den) < 1e-12:
            continue
        GX, GY = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        a = ((y[1] - y[2]) * (GX - x[2]) + (x[2] - x[1]) * (GY - y[2])) / den
        b = ((y[2] - y[0]) * (GX - x[2]) + (x[0] - x[2]) * (GY - y[2])) / den
        c = 1 - a - b
        m = (a >= -1e-9) & (b >= -1e-9) & (c >= -1e-9)
        if not m.any():
            continue
        zz = a * z[0] + b * z[1] + c * z[2]
        sub = zb[y0:y1, x0:x1]
        m &= zz > sub
        if not m.any():
            continue
        sub[m] = zz[m]
        col = red if (hl is not None and hl[idx[k]]) else base
        img[y0:y1, x0:x1][m] = (col * sh[k]).astype(np.uint8)
    return img


COL = {'utl': (230, 40, 40), 'twin175': (250, 170, 0), 'ionBall': (0, 170, 60), 'pd': (190, 0, 200)}


def pictures(T, lab, classes, rdir, reps):
    try:
        from PIL import Image, ImageDraw
    except Exception as e:  # pragma: no cover
        print('PIL not available, pictures skipped:', e)
        return []
    os.makedirs(rdir, exist_ok=True)
    made = []
    # whole ship with the positions marked
    for name, half, px in (('top', (58.0, 21.5), 3000), ('stbd', (58.0, 9.0), 3000)):
        M = view_matrix(name)
        ctr = np.array([0, 1.455, 3.0])
        img = Image.fromarray(render(T, M, ctr, half, px=px))
        dr = ImageDraw.Draw(img)
        sc = px / (2 * half[0])
        for cls, items in classes.items():
            r = {'utl': 11, 'twin175': 7, 'ionBall': 9, 'pd': 4}[cls]
            for it in items:
                p = np.array(it['stl'])
                if name == 'stbd' and p[0] < -1e-6:
                    continue
                q = (p - ctr) @ M.T
                X, Y = (q[0] + half[0]) * sc, (half[1] - q[1]) * sc
                dr.ellipse([X - r, Y - r, X + r, Y + r], outline=COL[cls], width=3)
        y = 8
        for cls in classes:
            dr.rectangle([8, y, 30, y + 14], fill=COL[cls])
            dr.text((36, y + 1), '%s  %d' % (cls, len(classes[cls])), fill=(20, 20, 20))
            y += 20
        dr.text((8, y), 'top view: bow right, port up' if name == 'top' else 'from starboard: bow left (starboard and centreline mounts only)', fill=(20, 20, 20))
        path = os.path.join(rdir, 'overview_%s_marked.png' % name)
        img.save(path)
        made.append(path)
    # representative shells: from above, oblique, and square to the mount
    for cls, ids in reps.items():
        for cid, half_m in ids:
            hl = lab == cid
            V = T[hl].reshape(-1, 3)
            c = (V.min(0) + V.max(0)) / 2
            h = half_m / S
            near = (np.abs(T.mean(1) - c) < h * 3).all(1)
            az = -60 if c[0] >= 0 else 240
            side = 'stbd' if c[0] >= 0 else 'port'
            ims = [render(T[near], view_matrix('top'), c, h, px=520, hl=hl[near]),
                   render(T[near], oblique(az, 35), c, h, px=520, hl=hl[near]),
                   render(T[near], view_matrix(side), c, h, px=520, hl=hl[near])]
            path = os.path.join(rdir, '%s_shell%d.png' % (cls, cid))
            Image.fromarray(np.concatenate(ims, 1)).save(path)
            made.append(path)
    # cross-sections of the starboard edge (side band): model z in metres on the left, ship y on the right
    for y0 in (14.0, 22.6):
        d = T[:, :, 1] - y0
        m = (d.min(1) < 0) & (d.max(1) > 0)
        segs = []
        for tri, dd in zip(T[m], d[m]):
            pts = []
            for i in range(3):
                j = (i + 1) % 3
                if (dd[i] < 0) != (dd[j] < 0):
                    t = dd[i] / (dd[i] - dd[j])
                    pts.append(tri[i] + t * (tri[j] - tri[i]))
            if len(pts) == 2:
                segs.append(pts)
        segs = np.array(segs)
        xm = segs[:, :, 0].max()
        x0, x1, z0, z1 = xm - 400 / S, xm + 60 / S, -150 / S, 150 / S
        Wp = 1200
        sc = Wp / (x1 - x0)
        Hp = int((z1 - z0) * sc)
        img = Image.new('RGB', (Wp, Hp), (255, 255, 255))
        dr = ImageDraw.Draw(img)
        for gz in range(-150, 151, 25):
            Y = Hp - (gz / S - z0) * sc
            dr.line([(0, Y), (Wp, Y)], fill=(255, 150, 150) if gz == 0 else (225, 225, 225))
            dr.text((3, Y - 11), 'z %d m' % gz, fill=(110, 110, 110))
            dr.text((Wp - 70, Y - 11), 'y %d' % (gz + Y_OFFSET), fill=(110, 110, 110))
        for a_, b_ in segs:
            dr.line([((a_[0] - x0) * sc, Hp - (a_[2] - z0) * sc), ((b_[0] - x0) * sc, Hp - (b_[2] - z0) * sc)], fill=(20, 60, 160), width=1)
        dr.text((120, 4), 'section at ship x %.0f m (model y %.1f), starboard edge; half width %.0f m' % ((STL_Y_STERN - y0) * S, y0, xm * S), fill=(0, 0, 0))
        path = os.path.join(rdir, 'section_shipx%d.png' % round((STL_Y_STERN - y0) * S))
        img.save(path)
        made.append(path)
    return made


# ---------------------------------------------------------------- main
def main():
    stl, out = sys.argv[1], sys.argv[2]
    design = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(out, exist_ok=True)
    T = load(stl)
    lab = components(T)
    nc = lab.max() + 1
    order = np.argsort(lab, kind='stable')
    st = np.r_[0, np.cumsum(np.bincount(lab))]
    sh = [Shell(c, T[order[st[c]:st[c + 1]]]) for c in range(nc)]
    log = []

    def say(*a):
        s = ' '.join(str(x) for x in a)
        print(s)
        log.append(s)
    say('triangles', len(T), 'shells', nc, 'bbox', np.round(T.reshape(-1, 3).min(0), 4), np.round(T.reshape(-1, 3).max(0), 4))
    say('length m', round((T[:, :, 1].max() - T[:, :, 1].min()) * S, 1), 'scale', S, 'y offset used', Y_OFFSET, '(requested', Y_OFFSET_REQUESTED, ')')

    def fp(s):  # plan footprint, larger first
        return max(s.d[0], s.d[1]), min(s.d[0], s.d[1])

    octs = [s for s in sh if s.tris in (54, 72) and 120 < fp(s)[1] and fp(s)[0] < 135]
    sqs = [s for s in sh if (s.tris == 34 and 3450 < s.area < 3650 and fp(s)[0] < 50) or (s.tris == 48 and 3400 < s.area < 3600 and fp(s)[1] > 40)]
    balls = [s for s in sh if s.tris == 88 and 3400 < s.area < 3650]
    boxes = [s for s in sh if s.tris == 100 and 11500 < s.area < 11900]
    pads = [s for s in sh if s.tris in (56, 58, 60) and 28 < fp(s)[1] and fp(s)[0] < 50 and s.d[2] < 12]
    # near misses, for the record
    say('octagon-like shells not taken (50-80 triangles, 100-200 m plan):',
        [(s.id, s.tris, [int(round(v)) for v in s.d]) for s in sh if 50 <= s.tris <= 80 and 100 < fp(s)[1] and fp(s)[0] < 200 and s not in octs])

    def partner(s, group):
        m = s.c * [-1, 1, 1]
        for o in group:
            if o is not s and np.abs(o.c - m).max() < 0.02:
                return o.id
        return None

    def side(s):
        return 'centre' if abs(s.c[0]) < 0.02 else ('stbd' if s.c[0] > 0 else 'port')

    def clear(s, origin, n, reach_m=400):
        t = ray_clear(T, lab == s.id, origin + n * (1.0 / S), n, reach_m / S)
        return None if t is None else round(t * S + 1.0, 1)

    classes = collections.OrderedDict()
    # ---- utl: octagonal recess
    items = []
    for s in octs:
        ax = s.axis()
        if ax[2] < 0:
            ax = -ax
        lv = s.levels(ax)
        up = [l for l in lv if l[2] > 0]
        floor, rim = up[0], up[-1]
        u, v = plane_frame(ax)
        fc = (floor[3].min(0) + floor[3].max(0)) / 2
        fc = fc + ax * (floor[0] - fc @ ax)
        V = s.P.reshape(-1, 3)
        ped = [o.id for o in sh if o is not s and 30 <= o.tris <= 80 and 140 < fp(o)[1] and fp(o)[0] < 200 and
               (o.lo[:2] <= s.c[:2]).all() and (o.hi[:2] >= s.c[:2]).all() and o.lo[2] < s.hi[2] and o.hi[2] > s.lo[2] - 0.5]
        items.append(dict(shell=s.id, triangles=s.tris, side=side(s), mirror_shell=partner(s, octs),
                          stl=[round(x, 4) for x in fc], ship=to_ship(fc), ship_y_at_374=round(fc[2] * S + Y_OFFSET_REQUESTED, 1),
                          normal_stl=[round(x, 3) for x in ax], normal_ship=dir_ship(ax), facing=facing_word(ax),
                          tilt_deg=round(float(np.degrees(np.arccos(min(1, abs(ax[2]))))), 1),
                          base_across_m=[round(np.ptp(V @ u) * S, 1), round(np.ptp(V @ v) * S, 1)],
                          rim_top_across_m=[round(np.ptp(rim[3] @ u) * S, 1), round(np.ptp(rim[3] @ v) * S, 1)],
                          recess_inner_m=[round(np.ptp(floor[3] @ u) * S, 1), round(np.ptp(floor[3] @ v) * S, 1)],
                          recess_floor_area_m2=round(floor[1]), recess_depth_m=round((rim[0] - floor[0]) * S, 1),
                          shell_height_along_normal_m=round(np.ptp(V @ ax) * S, 1),
                          bbox_m=[round(x, 1) for x in s.d], pedestal_shells=ped,
                          clear_above_m=clear(s, fc, ax)))
    classes['utl'] = items
    # ---- twin175: framed square recess
    items = []
    frames = [o for o in sh if (o.tris == 34 and 5800 < o.area < 6050) or (o.tris == 40 and 5850 < o.area < 6050) or (o.tris == 97)]
    for s in sqs:
        ax = s.axis()
        if ax[2] < 0:
            ax = -ax
        lv = [l for l in s.levels(ax) if l[2] > 0]
        floor, rim = lv[0], lv[-1]
        u, v = plane_frame(ax)
        fc = (floor[3].min(0) + floor[3].max(0)) / 2
        fc = fc + ax * (floor[0] - fc @ ax)
        V = s.P.reshape(-1, 3)
        fr = [o for o in frames if (o.lo[:2] <= s.c[:2] + 1e-6).all() and (o.hi[:2] >= s.c[:2] - 1e-6).all() and abs(o.c[2] - s.c[2]) < 0.5]
        fr.sort(key=lambda o: o.area)
        L, Wd, yaw = min_rect(V, ax)
        items.append(dict(shell=s.id, triangles=s.tris, side=side(s), mirror_shell=partner(s, sqs),
                          stl=[round(x, 4) for x in fc], ship=to_ship(fc), ship_y_at_374=round(fc[2] * S + Y_OFFSET_REQUESTED, 1),
                          normal_stl=[round(x, 3) for x in ax], normal_ship=dir_ship(ax), facing=facing_word(ax),
                          tilt_deg=round(float(np.degrees(np.arccos(min(1, abs(ax[2]))))), 1),
                          rim_outer_m=[round(np.ptp(V @ u) * S, 1), round(np.ptp(V @ v) * S, 1)],
                          recess_inner_m=[round(np.ptp(floor[3] @ u) * S, 1), round(np.ptp(floor[3] @ v) * S, 1)],
                          recess_depth_m=round((rim[0] - floor[0]) * S, 1),
                          frame_shells=[o.id for o in fr], frame_bbox_m=[[round(x, 1) for x in o.d] for o in fr],
                          bbox_m=[round(x, 1) for x in s.d], clear_above_m=clear(s, fc, ax)))
    classes['twin175'] = items
    # ---- ionBall: ball in a box
    items = []
    for s in balls:
        ax = s.axis()
        lv = s.levels(ax)
        flat = max(lv, key=lambda l: l[1])
        n = ax * flat[2]                      # outward normal of the flat face of the ball
        bx = min(boxes, key=lambda o: np.linalg.norm(o.c - s.c))
        if np.linalg.norm(bx.c - s.c) * S > 40:
            bx = None
        elif (s.c - bx.c) @ n < 0:
            say('ball', s.id, 'flat face points into its box: check')
        V = s.P.reshape(-1, 3)
        u, v = plane_frame(n)
        front = (flat[3].min(0) + flat[3].max(0)) / 2
        items.append(dict(shell=s.id, triangles=s.tris, side=side(s), mirror_shell=partner(s, balls),
                          stl=[round(x, 4) for x in s.c], ship=to_ship(s.c), ship_y_at_374=round(s.c[2] * S + Y_OFFSET_REQUESTED, 1),
                          front_face_stl=[round(x, 4) for x in front], front_face_ship=to_ship(front),
                          normal_stl=[round(x, 3) for x in n], normal_ship=dir_ship(n), facing=facing_word(n),
                          ball_diameter_m=[round(np.ptp(V @ u) * S, 1), round(np.ptp(V @ v) * S, 1)],
                          ball_flat_front_diameter_m=round(float(np.sqrt(flat[1] / np.pi) * 2), 1),
                          ball_depth_m=round(np.ptp(V @ n) * S, 1),
                          box_shell=bx.id if bx else None, box_bbox_m=[round(x, 1) for x in bx.d] if bx else None,
                          box_centre_ship=to_ship(bx.c) if bx else None,
                          bbox_m=[round(x, 1) for x in s.d], clear_ahead_m=clear(s, front, n)))
    classes['ionBall'] = items
    # ---- pd: rounded pad with a step
    items = []
    for s in pads:
        ax = s.axis()
        lv = s.levels(ax)
        if lv[0][1] < lv[-1][1]:              # the small step is the top; turn the axis toward it
            ax = -ax
            lv = s.levels(ax)
        base, step = lv[0], lv[-1]
        V = s.P.reshape(-1, 3)
        bc = (V.min(0) + V.max(0)) / 2
        top = bc + ax * (step[0] - bc @ ax)
        L, Wd, yaw = min_rect(V, ax)
        sc = (step[3].min(0) + step[3].max(0)) / 2
        off = sc - bc
        off = off - ax * (off @ ax)
        items.append(dict(shell=s.id, triangles=s.tris, side=side(s), mirror_shell=partner(s, pads),
                          stl=[round(x, 4) for x in top], ship=to_ship(top), ship_y_at_374=round(top[2] * S + Y_OFFSET_REQUESTED, 1),
                          normal_stl=[round(x, 3) for x in ax], normal_ship=dir_ship(ax), facing=facing_word(ax),
                          size_m=[L, Wd, round(np.ptp(V @ ax) * S, 1)], long_side_yaw_deg=yaw,
                          base_area_m2=round(base[1]), step_area_m2=round(step[1]), step_height_m=round((step[0] - lv[-2][0]) * S, 1) if len(lv) > 2 else None,
                          step_offset_ship_m=[round(-off[1] * S, 1), round(off[2] * S, 1), round(off[0] * S, 1)],
                          bbox_m=[round(x, 1) for x in s.d], clear_above_m=clear(s, top, ax)))
    classes['pd'] = items
    classes = json.loads(json.dumps(classes), object_pairs_hook=collections.OrderedDict)  # plain floats
    for k in classes:
        classes[k].sort(key=lambda it: (it['ship'][0], it['ship'][2]))

    # ---- counts
    say('')
    for k, items in classes.items():
        c = collections.Counter(it['side'] for it in items)
        nomir = [it['shell'] for it in items if it['side'] != 'centre' and it['mirror_shell'] is None]
        say(k, 'total', len(items), dict(c), 'without a mirror twin:', nomir, 'triangles', dict(collections.Counter(it['triangles'] for it in items)),
            'facing', dict(collections.Counter(it['facing'] for it in items)))
    say('')
    for k, items in classes.items():
        say('==', k)
        for it in items:
            if it['side'] == 'port':
                continue
            extra = {'utl': lambda i: 'depth %.1f inner %s rim %s base %s tilt %.1f ped %s clear %s' % (i['recess_depth_m'], i['recess_inner_m'], i['rim_top_across_m'], i['base_across_m'], i['tilt_deg'], i['pedestal_shells'], i['clear_above_m']),
                     'twin175': lambda i: 'depth %.1f inner %s rim %s tilt %.1f frame %s clear %s' % (i['recess_depth_m'], i['recess_inner_m'], i['rim_outer_m'], i['tilt_deg'], i['frame_shells'], i['clear_above_m']),
                     'ionBall': lambda i: 'dia %s depth %.1f normal(ship) %s box %s clear %s' % (i['ball_diameter_m'], i['ball_depth_m'], i['normal_ship'], i['box_shell'], i['clear_ahead_m']),
                     'pd': lambda i: 'size %s yaw %.1f normal(ship) %s clear %s' % (i['size_m'], i['long_side_yaw_deg'], i['normal_ship'], i['clear_above_m'])}[k](it)
            say(' shell %4d %-6s tris %2d stl %s ship %s %s %s' % (it['shell'], it['side'], it['triangles'], it['stl'], it['ship'], it['facing'], extra))

    # ---- side band (trench) of the main hull shell, engines, large structures
    hull = max(sh, key=lambda s: np.prod(s.d))
    say('')
    say('main hull shell', hull.id, 'triangles', hull.tris, 'bbox m', np.round(hull.d, 1), 'ship x', to_ship(hull.hi)[0], 'to', to_ship(hull.lo)[0])
    band = []
    for y0 in np.arange(44, -55, -2.0):
        d = hull.P[:, :, 1] - y0
        m = (d.min(1) < 0) & (d.max(1) > 0)
        pts = []
        for tri, dd in zip(hull.P[m], d[m]):
            for i in range(3):
                j = (i + 1) % 3
                if (dd[i] < 0) != (dd[j] < 0):
                    t = dd[i] / (dd[i] - dd[j])
                    pts.append(tri[i] + t * (tri[j] - tri[i]))
        pts = np.array(pts)
        pts = pts[pts[:, 0] > 0]
        xm = pts[:, 0].max()
        edge = np.unique(np.round(pts[pts[:, 0] > xm - 1e-3][:, 2] * S, 1))
        band.append(dict(ship_x=float(round((STL_Y_STERN - y0) * S, 1)), half_width_m=float(round(xm * S, 1)), edge_z_levels_m=[float(e) for e in edge],
                         edge_ship_y=[round(float(e) + Y_OFFSET, 1) for e in edge]))
        say(' side edge at ship x %6.0f half width %7.1f  heights (model z, m) %s' % (band[-1]['ship_x'], band[-1]['half_width_m'], band[-1]['edge_z_levels_m']))
    eng = []
    for s in sh:
        if s.tris in (432, 504, 560, 760) and s.c[1] > 38:
            V = s.P.reshape(-1, 3)
            rear = V[V[:, 1] > s.hi[1] - 1e-4]
            eng.append(dict(shell=s.id, triangles=s.tris, side=side(s), axis_stl=[round(s.c[0], 4), round(s.c[2], 4)],
                            ship_y=round(s.c[2] * S + Y_OFFSET, 1), ship_z=round(s.c[0] * S, 1),
                            ship_x_rear=round((STL_Y_STERN - s.hi[1]) * S, 1), ship_x_front=round((STL_Y_STERN - s.lo[1]) * S, 1),
                            length_m=round(s.d[1], 1), max_diameter_m=[round(s.d[0], 1), round(s.d[2], 1)],
                            rear_rim_diameter_m=[round(np.ptp(rear[:, 0]) * S, 1), round(np.ptp(rear[:, 2]) * S, 1)]))
    eng = json.loads(json.dumps(eng))
    eng.sort(key=lambda e: (-e['max_diameter_m'][0], e['ship_z']))
    say('')
    say('engine bodies (shells of 432/504/560/760 triangles aft of model y 38):', len(eng))
    for e in eng:
        say(' ', e)
    big = []
    for s in sorted(sh, key=lambda s: -np.prod(s.d)):
        if len(big) >= 14:
            break
        if abs(s.c[0]) < 0.02 and s.id != hull.id and s.d[1] > 250:
            big.append(dict(shell=s.id, triangles=s.tris, ship_x=[to_ship(s.hi)[0], to_ship(s.lo)[0]], ship_y=[round(s.lo[2] * S + Y_OFFSET, 1), round(s.hi[2] * S + Y_OFFSET, 1)],
                            half_width_m=round(s.hi[0] * S, 1), bbox_m=[round(x, 1) for x in s.d]))
    big = json.loads(json.dumps(big))
    say('')
    say('largest centreline shells (superstructure, bridge tower, domes):')
    for b in big:
        say(' ', b)

    # ---- comparison with the present example
    comp = None
    if design:
        d = json.load(gzip.open(design))
        g = collections.defaultdict(list)
        for f in d['fits']:
            g[f['k']].append(f['p'])
        say('')
        say('present example fits:', {k: len(v) for k, v in g.items()})
        comp = {}
        for dk, ck in (('utl', 'utl'), ('quad175', 'twin175'), ('ion', 'ionBall'), ('pd', 'pd')):
            A = np.array(g.get(dk, []))
            B = np.array([it['ship'] for it in classes[ck]])
            if not len(A) or not len(B):
                continue
            D3 = np.linalg.norm(A[:, None] - B[None], axis=2)
            Dp = np.linalg.norm(A[:, None, [0, 2]] - B[None, :, [0, 2]], axis=2)
            n3, npl = D3.min(1), Dp.min(1)
            back = Dp.min(0)
            q = lambda a: [round(float(x), 1) for x in np.percentile(a, [0, 25, 50, 75, 100])]
            comp[dk] = dict(example_count=len(A), source_class=ck, source_count=len(B),
                            example_to_nearest_source_plan_m=q(npl), example_to_nearest_source_3d_m=q(n3),
                            example_within_50m_plan=int((npl < 50).sum()), example_within_150m_plan=int((npl < 150).sum()),
                            source_to_nearest_example_plan_m=q(back), source_with_example_within_150m_plan=int((back < 150).sum()),
                            source_positions_claimed_by_nearest=int(len(set(Dp.argmin(1)))))
            say(' %-8s example %3d  source %-8s %3d | example->nearest source, plan m (min,q1,median,q3,max) %s  3-D %s | within 50 m: %d, within 150 m: %d | source->nearest example plan %s, source positions with an example fit within 150 m: %d'
                % (dk, len(A), ck, len(B), comp[dk]['example_to_nearest_source_plan_m'], comp[dk]['example_to_nearest_source_3d_m'], comp[dk]['example_within_50m_plan'],
                   comp[dk]['example_within_150m_plan'], comp[dk]['source_to_nearest_example_plan_m'], comp[dk]['source_with_example_within_150m_plan']))

    if design:
        say('')
        say('example fits within 50 m (plan) of a source position, by kind and source class:')
        cross = {}
        for dk, pts in g.items():
            A = np.array(pts)
            row = {}
            for ck, items in classes.items():
                B = np.array([it['ship'] for it in items])
                Dp = np.linalg.norm(A[:, None, [0, 2]] - B[None, :, [0, 2]], axis=2)
                row[ck] = dict(example_fits_within_50m=int((Dp.min(1) < 50).sum()), source_positions_with_a_fit_within_50m=int((Dp.min(0) < 50).sum()))
            cross[dk] = dict(count=len(A), near=row)
            say('  %-8s %3d : %s' % (dk, len(A), {ck: (v['example_fits_within_50m'], v['source_positions_with_a_fit_within_50m']) for ck, v in row.items()}))
        comp['cross'] = cross
        # height offset implied by the example fits that sit on a source position
        for dk, ck in (('utl', 'utl'), ('quad175', 'twin175')):
            A = np.array(g.get(dk, []))
            Bs = np.array([it['stl'] for it in classes[ck]])
            Bp = np.array([it['ship'] for it in classes[ck]])
            Dp = np.linalg.norm(A[:, None, [0, 2]] - Bp[None, :, [0, 2]], axis=2)
            j = Dp.argmin(1)
            ok = Dp.min(1) < 50
            off = A[ok, 1] - Bs[j[ok], 2] * S
            comp[dk]['implied_y_offset'] = [round(float(x), 1) for x in np.percentile(off, [0, 25, 50, 75, 100])]
            say('  y offset implied by the %d %s fits on source positions (fit y - model z*%.1f): min, q1, median, q3, max %s' % (ok.sum(), dk, S, comp[dk]['implied_y_offset']))
    res = collections.OrderedDict(
        source=os.path.basename(stl), triangles=int(len(T)), shells=int(nc), scale=S,
        map='ship_x=(%.5f-stl_y)*%.1f (from the stern, bow +x); ship_z=stl_x*%.1f (starboard +z); ship_y=stl_z*%.1f+%.1f' % (STL_Y_STERN, S, S, S, Y_OFFSET),
        y_offset=Y_OFFSET, y_offset_requested=Y_OFFSET_REQUESTED,
        y_offset_note='ship_y is given with 348 (model bottom at y 0; the model side band centre on the example hull side band centre 346; the present example engines use the same). ship_y_at_374 is the same point with the requested 374.',
        counts={k: len(v) for k, v in classes.items()}, classes=classes,
        extras=dict(side_band=band, engines=eng, centreline_structures=big), example_comparison=comp)
    json.dump(res, open(os.path.join(out, 'mounts.json'), 'w'), indent=1, ensure_ascii=False)
    def pick(group, n, half):
        g = sorted([s for s in group if s.c[0] >= -0.02], key=lambda s: s.c[1])
        return [(g[i].id, half) for i in sorted(set(np.linspace(0, len(g) - 1, n).astype(int)))]
    reps = {'utl': pick(octs, 3, 160), 'twin175': pick(sqs, 3, 90), 'ionBall': pick(balls, 3, 80), 'pd': pick(pads, 3, 60)}
    ex = [s for s in sh if s.tris == 67 and 170 < fp(s)[1]][:1] + [s for s in sh if s.tris == 52 and 140 < fp(s)[1] < 200][:1] + \
         [s for s in sh if s.tris == 22 and 85 < fp(s)[0] < 95 and 70 < fp(s)[1] < 82][:1]
    reps['excluded'] = [(s.id, 200 if s.tris != 22 else 80) for s in ex]
    made = pictures(T, lab, classes, os.path.join(out, 'renders'), reps)
    say('')
    say('pictures:', [os.path.basename(p) for p in made])
    open(os.path.join(out, 'census_numbers.txt'), 'w').write('\n'.join(log) + '\n')


if __name__ == '__main__':
    main()
