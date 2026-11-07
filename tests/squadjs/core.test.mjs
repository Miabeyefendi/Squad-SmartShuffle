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

test('group keeping (lock mode 2) matches the Python reference', () => {
  golden.cases.forEach((c, n) => {
    const t = keepGroups(c.k6.team, c.k6.P, c.groups, c.visible.sl);
    assert.deepEqual(t, c.keep, `case ${n}`);
    for (const g of c.groups) assert.equal(new Set(g.map((i) => t[i])).size, 1, `case ${n} group split`);
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
  const plugin = new SmartShuffle(server, { autoShuffle: true, lockMode: 1 });
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
  assert.ok(server.calls.some((c) => c.startsWith(`warn ${runner.eosID}`)));

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
  const plugin = new SmartShuffle(server, { autoShuffle: true, lockMode: 2 });
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
  const plugin = new SmartShuffle(server, { autoShuffle: true, useScoreboardDump: true, dumpWaitSeconds: 1 });
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
