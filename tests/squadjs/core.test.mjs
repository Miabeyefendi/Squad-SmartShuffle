// Tests for src/squadjs/smart-shuffle.js. Run: node --test tests/squadjs/
// golden.json holds inputs and outputs of the offline reference model (20 simulated 100 player matches).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../../src/squadjs/smart-shuffle.js');

// the plugin imports ./base-plugin.js from SquadJS; load it next to a minimal stand-in
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-shuffle-'));
fs.copyFileSync(SRC, path.join(dir, 'smart-shuffle.js'));
fs.writeFileSync(
  path.join(dir, 'base-plugin.js'),
  'export default class BasePlugin {\n' +
    '  constructor(server, options) {\n' +
    '    this.server = server;\n' +
    '    this.options = {};\n' +
    '    for (const [k, o] of Object.entries(this.constructor.optionsSpecification))\n' +
    '      this.options[k] = options && k in options ? options[k] : o.default;\n' +
    '  }\n' +
    '  verbose() {}\n' +
    '}\n'
);
const mod = await import(pathToFileURL(path.join(dir, 'smart-shuffle.js')).href);
const { planTeams, keepGroups, parseListPlayers, parseDumpLine } = mod;
const SmartShuffle = mod.default;

const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'golden.json'), 'utf8'));

function closeArrays(a, b, tol, label) {
  assert.equal(a.length, b.length, label);
  for (let i = 0; i < a.length; i++) {
    assert.ok(Math.abs(a[i] - b[i]) <= tol * Math.max(1, Math.abs(b[i])), `${label} [${i}] ${a[i]} vs ${b[i]}`);
  }
}

test('K6 scores and teams match the Python reference', () => {
  golden.cases.forEach((c, n) => {
    const { P, team } = planTeams(c.visible, 'k6', c.slGroups);
    closeArrays(P, c.k6.P, 1e-9, `case ${n} P`);
    assert.deepEqual(team, c.k6.team, `case ${n} team`);
  });
});

test('v4a scores and teams match the Python reference', () => {
  golden.cases.forEach((c, n) => {
    const { P, team } = planTeams(c.full, 'v4a', c.slGroups);
    closeArrays(P, c.v4a.P, 1e-9, `case ${n} P`);
    assert.deepEqual(team, c.v4a.team, `case ${n} team`);
  });
});

test('group keeping (friends on) matches the Python reference', () => {
  golden.cases.forEach((c, n) => {
    const t = planTeams(c.visible, 'k6', c.slGroups, c.groups).team;
    assert.deepEqual(t, c.keep, `case ${n} k6`);
    for (const g of c.groups) assert.equal(new Set(g.map((i) => t[i])).size, 1, `case ${n} group split`);
    assert.deepEqual(planTeams(c.full, 'v4a', c.slGroups, c.groups).team, c.keepV4a, `case ${n} v4a`);
    // without the extra dimensions the repair evens out the score sum only
    assert.deepEqual(keepGroups(c.k6.team, c.k6.P, c.groups, c.visible.sl), c.keepSum, `case ${n} sum`);
  });
});

test('teams stay within one player of each other', () => {
  for (const c of golden.cases) {
    const { team } = planTeams(c.visible, 'k6', c.slGroups);
    const ones = team.filter((t) => t === 1).length;
    assert.ok(Math.abs(team.length - 2 * ones) <= 1);
  }
});

test('ListPlayers parsing with and without Party ID and Vehicle', () => {
  const eosA = '0002a10186d9414496bf20d22d3860ba';
  const eosB = '0002b20186d9414496bf20d22d3860bb';
  const text = [
    '----- Active Players -----',
    `ID: 3 | Online IDs: EOS: ${eosA} steam: 76561198000000001 | Name: Some Name | Team ID: 1 | Party ID: 7a3f | Squad ID: 2 | Is Leader: True | Role: USA_SLCrewman_01 | Vehicle: M1A2`,
    `ID: 4 | Online IDs: EOS: ${eosB} steam: 76561198000000002 | Name: Other | Team ID: 2 | Squad ID: N/A | Is Leader: False | Role: RGF_Medic_01`,
    'ID: 5 | Online IDs: EOS: 0002c3 | Name: Loading | Team ID: N/A | Squad ID: N/A | Is Leader: False | Role: ',
    '----- Recently Disconnected Players [Max of 15] -----'
  ].join('\n');
  const p = parseListPlayers(text);
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], {
    eosID: eosA, name: 'Some Name', teamID: 1, partyID: '7a3f', squadID: 2, isLeader: true, role: 'USA_SLCrewman_01'
  });
  assert.equal(p[1].partyID, null);
  assert.equal(p[1].squadID, null);
  assert.equal(p[1].role, 'RGF_Medic_01');
});

test('scoreboard dump line parsing', () => {
  const r = parseDumpLine('P eos=00ab k=12 w=20 d=5 h=300.5 cap=2 min=44.5 name=A Name With Spaces');
  assert.equal(r.eosID, '00ab');
  assert.equal(r.name, 'A Name With Spaces');
  assert.deepEqual(r.stats, { kills: 12, knocks: 20, deaths: 5, heal: 300.5, caps: 2, minutes: 44.5 });
  assert.equal(parseDumpLine('P eos=- k=1 name=X').eosID, null);
  const eos = '0002a10186d9414496bf20d22d3860ba';
  assert.equal(parseDumpLine(`P eos=EOS:${eos},steam:7656 k=1 name=X`).eosID, eos);
  assert.equal(parseDumpLine('P eos=- cap=2 capn=3 name=X').stats.caps, 5);
});

// ---- plugin flow against a fake SquadJS server ----

function fakeServer(players) {
  const server = new EventEmitter();
  server.players = players.map((p) => ({ ...p }));
  server.calls = [];
  server.rules = [];
  server.logParser = { getRules: () => server.rules };
  server.updatePlayerList = async () => {};
  const line = (p) =>
    `ID: 1 | Online IDs: EOS: ${p.eosID} | Name: ${p.name} | Team ID: ${p.teamID}` +
    (p.partyID ? ` | Party ID: ${p.partyID}` : '') +
    ` | Squad ID: ${p.squadID ?? 'N/A'} | Is Leader: ${p.isLeader ? 'True' : 'False'} | Role: ${p.role}`;
  server.rcon = {
    execute: async (cmd) => {
      server.calls.push(cmd);
      return cmd === 'ListPlayers' ? server.players.map(line).join('\n') : '';
    },
    getSquads: async () => [[], [0, 0]],
    switchTeam: async (id) => {
      server.calls.push(`switch ${id}`);
      const p = server.players.find((x) => x.eosID === id);
      p.teamID = p.teamID === 1 ? 2 : 1;
    },
    warn: async (id, msg) => server.calls.push(`warn ${id} ${msg}`),
    broadcast: async (msg) => server.calls.push(`broadcast ${msg}`)
  };
  return server;
}

function makePlayers() {
  // team 1 gets every strong player, team 2 every weak one
  const out = [];
  for (let i = 0; i < 20; i++) {
    out.push({
      eosID: `e${String(i).padStart(2, '0')}`,
      name: `P${i}`,
      teamID: i < 10 ? 1 : 2,
      squadID: 1 + (i % 4),
      isLeader: i % 10 === 0,
      role: i % 5 === 1 ? 'USA_Medic_01' : 'USA_Rifleman_01'
    });
  }
  return out;
}

async function playMatch(server) {
  for (let tick = 0; tick < 3; tick++) await server.listeners('UPDATED_PLAYER_INFORMATION')[0]();
  for (const p of server.players) {
    const strong = p.teamID === 1;
    for (let k = 0; k < (strong ? 12 : 2); k++) {
      const victim = server.players.find((x) => x.teamID !== p.teamID);
      server.emit('PLAYER_WOUNDED', { attacker: p, victim, teamkill: false });
      server.emit('PLAYER_DIED', { attacker: p, victim, teamkill: false });
      server.emit('PLAYER_DAMAGED', { attacker: p, victim, damage: 100, teamkill: false });
    }
  }
}

test('plugin: auto shuffle moves players at round end, lock moves a switcher back, unlock lifts it', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true, lockMode: 1, minPlayers: 0 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  await plugin.onRoundEnded();
  const switches = server.calls.filter((c) => c.startsWith('switch'));
  assert.ok(switches.length > 0, 'nobody moved');
  assert.equal(server.players.filter((p) => p.teamID === 1).length, 10);
  assert.ok(server.calls.some((c) => c.startsWith('broadcast Smart Shuffle')));

  // a player switches by himself during the locked round: moved back and warned
  const runner = server.players[3];
  const want = runner.teamID;
  runner.teamID = want === 1 ? 2 : 1;
  await plugin.onPlayerInfo();
  assert.equal(runner.teamID, want);
  assert.ok(server.calls.some((c) => c === `warn ${runner.eosID} Smart Shuffle: team changes are locked until this round ends.`));

  // admin lifts the lock: the next switch stays
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'unlock', eosID: 'admin' });
  runner.teamID = want === 1 ? 2 : 1;
  await plugin.onPlayerInfo();
  assert.notEqual(runner.teamID, want);
  await plugin.unmount();
});

test('plugin: no shuffle without auto or now; now runs once; lock ends at the next round end', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: false, lockMode: 1 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  await plugin.onRoundEnded();
  assert.equal(server.calls.filter((c) => c.startsWith('switch')).length, 0);

  server.emit('NEW_GAME', {});
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'now', eosID: 'admin' });
  await plugin.onCommand({ chat: 'ChatAll', message: 'auto on', eosID: 'someone' });
  assert.equal(plugin.auto, false, 'non-admin chat must be ignored');
  await playMatch(server);
  await plugin.onRoundEnded();
  assert.ok(server.calls.filter((c) => c.startsWith('switch')).length > 0);
  assert.ok(plugin.lock);

  server.emit('NEW_GAME', {});
  await plugin.onRoundEnded();
  assert.equal(plugin.lock, null, 'lock must end at the next round end');
  await plugin.unmount();
});

test('plugin: lock mode 2 keeps a party on one side', async () => {
  const players = makePlayers();
  for (const i of [2, 3, 12, 13]) players[i].partyID = 'p1';
  const server = fakeServer(players);
  const plugin = new SmartShuffle(server, { autoShuffle: true, lockMode: 2, minPlayers: 0 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  await plugin.onRoundEnded();
  const sides = new Set(server.players.filter((p) => p.partyID === 'p1').map((p) => p.teamID));
  assert.equal(sides.size, 1);
  await plugin.unmount();
});

test('plugin: hybrid dump switches to v4a when the dump covers the players', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true, useScoreboardDump: true, dumpWaitSeconds: 1, minPlayers: 0 });
  await plugin.mount();
  assert.equal(server.rules.length, 1);
  server.emit('NEW_GAME', {});
  await playMatch(server);
  const rule = server.rules[0];
  const feed = (body) => {
    const m = `[2026.11.07-10.00.00:000][123]LogSquad: SmartShuffleDump ${body}`.match(rule.regex);
    assert.ok(m, body);
    rule.onMatch(m);
  };
  feed('BEGIN');
  for (const p of server.players) feed(`P eos=${p.eosID} k=3 w=4 d=2 cap=${p.teamID === 2 ? 5 : 0} min=40 name=${p.name}`);
  feed('END');
  const logs = [];
  plugin.verbose = (lvl, msg) => logs.push(msg);
  await plugin.onRoundEnded();
  assert.ok(logs.some((l) => l.startsWith('Shuffled with v4a')), logs.join('\n'));
  await plugin.unmount();
  assert.equal(server.rules.length, 0);
});

// ---- party size cap, skip rules, preview, move check ----

// every player of the party is a strong player of team 1, so a balanced plan has to cut the party in two
// unless it is kept together
function bigPartyPlayers() {
  const players = makePlayers();
  for (const i of [1, 2, 3, 4, 5, 6]) players[i].partyID = 'big';
  return players;
}

async function runRound(options, players = makePlayers(), prepare = () => {}) {
  const server = fakeServer(players);
  prepare(server);
  const plugin = new SmartShuffle(server, { autoShuffle: true, lockMode: 2, minPlayers: 0, ...options });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  await plugin.onRoundEnded();
  return { server, plugin };
}

test('plugin: maxPartySize keeps small parties together and splits bigger ones', async () => {
  const sides = (server) => new Set(server.players.filter((p) => p.partyID === 'big').map((p) => p.teamID)).size;
  const capped = await runRound({ maxPartySize: 4 }, bigPartyPlayers());
  assert.equal(sides(capped.server), 2, 'a party of 6 over the cap of 4 must be split');
  const wide = await runRound({ maxPartySize: 6 }, bigPartyPlayers());
  assert.equal(sides(wide.server), 1, 'a party of 6 within the cap of 6 stays together');
  const none = await runRound({ maxPartySize: 0 }, bigPartyPlayers());
  assert.equal(sides(none.server), 1, '0 means no limit');
});

test('plugin: auto shuffle skips small servers and skipped layers, an admin now does not', async () => {
  const switched = (server) => server.calls.filter((c) => c.startsWith('switch')).length;

  const small = await runRound({ minPlayers: 40 });
  assert.equal(switched(small.server), 0, '20 players is under the default minimum of 40');

  const invasion = await runRound({}, makePlayers(), (s) => {
    s.currentLayer = { name: 'Narva Invasion v1', classname: 'Narva_Invasion_v1', gamemode: 'Invasion' };
  });
  assert.equal(switched(invasion.server), 0, 'invasion is skipped by default');

  const seed = await runRound({}, makePlayers(), (s) => {
    s.currentLayer = { name: 'Jensen Training Range', classname: 'JensensRange_ADF-US' };
  });
  assert.equal(switched(seed.server), 0, 'jensen is skipped by default');

  const raas = await runRound({}, makePlayers(), (s) => {
    s.currentLayer = { name: 'Narva RAAS v1', classname: 'Narva_RAAS_v1', gamemode: 'RAAS' };
  });
  assert.ok(switched(raas.server) > 0, 'RAAS is shuffled');

  const custom = await runRound({ skipLayers: 'raas' }, makePlayers(), (s) => {
    s.currentLayer = { name: 'Narva RAAS v1', classname: 'Narva_RAAS_v1' };
  });
  assert.equal(switched(custom.server), 0, 'skipLayers accepts a comma separated string');

  // an admin "now" ignores both rules
  const server = fakeServer(makePlayers());
  server.currentLayer = { name: 'Narva Invasion v1' };
  const plugin = new SmartShuffle(server, { autoShuffle: false, minPlayers: 40 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'now', eosID: 'admin' });
  await playMatch(server);
  await plugin.onRoundEnded();
  assert.ok(switched(server) > 0, 'now must run on an invasion layer with few players');
});

test('plugin: preview changes nothing and answers the admin', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true });
  const logs = [];
  plugin.verbose = (lvl, msg) => logs.push(msg);
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  const before = server.players.map((p) => p.teamID).join('');
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'preview', eosID: 'admin' });
  assert.equal(server.players.map((p) => p.teamID).join(''), before, 'preview must not move anyone');
  assert.equal(server.calls.filter((c) => c.startsWith('switch') || c.startsWith('broadcast')).length, 0);
  const reply = server.calls.find((c) => c.startsWith('warn admin Smart Shuffle preview'));
  assert.ok(reply && /\d+ of 20 would move, score gap \d+% -> \d+%/.test(reply), reply);
  assert.ok(logs.some((l) => l.startsWith('Preview moves')), 'names go to the log');
  assert.equal(plugin.lock, null);
  await plugin.unmount();
});

test('plugin: a lost team change is repeated, one that never lands is reported', async () => {
  // the first command is swallowed once
  const lost = await runRound({ lockMode: 1 }, makePlayers(), (s) => {
    const real = s.rcon.switchTeam;
    let dropped = false;
    s.rcon.switchTeam = async (id) => {
      if (!dropped) {
        dropped = true;
        s.calls.push(`switch ${id} (lost)`);
        return;
      }
      await real(id);
    };
  });
  assert.equal(lost.server.players.filter((p) => p.teamID === 1).length, 10, 'teams not even after the retry');
  assert.equal(lost.plugin.last.failed, 0);

  // one player never moves
  let stuck = null;
  const never = await runRound({ lockMode: 1 }, makePlayers(), (s) => {
    const real = s.rcon.switchTeam;
    s.rcon.switchTeam = async (id) => {
      stuck = stuck || id;
      if (id === stuck) {
        s.calls.push(`switch ${id} (stuck)`);
        return;
      }
      await real(id);
    };
  });
  assert.equal(never.plugin.last.failed, 1);
  const text = never.server.calls.find((c) => c.startsWith('broadcast Smart Shuffle'));
  assert.ok(text.includes(`(${never.plugin.last.moved} players moved)`), text);
  const status = [];
  never.server.rcon.warn = async (id, msg) => status.push(msg);
  await never.plugin.onCommand({ chat: 'ChatAdmin', message: 'status', eosID: 'admin' });
  assert.ok(status[0].includes('1 not placed'), status[0]);
});

// ---- timing, lock across the map change, messages, switches ----

const switches = (server) => server.calls.filter((c) => c.startsWith('switch')).length;

test('plugin: nobody is moved once the next map has started', async () => {
  // the map changes after the third move: the shuffle stops there
  const cut = await runRound({ lockMode: 1 }, makePlayers(), (s) => {
    const real = s.rcon.switchTeam;
    let n = 0;
    s.rcon.switchTeam = async (id) => {
      await real(id);
      if (++n === 3) s.emit('NEW_GAME', {});
    };
  });
  assert.equal(switches(cut.server), 3, 'moves went on after the map change');
  assert.equal(cut.plugin.last.stopped, true);
  assert.equal(cut.plugin.lock, null, 'a shuffle that stopped early must not lock');
  const t1 = cut.server.players.filter((p) => p.teamID === 1).length;
  assert.ok(Math.abs(20 - 2 * t1) <= 2, `team sizes drifted: ${t1} vs ${20 - t1}`);
  assert.equal(cut.server.calls.filter((c) => c.startsWith('broadcast Smart Shuffle: teams balanced')).length, 0);

  // the map changes while the shuffle is still waiting (shuffleDelaySeconds): no move at all
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true, minPlayers: 0, shuffleDelaySeconds: 0.05 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  const running = plugin.onRoundEnded();
  server.emit('NEW_GAME', {});
  await running;
  assert.equal(switches(server), 0);
  assert.equal(plugin.last.stopped, true);
  await plugin.unmount();
});

test('plugin: the lock follows the team numbers across the map change', async () => {
  for (const flip of [true, false]) {
    const { server, plugin } = await runRound({ lockMode: 1 });
    const moved = switches(server);
    assert.ok(moved > 0 && plugin.lock);

    // map load: teams unknown for a moment, then everybody comes back (numbers swapped or not)
    server.emit('NEW_GAME', {});
    const real = server.players.map((p) => p.teamID);
    for (const p of server.players) p.teamID = null;
    await plugin.onPlayerInfo();
    server.players.forEach((p, i) => (p.teamID = flip ? 3 - real[i] : real[i]));
    await plugin.onPlayerInfo();
    assert.equal(switches(server), moved, `flip=${flip}: players were moved after the map change`);

    // the lock still works: one player who switches by himself is moved back
    const runner = server.players[5];
    const want = runner.teamID;
    runner.teamID = 3 - want;
    await plugin.onPlayerInfo();
    assert.equal(runner.teamID, want, `flip=${flip}: switcher not moved back`);
    await plugin.unmount();
  }
});

test('plugin: many players looking switched at once are left alone', async () => {
  const { server, plugin } = await runRound({ lockMode: 1 });
  const moved = switches(server);
  for (const p of server.players.slice(0, 8)) p.teamID = 3 - p.teamID;
  await plugin.onPlayerInfo();
  assert.equal(switches(server), moved);
  await plugin.unmount();
});

test('plugin: cancel calls off a pending shuffle', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: false, minPlayers: 0 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'now', eosID: 'admin' });
  assert.ok(server.calls.some((c) => c === 'broadcast Smart Shuffle: teams will be balanced at the end of this round.'));
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'cancel', eosID: 'admin' });
  assert.ok(server.calls.some((c) => c.startsWith('warn admin Smart Shuffle: the shuffle for this round is cancelled')));
  assert.ok(server.calls.some((c) => c === 'broadcast Smart Shuffle: the shuffle for this round is cancelled.'));
  await playMatch(server);
  await plugin.onRoundEnded();
  assert.equal(switches(server), 0);
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'cancel', eosID: 'admin' });
  assert.ok(server.calls.some((c) => c.startsWith('warn admin Smart Shuffle: nothing to cancel')));
  await plugin.unmount();
});

test('plugin: moved players, admins and the server are told, and each message can be turned off', async () => {
  const withAdmin = (s) => {
    s.players[19].steamID = '76561198000000099';
    s.getAdminsWithPermission = (perm, type) => (type === 'steamID' ? ['76561198000000099'] : []);
  };
  const loud = await runRound({ lockMode: 1 }, makePlayers(), withAdmin);
  const calls = loud.server.calls;
  const personal = calls.filter((c) => c.includes('you were moved to the other team'));
  assert.equal(personal.length, loud.plugin.last.moved, 'every moved player gets one message');
  assert.ok(calls.some((c) => c.startsWith('broadcast Smart Shuffle: teams balanced')));
  const report = calls.filter((c) => c.includes('Smart Shuffle report:'));
  assert.equal(report.length, 1, 'one admin online, one report');
  assert.ok(report[0].startsWith('warn e19 ') && /score gap \d+% -> \d+%/.test(report[0]), report[0]);

  const quiet = await runRound(
    { lockMode: 1, warnMovedPlayers: false, adminReport: false, broadcastResult: false, announceMinutes: 0 },
    makePlayers(),
    withAdmin
  );
  assert.ok(switches(quiet.server) > 0);
  assert.equal(quiet.server.calls.filter((c) => c.startsWith('warn') || c.startsWith('broadcast')).length, 0);
  await quiet.plugin.onCommand({ chat: 'ChatAdmin', message: 'now', eosID: 'admin' });
  assert.equal(quiet.server.calls.filter((c) => c.startsWith('broadcast')).length, 0, 'announceMinutes 0 is silent');

  // the admin who asked for "now" gets the report even without an admin list
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: false, minPlayers: 0 });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'now', eosID: 'boss' });
  await playMatch(server);
  await plugin.onRoundEnded();
  assert.ok(server.calls.some((c) => c.startsWith('warn boss Smart Shuffle report:')));
  await plugin.unmount();
});

test('plugin: lock and friends are separate switches', async () => {
  const sides = (server, id) => new Set(server.players.filter((p) => p.partyID === id).map((p) => p.teamID)).size;

  // friends kept, no lock
  const free = await runRound({ lockMode: 0, keepParties: true, maxPartySize: 6 }, bigPartyPlayers());
  assert.equal(sides(free.server, 'big'), 1);
  assert.equal(free.plugin.lock, null);
  assert.ok(!free.server.calls.some((c) => c.includes('locked until')));

  // lock, friends not kept
  const hard = await runRound({ lockMode: 2, keepParties: false, maxPartySize: 6 }, bigPartyPlayers());
  assert.equal(sides(hard.server, 'big'), 2);
  assert.ok(hard.plugin.lock);

  // the same from admin chat
  const { plugin, server } = await runRound({ lockMode: 2 });
  const say = async (message) => {
    await plugin.onCommand({ chat: 'ChatAdmin', message, eosID: 'admin' });
    return server.calls.filter((c) => c.startsWith('warn admin')).pop();
  };
  assert.ok((await say('friends off')).includes('friends (keep parties together): off'));
  assert.equal(plugin.friends, false);
  assert.equal(plugin.locking, true);
  assert.ok((await say('lock off')).includes('lock: off, friends: off'));
  assert.equal(plugin.lock, null);
  assert.ok((await say('friends on')).includes(': on'));
  assert.ok((await say('status')).includes('auto on, lock off, friends on'));
  await say('lock 2');
  assert.deepEqual([plugin.locking, plugin.friends], [true, true]);
  await say('lock 1');
  assert.deepEqual([plugin.locking, plugin.friends], [true, false]);
});

test('plugin: announcements only while a shuffle is due', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true, minPlayers: 0 });
  await plugin.mount();
  const count = () => server.calls.filter((c) => c.startsWith('broadcast Smart Shuffle: teams will be balanced')).length;
  server.emit('NEW_GAME', {});
  await plugin.onAnnounce();
  assert.equal(count(), 1);
  server.emit('NEW_GAME', { layerClassname: 'Narva_Invasion_v1' });
  await plugin.onAnnounce();
  assert.equal(count(), 1, 'a skipped layer is not announced');
  server.emit('NEW_GAME', { layerClassname: 'Narva_RAAS_v1' });
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'auto off', eosID: 'admin' });
  await plugin.onAnnounce();
  assert.equal(count(), 1, 'nothing is due with auto off');
  await plugin.unmount();
  assert.equal(plugin.announceTimer, null);
});

test('plugin: the moves finish even with a failing command or a long scoreboard wait', async () => {
  // one command throws: the others still go out and the check repeats the failed one
  let thrown = false;
  const flaky = await runRound({ lockMode: 1 }, makePlayers(), (s) => {
    const real = s.rcon.switchTeam;
    s.rcon.switchTeam = async (id) => {
      if (!thrown) {
        thrown = true;
        throw new Error('rcon timeout');
      }
      await real(id);
    };
  });
  assert.equal(flaky.plugin.last.stopped, false);
  assert.equal(flaky.plugin.last.failed, 0);
  assert.equal(flaky.server.players.filter((p) => p.teamID === 1).length, 10);

  // a slow RCON was measured earlier: the 20 s scoreboard wait is dropped so the moves fit before the deadline
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true, minPlayers: 0, shuffleDelaySeconds: 20 });
  plugin.moveMs = 5000;
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  const t0 = Date.now();
  await plugin.onRoundEnded();
  assert.ok(Date.now() - t0 < 2000, 'the wait was not cut');
  assert.ok(switches(server) > 0);
  assert.equal(plugin.last.stopped, false);
  await plugin.unmount();
});

// ---- session history and outside rating ----

const { withHistory, longTermRating, blendScores, STAT_KEYS } = mod;

test('session history matches the Python reference', () => {
  golden.cases.forEach((c, n) => {
    const S = { sl: c.visible.sl, role: c.visible.role, team: c.visible.team };
    for (const k of STAT_KEYS) S[k] = [];
    for (let i = 0; i < c.visible.sl.length; i++) {
      const now = Object.fromEntries(STAT_KEYS.map((k) => [k, c.visible[k][i]]));
      const rounds = c.hist.olds.map((o) => Object.fromEntries(STAT_KEYS.map((k) => [k, o[k][i]])));
      const s = withHistory(now, rounds);
      for (const k of STAT_KEYS) S[k].push(s[k]);
    }
    assert.deepEqual(planTeams(S, 'k6', c.slGroups).team, c.hist.team, `case ${n}`);
  });
  assert.deepEqual(withHistory({ kills: 3 }, []), { kills: 3 }, 'no earlier rounds: this match as it is');
});

test('outside rating and blend match the Python reference', () => {
  golden.cases.forEach((c, n) => {
    const L = longTermRating(c.mss.tot, c.mss.known);
    L.forEach((v, i) => {
      if (c.mss.L[i] === null) assert.ok(Number.isNaN(v), `case ${n} L[${i}] should be empty`);
      else assert.ok(Math.abs(v - c.mss.L[i]) < 1e-9, `case ${n} L[${i}] ${v} vs ${c.mss.L[i]}`);
    });
    closeArrays(blendScores(c.k6.P, L, 0.15), c.mss.P, 1e-9, `case ${n} blended P`);
    const { team } = planTeams(c.visible, 'k6', c.slGroups, [], (P) => blendScores(P, L, 0.15));
    assert.deepEqual(team, c.mss.team, `case ${n} team`);
  });
  const P = [1, 2, 3];
  assert.equal(blendScores(P, [NaN, NaN, NaN], 0), P, 'weight 0 leaves the scores alone');
});

test('plugin: earlier rounds of the session are counted, and can be switched off', async () => {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: false, minPlayers: 0, historyRounds: 2 });
  await plugin.mount();
  for (let round = 0; round < 3; round++) {
    server.emit('NEW_GAME', {});
    await playMatch(server);
    for (const s of plugin.stats.values()) s.minutes = 40;
    await plugin.onRoundEnded();
  }
  server.emit('NEW_GAME', {});
  assert.equal(plugin.recent('e00').length, 2, 'only the last historyRounds rounds are kept');
  await playMatch(server);
  for (const s of plugin.stats.values()) s.minutes = 40;
  const withIt = (await plugin.plan(false)).P;
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'history off', eosID: 'admin' });
  const without = (await plugin.plan(false)).P;
  assert.notDeepEqual(withIt, without, 'history did not change the scores');
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'history on', eosID: 'admin' });
  assert.deepEqual((await plugin.plan(false)).P, withIt);

  // old rounds drop out, and a skipped round (here: too few players) is not kept
  for (const list of plugin.history.values()) for (const r of list) r.t -= 7 * 3600000;
  assert.equal(plugin.recent('e00').length, 0);
  const small = new SmartShuffle(fakeServer(makePlayers()), { minPlayers: 40 });
  await small.mount();
  small.server.emit('NEW_GAME', {});
  await playMatch(small.server);
  for (const s of small.stats.values()) s.minutes = 40;
  await small.onRoundEnded();
  small.server.emit('NEW_GAME', {});
  assert.equal(small.history.size, 0);
  const off = new SmartShuffle(fakeServer(makePlayers()), { historyRounds: 0 });
  assert.equal(off.historyOn, false);
  await plugin.unmount();
  await small.unmount();
});

test('plugin: MySquadStats rating is off by default, needs a token, and never leaks it', async () => {
  const players = makePlayers().map((p, i) => ({ ...p, steamID: `7656119800000${String(i).padStart(4, '0')}` }));
  const plain = new SmartShuffle(fakeServer(players), { useMySquadStats: true });
  assert.equal(plain.outsideOn, false, 'no token, no outside rating');
  assert.equal(new SmartShuffle(fakeServer(players), { mySquadStatsToken: 'T0KEN' }).outsideOn, false, 'off by default');

  const server = fakeServer(players);
  const plugin = new SmartShuffle(server, {
    autoShuffle: true, minPlayers: 0, historyRounds: 0, useMySquadStats: true, mySquadStatsToken: 'T0KEN', mySquadStatsWeight: 0.5
  });
  const logs = [];
  plugin.verbose = (lvl, msg) => logs.push(msg);
  plugin.outsideGapMs = 0;
  const asked = [];
  plugin.getJson = async (url) => {
    assert.equal(url.host, 'api.mysquadstats.com');
    assert.equal(url.searchParams.get('accessToken'), 'T0KEN');
    const id = url.searchParams.get('search');
    asked.push(id);
    const i = +id.slice(-4);
    // the weak team of this match (players 10..19) has the strong all-time numbers
    return { data: [{ steamID: id, totalKills: i >= 10 ? 900 : 200, totalWounds: 400, totalDeaths: 300, totalRevives: 50 + i }] };
  };
  plugin.outsideOn = false;
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  const before = (await plugin.plan(false)).P;
  plugin.outsideOn = true;
  for (let tick = 0; tick < 4; tick++) await plugin.fetchOutside();
  assert.equal(new Set(asked).size, 20, 'every player is asked once: ' + logs.join(' | '));
  await plugin.fetchOutside();
  assert.equal(asked.length, 20, 'answers are cached');
  const after = (await plugin.plan(false)).P;
  assert.notDeepEqual(after, before);
  assert.ok(after[15] > before[15] && after[5] < before[5], 'the all-time rating did not pull the scores');
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'mss off', eosID: 'admin' });
  assert.deepEqual((await plugin.plan(false)).P, before);
  await plugin.onCommand({ chat: 'ChatAdmin', message: 'status', eosID: 'admin' });

  // the API fails: no crash, a pause, and the token is not in any log line or message
  plugin.outsideOn = true;
  plugin.outside.clear();
  plugin.getJson = async (url) => {
    throw new Error(`HTTP 500 for ${url}`);
  };
  await plugin.fetchOutside();
  assert.ok(plugin.outsidePause > Date.now());
  assert.ok(logs.some((l) => l.includes('MySquadStats not reachable')));
  assert.ok(![...logs, ...server.calls].some((l) => l.includes('T0KEN')), 'token leaked');
  await plugin.unmount();
});
