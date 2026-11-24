"""Build the preset zips of the SquadJS plugin.

Run: python -I -B src/utils/build_presets.py <version>
Output: releases/presets-v<version>/SmartShuffle-<preset>.zip, SmartShuffle-all-presets.zip and sha256.txt

The five presets form a ladder: step 1 gives the most even teams, every next step moves fewer players and
keeps more friend groups together, for more stomped matches. Every zip holds the plugin
(src/squadjs/smart-shuffle.js), the complete plugin entry for SquadJS config.json with the lock, party and
history settings (src/squadjs/presets/<preset>.json) and a short README.txt. The all-presets zip holds the
plugin once and the five entries. The numbers come from the round 21 simulation (see the README).
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "src" / "squadjs" / "smart-shuffle.js"
PRESETS = ROOT / "src" / "squadjs" / "presets"
STAMP = (2026, 11, 24, 18, 0, 0)

# id: (title, who it is for, what it does)
INFO = {
    "1-strict": (
        "Step 1, strict: the most even teams",
        "Servers that want the most even teams and do not keep friends together.",
        "Everyone is placed by strength, parties are ignored. About a third of the server changes team.\n"
        "Hard lock for one round: nobody may switch back.",
    ),
    "2-balanced": (
        "Step 2, balanced: even teams, friends stay",
        "Most servers: players keep their party and most keep their team.",
        "Parties of up to 4 stay whole, on the side they play on now. About one player in eight changes\n"
        "team. The lock keeps friends together for the next round.",
    ),
    "3-relaxed": (
        "Step 3, relaxed: fewer moves",
        "Servers where players dislike being moved more than a less even match.",
        "Parties of up to 4 stay whole, on their current side. About one player in ten changes team.\n"
        "The lock keeps friends together for the next round.",
    ),
    "4-together": (
        "Step 4, together: every party stays",
        "Clan and community servers with big friend stacks.",
        "Every party stays whole on its current side, whatever its size. About one player in eleven\n"
        "changes team. The lock keeps friends together for the next round.",
    ),
    "5-light": (
        "Step 5, light: the smallest shuffle",
        "Servers that only want the worst mismatches softened.",
        "Every party stays whole on its current side. About one player in twelve changes team, still\n"
        "far fewer stomped matches than a random shuffle. The lock keeps friends together.",
    ),
}
ORDER = list(INFO)


def settings_lines(entry):
    out = []
    for k, v in entry.items():
        if k in ("plugin", "enabled"):
            continue
        out.append("  %s = %s" % (k, json.dumps(v)))
    return out


def readme(pid, version, entry, sim):
    title, who, what = INFO[pid]
    lines = [
        "Smart Shuffle for SquadJS - %s (%s)" % (title, pid),
        "Presets %s: step %d of 5. Step 1 gives the most even teams, every next step moves fewer" % (version, ORDER.index(pid) + 1),
        "players and keeps more friends together, for more stomped matches.",
        "",
        "For: " + who,
        "",
        what,
        "",
        "Simulation (100 players, ticket model, 7,200 matches in each of three worlds; a model, not live data):",
        sim,
        "",
        "Install",
        "1. Copy smart-shuffle.js into SquadJS/squad-server/plugins/ (replace an older copy).",
        "2. Open SquadJS config.json and put the entry from config-entry.json into the \"plugins\" list.",
        "   If you already have a SmartShuffle entry, replace it. Keep only one.",
        "3. Restart SquadJS. Type !smartshuffle status in admin chat to check it is running.",
        "",
        "The entry is complete: lock, parties, session history and fewer moves are all set. The plugin",
        "file is the same in every preset, so you can switch steps by changing config.json alone.",
        "All settings: https://github.com/Miabeyefendi/Squad-SmartShuffle#-configuration",
        "",
        "Settings in this preset:",
    ] + settings_lines(entry)
    lines += ["", "Source and full documentation: https://github.com/Miabeyefendi/Squad-SmartShuffle", ""]
    return "\r\n".join(lines)


def readme_all(version, entries, sims):
    lines = [
        "Smart Shuffle for SquadJS - all five presets (Presets %s)" % version,
        "",
        "One plugin file and five ready config.json entries, from the most even teams (step 1) to the",
        "smallest shuffle (step 5). Pick one entry, put it into the \"plugins\" list of SquadJS config.json",
        "(replace an older SmartShuffle entry, keep only one), copy smart-shuffle.js into",
        "SquadJS/squad-server/plugins/ and restart SquadJS.",
        "",
    ]
    for pid in ORDER:
        lines += ["%s (presets/%s.json)" % (INFO[pid][0], pid), "For: " + INFO[pid][1], sims[pid]]
        lines += settings_lines(entries[pid]) + [""]
    lines += ["Source and full documentation: https://github.com/Miabeyefendi/Squad-SmartShuffle", ""]
    return "\r\n".join(lines)


def write_zip(path, files):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            zi = zipfile.ZipInfo(name, date_time=STAMP)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data)


def main(version, sims):
    out = ROOT / "releases" / ("presets-v" + version)
    out.mkdir(parents=True, exist_ok=True)
    plugin = PLUGIN.read_bytes()
    entries = {pid: json.loads((PRESETS / (pid + ".json")).read_text(encoding="utf-8")) for pid in ORDER}
    paths = []
    for pid in ORDER:
        folder = "SmartShuffle-" + pid + "/"
        path = out / ("SmartShuffle-" + pid + ".zip")
        write_zip(path, {
            folder + "smart-shuffle.js": plugin,
            folder + "config-entry.json": (json.dumps(entries[pid], indent=2) + "\n").encode("utf-8"),
            folder + "README.txt": readme(pid, version, entries[pid], sims[pid]).encode("utf-8"),
        })
        paths.append(path)
    folder = "SmartShuffle-all-presets/"
    files = {folder + "smart-shuffle.js": plugin}
    for pid in ORDER:
        files[folder + "presets/" + pid + ".json"] = (json.dumps(entries[pid], indent=2) + "\n").encode("utf-8")
    files[folder + "README.txt"] = readme_all(version, entries, sims).encode("utf-8")
    path = out / "SmartShuffle-all-presets.zip"
    write_zip(path, files)
    paths.append(path)
    sums = []
    for path in paths:
        h = hashlib.sha256(path.read_bytes()).hexdigest()
        sums.append("%s  %s" % (h, path.name))
        print(path.name, h)
    (out / "sha256.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")


if __name__ == "__main__":
    ver = sys.argv[1] if len(sys.argv) > 1 else "2.0.0"
    sim_file = ROOT / "src" / "squadjs" / "presets" / "simulation.json"
    main(ver, json.loads(sim_file.read_text(encoding="utf-8")))
