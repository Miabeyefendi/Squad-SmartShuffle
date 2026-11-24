"""Build every preset zip of Smart Shuffle for one release.

Run: python -I -B src/utils/build_presets.py <version>
Output: releases/v<version>/<Name>.zip, Modloader-<Name>.zip, All-presets.zip and sha256.txt

Vanilla presets (<Name>.zip) need SquadJS only. Modloader presets (Modloader-<Name>.zip) are the same
settings on the hybrid route: SquadJS plus ModLoader and the SmartShuffle Workshop item, which write the
full scoreboard to the server log (useScoreboardDump). Every zip holds the plugin
(src/squadjs/smart-shuffle.js), the complete config.json entry (src/squadjs/presets/<name>.json) and a
short README.txt. The numbers come from the round 22 (vanilla) and round 23 (hybrid) simulations.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "src" / "squadjs" / "smart-shuffle.js"
PRESETS = ROOT / "src" / "squadjs" / "presets"
STAMP = (2026, 11, 24, 23, 0, 0)
REPO = "https://github.com/Miabeyefendi/Squad-SmartShuffle"

# name: (step, title, who it is for)
INFO = {
    "default": (0, "Default: the plugin's own settings", "Servers that want the plugin as it comes."),
    "strict": (1, "Step 1, Strict: the most even teams", "Servers that want the most even teams."),
    "tight": (2, "Step 2, Tight: even teams, trios stay", "Servers that want even teams and small friend groups kept."),
    "balanced": (3, "Step 3, Balanced: parties up to 4 stay", "Most servers."),
    "steady": (4, "Step 4, Steady: fewer moves", "Most servers, with fewer players moved."),
    "calm": (5, "Step 5, Calm: few moves", "Servers where players dislike being moved."),
    "squads": (6, "Step 6, Squads: parties up to 6 stay", "Community servers with friend squads."),
    "relaxed": (7, "Step 7, Relaxed: very few moves", "Community servers that prefer few moves to tight balance."),
    "easy": (8, "Step 8, Easy: minimal moves for squads", "Servers that only want clear mismatches fixed."),
    "together": (9, "Step 9, Together: every party stays", "Clan servers with big friend stacks."),
    "light": (10, "Step 10, Light: the smallest shuffle", "Servers that only want the worst mismatches softened."),
}
# stomped % in the main / no synergy / volatile world, average, players moved %, parties kept whole %
VANILLA = {
    "default": (10.5, 11.0, 12.2, 11.2, 50, 84), "strict": (10.0, 10.2, 11.9, 10.7, 33, 42),
    "tight": (10.8, 11.1, 13.2, 11.7, 22, 65), "balanced": (11.8, 11.7, 13.9, 12.5, 18, 85),
    "steady": (12.2, 12.3, 14.8, 13.1, 15, 86), "calm": (13.4, 12.9, 16.2, 14.2, 13, 86),
    "squads": (13.7, 13.4, 16.6, 14.6, 12, 89), "relaxed": (15.7, 15.1, 19.0, 16.6, 11, 90),
    "easy": (18.2, 17.2, 21.7, 19.0, 9, 90), "together": (21.1, 17.9, 26.2, 21.7, 9, 99),
    "light": (23.2, 20.3, 28.6, 24.0, 8, 99),
}
MODLOADER = {
    "default": (10.1, 10.6, 12.9, 11.2, 50, 84), "strict": (10.1, 10.6, 12.6, 11.1, 33, 42),
    "tight": (10.8, 11.2, 14.0, 12.0, 21, 65), "balanced": (11.5, 11.6, 14.5, 12.5, 18, 85),
    "steady": (12.4, 12.1, 15.4, 13.3, 14, 86), "calm": (13.7, 13.2, 16.9, 14.6, 12, 86),
    "squads": (14.0, 13.8, 17.5, 15.1, 12, 89), "relaxed": (16.3, 15.3, 19.8, 17.2, 10, 90),
    "easy": (18.4, 18.0, 22.0, 19.5, 9, 90), "together": (21.1, 18.4, 25.6, 21.7, 9, 99),
    "light": (23.3, 20.8, 28.1, 24.0, 8, 99),
}
ORDER = list(INFO)


def title(name):
    return name.capitalize()


def entry_for(name, modloader):
    e = json.loads((PRESETS / (name + ".json")).read_text(encoding="utf-8"))
    if modloader:
        e.pop("historyRounds", None)  # the hybrid route rates from the full scoreboard, no session history
        e.pop("historyHours", None)
        e["useScoreboardDump"] = True
    return e


def sim_lines(name, modloader):
    m, s, v, avg, mv, kept = (MODLOADER if modloader else VANILLA)[name]
    return [
        "Simulation (100 players, ticket model, 7,200 matches in each of three worlds; a model, not live data):",
        "  Stomped matches (ticket gap over 150, main / no synergy / volatile world): %.1f%% / %.1f%% / %.1f%%, average %.1f%%." % (m, s, v, avg),
        "  Players moved per shuffle: %d%%. Parties kept whole: %d%%." % (mv, kept),
        "  Random shuffle for comparison: 29.3% stomped, 50% of players moved.",
    ]


def settings_lines(entry):
    return ["  %s = %s" % (k, json.dumps(v)) for k, v in entry.items() if k not in ("plugin", "enabled")]


MODLOADER_STEPS = [
    "Install (Modloader preset: SquadJS + ModLoader + the SmartShuffle Workshop item)",
    "1. Copy smart-shuffle.js into SquadJS/squad-server/plugins/ (replace an older copy).",
    "2. Put the entry from config-entry.json into the \"plugins\" list of SquadJS config.json, replacing an",
    "   older SmartShuffle entry. It has \"useScoreboardDump\": true.",
    "3. On the game server download ModLoader and the SmartShuffle Workshop item with SteamCMD:",
    "     workshop_download_item 393380 3516838562",
    "     workshop_download_item 393380 3835528773",
    "   and put both folders into SquadGame/Plugins/Mods/.",
    "4. SquadGame/ServerConfig/ModsConfig.cfg:  ModLoadOrder=3516838562,3835528773",
    "5. Make ModLoader_v1 the first line of SquadGame/ServerConfig/LayerVoting.cfg.",
    "6. SquadGame/Saved/ModLoader/ModLoader.json (version 2), under \"rulesets\":",
    "     \"/SmartShuffle/BP_SmartShuffleDump.BP_SmartShuffleDump_C\": true",
    "7. Restart the server and SquadJS. Players download ModLoader and the item by themselves (about 4 MB).",
    "If the scoreboard lines do not arrive, the plugin falls back to the SquadJS data on its own.",
    "Epic Games players cannot join a modded server.",
]
VANILLA_STEPS = [
    "Install (SquadJS only, players download nothing)",
    "1. Copy smart-shuffle.js into SquadJS/squad-server/plugins/ (replace an older copy).",
    "2. Put the entry from config-entry.json into the \"plugins\" list of SquadJS config.json, replacing an",
    "   older SmartShuffle entry. Keep only one.",
    "3. Restart SquadJS. Type !smartshuffle status in admin chat to check it is running.",
]


def readme(name, version, entry, modloader):
    step, ttl, who = INFO[name]
    head = ("Modloader-" if modloader else "") + title(name)
    where = ("Step %d of 10. Step 1 gives the most even teams, every next step moves fewer players and keeps\n"
             "more friends together, for more stomped matches." % step) if step else "The plugin's built-in settings."
    lines = ["Smart Shuffle %s - %s (%s)" % (version, head, ttl), where, "", "For: " + who, ""]
    lines += sim_lines(name, modloader) + [""]
    lines += (MODLOADER_STEPS if modloader else VANILLA_STEPS) + [""]
    lines += ["Settings in this preset:"] + settings_lines(entry)
    lines += ["", "All presets and the full documentation: " + REPO, ""]
    return "\r\n".join(lines).replace("\n", "\r\n").replace("\r\r\n", "\r\n")


def write_zip(path, files):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for fname, data in files.items():
            zi = zipfile.ZipInfo(fname, date_time=STAMP)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data)


def main(version):
    out = ROOT / "releases" / ("v" + version)
    out.mkdir(parents=True, exist_ok=True)
    plugin = PLUGIN.read_bytes()
    paths = []
    allfiles = {"All-presets/smart-shuffle.js": plugin}
    for modloader in (False, True):
        for name in ORDER:
            zname = ("Modloader-" if modloader else "") + title(name)
            entry = entry_for(name, modloader)
            body = (json.dumps(entry, indent=2) + "\n").encode("utf-8")
            write_zip(out / (zname + ".zip"), {
                zname + "/smart-shuffle.js": plugin,
                zname + "/config-entry.json": body,
                zname + "/README.txt": readme(name, version, entry, modloader).encode("utf-8"),
            })
            paths.append(out / (zname + ".zip"))
            allfiles["All-presets/%s/%s.json" % ("modloader" if modloader else "vanilla", zname)] = body
    lines = ["Smart Shuffle %s - every preset" % version, "",
             "vanilla/<Name>.json: SquadJS only. modloader/Modloader-<Name>.json: SquadJS + ModLoader + the",
             "SmartShuffle Workshop item (see a Modloader-<Name>.zip README for the server steps).",
             "Copy smart-shuffle.js into SquadJS/squad-server/plugins/, put ONE entry into the \"plugins\" list",
             "of SquadJS config.json and restart SquadJS.", "", "Ladder (stomped matches average / players moved / parties kept whole):"]
    for name in ORDER:
        v, m = VANILLA[name], MODLOADER[name]
        lines.append("  %-9s vanilla %4.1f%% / %d%% / %d%%    modloader %4.1f%% / %d%% / %d%%" % (
            title(name), v[3], v[4], v[5], m[3], m[4], m[5]))
    lines += ["", "Full documentation: " + REPO, ""]
    allfiles["All-presets/README.txt"] = "\r\n".join(lines).encode("utf-8")
    write_zip(out / "All-presets.zip", allfiles)
    paths.append(out / "All-presets.zip")
    sums = []
    for p in paths:
        h = hashlib.sha256(p.read_bytes()).hexdigest()
        sums.append("%s  %s" % (h, p.name))
    (out / "sha256.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")
    print("\n".join(sums))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2.0.0")
