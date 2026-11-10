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

## [SquadJS 1.1.0] - 2026-11-11

### Added

- Session history: each player's last rounds of the same session are counted together with the match that
  just ended (`historyRounds`, default 4, `historyHours`, default 6). Kept in memory only, nothing is written to
  disk. In the simulation stomped matches drop from 10.3% to 9.5%.
- `!smartshuffle preview` shows what a shuffle would do without moving anyone, `!smartshuffle cancel` calls off a
  queued shuffle.
- Friend keeping is its own switch (`keepParties`, `!smartshuffle friends on/off`) with a size cap
  (`maxPartySize`, default 4): bigger parties are split like everyone else.
- Automatic shuffles skip Seed, Jensen's Range and Invasion layers (`skipLayers`) and servers under
  `minPlayers` (default 40). `!smartshuffle now` always runs.
- Messages, each with its own switch: a notice while a shuffle is due (`announceMinutes`), a private message to
  every moved player (`warnMovedPlayers`), the result for the server (`broadcastResult`) and a report for the
  admins online (`adminReport`).
- Optional, off by default and experimental: an all-time rating from MySquadStats blended into the score
  (`useMySquadStats`, `mySquadStatsToken`, `mySquadStatsWeight`).
- Step-by-step guide and a simulation chart in the README.

### Changed

- Players are only moved on the end screen, right after the round ends, and never once the next map has
  started. The optional scoreboard wait (`shuffleDelaySeconds`) shortens itself so the moves finish in time.
- After the moves the plugin reads the teams back and repeats a team change that did not land.
  `!smartshuffle status` shows how many players were moved and how many could not be placed.
- With friends kept together, the balance repair now evens out every dimension, not only the score sum. In the
  party simulation stomped matches drop from 13.8% to 11.1%.

### Fixed

- The lock follows the team numbers when the game swaps them at a map change. Before, it could move players
  back in the first minute of the next match.
- One failed team change command no longer stops the rest of the shuffle.

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
[SquadJS 1.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.1.0
[SquadJS 1.0.1]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.0.1
[SquadJS 1.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.0.0
[Hybrid 0.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/hybrid-v0.1.0
[ModLoader 0.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/modloader-v0.1.0
