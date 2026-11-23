"""Build the five preset zips of the SquadJS plugin.

Run: python -I -B src/utils/build_presets.py <version>
Output: releases/presets-v<version>/SmartShuffle-<preset>.zip and sha256.txt

Every zip holds the unchanged plugin (src/squadjs/smart-shuffle.js), the plugin entry for SquadJS
config.json (src/squadjs/presets/<preset>.json) and a short README.txt. The presets only differ in
config.json settings; the numbers come from the round 19 simulation (see the README).
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "src" / "squadjs" / "smart-shuffle.js"
PRESETS = ROOT / "src" / "squadjs" / "presets"
STAMP = (2026, 11, 24, 12, 0, 0)

# id: (title, who it is for, what it does, stomps in the three simulated worlds, parties kept)
INFO = {
    "friends-small": (
        "Friends: duos and trios",
        "Servers where players ask to stay with one or two friends.",
        "Parties of 2 or 3 stay on one side. Bigger parties are split like everyone else. The lock keeps\n"
        "friends together for the next round. Counts each player's last 2 rounds of the session.",
    ),
    "friends-squad": (
        "Friends: whole squads up to 6",
        "Community servers where friend groups play as a squad together.",
        "Parties of up to 6 stay on one side. Only stacks of 7 or more are split. The lock keeps friends\n"
        "together for the next round. Counts each player's last 4 rounds of the session.",
    ),
    "quality-max": (
        "Quality: maximum balance",
        "Servers that want the most even teams and do not keep friends together.",
        "Parties are ignored, everyone is placed by strength. Hard lock for one round. Counts each\n"
        "player's last 4 rounds of the session.",
    ),
    "quality-session": (
        "Quality: long session",
        "Servers with the same regulars playing for many hours.",
        "Parties are ignored. Hard lock for one round. Counts each player's last 8 rounds, up to 12\n"
        "hours back. The steadiest choice when tonight's form swings a lot.",
    ),
    "quality-fresh": (
        "Quality: tonight's form",
        "Public servers where many players come and go.",
        "Parties are ignored. Hard lock for one round. Counts only each player's last 2 rounds, up to\n"
        "3 hours back, so tonight's form weighs most.",
    ),
}


def readme(pid, version, entry, sim):
    title, who, what = INFO[pid]
    lines = [
        "Smart Shuffle for SquadJS - preset: %s (%s)" % (title, pid),
        "Preset pack %s" % version,
        "",
        "For: " + who,
        "",
        what,
        "",
        "Simulation (100 players, ticket model, 7,200 matches in each of three worlds, a model, not live",
        "data). Worlds: main (form and party synergy) / no party synergy / form that swings twice as much:",
        sim,
        "",
        "Install",
        "1. Copy smart-shuffle.js into SquadJS/squad-server/plugins/ (replace an older copy).",
        "2. Open SquadJS config.json and put the entry from config-entry.json into the \"plugins\" list.",
        "   If you already have a SmartShuffle entry, replace it. Keep only one.",
        "3. Restart SquadJS. Type !smartshuffle status in admin chat to check it is running.",
        "",
        "Every preset moves fewer players (fewerMoves = 0.1): about a third of the server instead of",
        "half, with the same balance in the simulation. Set fewerMoves to 0 for the old behaviour.",
        "",
        "The plugin file is the same in every preset. Only the settings differ, so you can switch",
        "presets by changing config.json alone. Every setting can still be changed by hand, see",
        "https://github.com/Miabeyefendi/Squad-SmartShuffle#-configuration",
        "",
        "Settings in this preset:",
    ]
    for k, v in entry.items():
        if k in ("plugin", "enabled"):
            continue
        lines.append("  %s = %s" % (k, json.dumps(v)))
    lines += ["", "Source and full documentation: https://github.com/Miabeyefendi/Squad-SmartShuffle", ""]
    return "\r\n".join(lines)


def main(version, sims):
    out = ROOT / "releases" / ("presets-v" + version)
    out.mkdir(parents=True, exist_ok=True)
    plugin = PLUGIN.read_bytes()
    sums = []
    for pid in INFO:
        entry = json.loads((PRESETS / (pid + ".json")).read_text(encoding="utf-8"))
        folder = "SmartShuffle-" + pid + "/"
        files = {
            folder + "smart-shuffle.js": plugin,
            folder + "config-entry.json": (json.dumps(entry, indent=2) + "\n").encode("utf-8"),
            folder + "README.txt": readme(pid, version, entry, sims[pid]).encode("utf-8"),
        }
        path = out / ("SmartShuffle-" + pid + ".zip")
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            for name, data in files.items():
                zi = zipfile.ZipInfo(name, date_time=STAMP)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = 0o644 << 16
                z.writestr(zi, data)
        h = hashlib.sha256(path.read_bytes()).hexdigest()
        sums.append("%s  %s" % (h, path.name))
        print(path.name, h)
    (out / "sha256.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")


if __name__ == "__main__":
    ver = sys.argv[1] if len(sys.argv) > 1 else "1.0.0"
    sim_file = ROOT / "src" / "squadjs" / "presets" / "simulation.json"
    main(ver, json.loads(sim_file.read_text(encoding="utf-8")))
