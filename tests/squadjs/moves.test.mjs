// Tests for the fewerMoves option of src/squadjs/smart-shuffle.js. Run: node --test tests/squadjs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../../src/squadjs/smart-shuffle.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-shuffle-moves-'));
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
const { planTeams, moveBack, buildScores, rateDims, kitRows, FORMULAS } = mod;
const SmartShuffle = mod.default;
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'golden.json'), 'utf8'));

// the balance target the plugin minimises (score gap + every extra dimension)
function target(S, team) {
  const f = FORMULAS.k6;
  const { P, sub } = buildScores(S, f);
  const dims = [...sub, ...rateDims(S), ...kitRows(S.role)];
  const gap = (row) => {
    let a = 0;
    let b = 0;
    row.forEach((v, i) => (team[i] === 0 ? (a += v) : (b += v)));
    return Math.abs(a - b) / Math.max(a + b, 1e-9);
  };
  return gap(P) + f.lam * (dims.reduce((s, row) => s + gap(row), 0) / dims.length);
}
const movedCount = (team, current) => team.filter((t, i) => t !== current[i]).length;
const flipped = (team, current) => (movedCount(team, current) > team.length / 2 ? team.map((x) => 1 - x) : team);

test('fewerMoves 0 gives exactly the released split', () => {
  golden.cases.forEach((c, n) => {
    assert.deepEqual(planTeams(c.visible, 'k6', c.slGroups, [], null, 0).team, c.k6.team, `case ${n}`);
    assert.deepEqual(planTeams(c.visible, 'k6', c.slGroups, c.groups, null, 0).team,
      planTeams(c.visible, 'k6', c.slGroups, c.groups).team, `case ${n} groups`);
  });
});

test('fewerMoves moves fewer players and keeps the balance within the allowed share', () => {
  let before = 0;
  let after = 0;
  golden.cases.forEach((c, n) => {
    const S = c.visible;
    const base = flipped(c.k6.team, S.team);
    const t = planTeams(S, 'k6', c.slGroups, [], null, 0.1).team;
    assert.ok(movedCount(t, S.team) <= movedCount(base, S.team), `case ${n} moves more`);
    assert.ok(target(S, t) <= 1.1 * target(S, base) + 1e-12, `case ${n} balance over the limit`);
    const sizes = [t.filter((x) => x === 0).length, t.filter((x) => x === 1).length];
    const baseSizes = [base.filter((x) => x === 0).length, base.filter((x) => x === 1).length];
    assert.deepEqual(sizes, baseSizes, `case ${n} team sizes`);
    S.sl.forEach((isSl, i) => isSl && assert.equal(t[i], base[i], `case ${n} SL ${i} moved back`));
    before += movedCount(base, S.team);
    after += movedCount(t, S.team);
  });
  assert.ok(after < 0.9 * before, `only ${before} -> ${after} moves`);
});

test('fewerMoves leaves kept friend groups where the group keeping put them', () => {
  golden.cases.forEach((c, n) => {
    const S = c.visible;
    const base = flipped(planTeams(S, 'k6', c.slGroups, c.groups).team, S.team);
    const t = planTeams(S, 'k6', c.slGroups, c.groups, null, 0.2).team;
    c.groups.flat().forEach((i) => assert.equal(t[i], base[i], `case ${n} party member ${i}`));
  });
});

test('team labels are swapped when more than half would move', () => {
  const team = [0, 0, 0, 1, 1, 1];
  const current = [1, 1, 1, 0, 0, 1];
  const P = [1, 1, 1, 1, 1, 1];
  const t = moveBack(team, P, [], 1, [false, false, false, false, false, false], [], current, 0);
  assert.deepEqual(t, [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(moveBack([0, 1, 0, 1], [1, 1, 1, 1], [], 1, [false, false, false, false], [], [0, 1, 1, 1], 0),
    [0, 1, 0, 1]);
});

function fakeServer(players) {
  const server = new EventEmitter();
  server.players = players.map((p) => ({ ...p }));
  server.calls = [];
  server.rules = [];
  server.logParser = { getRules: () => server.rules };
  server.updatePlayerList = async () => {};
  const line = (p) =>
    `ID: 1 | Online IDs: EOS: ${p.eosID} | Name: ${p.name} | Team ID: ${p.teamID}` +
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

// 40 players, team 1 somewhat stronger: a shuffle is needed, and there is room to move fewer players
function makePlayers() {
  const out = [];
  for (let i = 0; i < 40; i++) {
    out.push({
      eosID: `e${String(i).padStart(2, '0')}`,
      name: `M${i}`,
      teamID: i % 2 === 0 ? 1 : 2,
      squadID: 1 + (i % 4),
      isLeader: i < 4,
      role: i % 5 === 1 ? 'USA_Medic_01' : 'USA_Rifleman_01'
    });
  }
  return out;
}

async function playMatch(server) {
  for (let tick = 0; tick < 3; tick++) await server.listeners('UPDATED_PLAYER_INFORMATION')[0]();
  server.players.forEach((p, i) => {
    const kills = (p.teamID === 1 ? 7 : 2) + ((i * 7) % 5);
    for (let k = 0; k < kills; k++) {
      const victim = server.players.find((x) => x.teamID !== p.teamID);
      server.emit('PLAYER_WOUNDED', { attacker: p, victim, teamkill: false });
      server.emit('PLAYER_DIED', { attacker: p, victim, teamkill: false });
      server.emit('PLAYER_DAMAGED', { attacker: p, victim, damage: 100, teamkill: false });
    }
  });
}

async function switchesWith(options) {
  const server = fakeServer(makePlayers());
  const plugin = new SmartShuffle(server, { autoShuffle: true, lockMode: 1, minPlayers: 0, ...options });
  await plugin.mount();
  server.emit('NEW_GAME', {});
  await playMatch(server);
  await plugin.onRoundEnded();
  await plugin.unmount();
  return server.calls.filter((c) => c.startsWith('switch')).length;
}

test('plugin: fewerMoves is off by default and moves fewer players when set', async () => {
  const off = await switchesWith({});
  const on = await switchesWith({ fewerMoves: 0.1 });
  assert.ok(off > 0, 'nobody moved');
  assert.ok(on < off, `fewerMoves did not reduce the moves: ${off} -> ${on}`);
});
