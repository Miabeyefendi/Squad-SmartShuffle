# Hybrid route: scoreboard dump (ModLoader ruleset) + SquadJS plugin

The math and the team moves stay in the SquadJS plugin (`src/squadjs/smart-shuffle.js`, the same file as the
SquadJS route). The ModLoader side has one job: when the match ends, write every player's full scoreboard
to the server log. The plugin reads those lines and switches to the full-data formula (v4a). If the lines
never arrive, it falls back to K6 (SquadJS log data only).

SquadJS entry in `config.json` (plugins list):

```json
{
  "plugin": "SmartShuffle",
  "enabled": true,
  "autoShuffle": false,
  "lockMode": 2,
  "useScoreboardDump": true,
  "dumpWaitSeconds": 10
}
```

## Log line format (what the plugin expects)

One line per entry in the server log. Unreal may put its own prefix in front
(`[time][frame]LogXxx: ...`); the plugin reads everything after the word `SmartShuffleDump`.

```
SmartShuffleDump BEGIN
SmartShuffleDump P eos=<EOS ID> k=<kills> w=<wounds dealt> d=<deaths> tk=<teamkills> r=<revives> h=<healing> dmg=<damage> s=<suppression dealt> sr=<suppression received> a=<ammo supplied> c=<construction supplied> m=<markers> ts=<tactical support> cap=<captures> capn=<neutralizations> ct=<capture ticks> dt=<defense ticks> name=<player name>
SmartShuffleDump END
```

- Key order does not matter. A missing key counts as 0 (or keeps the value SquadJS counted itself).
  `cap` and `capn` add up. `min=<minutes>` is accepted too; without it the plugin uses its own playtime count.
- `name=` always comes last, since names can contain spaces.
- The plugin looks for a 32 digit EOS ID inside `eos=`; `EOS:...`, a list, or the bare ID all work. Without
  one, the player is matched by name.
- v4a is used when at least 80% of the players on the server are in the dump.

## Blueprint: BP_SmartShuffleDump

Mod `SmartShuffle` in the Squad SDK, Blueprint `Plugins\Mods\SmartShuffle\Content\BP_SmartShuffleDump`, parent
class `SQGameRuleSet`. The graph as built (96 nodes):

1. Event: `On End Match` (SQGameRuleSet override).
2. `Log Error` (SQBlueprintLibrary) with "SmartShuffleDump BEGIN". `Log Error` is used instead of
   `Print String` because `Print String` is marked Development Only and is compiled out of Shipping builds.
3. `Get Game State` -> `Player Array` -> `For Each Loop` -> `Cast To SQPlayerState`. Players that fail the cast
   are skipped. Spectators are not filtered here; the plugin ignores records it cannot match to a team player.
4. Per-player values:

   | Key | Node |
   |---|---|
   | eos | `Get Player Online Id` |
   | k, w, d, tk | `Get Num Kills`, `Get Num Wounded`, `Get Num Deaths`, `Get Num Team Kills` |
   | r, h, dmg, s, sr, a, c | `SQStatsCollectorSubsystem` -> `Get Stat` (Revives, Healing, DamageInflicted, SuppressionInflicted, SuppressionReceived, AmmoSupplied, ConstructionSupplied) |
   | m, ts | `Get Stat` (PlacedSupportRequests, SentTacticalSupport) |
   | cap, capn | `Get Stat` (ObjectiveCapture, ObjectiveNeutralize) |
   | ct, dt | `Get Stat` (ObjectiveCaptureTick, ObjectiveDefenseTick) |
   | name | `Get Only Player Name` |

   `Get Stat` is an impure call with a by-ref `Stat Type`, so every call is chained on the exec line and fed by
   an enum literal node. `Player Index` comes from the PlayerState's `Get Player ID` (not verified yet, see below).
   Numbers go through `To String (Integer)` / `To String (Integer64)`, the line is built with a chain of `Append`.
5. `Log Error` with the finished "SmartShuffleDump P ..." line, once per player.
6. After the loop (`Completed`), `Log Error` with "SmartShuffleDump END".

Register it with ModLoader: in `SquadGame/Saved/ModLoader/ModLoader.json` (version 2) add
`"/SmartShuffle/BP_SmartShuffleDump.BP_SmartShuffleDump_C": true` under `rulesets`. An older list form
(`"rulesets": [ "..." ]`) is converted automatically and the file is rewritten. Actor mods such as SquadJSLogger
(`/SquadJSLogger/BP_SquadJSLogger.BP_SquadJSLogger_C`) go under `mods`, not `rulesets`: ModLoader reports
`Failed to cast to ruleset` otherwise. Put the `ModLoader_v1` layer first in the rotation.

Checked on a local Windows dedicated server (2026-11-22, Squad 10.6): the mod mounts, ModLoader logs
`Loaded Actor Class:BP_SmartShuffleDump_C` and `Added modded Ruleset:BP_SmartShuffleDump_C`. The dump itself
(the end of match lines) is still unchecked, it needs a played match.

## Check on the first test server (not verified yet)

1. Do the `Log Error` lines reach the server log? They should appear as `LogSquad: Error: SmartShuffleDump ...`
   (the plugin accepts any log category in front of the word).
2. Is `player_index` for `Get Stat` the same as `Player Id`? Check: for one player, `Get Stat (KILLS)` and
   `Get Num Kills` must give the same number. If they do not, dump `Get Player Stats String (player_index)`
   and compare.
3. Are the lines written before or after the `ROUND_ENDED` event SquadJS sees? The plugin waits
   `dumpWaitSeconds`; raise it if the dump arrives late.
4. Does `Get Player Online Id` contain the 32 digit EOS ID? If not, players are matched by name, which also works.
