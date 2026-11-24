#!/usr/bin/env python3
"""Verify the two revised-missile passes and export their score and event tables.

Usage: python3 collect.py PLAIN_OUTPUT OBSERVER_OUTPUT RESULT_DIRECTORY
"""
import csv
import gzip
import json
import sys
from pathlib import Path

plain, audit, out = map(Path, sys.argv[1:])
out.mkdir(parents=True, exist_ok=True)
(out / "replays").mkdir(exist_ok=True)
trials, launches, impacts, bursts = [], [], [], []
for opponent in ("tie_ln", "tie_in", "tie_d"):
    for side in ("x-first", "tie-first"):
        folder = Path(opponent, side)
        for seed in range(21, 41):
            file = folder / f"seed-{seed}" / "result.json"
            observed = json.loads((audit / file).read_text())
            contacts = observed.pop("contacts")
            showers = observed.pop("bursts")
            run = json.loads((plain / file).read_text())
            assert observed == run, file
            x_lost, tie_lost = (run["a"], run["b"]) if side == "x-first" else (run["b"], run["a"])
            winner = "x" if x_lost < tie_lost else "tie" if tie_lost < x_lost else "draw"
            ending = {"none": "timeout", "both": "mutual", "A": "elimination", "B": "elimination"}[run["w"]]
            weapon = run["missiles"]
            engine = run["collisions"]
            key = {"opponent": opponent, "side": side, "seed": seed}
            def team(unit):
                return "x" if unit.startswith("a") == (side == "x-first") else "tie"

            assert all(n == "cmsl" for n in weapon.get("kinds", {}))
            assert len(run["launches"]) == weapon["fired"]
            assert len({m["id"] for m in contacts}) == len(contacts)
            assert sum(m["n"] for m in contacts) == engine.get("hit", 0)
            assert sum(m["n"] for m in contacts if m["friendly"]) == engine.get("ff", 0)
            assert sum(m["n"] for m in contacts if not m["friendly"] and m["actual"] != m["target"]) == engine.get("stray", 0)
            assert sum(m["n"] for m in contacts if m["prox"]) == engine.get("prox", 0)
            for burst in showers:
                leak = burst.get("leaked") or 0
                absorbed = max(0, min(1, 1-leak/burst["energy"]))
                fraction = "full" if absorbed >= 1-1e-9 else "partial" if absorbed > 1e-9 else "zero"
                bursts.append({**key, "from_id": burst["from"], "actual_id": burst["actual"],
                               "side_hit": team(burst["actual"]), "rounds": burst["n"],
                               "incoming_energy_game_units": burst["energy"], "absorbed_fraction": absorbed,
                               "absorption": fraction})
            for round_ in run["launches"]:
                assert 0 <= round_["metres"] <= 3000
                launches.append({**key, "time_s": round_["t"], "from_id": round_["from"],
                                 "side_firing": team(round_["from"]), "target_id": round_["to"],
                                 "distance_m": round(round_["metres"], 3)})
            counts = {"intended": 0, "launcher": 0, "wingmate": 0, "other_enemy": 0}
            for c in contacts:
                assert c["n"] == 1
                category = ("launcher" if c["from"] == c["actual"] else
                            "wingmate" if c["friendly"] else
                            "intended" if c["target"] == c["actual"] else "other_enemy")
                counts[category] += c["n"]
                impacts.append({**key, "time_s": c["time"], "missile_id": c["id"],
                                "from_id": c["from"], "side_firing": team(c["from"]),
                                "target_id": c["target"], "actual_id": c["actual"],
                                "category": category, "contact": "proximity" if c["prox"] else "direct",
                                "missile_travel_m": round(c["travelled"], 3)})
            trials.append({**key, "seconds": run["t"], "x_lost": x_lost, "tie_lost": tie_lost,
                           "winner": winner, "ending": ending, "raw_winner": run["w"],
                           "missiles_fired": weapon["fired"], "runner_hit": weapon["hit"],
                           "runner_spent": weapon["spent"], "runner_target_lost": weapon["lost"],
                           "runner_unclassified": weapon["fired"]-weapon["hit"]-weapon["spent"]-weapon["lost"],
                           "engine_hit": engine.get("hit", 0), "proximity": engine.get("prox", 0), **counts,
                           "held_checks": run["held"]})
            if seed == 24 and side == "x-first":
                data = (plain / file.parent / "trace.json").read_bytes()
                trace = json.loads(data)
                frames = trace["frames"]
                assert trace["a"] == "craft_xwing" and trace["b"] == "craft_"+opponent
                assert trace["seed"] == seed and trace["kind"] == "head-on"
                assert len(trace["ids"]) == 8 and len(set(trace["ids"])) == 8
                assert len(frames)*trace["dt"] == run["t"] == trace["result"]["t"]
                assert trace["result"]["lostA"] == sum(v[4] for v in frames[-1]["u"][:4]) == x_lost
                assert trace["result"]["lostB"] == sum(v[4] for v in frames[-1]["u"][4:]) == tie_lost
                assert frames[-1]["prox"] == engine.get("prox", 0)
                assert frames[-1]["ff"] == counts["launcher"]+counts["wingmate"]
                assert len({m["id"] for frame in frames for m in frame["m"]}) == weapon["fired"]
                (out / "replays" / (opponent+".json.gz")).write_bytes(gzip.compress(data, mtime=0))

assert len(trials) == 120
for filename, rows in (("trials.csv", trials), ("launches.csv", launches), ("impacts.csv", impacts),
                       ("proximity.csv", bursts)):
    with (out / filename).open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
