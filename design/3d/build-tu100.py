"""Build the TU-100 twin in Blender 5.x from design/3d/layout.json and export public/models/tu100-unit.glb.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python design/3d/build-tu100.py -- [--render] [--no-export]

Illustrative geometry built from photographs and published dimensions (see refs/tu100-unit.md), not a survey.
Every object carries a `validation` extra. Node names are stable and read by components/twin/*.
Blender axes: X across, Z up, -Y toward the viewer; the glTF exporter turns -Y into +Z for three.js.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = '--render' in ARGS
EXPORT = '--no-export' not in ARGS
PREVIEW_DIR = os.path.abspath(os.path.join(ROOT, '..', 'work', 'viz3d-review', 'blender'))

with open(os.path.join(HERE, 'layout.json')) as f:
    L = json.load(f)
P, PIPE = L['panel'], L['pipe']
PANEL_FACE_Y = 0.0  # front face of the panel sits on y=0; the panel body extends to +thickness


def X(px):
    return (px / 100 - 0.5) * P['width']


def Z(py):
    return P['bottom'] + (1 - py / 100) * P['height']


def loc(px, py, d):
    return Vector((X(px), -d, Z(py)))


# --- materials -------------------------------------------------------------
def material(name, rgb, metal=0.0, rough=0.5, alpha=1.0, emissive=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Alpha'].default_value = alpha
    if emissive:
        bsdf.inputs['Emission Color'].default_value = (*emissive, 1)
        bsdf.inputs['Emission Strength'].default_value = 1.0
    m.diffuse_color = (*rgb, alpha)
    m.use_backface_culling = True
    if alpha < 1:
        m.surface_render_method = 'BLENDED'
    return m


MAT = {
    'panel': material('Panel white HDPE', (0.92, 0.92, 0.89), 0, 0.62),
    'frame': material('Aluminium frame', (0.72, 0.74, 0.76), 0.85, 0.35),
    'mesh': material('Side mesh guard', (0.45, 0.47, 0.5), 0.6, 0.6, 0.45),
    'bench': material('Bench top black', (0.06, 0.06, 0.065), 0.0, 0.55),
    'cabinet': material('Cabinet white', (0.88, 0.89, 0.88), 0, 0.6),
    'copper': material('Copper tube', (0.62, 0.3, 0.14), 0.8, 0.38),
    'brass': material('Brass fitting', (0.68, 0.5, 0.2), 0.85, 0.3),
    'glass': material('Observation glass', (0.75, 0.9, 0.9), 0.0, 0.08, 0.3),
    'fins': material('Aluminium fins', (0.7, 0.72, 0.72), 0.7, 0.45),
    'coilframe': material('Coil frame steel', (0.58, 0.6, 0.6), 0.7, 0.5),
    'tray': material('Drip tray black', (0.05, 0.05, 0.05), 0.1, 0.45),
    'black': material('Black vessel', (0.03, 0.03, 0.035), 0.3, 0.35),
    'red': material('Handwheel red', (0.72, 0.1, 0.08), 0.0, 0.4),
    'blue': material('Blue cap', (0.1, 0.35, 0.75), 0.0, 0.4),
    'redcap': material('Red cap', (0.85, 0.2, 0.15), 0.0, 0.4),
    'white': material('White plastic', (0.93, 0.93, 0.9), 0, 0.5),
    'plate': material('Label plate', (0.96, 0.96, 0.94), 0, 0.5),
    'steel': material('Brushed steel box', (0.75, 0.76, 0.77), 0.7, 0.4),
    'beige': material('Beige switch box', (0.86, 0.82, 0.68), 0, 0.5),
    'dark': material('Dark trim', (0.12, 0.13, 0.14), 0.1, 0.5),
    'yellow': material('Yellow label', (0.95, 0.85, 0.15), 0, 0.5),
    'gauge': material('Gauge face', (0.97, 0.97, 0.95), 0, 0.3),
    'needle': material('Gauge needle', (0.1, 0.2, 0.75), 0.2, 0.3),
    'sleeve': material('Insulation sleeve', (0.1, 0.1, 0.1), 0, 0.9),
    'bluelabel': material('Blue tray label', (0.15, 0.3, 0.7), 0, 0.5),
    'redlabel': material('Red tray label', (0.8, 0.25, 0.1), 0, 0.5),
    'fan': material('Fan housing', (0.2, 0.21, 0.22), 0.3, 0.5),
    'blade': material('Fan blade', (0.35, 0.36, 0.37), 0.5, 0.4),
}

COLLECTION = bpy.data.collections.new('TU100')
bpy.context.scene.collection.children.link(COLLECTION)


def register(o, name, validation='Illustrative geometry from photographs and published dimensions; not surveyed.'):
    o.name = name
    o['validation'] = validation
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COLLECTION.objects.link(o)
    return o


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


# --- primitives ------------------------------------------------------------
def box(name, center, size, mat, bevel=0.003, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rotation)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = min(bevel, min(size) * 0.3)
        mod.segments = 2
    o.data.materials.append(mat)
    return register(o, name)


def cyl(name, a, b, r, mat, segs=24, cap=True):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=(b - a).length, location=(a + b) / 2,
                                        end_fill_type='NGON' if cap else 'NOTHING')
    o = bpy.context.object
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    o.data.materials.append(mat)
    smooth(o)
    return register(o, name)


def torus(name, center, major, minor, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=36, minor_segments=12,
                                     location=center, rotation=rotation)
    o = bpy.context.object
    o.data.materials.append(mat)
    smooth(o)
    return register(o, name)


def tube(name, pts, r, mat, resolution=2, corner=None):
    """A pipe along a 3D polyline. Corners are rounded with a small bevel curve radius."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = r
    curve.bevel_resolution = resolution
    curve.resolution_u = 6
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    rounded = round_corners(pts, corner if corner is not None else max(r * 3, 0.012))
    spline.bezier_points.add(len(rounded) - 1)
    for bp, co in zip(spline.bezier_points, rounded):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    smooth(o)
    return register(o, name)


def round_corners(pts, radius):
    """Insert points before and after each corner so AUTO bezier handles give rounded elbows."""
    pts = [Vector(p) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        prev, cur, nxt = pts[i - 1], pts[i], pts[i + 1]
        a = (prev - cur)
        b = (nxt - cur)
        if a.length < 1e-6 or b.length < 1e-6:
            continue
        ra = min(radius, a.length * 0.45)
        rb = min(radius, b.length * 0.45)
        out.append(cur + a.normalized() * ra)
        out.append(cur + b.normalized() * rb)
    out.append(pts[-1])
    return out


def text(name, string, size, location, mat, rotation=(math.pi / 2, 0, 0), align='CENTER', extrude=0.0005):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = string
    curve.size = size
    curve.align_x = align
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    o = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(o)
    o.location = location
    o.rotation_euler = rotation
    o.data.materials.append(mat)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return register(bpy.context.object, name)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    return register(bpy.context.object, name)


def empty(name, location):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.02
    o.location = location
    bpy.context.scene.collection.objects.link(o)
    register(o, name, 'Attach point')
    bpy.context.view_layer.update()  # matrix_world must be current before children read it
    return o


def parent_to(child, pivot):
    bpy.context.view_layer.update()
    child.parent = pivot
    child.matrix_parent_inverse = pivot.matrix_world.inverted()


# --- pipe layering (same algorithm as lib/twin.ts) --------------------------
def pipe_points(pts):
    """Percent points with optional explicit d -> 3D points on two depth layers with jogs at depth changes."""
    segs = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        if len(a) > 2 and len(b) > 2:
            d = None  # explicit at both ends; may differ (a depth move)
        else:
            horizontal = abs(a[1] - b[1]) < 1e-9
            d = PIPE['horizontal'] if horizontal else PIPE['vertical']
        da = a[2] if len(a) > 2 else d
        db = b[2] if len(b) > 2 else d
        segs.append((a, b, da, db))
    out = []
    for i, (a, b, da, db) in enumerate(segs):
        start = loc(a[0], a[1], da)
        if out and (out[-1] - start).length > 1e-6:
            out.append(start)  # jog at the corner: depth changes between segments
        elif not out:
            out.append(start)
        out.append(loc(b[0], b[1], db))
    # drop duplicate consecutive points
    cleaned = [out[0]]
    for p in out[1:]:
        if (p - cleaned[-1]).length > 1e-6:
            cleaned.append(p)
    return cleaned


# --- panel, frame, stand ---------------------------------------------------
W, H, T, BOT, DEPTH = P['width'], P['height'], P['thickness'], P['bottom'], P['depth']
box('Panel', (0, T / 2, BOT + H / 2), (W, T, H), MAT['panel'], bevel=0.002)
rail = 0.02
for sx in (-1, 1):
    box('Frame_Side_%s' % ('L' if sx < 0 else 'R'), (sx * (W / 2 + rail / 2), -0.005, BOT + H / 2), (rail, 0.03, H + rail), MAT['frame'], 0.002)
    # side mesh guard running back from the panel
    box('Mesh_Side_%s' % ('L' if sx < 0 else 'R'), (sx * (W / 2 + 0.004), DEPTH * 0.5, BOT + H / 2), (0.004, DEPTH - 0.02, H - 0.05), MAT['mesh'], 0)
    box('Frame_SideBack_%s' % ('L' if sx < 0 else 'R'), (sx * (W / 2 + rail / 2), DEPTH - rail / 2, BOT + H / 2), (rail, rail, H + rail), MAT['frame'], 0.002)
    for z in (BOT + 0.01, BOT + H - 0.01):
        box('Frame_SideRail_%s_%d' % ('L' if sx < 0 else 'R', int(z * 100)), (sx * (W / 2 + rail / 2), DEPTH / 2, z), (rail, DEPTH, rail), MAT['frame'], 0.002)
box('Frame_Top', (0, -0.005, BOT + H + rail / 2), (W + 2 * rail, 0.03, rail), MAT['frame'], 0.002)
box('Frame_TopBack', (0, DEPTH - rail / 2, BOT + H + rail / 2), (W + 2 * rail, rail, rail), MAT['frame'], 0.002)
# stand: bench top, extrusion box, cabinet, plinth
box('Bench_Top', (0, DEPTH / 2 - 0.03, BOT - 0.015), (W + 0.06, DEPTH + 0.02, 0.03), MAT['bench'], 0.003)
box('Bench_Frame', (0, DEPTH / 2 - 0.03, BOT - 0.03 - 0.11), (W + 0.06, DEPTH, 0.22), MAT['frame'], 0.004)
box('Bench_Frame_Inset', (0, -0.035 - 0.003, BOT - 0.03 - 0.11), (W - 0.06, 0.006, 0.16), MAT['dark'], 0)
box('Cabinet', (0, DEPTH / 2 - 0.03, (BOT - 0.25) / 2 + 0.02), (W + 0.12, DEPTH + 0.06, BOT - 0.25 - 0.04), MAT['cabinet'], 0.004)
box('Cabinet_Top', (0, DEPTH / 2 - 0.03, BOT - 0.25 + 0.005), (W + 0.14, DEPTH + 0.08, 0.02), MAT['dark'], 0.002)
box('Plinth', (0, DEPTH / 2 - 0.03, 0.02), (W + 0.06, DEPTH, 0.04), MAT['dark'], 0.002)
box('Cabinet_Door_Line', (0, -0.035 - 0.001, (BOT - 0.25) / 2), (0.004, 0.003, BOT - 0.25 - 0.08), MAT['dark'], 0)

# --- coils ------------------------------------------------------------------
for coil in L['coils']:
    cx, cz = X(coil['cx']), Z(coil['cy'])
    w, h, t, so = coil['width'], coil['height'], coil['thickness'], coil['standoff']
    yc = -(so + t / 2)
    fins = []
    n = 34
    for i in range(n):
        x = cx - w / 2 + 0.01 + i * (w - 0.02) / (n - 1)
        fins.append(box('fin', (x, yc, cz), (0.0008, t, h - 0.02), MAT['fins'], 0))
    join(fins, 'Coil_%s_Fins' % coil['id'].capitalize())
    # frame plates top and bottom, side brackets to the panel
    box('Coil_%s_Frame_Top' % coil['id'].capitalize(), (cx, yc, cz + h / 2), (w, t + 0.01, 0.012), MAT['coilframe'], 0.002)
    box('Coil_%s_Frame_Bottom' % coil['id'].capitalize(), (cx, yc, cz - h / 2), (w, t + 0.01, 0.012), MAT['coilframe'], 0.002)
    for sx in (-1, 1):
        box('Coil_%s_Bracket_%s' % (coil['id'].capitalize(), 'L' if sx < 0 else 'R'), (cx + sx * (w / 2 - 0.01), -so / 2, cz), (0.01, so, 0.03), MAT['coilframe'], 0.001)
    # serpentine: 8 rows, U-bends outside the fins on both sides
    rows = coil['rows']
    ys = [Z(coil['rowTop'] + (coil['rowBottom'] - coil['rowTop']) * i / (rows - 1)) for i in range(rows)]
    left, right = X(coil['left']), X(coil['right'])
    pts = []
    for i, zr in enumerate(ys):
        a, b = (left, right) if i % 2 == 0 else (right, left)
        pts.append(Vector((a, yc, zr)))
        pts.append(Vector((b, yc, zr)))
    path = tube('Coil_%s_Tubes' % coil['id'].capitalize(), pts, PIPE['radius'], MAT['copper'], corner=0.012)
    # fan housing behind the panel
    fz = cz
    box('Fan_%s_Housing' % coil['id'].capitalize(), (cx, T + 0.07, fz), (0.3, 0.14, 0.3), MAT['fan'], 0.004)
    torus('Fan_%s_Ring' % coil['id'].capitalize(), (cx, T + 0.145, fz), 0.12, 0.006, MAT['dark'], (math.pi / 2, 0, 0))
    # blades built with bmesh in the pivot's local frame (axis = Blender +Y, glTF -Z) so no transforms are needed
    pivot = empty('Fan_%s_Pivot' % coil['id'].capitalize(), (cx, T + 0.13, fz))
    bm = bmesh.new()
    for k in range(5):
        ang = k * 2 * math.pi / 5
        geom = bmesh.ops.create_cube(bm, size=1.0)['verts']
        bmesh.ops.scale(bm, vec=(0.1, 0.004, 0.035), verts=geom)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(0.5, 3, 'X'), verts=geom)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(ang, 3, 'Y'), verts=geom)
        bmesh.ops.translate(bm, vec=(math.cos(ang) * 0.06, 0, math.sin(ang) * 0.06), verts=geom)
    hubv = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.02, radius2=0.02, depth=0.02)['verts']
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.pi / 2, 3, 'X'), verts=hubv)
    mesh = bpy.data.meshes.new('Fan_%s_Blades' % coil['id'].capitalize())
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(MAT['blade'])
    blade_obj = bpy.data.objects.new('Fan_%s_Blades' % coil['id'].capitalize(), mesh)
    bpy.context.scene.collection.objects.link(blade_obj)
    register(blade_obj, 'Fan_%s_Blades' % coil['id'].capitalize())
    blade_obj.location = (cx, T + 0.13, fz)
    smooth(blade_obj)
    parent_to(blade_obj, pivot)

# --- trays -------------------------------------------------------------------
for tray in L['trays']:
    cx = (X(tray['x1']) + X(tray['x2'])) / 2
    w = X(tray['x2']) - X(tray['x1'])
    cz = Z(tray['y'])
    box('Tray_%s' % tray['id'].capitalize(), (cx, -tray['depth'] / 2, cz), (w, tray['depth'], tray['height']), MAT['tray'], 0.003)
    box('Tray_%s_Lip' % tray['id'].capitalize(), (cx, -tray['depth'] + 0.006, cz + 0.012), (w, 0.012, 0.012), MAT['tray'], 0.002)
    lab = box('Tray_%s_Label' % tray['id'].capitalize(), (X(28), -tray['depth'] - 0.001, cz), (0.07, 0.002, 0.014),
              MAT['bluelabel'] if tray['labelColor'] == 'blue' else MAT['redlabel'], 0)
    text('Tray_%s_Text' % tray['id'].capitalize(), tray['label'], 0.009, (X(28), -tray['depth'] - 0.004, cz), MAT['white'])
    cyl('Tray_%s_Drain' % tray['id'].capitalize(), (X(28), -tray['depth'] / 2, cz - tray['height'] / 2), (X(28), -tray['depth'] / 2, cz - tray['height'] / 2 - 0.04), 0.006, MAT['brass'], 16)

# --- glass tubes -------------------------------------------------------------
for tb in L['tubes']:
    z = Z(tb['y'])
    d = tb['d']
    x1, x2 = X(tb['x1']), X(tb['x2'])
    name = 'Tube_%s' % ''.join(p.capitalize() for p in tb['id'].split('_'))
    inner1, inner2 = x1 + 0.03, x2 - 0.03
    cyl(name + '_Glass', (inner1, -d, z), (inner2, -d, z), 0.011, MAT['glass'], 28)
    cyl(name + '_Core', (inner1, -d, z), (inner2, -d, z), 0.004, MAT['copper'], 12)  # the bore reads as a tube when empty
    for x in (inner1, inner2):
        cyl(name + '_Flange', (x - 0.012, -d, z), (x + 0.012, -d, z), 0.019, MAT['brass'], 24)
    cyl(name + '_End_L', (x1, -d, z), (inner1, -d, z), 0.008, MAT['brass'], 16)
    cyl(name + '_End_R', (inner2, -d, z), (x2, -d, z), 0.008, MAT['brass'], 16)
    for zz in (z + 0.016, z - 0.016):
        cyl(name + '_TieBolt', (inner1 - 0.012, -d, zz), (inner2 + 0.012, -d, zz), 0.002, MAT['frame'], 8)
    for x in (x1, x2):
        cyl(name + '_Clip', (x, -d, z), (x, 0, z), 0.006, MAT['brass'], 12)

# --- pipes -------------------------------------------------------------------
for pipe in L['pipes']:
    pts = pipe_points(pipe['pts'])
    tube('Pipe_%s' % pipe['id'], pts, PIPE['radius'], MAT['copper'])
    # brass clips where the pipe meets the panel-side layer corners (every third vertex keeps it light)
    for i, p in enumerate(pts):
        if i % 3 == 1 and -p.y > 0.03 and -p.y < 0.07:
            cyl('Clip_%s_%d' % (pipe['id'], i), (p.x, p.y, p.z), (p.x, 0, p.z), 0.004, MAT['brass'], 10)
# capillary (thin) from TXV to the suction sleeve
cap = [loc(p[0], p[1], 0.022) for p in L['capillary']]
tube('Capillary_TXV_Bulb', cap, 0.0012, MAT['copper'], resolution=1, corner=0.01)

# --- valves ------------------------------------------------------------------
def handwheel(name, center, axis_dir, mat_cap):
    """A six-lobe red knob on a brass stem; the pivot empty sits at the stem base so the app can spin it."""
    axis = Vector(axis_dir).normalized()
    base = Vector(center)
    pivot = empty(name + '_Pivot', base)
    stem = cyl(name + '_Stem', base, base + axis * 0.03, 0.005, MAT['brass'], 12)
    hub = cyl(name + '_Hub', base + axis * 0.026, base + axis * 0.038, 0.012, MAT['red'], 24)
    ring_rot = axis.to_track_quat('Z', 'Y').to_euler()
    ring = torus(name + '_Ring', base + axis * 0.032, 0.02, 0.0075, MAT['red'], ring_rot)
    lobes = []
    # build an orthonormal frame around the axis for the lobes
    helper = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(helper).normalized()
    v = axis.cross(u).normalized()
    for k in range(6):
        ang = k * math.pi / 3
        c = base + axis * 0.032 + (u * math.cos(ang) + v * math.sin(ang)) * 0.024
        lobes.append(cyl('lobe', c - axis * 0.007, c + axis * 0.007, 0.0085, MAT['red'], 14))
    capd = cyl(name + '_Cap', base + axis * 0.038, base + axis * 0.0405, 0.009, mat_cap, 20)
    wheel = join([hub, ring, capd] + lobes, name + '_Wheel')
    wheel['valve'] = name.split('_')[1]
    parent_to(wheel, pivot)
    parent_to(stem, pivot)
    return pivot


BLUE_CAPS = {'HP1', 'HP3', 'ACB', 'ACO', 'ACI'}
for v in L['valves']:
    if v.get('bench'):
        center = Vector((X(v['x']), -v['d'], Z(v['y'])))
        axis_dir = (0, 0, 1)
        body_axis = (0, -1, 0) if v['axis'] == 'd' else (1, 0, 0)
    else:
        d = PIPE['horizontal'] if v['axis'] == 'x' else PIPE['vertical']
        center = Vector((X(v['x']), -d, Z(v['y'])))
        axis_dir = (0, -1, 0)
        body_axis = (1, 0, 0) if v['axis'] == 'x' else (0, 0, 1)
    ba = Vector(body_axis)
    name = 'Valve_%s' % v['id']
    body = cyl(name + '_Body', center - ba * 0.018, center + ba * 0.018, 0.011, MAT['brass'], 18)
    body['valve'] = v['id']
    for sgn in (-1, 1):
        nut = cyl(name + '_Nut', center + ba * sgn * 0.022, center + ba * sgn * 0.03, 0.008, MAT['brass'], 6)
        nut['valve'] = v['id']
    bonnet = cyl(name + '_Bonnet', center, center + Vector(axis_dir) * 0.014, 0.009, MAT['brass'], 16)
    bonnet['valve'] = v['id']
    handwheel(name, center + Vector(axis_dir) * 0.012, axis_dir, MAT['blue'] if v['id'] in BLUE_CAPS else MAT['redcap'])
    if v.get('bench'):
        cyl(name + '_Foot', center - Vector((0, 0, 0.012)), center - Vector((0, 0, 0.1)), 0.004, MAT['brass'], 10)
    # a small id tag beside the wheel
    tag_pos = center + Vector(axis_dir) * 0.04 + (Vector((0, 0, 0.03)) if not v.get('bench') else Vector((0, -0.03, 0)))
    text(name + '_Tag', v['id'], 0.012, tag_pos, MAT['white'] if v.get('bench') else MAT['dark'],
         rotation=(math.pi / 2, 0, 0) if not v.get('bench') else (0, 0, 0))

# --- vessels -----------------------------------------------------------------
for ves in L['vessels']:
    x, d, r, h, zb = X(ves['x']), ves['d'], ves['radius'], ves['height'], ves['zBottom']
    name = ves['id'].capitalize()
    if ves['id'] == 'compressor':
        body = cyl(name, (x, -d, zb + 0.02), (x, -d, zb + h - r * 0.6), r, MAT['black'], 36)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=36, ring_count=18, location=(x, -d, zb + h - r * 0.6))
        dome = bpy.context.object
        dome.scale = (1, 1, 0.6)
        bpy.ops.object.transform_apply(scale=True)
        dome.data.materials.append(MAT['black'])
        smooth(dome)
        join([body, register(dome, 'dome')], name)
        box(name + '_Base', (x, -d, zb + 0.01), (r * 2.3, r * 2.3, 0.02), MAT['dark'], 0.003)
        box(name + '_Terminal', (x - r * 0.9, -d - r * 0.5, zb + 0.12), (0.05, 0.05, 0.07), MAT['dark'], 0.003)
        for px, port in ((93, 'Discharge'), (88, 'Suction')):
            cyl(name + '_Port_' + port, (X(px), -d, zb + h - 0.02), (X(px), -d, zb + h + 0.005), 0.009, MAT['brass'], 12)
    elif ves['id'] == 'dryer':
        o = cyl(name, (x, -d, zb), (x, -d, zb + h), r, MAT['black'], 28)
        for zz in (zb, zb + h):
            cyl(name + '_Neck', (x, -d, zz - 0.012), (x, -d, zz + 0.012), 0.009, MAT['brass'], 12)
        box(name + '_Label', (x, -d - r - 0.0005, zb + h / 2), (0.03, 0.001, 0.035), MAT['white'], 0)
        cyl(name + '_Clip', (x, -d, zb + h / 2), (x, 0, zb + h / 2), 0.005, MAT['brass'], 10)
    else:
        o = cyl(name, (x, -d, zb + 0.015), (x, -d, zb + h - 0.015), r, MAT['black'], 36)
        for zz, sgn in ((zb + 0.015, -1), (zb + h - 0.015, 1)):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=36, ring_count=16, location=(x, -d, zz))
            capo = bpy.context.object
            capo.scale = (1, 1, 0.3)
            bpy.ops.object.transform_apply(scale=True)
            capo.data.materials.append(MAT['black'])
            smooth(capo)
            register(capo, name + '_Cap')
        if ves['id'] == 'accumulator':
            cyl(name + '_Label', (x, -d, zb + h * 0.45), (x, -d, zb + h * 0.8), r + 0.0008, MAT['yellow'], 36, cap=False)
            for zz in (zb + 0.04, zb + h - 0.04):
                box(name + '_Clamp', (x, -d / 2, zz), (r * 2 + 0.01, d, 0.012), MAT['frame'], 0.002)
            for px in (65, 69):
                cyl(name + '_Port', (X(px), -d, zb + h - 0.02), (X(px), -d, zb + h + 0.01), 0.008, MAT['brass'], 12)
        if ves['id'] == 'receiver':
            box(name + '_Label', (x, -d - r + 0.0005, zb + h * 0.5), (0.06, 0.002, 0.06), MAT['yellow'], 0)
            box(name + '_Foot', (x, -d, zb + 0.004), (r * 2.2, r * 2.2, 0.008), MAT['dark'], 0.002)
            cyl(name + '_Port_In', (X(51), -d, zb + h - 0.02), (X(51), -d, zb + h + 0.01), 0.008, MAT['brass'], 12)
            cyl(name + '_Port_Out', (x, -d, zb + 0.09), (x, -d - r - 0.0, zb + 0.09), 0.008, MAT['brass'], 12)

# --- gauges ------------------------------------------------------------------
for g in L['gauges']:
    x = X(g['x'])
    d = 0.05
    name = 'Gauge_%s' % g['id'].capitalize()
    cyl(name + '_Stem', (x, -PIPE['horizontal'], Z(g['stemY1'])), (x, -d, Z(g['stemY1'])), 0.005, MAT['brass'], 12)
    cyl(name + '_Riser', (x, -d, Z(g['stemY1'])), (x, -d, Z(g['stemY2'])), 0.005, MAT['brass'], 12)
    cyl(name + '_Fitting', (x, -d, Z(g['stemY2']) - 0.01), (x, -d, Z(g['stemY2']) + 0.012), 0.009, MAT['brass'], 6)
    fz = Z(g['faceY'])
    case = cyl(name + '_Case', (x, -d + 0.012, fz), (x, -d - 0.012, fz), 0.035, MAT['frame'], 36)
    face = cyl(name + '_Face', (x, -d - 0.012, fz), (x, -d - 0.0125, fz), 0.031, MAT['gauge'], 36)
    face['gauge'] = g['id']
    ring = torus(name + '_Bezel', (x, -d - 0.012, fz), 0.033, 0.0025, MAT['frame'], (math.pi / 2, 0, 0))
    pivot = empty(name + '_Needle_Pivot', (x, -d - 0.016, fz))
    needle = box(name + '_Needle', (x, -d - 0.016, fz + 0.012), (0.0025, 0.001, 0.024), MAT['needle'], 0)
    parent_to(needle, pivot)
    pivot['gauge'] = g['id']
    pivot['max'] = g['max']
    # tick marks around the face
    ticks = []
    for k in range(13):
        ang = math.radians(-135 + k * 22.5)
        tx, tz = x + math.sin(ang) * 0.026, fz + math.cos(ang) * 0.026
        ticks.append(box('tick', (tx, -d - 0.0138, tz), (0.0015, 0.0005, 0.004), MAT['dark'], 0, rotation=(0, -ang, 0)))
    join(ticks, name + '_Ticks')

# --- fittings ----------------------------------------------------------------
for f in L['fittings']:
    if f['id'] == 'sightglass':
        cyl('SightGlass', (X(f['x']), -f['d'], Z(f['y']) - f['height'] / 2), (X(f['x']), -f['d'], Z(f['y']) + f['height'] / 2), f['radius'], MAT['brass'], 16)
        cyl('SightGlass_Window', (X(f['x']), -f['d'], Z(f['y'])), (X(f['x']), -f['d'] - f['radius'] - 0.001, Z(f['y'])), 0.006, MAT['glass'], 16)
    elif f['id'] in ('txv_body', 'axv_body'):
        x, d, z = X(f['x']), f['d'], Z(f['y'])
        nm = 'TXV' if f['id'] == 'txv_body' else 'AXV'
        body = cyl(nm, (x, -d, z - f['height'] / 2), (x, -d, z + f['height'] / 2), f['radius'], MAT['brass'], 20)
        body['component'] = nm
        if f['id'] == 'txv_body':
            disc = cyl(nm + '_Diaphragm', (x, -d, Z(f['discY']) - 0.008), (x, -d, Z(f['discY']) + 0.008), f['disc'], MAT['brass'], 32)
            cyl(nm + '_Outlet', (x, -d, z), (x + 0.03, -d, z), 0.006, MAT['brass'], 12)
        else:
            cyl(nm + '_Cap', (x, -d, z + f['height'] / 2), (x, -d, z + f['height'] / 2 + 0.02), 0.009, MAT['dark'], 16)
            cyl(nm + '_Side', (x, -d, z), (x - 0.03, -d, z), 0.006, MAT['brass'], 12)
    elif f['id'] == 'captube':
        cx, cz, d, r = X(f['x']), Z(f['y']), f['d'], f['radius']
        pts = []
        turns, n = f['turns'], 48
        for i in range(turns * n + 1):
            ang = i / n * 2 * math.pi
            pts.append(Vector((cx + math.cos(ang) * r, -d - i / (turns * n) * 0.012, cz + math.sin(ang) * r)))
        feed_in = [loc(66, 15, 0.035), loc(66, 11, 0.03), pts[0]]
        feed_out = [pts[-1], loc(76, 11, 0.03), loc(76, 15, 0.035)]
        o = tube('CapTube', feed_in + pts + feed_out, 0.0016, MAT['copper'], resolution=1, corner=0.004)
        o['component'] = 'CTV'
    elif f['id'] == 'sleeve':
        o = cyl('Suction_Sleeve', (X(f['x1']), -f['d'], Z(f['y'])), (X(f['x2']), -f['d'], Z(f['y'])), f['radius'], MAT['sleeve'], 20)
        cyl('TXV_Bulb', (X(f['x2']) - 0.045, -f['d'] - 0.014, Z(f['y'])), (X(f['x2']) - 0.005, -f['d'] - 0.014, Z(f['y'])), 0.006, MAT['copper'], 12)

# --- boxes and plates --------------------------------------------------------
for b in L['boxes']:
    cx = X(b['cx'])
    if 'zBottom' in b:
        cz = b['zBottom'] + b['h'] / 2
        d = b['d']
        box('Box_' + b['id'], (cx, -d, cz), (b['w'], b['t'], b['h']), MAT[b['color']], 0.004)
        box('Box_' + b['id'] + '_Bracket', (cx, -d, b['zBottom'] - 0.01), (b['w'] * 0.6, b['t'] * 0.6, 0.02), MAT['frame'], 0.002)
        for k, dx in enumerate((-0.02, 0.02)):
            box('Box_' + b['id'] + '_Window_%d' % k, (cx + dx, -d - b['t'] / 2 - 0.0005, cz), (0.014, 0.001, 0.05), MAT['white'], 0)
        continue
    cz = Z(b['cy'])
    o = box('Box_' + b['id'], (cx, -b['t'] / 2, cz), (b['w'], b['t'], b['h']), MAT[b['color']], 0.003 if b['t'] > 0.01 else 0.0005)
    if b['id'] == 'controlbox':
        for k, dx in enumerate((-0.04, 0.04)):
            cyl('Box_controlbox_Knob_%d' % k, (cx + dx, -b['t'], cz - 0.02), (cx + dx, -b['t'] - 0.018, cz - 0.02), 0.019, MAT['steel'], 24)
            box('Box_controlbox_Label_%d' % k, (cx + dx, -b['t'] - 0.0005, cz - b['h'] / 2 + 0.012), (0.06, 0.001, 0.012), MAT['bluelabel'] if k == 0 else MAT['redlabel'], 0)
        box('Box_controlbox_Display', (cx, -b['t'] - 0.0015, cz + 0.07), (0.06, 0.001, 0.022), MAT['dark'], 0)
        box('Box_controlbox_Plate', (cx, -b['t'] - 0.0003, cz + 0.03), (0.15, 0.0006, 0.1), MAT['white'], 0)
        text('Box_controlbox_Text', 'Vari-Speed   Vari-Speed', 0.011, (cx, -b['t'] - 0.0025, cz + 0.045), MAT['dark'])
    if b['id'] == 'tcs':
        box('Box_tcs_Screen', (cx, -b['t'] - 0.0005, cz + 0.02), (0.04, 0.001, 0.02), MAT['dark'], 0)
    if b['id'] == 'nameplate':
        box('Box_nameplate_Border', (cx, -b['t'] - 0.0003, cz), (b['w'] - 0.006, 0.0006, b['h'] - 0.006), MAT['white'], 0)
        text('Box_nameplate_Text1', 'MODEL NO. TU-100', 0.013, (cx, -b['t'] - 0.0025, cz + 0.012), MAT['dark'])
        text('Box_nameplate_Text2', 'BASIC REFRIGERATION TRAINING UNIT', 0.008, (cx, -b['t'] - 0.0025, cz - 0.01), MAT['dark'])
    if b['id'] == 'probeholder':
        text('Box_probeholder_Text', 'CLAMP PROBE HOLDER', 0.009, (cx, -b['t'] - 0.0025, cz), MAT['dark'])

# --- attach points for labels (three.js reads empties by name) ---------------
for coil in L['coils']:
    empty('Anchor_Coil_%s' % coil['id'].capitalize(), (X(coil['cx']), -(coil['standoff'] + coil['thickness']), Z(coil['cy'])))
for ves in L['vessels']:
    empty('Anchor_%s' % ves['id'].capitalize(), (X(ves['x']), -ves['d'] - ves['radius'], ves['zBottom'] + ves['height'] / 2))
for tb in L['tubes']:
    empty('Anchor_Tube_%s' % ''.join(p.capitalize() for p in tb['id'].split('_')), ((X(tb['x1']) + X(tb['x2'])) / 2, -tb['d'] - 0.02, Z(tb['y'])))
empty('Anchor_Metering', (X(79), -0.08, Z(20)))
empty('Anchor_Reversing', (X(79.6), -0.08, Z(47)))
empty('Anchor_Gauges', (X(46), -0.08, Z(50)))

bpy.context.scene['description'] = 'TU-100 digital twin geometry: illustrative, built from photographs and published dimensions; not a survey.'

# --- export ------------------------------------------------------------------
if EXPORT:
    os.makedirs(os.path.join(ROOT, 'public', 'models'), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in COLLECTION.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(ROOT, 'public', 'models', 'tu100-unit.glb'),
        export_format='GLB', export_extras=True, export_animations=False, export_apply=True,
        use_selection=True, export_texcoords=False, export_normals=True, export_yup=True,
    )
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'tu100-unit.blend'))

# --- preview renders --------------------------------------------------------
if RENDER:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.display.shading.show_shadows = True
    scene.display.shading.show_object_outline = True
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('World')
    scene.world.color = (0.86, 0.88, 0.9)
    scene.render.resolution_percentage = 100
    cam_data = bpy.data.cameras.new('Cam')
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shoot(name, location, target, width, height, ortho=None, lens=35):
        cam.location = location
        direction = Vector(target) - Vector(location)
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        if ortho:
            cam_data.type = 'ORTHO'
            cam_data.ortho_scale = ortho
        else:
            cam_data.type = 'PERSP'
            cam_data.lens = lens
        scene.render.resolution_x, scene.render.resolution_y = width, height
        scene.render.filepath = os.path.join(PREVIEW_DIR, name + '.png')
        bpy.ops.render.render(write_still=True)

    mid = BOT + H / 2
    shoot('front-ortho', (0, -3, mid), (0, 0, mid), 1010, 1600, ortho=H * 1.0)
    shoot('three-quarter', (-1.6, -2.2, 1.9), (0.05, 0.1, 1.2), 1400, 1000, lens=40)
    shoot('side', (-2.6, 0.2, 1.3), (0, 0.2, 1.2), 900, 1200, lens=45)
    shoot('valves', (0.25, -0.9, 1.35), (0.26, 0, 1.32), 1200, 900, lens=50)
    shoot('receiver', (-0.15, -1.0, 1.0), (0.0, 0.1, 0.7), 1200, 900, lens=45)
    shoot('metering', (0.2, -0.9, 1.85), (0.22, 0, 1.72), 1200, 900, lens=50)
    shoot('whole', (-1.2, -3.0, 1.6), (0, 0.1, 1.15), 1200, 1400, lens=38)
    print('PREVIEWS', PREVIEW_DIR)

print('OBJECTS', len(COLLECTION.objects))
