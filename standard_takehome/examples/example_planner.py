"""
Example Phase 1 planner in Python.

The simulator runs in the browser. This script does not talk to it; it only
produces a `routines.json` bundle that you then drop into the simulator UI
(or post to whatever batch runner you build).

The wire format is the only contract. You can use any language, any library,
any tool. The output just has to match `src/schema.json`.

Run:
    python examples/example_planner.py > routines.json
"""

import json
import math
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent


def load_scene(scene_id: str) -> dict[str, Any]:
    path = ROOT / "scenarios" / f"{scene_id}.json"
    return json.loads(path.read_text())


def load_index() -> list[str]:
    idx = json.loads((ROOT / "scenarios" / "index.json").read_text())
    return [s["id"] for s in idx["scenes"]]


def compatible_bins(scene: dict, part: dict) -> list[dict]:
    kind = part.get("kind", "default")
    out = []
    for b in scene["bins"]:
        a = b.get("accepts", "any")
        if a == "any" or (isinstance(a, list) and (kind in a or part["id"] in a)):
            out.append(b)
    return out


def bin_center(b: dict) -> tuple[float, float]:
    return (b["x"] + b["w"] / 2, b["y"] + b["h"] / 2)


def greedy_nearest_bin(scene: dict) -> dict[str, Any]:
    assignments: list[tuple[dict, dict]] = []
    used: dict[str, int] = {}
    for part in scene["parts"]:
        bins = [b for b in compatible_bins(scene, part)
                if used.get(b["id"], 0) < b.get("capacity", math.inf)]
        if not bins:
            continue
        bins.sort(key=lambda b: math.hypot(bin_center(b)[0] - part["x"], bin_center(b)[1] - part["y"]))
        chosen = bins[0]
        used[chosen["id"]] = used.get(chosen["id"], 0) + 1
        assignments.append((part, chosen))

    assignments.sort(key=lambda pb: pb[0]["x"])
    steps: list[dict] = []
    for part, bin_ in assignments:
        bx, by = bin_center(bin_)
        steps.extend([
            {"type": "move_pose", "x": part["x"], "y": part["y"]},
            {"type": "grip_close"},
            {"type": "move_pose", "x": bx, "y": by},
            {"type": "grip_open"},
        ])
    return {"steps": steps, "notes": "python example: greedy nearest-bin, sort by x"}


def main() -> None:
    bundle = {
        "candidate": "example",
        "generator": "examples/example_planner.py",
        "scenarios": {sid: greedy_nearest_bin(load_scene(sid)) for sid in load_index()},
    }
    print(json.dumps(bundle, indent=2))


if __name__ == "__main__":
    main()
