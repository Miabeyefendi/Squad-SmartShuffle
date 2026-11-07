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
SmartShuffleDump P eos=<EOS ID> k=<kills> w=<wounds dealt> d=<deaths> r=<revives> h=<healing> dmg=<damage> s=<suppression dealt> sr=<suppression received> a=<ammo supplied> c=<construction supplied> m=<markers> ts=<tactical support> cap=<captures+neutralizations> ct=<capture ticks> dt=<defense ticks> tk=<teamkills> min=<minutes played> name=<player name>
SmartShuffleDump END
```

- Key order does not matter. A missing key counts as 0 (or keeps the value SquadJS counted itself).
- `name=` always comes last, since names can contain spaces.
- The plugin looks for a 32 digit EOS ID inside `eos=`; `EOS:...`, a list, or the bare ID all work. Without
  one, the player is matched by name.
- v4a is used when at least 80% of the players on the server are in the dump.

## Blueprint recipe: BP_SmartShuffleDump

In the Squad SDK, create a new Blueprint under `Plugins\Mods\ShuffleTeams\Content\` with parent class
`SQGameRuleSet`.

1. Event: `On End Match` (SQGameRuleSet).
2. `Print String` ("SmartShuffleDump BEGIN"). Print to Screen OFF, Print to Log ON.
3. `Get Game State` -> `Player Array` -> `For Each Loop`. `Cast To SQPlayerState` for each element.
   Skip it when `Team Id` is not 1 or 2.
4. Per-player values:

   | Key | Node |
   |---|---|
   | eos | `Get Player Online Id` (or `Get Player All Online IDs`) |
   | k | `Get Num Kills` |
   | w | `Get Num Wounded` |
   | d | `Get Num Deaths` |
   | tk | `Get Num Team Kills` |
   | r, h, dmg, s, sr, a, c | `SQStatsCollectorSubsystem` -> `Get Stat` (REVIVES, HEALING, DAMAGE_INFLICTED, SUPPRESSION_INFLICTED, SUPPRESSION_RECEIVED, AMMO_SUPPLIED, CONSTRUCTION_SUPPLIED) |
   | m, ts | `Get Stat` (PLACED_SUPPORT_REQUESTS, SENT_TACTICAL_SUPPORT) |
   | cap | `Get Stat` (OBJECTIVE_CAPTURE) + `Get Stat` (OBJECTIVE_NEUTRALIZE) |
   | ct, dt | `Get Stat` (OBJECTIVE_CAPTURE_TICK, OBJECTIVE_DEFENSE_TICK) |
   | min | (current time - `SQTeamworkStatsCollector.Get Player Join Time`) / 60 |
   | name | `Get Only Player Name` |

   `player_index` for `Get Stat`: the PlayerState's `Player Id` (not verified yet, see below).
   `SQStatsCollectorSubsystem`: `Get Game Instance Subsystem` node, class SQStatsCollectorSubsystem.
5. Build the line with `Append`: "SmartShuffleDump P eos=" + eos + " k=" + k + ... + " name=" + name, then
   `Print String` (log only).
6. After the loop, `Print String` ("SmartShuffleDump END").

Register it with ModLoader: add `/ShuffleTeams/BP_SmartShuffleDump.BP_SmartShuffleDump_C` to the "rulesets"
list in `Saved/ModLoader/ModLoader.json` (SquadJSLogger uses the same form:
`/SquadJSLogger/BP_SquadJSLogger.BP_SquadJSLogger_C`).

## Check on the first test server (not verified yet)

1. Does `Print String` reach the server log? Print String can be compiled out of Shipping builds. If it does
   not show up, use the log node SquadJSLogger uses (that mod does write to the server log).
2. Is `player_index` for `Get Stat` the same as `Player Id`? Check: for one player, `Get Stat (KILLS)` and
   `Get Num Kills` must give the same number. If they do not, dump `Get Player Stats String (player_index)`
   and compare.
3. Are the lines written before or after the `ROUND_ENDED` event SquadJS sees? The plugin waits
   `dumpWaitSeconds`; raise it if the dump arrives late.
4. Does `Get Player Online Id` contain the 32 digit EOS ID? If not, players are matched by name, which also works.
