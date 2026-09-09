"""Illustrative component pilot, not a measured reconstruction of the RMIT unit."""
import bpy, math, os
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.4,alpha=1):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,alpha);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,alpha);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Alpha'].default_value=alpha
 if alpha<1:m.surface_render_method='DITHERED'
 return m
copper=material('Copper pipe',(.55,.22,.09),.75);silver=material('Aluminium fins',(.49,.55,.55),.75);frame=material('Dark coil frame',(.065,.09,.08),.5);brass=material('Valve brass',(.58,.38,.12),.7);green=material('Valve handwheel',(.035,.3,.18),.2);glass=material('Illustrative glass',(.57,.85,.81),0,.15,.24);back=material('Off-white mounting panel',(.82,.85,.79),0,.6)
def cube(name,location,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);return o
def rod(name,a,b,r,mat,vertices=20):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);return o
def tube(name,coords,r,mat):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=3;s=curve.splines.new('POLY');s.points.add(len(coords)-1)
 for p,co in zip(s.points,coords):p.co=(*co,1)
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
cube('Mounting panel',(0,.12,0),(1.3,.035,1.05),back)
for x in [-.5,.12]:cube('Coil frame side',(x,0,.16),(.035,.15,.62),frame)
for z in [-.15,.47]:cube('Coil frame rail',(-.19,0,z),(.65,.15,.03),frame)
for i in range(33):cube('Coil fin %02d'%i,(-.48+i*.018,0,.16),(.005,.13,.58),silver)
# Serpentine pipe with rounded U bends, visibly separate from fins.
path=[]
for j in range(8):
 z=.42-j*.075;left,right=-.51,.13
 if j%2==0:path.extend([(left,-.085,z),(right,-.085,z)])
 else:path.extend([(right,-.085,z),(left,-.085,z)])
 if j<7:
  edge=right if j%2==0 else left;sign=1 if j%2==0 else -1
  for k in range(1,13):
   ang=k/12*math.pi;path.append((edge+sign*.0375*math.sin(ang),-.085,z-.0375+.0375*math.cos(ang)))
tube('coil_refrigerant_path',path,.012,copper)
tube('coil_to_observation',[(.13,-.085,.42),(.39,-.085,.42),(.39,-.085,.30)],.012,copper)
rod('observation_glass',(.39,-.085,.02),(.39,-.085,.30),.039,glass,40)
for z in [.02,.30]:rod('Tube end flange',(.39,-.085,z-.013),(.39,-.085,z+.013),.063,brass,32)
for x in [.338,.442]:rod('Tube tie bolt',(x,-.085,.005),(x,-.085,.315),.006,silver,12)
tube('observation_to_valve',[(.39,-.085,.02),(.39,-.085,-.23)],.012,copper)
rod('pilot_valve_body',(.39,-.085,-.24),(.39,-.085,-.32),.035,brass)
rod('Valve stem',(.39,-.085,-.28),(.39,-.20,-.28),.01,brass)
bpy.ops.mesh.primitive_torus_add(major_radius=.056,minor_radius=.009,major_segments=32,minor_segments=10,location=(.39,-.22,-.28),rotation=(math.pi/2,0,0));wheel=bpy.context.object;wheel.name='pilot_valve_handwheel';wheel.data.materials.append(green)
for a in [0,math.pi/2]:rod('Handwheel spoke',(.39-.05*math.cos(a),-.22,-.28-.05*math.sin(a)),(.39+.05*math.cos(a),-.22,-.28+.05*math.sin(a)),.005,green)
tube('valve_outlet',[(.39,-.085,-.32),(.39,-.085,-.42),(-.05,-.085,-.42)],.012,copper)
for o in bpy.context.scene.objects:o['validation']='Illustrative pilot; dimensions and piping are not surveyed'
bpy.context.scene['description']='TU100 spatial inspection pilot: coil, tube and valve. Not a complete circuit or a calibrated replica.'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'design/3d/tu100-component-pilot.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'public/models/tu100-component-pilot.glb'),export_format='GLB',export_extras=True,export_animations=False)
