# ModLoader route: BP_SmartShuffle (Blueprint only)

Scoring, balancing and the lock all run inside the game, no SquadJS. Formula v4a (full scoreboard), balance
lambda 0.5. This file is a node recipe. Every function has a tested counterpart with the same name in
`src/squadjs/smart-shuffle.js`, which gives exactly the same teams as the reference model. Follow that JS
function line by line while building the Blueprint.

The hybrid route gives the same formula with far less Blueprint work (`src/hybrid/`). This route is for
servers that do not run SquadJS.

## Class and registration

- New Blueprint, parent class `SQGameRuleSet`, name `BP_SmartShuffle`, in `Plugins\Mods\ShuffleTeams\Content\`.
- ModLoader: add `/ShuffleTeams/BP_SmartShuffle.BP_SmartShuffle_C` to the "rulesets" list in
  `Saved/ModLoader/ModLoader.json`.

## Settings (`SQBlueprintLibrary`)

| Setting | Node | Default |
|---|---|---|
| `SmartShuffle_Auto` | `Get Custom Server Setting As Bool` | false |
| `SmartShuffle_Now` | `Get Custom Server Setting As Int` (fires once when the value changes) | 0 |
| `SmartShuffle_Lock` | `Get Custom Server Setting As Int` (0, 1, 2) | 2 |

Admin: `AdminSetCustomOption SmartShuffle_Now 1` (a new number every time).

## Variables

Per-player arrays (same index = same player): `PS` (SQPlayerState), `Team` (int 0/1), `SL` (bool),
`Role` (int: 1 medic, 2 logistics, 3 vehicle crew, 0 other), `SLGroup` (int: 0 vehicle SL, 1 locked small
squad SL, 2 open SL), `Party` (string), and the stats (float): Kills, Knocks, Deaths, Revives, Heal, Damage,
Supp, SuppRecv, Ammo, Constr, Markers, Support, Caps, CTicks, DTicks, TK, Minutes.

## Flow

1. `On End Match`:
   - Trigger: `Auto` is on, or `Now` differs from the last value seen. Otherwise stop. Remember `Now`.
   - Collect: `Get Game State` -> `Player Array`, for every `SQPlayerState` on team 1 or 2, the stats with the
     same nodes as the table in `src/hybrid/BP_SmartShuffleDump.md`.
     `SL` = `Is Squad Leader`. `Role`: name of `Get Current Role` contains "Medic" -> 1, "Crewman"/"Pilot" -> 3.
     `SLGroup`: SL with Role 3 -> 0; `Get Squad State` locked (`Is Locked`) with 3 or fewer members -> 1; else 2.
     `Party` = `Get Party Id`.
   - Compute: `BuildScores` -> `KitRows` -> `BalanceMulti` (lambda 0.5) -> `KeepGroups` when the lock is 2.
   - Apply: for every player whose team changes, `Get Game Mode` -> `Cast To SQGameMode` ->
     `Try To Change Players Team (player = PS's Controller, team_id = Team+1, force_change = true)`.
   - Announce with `Send Chat Message`.
   - If the lock is on, leave a "next round is locked" flag (see below, not verified).
2. `Match Started` (new map): if the flag is set, write every player's current team into a `LockTeam` map
   (PlayerState -> team). Teams at this point are the shuffle result, so no list has to be carried over.
3. `Player Joined Team (player, team_index)`: if the player is in `LockTeam` and `team_index` differs,
   `Try To Change Players Team (..., LockTeam value, force_change = true)` and `Send Chat Message`.
4. At round end (`On End Match`) clear `LockTeam` first, then step 1 decides on a new shuffle.

## Functions (same names in the JS file)

- `ZLogistic(array) -> array`: mean, standard deviation (divide by n), z = (x - mean) / (sd + 1e-9),
  clamp to [-3, 3], 1 / (1 + exp(-1.7 z)), floor 0.05.
- `GroupScores(player indexes)`: for every sub-area m0 = total / total minutes, rate = (x + 30 m0) /
  (minutes + 30), `ZLogistic(log(1 + 30 rate))`. KDA = (kills + knocks + revives + 1) / (deaths + 2),
  `ZLogistic(log(KDA + 0.001))`. Logistics sub-area = ammo + construction.
- `BuildScores`: `GroupScores` over the whole server and inside the player's own team, mixed half and half.
  Categories: Combat (kills .40, knocks .20, damage .25, suppression .15), Teamwork (others: revives .40,
  heal .30, logistics .30; SL: revives .15, heal .10, logistics .15, markers .35, support .25; in both cases
  the best single support sub-area wins if it beats the weighted mean), Objective (captures .30, ticks .45,
  defense .25). Weights: others .25 x 4, soft role (shifts toward .12/.10/.53/.25 by how much support beats
  combat), medic .15/.10/.50/.25, logistics .10/.10/.55/.25, SL .15/.15/.30/.40.
  P = exp(sum of weight * log(category)) * max(0, 1 - 0.1 * TK).
- `KitRows`: 0/1 rows for medic, logistics and vehicle crew.
- `ShuffleSum`: SLs split evenly group by group (0, 1, 2), the rest by P descending to the side with fewer
  players (or the lower sum), then best pair swaps until the gap is under 0.3%.
- `BalanceMulti`: start from `ShuffleSum`; at every step, for each non-SL pair (a, b), cost =
  |P gap| / total P + lambda * mean(|dimension gap| / dimension total); stop when the best cost does not beat
  the current one, at most 100 steps.
- `KeepGroups`: every party moves to the side where most of it already is, the closest-P player outside any
  group moves the other way; then sums are evened out with swaps among non-SL players outside groups only.

Nested loops over arrays in Blueprint (50 x 50 pairs x 15 dimensions x 100 steps on a full server) can be
slow. It runs once, on the end-of-match screen; if it stalls, lower the `BalanceMulti` step limit to 30.

## Not verified yet

- How the "next round is locked" flag survives the map change. The ruleset is recreated on every map.
  Candidate: `Execute Console Command` with `AdminSetCustomOption SmartShuffle_LockNext 1`, read on the new
  map. If that does not work: with Auto on, treat every round as locked (Auto shuffles every round anyway);
  only a lock after an admin-triggered shuffle cannot be carried.
- Whether `Try To Change Players Team` works on the end-of-match screen and the teams carry to the next map.
- Whether `player_index` for `Get Stat` equals `Player Id` (same test as in the hybrid file).
- Whether `Player Joined Team` fires for both admin moves and player switches.
