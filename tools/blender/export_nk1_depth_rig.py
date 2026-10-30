"""Export the active Blender scene as an NK1 depth-rig GLB.

Run:
  blender --background character.blend --python tools/blender/export_nk1_depth_rig.py -- \
    --output build/kurisu-depth-rig.glb --collection NK1_RIG

Rig object names are stable manifest IDs. Every rig object's parent must also be
inside the rig collection. Runtime transforms are read back from the exported
glTF nodes (not copied from Blender's pre-export coordinate system).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

MAGIC = 0x46546C67
JSON_CHUNK = 0x4E4F534A
ROLES = {
    "root", "head", "face", "eyes", "hair-front", "hair-back", "torso",
    "left-upper-arm", "left-forearm", "left-hand", "right-upper-arm",
    "right-forearm", "right-hand", "coat-front", "coat-tail", "accessory", "custom",
}
FACE_CHANNELS = {
    "blink", "blinkLeft", "blinkRight", "browRaise", "browRaiseLeft",
    "browRaiseRight", "browFurrow", "browFurrowLeft", "browFurrowRight",
    "eyeLookXLeft", "eyeLookXRight", "eyeLookYLeft", "eyeLookYRight",
    "smile", "frown", "mouthOpen", "mouthWide", "mouthRound",
    "visemeAA", "visemeEE", "visemeIH", "visemeOH", "visemeOU",
    "visemeFV", "visemeMBP", "visemeL", "joy", "sadness", "anger", "anxiety",
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Destination GLB path")
    parser.add_argument("--collection", default="NK1_RIG", help="Collection containing rig control objects")
    parser.add_argument("--manifest-id", default="nk1-kurisu-2p5d", help="Stable manifest ID")
    return parser.parse_args(argv)


def finite_tuple(values, length, label):
    result = [float(value) for value in values]
    if len(result) != length or not all(math.isfinite(value) for value in result):
        raise ValueError("invalid " + label)
    return result


def build_manifest(collection, manifest_id):
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,63}", manifest_id, re.I):
        raise ValueError("manifest ID must be 2-64 safe characters")
    objects = list(collection.all_objects)
    if not objects or len(objects) > 128:
        raise ValueError("rig collection must contain 1-128 objects")
    names = [obj.name for obj in objects]
    if len(set(names)) != len(names):
        raise ValueError("rig object names must be unique")
    object_set = set(objects)
    nodes = []
    for obj in objects:
        node_id = obj.name
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,63}", node_id, re.I):
            raise ValueError("unsafe rig object name: " + node_id)
        if obj.parent is not None and obj.parent not in object_set:
            raise ValueError("rig object has a parent outside the rig collection: " + node_id)
        role = obj.get("nk1_role")
        if role not in ROLES:
            raise ValueError("object " + node_id + " needs valid nk1_role custom property")
        pivot = [
            float(obj.get("nk1_pivot_x", 0.0)),
            float(obj.get("nk1_pivot_y", 0.0)),
        ]
        if not all(math.isfinite(value) and -1 <= value <= 1 for value in pivot):
            raise ValueError("pivot must be finite and within [-1, 1]: " + node_id)
        depth = float(obj.get("nk1_depth", 0.0))
        parallax = float(obj.get("nk1_parallax", 0.0))
        if not math.isfinite(depth) or not -1 <= depth <= 1:
            raise ValueError("nk1_depth must be within [-1, 1]: " + node_id)
        if not math.isfinite(parallax) or not 0 <= parallax <= 2:
            raise ValueError("nk1_parallax must be within [0, 2]: " + node_id)
        nodes.append({
            "id": node_id,
            "parentId": obj.parent.name if obj.parent else None,
            "role": role,
            # Filled from the actual exported glTF node after Blender's axis conversion.
            "position": [0.0, 0.0, 0.0],
            "pivot": pivot,
            "rotation": [0.0, 0.0, 0.0],
            "depth": depth,
            "parallax": parallax,
            "visible": not obj.hide_render,
        })
    return {"version": 1, "id": manifest_id, "units": "scene", "nodes": nodes}


def normalize_face_bindings(raw):
    if raw is None:
        return {}
    if not hasattr(raw, "items"):
        raise ValueError("nk1_face_bindings must be a mapping")
    result = {}
    for channel, names in raw.items():
        if channel not in FACE_CHANNELS:
            raise ValueError("unsupported face channel: " + str(channel))
        if isinstance(names, str):
            names = [names]
        if not isinstance(names, (list, tuple)) or not names:
            raise ValueError("face binding must be a non-empty name list: " + channel)
        clean = [str(name) for name in names]
        if any(not name.strip() for name in clean):
            raise ValueError("empty morph target name in " + channel)
        result[channel] = clean
    return result


def read_glb_document(glb_path):
    data = glb_path.read_bytes()
    if len(data) < 20:
        raise ValueError("exported file is not a complete GLB")
    magic, version, total = struct.unpack_from("<III", data, 0)
    if magic != MAGIC or version != 2 or total != len(data):
        raise ValueError("invalid GLB header")
    offset = 12
    document = None
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("truncated GLB chunk header")
        length, kind = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + length
        if end > len(data):
            raise ValueError("truncated GLB chunk")
        if kind == JSON_CHUNK:
            document = json.loads(data[start:end].decode("utf-8").rstrip(" \\t\\r\\n\\0"))
        offset = end
    if document is None:
        raise ValueError("GLB JSON chunk is missing")
    return document


def exported_node_trs(node, node_id):
    if "matrix" in node:
        raise ValueError("exported rig node uses a matrix transform; apply transforms in Blender so glTF emits TRS: " + node_id)
    translation = Vector(finite_tuple(node.get("translation", [0.0, 0.0, 0.0]), 3, node_id + " exported translation"))
    raw_rotation = finite_tuple(node.get("rotation", [0.0, 0.0, 0.0, 1.0]), 4, node_id + " exported rotation")
    quaternion = Quaternion((raw_rotation[3], raw_rotation[0], raw_rotation[1], raw_rotation[2]))
    if quaternion.magnitude < 1e-8:
        raise ValueError("exported glTF rotation quaternion is degenerate: " + node_id)
    quaternion.normalize()
    euler = quaternion.to_euler("XYZ")
    return list(translation), finite_tuple(euler, 3, node_id + " exported Euler rotation")


def reconcile_manifest_with_gltf(manifest, document):
    gltf_nodes = document.get("nodes", [])
    by_name = {}
    for index, node in enumerate(gltf_nodes):
        name = node.get("name")
        if isinstance(name, str):
            by_name.setdefault(name, []).append((index, node))
    parent_by_index = {}
    for parent_index, parent_node in enumerate(gltf_nodes):
        for child_index in parent_node.get("children", []):
            if not isinstance(child_index, int) or child_index < 0 or child_index >= len(gltf_nodes):
                raise ValueError("exported glTF contains an invalid child node index")
            if child_index in parent_by_index:
                raise ValueError("exported glTF node has multiple parents: " + str(gltf_nodes[child_index].get("name")))
            parent_by_index[child_index] = parent_index

    rig_ids = {entry["id"] for entry in manifest["nodes"]}
    for entry in manifest["nodes"]:
        matches = by_name.get(entry["id"], [])
        if len(matches) != 1:
            raise ValueError("rig node name must occur exactly once in exported glTF: " + entry["id"])
        index, gltf_node = matches[0]
        parent_index = parent_by_index.get(index)
        parent_name = gltf_nodes[parent_index].get("name") if parent_index is not None else None
        if parent_name is not None and parent_name not in rig_ids:
            raise ValueError("exported rig node is parented beneath a non-rig node: " + entry["id"])
        entry["parentId"] = parent_name
        entry["position"], entry["rotation"] = exported_node_trs(gltf_node, entry["id"])
    return manifest


def inject_scene_extras(glb_path, manifest, face_bindings, document):
    data = glb_path.read_bytes()
    chunks = []
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        start = offset + 8
        chunks.append((kind, data[start:start + length]))
        offset = start + length
    json_index = next((index for index, (kind, _) in enumerate(chunks) if kind == JSON_CHUNK), None)
    if json_index is None:
        raise ValueError("GLB JSON chunk is missing")
    scene_index = int(document.get("scene", 0))
    scenes = document.get("scenes", [])
    if scene_index < 0 or scene_index >= len(scenes):
        raise ValueError("GLB active scene is missing")
    extras = scenes[scene_index].setdefault("extras", {})
    extras["nk1DepthRigManifest"] = manifest
    if face_bindings:
        extras["nk1DepthRigFaceBindings"] = face_bindings
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    chunks[json_index] = (JSON_CHUNK, encoded)
    output = bytearray(struct.pack("<III", MAGIC, 2, 12 + sum(8 + len(chunk) for _, chunk in chunks)))
    for kind, chunk in chunks:
        output.extend(struct.pack("<II", len(chunk), kind))
        output.extend(chunk)
    glb_path.write_bytes(output)


def main():
    args = parse_args()
    collection = bpy.data.collections.get(args.collection)
    if collection is None:
        raise ValueError("missing Blender collection: " + args.collection)
    manifest = build_manifest(collection, args.manifest_id)
    face_bindings = normalize_face_bindings(bpy.context.scene.get("nk1_face_bindings"))
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_extras=True,
    )
    document = read_glb_document(output)
    reconcile_manifest_with_gltf(manifest, document)
    inject_scene_extras(output, manifest, face_bindings, document)
    print("NK1 depth-rig GLB exported and reconciled with glTF node transforms: " + str(output))
    print("Manifest nodes: " + str(len(manifest["nodes"])))


if __name__ == "__main__":
    main()
