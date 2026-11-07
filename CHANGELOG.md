<!--
================================================================================
CHANGELOG TEMPLATE - Miabeyefendi (https://github.com/Miabeyefendi)

RULES
  1. Newest release on top. Never rewrite a released entry.
  2. Dates are ISO, YYYY-MM-DD, and are the real publish date.
  3. Versions follow semantic versioning: MAJOR.MINOR.PATCH.
       MAJOR - something that used to work now works differently
       MINOR - new capability, nothing broken
       PATCH - fix only
  4. Only these six group headings, always in this order. Delete the empty ones.
       Added · Changed · Fixed · Removed · Deprecated · Security
  5. Write for the person using the software, not for the person who wrote it.
     "Volume tooltip no longer sticks after a track change" beats
     "refactor volume handler".
  6. Single language. This file stays English, like commit messages.
  7. Link each version number to its release page.
================================================================================
-->

# Changelog

All notable changes to **Squad-SmartShuffle** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

[English](./CHANGELOG.md) · [README](./README.md)

The three routes are released separately, each with its own tag: `squadjs-vX.Y.Z`, `hybrid-vX.Y.Z` and
`modloader-vX.Y.Z`.

---

## [Hybrid 0.2.0] - 2026-11-07

### Added

- The dump ruleset is built and published on the Steam Workshop as
  [SmartShuffle](https://steamcommunity.com/sharedfiles/filedetails/?id=3835528773) (ID 3835528773), with
  ModLoader as a required item. Packaged for Windows and Windows servers.

### Changed

- The ruleset writes its lines with `Log Error` instead of `Print String`, which is compiled out of Shipping
  builds. Captures and neutralizations are written as separate keys (`cap`, `capn`).

---

## [SquadJS 1.0.1] - 2026-11-07

### Fixed

- Scoreboard dump lines with both `cap` and `capn` now add the two together instead of keeping only the last one.

---

## [SquadJS 1.0.0] - 2026-11-07

### Added

- SquadJS plugin `smart-shuffle.js`: rates every player from the match that just ended and splits the teams
  evenly at round end.
- Scores from kills, wounds, deaths, damage, revives, deployables and playtime, with separate weights for
  squad leaders, medics and support players; every teamkill costs 10%.
- Balance on total strength plus each sub-area, per-minute rates and kit counts (medic, vehicle crew).
- Squad leaders split evenly in three groups: vehicle SLs, small locked squads, open squads.
- One round lock after a shuffle: players who switch or reconnect to switch are moved back and warned.
- Lock mode 2 keeps every party on one side.
- Admin chat command `!smartshuffle` with `now`, `auto on/off`, `lock 0/1/2`, `unlock` and `status`.

---

## [Hybrid 0.1.0] - 2026-11-07

### Added

- Log format and Blueprint recipe for `BP_SmartShuffleDump`, a ModLoader ruleset that writes the full
  scoreboard to the server log at match end.
- The SquadJS plugin reads the dump with `useScoreboardDump` and switches to the full scoreboard formula;
  without the dump it falls back to SquadJS data.

---

## [ModLoader 0.1.0] - 2026-11-07

### Added

- Blueprint recipe for `BP_SmartShuffle`, the in-game version with no SquadJS: scoring, balancing, settings
  through custom server options, and the lock.

---

<!-- Keep this link block at the bottom and add one line per release. -->

[Hybrid 0.2.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/hybrid-v0.2.0
[SquadJS 1.0.1]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.0.1
[SquadJS 1.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.0.0
[Hybrid 0.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/hybrid-v0.1.0
[ModLoader 0.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/modloader-v0.1.0
