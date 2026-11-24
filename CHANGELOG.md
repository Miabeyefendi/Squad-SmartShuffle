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
`modloader-vX.Y.Z`. The preset zips of the SquadJS route use `presets-vX.Y.Z`. Since 2.0.0 there is one release, tagged `vX.Y.Z`, for all of them.

---

## [2.1.0] - 2026-11-24

### Added

- Switch tokens (`switchTokens`, off by default): in a locked round a player can change team by spending a token
  instead of being moved back. Every player has `tokenStart` (2), a spent one comes back after `tokenRefillHours`
  (24). Seeding earns lasting tokens: +1 after 15 minutes, +2 after 1 hour, +3 after 3 hours in a day
  (`tokenSeedMinutes`), up to `tokenMax` (5). A player away for `tokenDecayDays` (21) loses one earned token per
  period. Players type `!tokens` to see theirs; admins switch the system with `!smartshuffle tokens on/off`. Tokens
  are kept in `tokenFile`, the only thing the plugin writes to disk.
- Faster lock: while teams are locked the plugin reads the player list every `lockCheckSeconds` (5), so a switch is
  undone within seconds instead of about 30. Squad has no log line for a team change, so no plugin can stop it
  before it happens; this keeps the window short.
- Shuffle only when needed: `shuffleTicketGap` runs the automatic shuffle only after a round won by that many
  tickets, `shuffleWinStreak` only after the same group of players won that many rounds in a row (it follows the
  players, not the team number, across map changes). Both off by default; with both set either one is enough.
- Switch gate (`switchCommand`, off by default): players ask with `!switch` and the plugin moves them when it is
  allowed, so nobody switches and is sent back. In a locked round it costs a switch token (or is refused without
  tokens), the bigger team may end at most `switchMaxDiff` players ahead, and a request that cannot be done waits
  `switchQueueMinutes` for a free slot or a player switching the other way, then the two are swapped.
  `!switch cancel` leaves the queue.
- Whole squads (`moveSquads`, off by default): squads up to `maxPartySize` players stay together when shuffling,
  not only parties.
- Admin imbalance alert (`imbalanceAlertMinutes`, off by default): that many minutes into a match the admins online,
  and only they, are told when the score gap is above `imbalanceAlertGap` percent.
- Messages: the server is told at the start of a locked round that teams are locked (`announceLockStart`), and
  optionally when the lock ends (`announceLockEnd`); admins are told when an automatic shuffle is skipped and why
  (`reportSkips`); a player moved back is told whether he has switch tokens left.

### Changed

- Every switch setting now also takes `"on"`/`"off"`, every number also takes `"off"` (0) and `"on"` (1).
- The README download links point to the latest release, so they keep working after a new one.
- Hybrid route docs now use the version 2 form of `ModLoader.json` (`"rulesets": { "<path>": true }`). The older list form still works, ModLoader converts it.
- The hybrid ruleset was loaded on a local Windows dedicated server with ModLoader: it mounts and is added as a ruleset. The end of match dump itself still needs a played match to be checked.
- Simulation: the full scoreboard with session history, an Elo-like rating from earlier rounds' team results, and
  other prior, team share and lambda settings were tested. None went below about 10% stomped matches.

### Fixed

- Whole squads and parties when (almost) every player is in one: with `moveSquads` on and squads of up to 9 (the
  game's limit), or with parties and no `maxPartySize`, there were no free players left to trade with, so squads
  could be split or the teams left uneven. Kept groups are now balanced as whole units against each other (a squad
  of 9 for a squad of 8 or 9), with team sizes at most 1 apart where the squads allow it. The files of the 2.1.0
  release were replaced with the fixed plugin.

## [2.0.0] - 2026-11-24

### Changed

- One release for everything. The release **Smart Shuffle 2.0.0** holds every preset with a simple name:
  `Default.zip` (the plugin's own settings) and the ten ladder steps `Strict.zip`, `Tight.zip`, `Balanced.zip`,
  `Steady.zip`, `Calm.zip`, `Squads.zip`, `Relaxed.zip`, `Easy.zip`, `Together.zip` and `Light.zip` (SquadJS
  only), the same eleven as `Modloader-<Name>.zip` for the hybrid route (SquadJS + ModLoader + the SmartShuffle
  Workshop item), `All-presets.zip` and `smart-shuffle.js` (SquadJS 1.3.0). The Modloader presets were simulated
  too and land within about half a point of the vanilla ones.
- The separate SquadJS, Presets, Hybrid and ModLoader releases were removed; their git tags stay, so the
  versions below still point to their code. The ModLoader-only Blueprint route is still a recipe
  (`src/modloader/BP_SmartShuffle.md`) and has no download yet.

## [Presets 3.0.0] - 2026-11-24

### Changed

- Ten steps instead of five, `01-strict` to `10-light`, so each step differs clearly and every column moves one
  way only: stomped matches rise from 10.7% to 24.0%, players moved fall from 33% to 8%, and parties kept whole
  rise from 42% to 99% (step 1 now keeps duos). All ten count 8 earlier rounds of the session (12 hours) and use
  lock mode 2; only `maxPartySize` and `fewerMoves` change from step to step. `SmartShuffle-all-presets.zip`
  holds all ten. Same plugin as SquadJS 1.3.0.
- The README explains why stomped matches below about 10% were not reached: a split that knows every player's
  true ability gets 5.5 to 6% in the simulation, but every method that only sees match stats stayed at 9.5 to
  10.5% (longer or heavier history, history from other nights, the full scoreboard, direct rate balancing).

## [Presets 2.0.0] - 2026-11-24

### Changed

- The presets are now a ladder of five steps instead of five similar choices: `1-strict`, `2-balanced`,
  `3-relaxed`, `4-together` and `5-light`. Step 1 gives the most even teams, every next step moves fewer
  players and keeps more friend groups whole: from 10.7% stomped matches and 33% of players moved (step 1) to
  23.9% and 8% (step 5), against 29.3% and 50% for a random shuffle. Every zip holds the complete `config.json`
  entry (lock, parties, history, fewer moves); the new `SmartShuffle-all-presets.zip` holds all five. Needs
  SquadJS 1.3.0, which every zip includes.

## [SquadJS 1.3.0] - 2026-11-24

### Changed

- With `fewerMoves` on, kept friend groups now stay on the side they play on now instead of moving to the side of
  the balanced split. In the simulation this cuts the players moved with parties up to 4 kept from about 35% to
  26% at `0.1`, with the same share of stomped matches. With `fewerMoves` at `0` nothing changes.
- `fewerMoves` now goes up to `10` (was `1`): larger values move even fewer players for more stomped matches.

## [Presets 1.1.0] - 2026-11-24

### Changed

- Every preset now sets `fewerMoves` to `0.1` and ships the SquadJS 1.2.0 plugin: a shuffle moves 33 to 36% of
  the players instead of 50%, with the same share of stomped matches within noise in the simulation. The README
  table has a new "Players moved" column.

## [SquadJS 1.2.0] - 2026-11-24

### Added

- `fewerMoves` (default `0`, off): move fewer players. The plugin first swaps the two side labels when that saves
  moves, then moves players back to their current side in pairs while the balance stays within that share of the
  best split. Squad leaders and kept parties are not moved back. With `0.1` a shuffle moves about a third of the
  server instead of half (50% down to 33% in a simulation of 21,600 matches, and on the 20 reference matches of the
  tests), with the same share of stomped matches within noise. While `fewerMoves` is `0` the split is exactly the
  same as in 1.1.0.

## [Presets 1.0.0] - 2026-11-24

### Added

- Five ready-made preset zips for the SquadJS route, each with the unchanged `smart-shuffle.js`, a
  `config.json` entry and a short README: `friends-small` (duos and trios stay together), `friends-squad`
  (parties up to 6 stay together), `quality-max`, `quality-session` and `quality-fresh` (parties ignored,
  different session history). In a simulation of 21,600 matches per preset in three worlds, all five cut
  stomped matches from about 29% to 10 to 13%; the three quality presets beat the current default by 0.4 to
  1 point. Table and details in the README.

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

[2.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/v2.1.0
[2.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/v2.0.0
[Presets 3.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/presets-v3.0.0
[Presets 2.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/presets-v2.0.0
[SquadJS 1.3.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.3.0
[Presets 1.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/presets-v1.1.0
[SquadJS 1.2.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.2.0
[Presets 1.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/presets-v1.0.0
[Hybrid 0.2.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/hybrid-v0.2.0
[SquadJS 1.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.1.0
[SquadJS 1.0.1]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.0.1
[SquadJS 1.0.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.0.0
[Hybrid 0.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/hybrid-v0.1.0
[ModLoader 0.1.0]: https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/modloader-v0.1.0
