"""Generate a deterministic, non-production NK1 2.5D rig blockout in Blender.

This is geometry for exercising the real export/runtime pipeline, not Kurisu artwork.
Run from the repository root:
  blender --background --python tools/blender/create_nk1_depth_rig_demo.py
  blender --background nk1-depth-rig-demo.blend --python tools/blender/export_nk1_depth_rig.py -- --output build/nk1-depth-rig-demo.glb
"""
from __future__ import annotations

import bpy
from mathutils import Matrix

COLLECTION_NAME = "NK1_RIG"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    scene = bpy.context.scene
    collection = bpy.data.collections.new(COLLECTION_NAME)
    scene.collection.children.link(collection)
    return collection


def link_only(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def make_empty(name, role, parent, collection, location=(0.0, 0.0, 0.0), depth=0.0, parallax=0.0):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.08
    obj.location = location
    if parent:
        obj.parent = parent
    obj["nk1_role"] = role
    obj["nk1_depth"] = depth
    obj["nk1_parallax"] = parallax
    return obj


def make_ellipsoid(name, role, parent, collection, location, scale, depth, parallax, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    link_only(obj, collection)
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    obj["nk1_role"] = role
    obj["nk1_depth"] = depth
    obj["nk1_parallax"] = parallax
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def make_material(name, color, roughness=0.78):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.roughness = roughness
    return material


def build():
    collection = clear_scene()
    skin = make_material("Blockout_Skin", (0.78, 0.55, 0.43))
    hair = make_material("Blockout_RedHair", (0.48, 0.12, 0.16))
    coat = make_material("Blockout_WhiteCoat", (0.78, 0.81, 0.84))
    dark = make_material("Blockout_Shadow", (0.12, 0.14, 0.19))
    eye = make_material("Blockout_Eyes", (0.08, 0.28, 0.36))
    root = make_empty("nk1_root", "root", None, collection)
    torso = make_ellipsoid("nk1_torso", "torso", root, collection, (0, 0, 0), (0.48, 0.66, 0.25), 0.0, 0.12, coat)
    head = make_ellipsoid("nk1_head", "head", torso, collection, (0, 0.82, 0.02), (0.34, 0.43, 0.31), 0.12, 0.32, skin)
    face = make_empty("nk1_face", "face", head, collection, (0, 0, 0.0), 0.18, 0.4)
    eyes = make_empty("nk1_eyes", "eyes", face, collection, (0, 0, 0.0), 0.2, 0.45)
    make_ellipsoid("nk1_eye_left", "custom", eyes, collection, (-0.14, 0.02, 0.275), (0.055, 0.035, 0.025), 0.22, 0.5, eye)
    make_ellipsoid("nk1_eye_right", "custom", eyes, collection, (0.14, 0.02, 0.275), (0.055, 0.035, 0.025), 0.22, 0.5, eye)
    make_ellipsoid("nk1_hair_back", "hair-back", head, collection, (0, 0.04, -0.13), (0.39, 0.48, 0.25), -0.18, 0.22, hair)
    make_ellipsoid("nk1_hair_front", "hair-front", head, collection, (0, 0.26, 0.23), (0.37, 0.2, 0.14), 0.35, 0.62, hair)
    make_ellipsoid("nk1_coat_front", "coat-front", torso, collection, (0, 0.05, 0.27), (0.22, 0.58, 0.045), 0.28, 0.3, coat)
    make_ellipsoid("nk1_coat_tail", "coat-tail", torso, collection, (0, -0.57, 0.08), (0.39, 0.22, 0.07), -0.1, 0.18, coat)
    for side, sign in (("left", -1), ("right", 1)):
        upper = make_ellipsoid(f"nk1_{side}_upper_arm", f"{side}-upper-arm", torso, collection, (sign * 0.53, 0.18, 0), (0.14, 0.39, 0.14), 0.02, 0.1, coat)
        make_ellipsoid(f"nk1_{side}_forearm", f"{side}-forearm", upper, collection, (0, -0.48, 0.01), (0.115, 0.34, 0.12), 0.04, 0.12, coat)
        make_ellipsoid(f"nk1_{side}_hand", f"{side}-hand", upper, collection, (0, -0.88, 0.02), (0.12, 0.14, 0.1), 0.08, 0.16, skin)
    bpy.context.scene["nk1_face_bindings"] = {"blinkLeft": ["Blink_L"], "blinkRight": ["Blink_R"], "mouthOpen": ["MouthOpen"]}
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 640
    bpy.context.scene.render.resolution_percentage = 100
    bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath("//nk1-depth-rig-demo.blend"))
    print("NK1 2.5D blockout scene saved: nk1-depth-rig-demo.blend")
    print("This is a technical mannequin; replace meshes/materials with approved character art.")


if __name__ == "__main__":
    build()
