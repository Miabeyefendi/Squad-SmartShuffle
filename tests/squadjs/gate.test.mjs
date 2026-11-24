// Tests for the shuffle triggers, whole squads, the !switch gate and the admin imbalance alert.
// Run: node --test tests/squadjs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../../src/squadjs/smart-shuffle.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-shuffle-gate-'));
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
const { mergeGroups } = mod;
const SmartShuffle = mod.default;

function fakeServer(players, admins = []) {
  const server = new EventEmitter();
  server.players = players.map((p) => ({ ...p }));
  server.calls = [];
  server.rules = [];
  server.logParser = { getRules: () => server.rules };
  server.updatePlayerList = async () => {};
  server.getAdminsWithPermission = (perm, type) => (type === 'eosID' ? admins : []);
  const line = (p) =>
    `ID: 1 | Online IDs: EOS: ${p.eosID} | Name: ${p.name} | Team ID: ${p.teamID}` +
    ` | Squad ID: ${p.squadID ?? 'N/A'} | Is Leader: ${p.isLeader ? 'True' : 'False'} | Role: ${p.role || 'USA_Rifleman_01'}`;
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

// n players, team 1 gets the first `t1`
function players(n, t1, extra = () => ({})) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ eosID: `e${String(i).padStart(2, '0')}`, name: `P${i}`, teamID: i < t1 ? 1 : 2, squadID: null, ...extra(i) });
  }
  return out;
}

const warned = (s, id, start) => s.calls.some((c) => c.startsWith(`warn ${id} ${start}`));

test('groups that share a player merge', () => {
  assert.deepEqual(mergeGroups([[1, 2], [2, 3], [5, 6], [7]]), [[1, 2, 3], [5, 6]]);
});

test('ticket gap trigger: a close round is skipped, a stomp shuffles, an unknown result shuffles', () => {
  const s = fakeServer(players(10, 5));
  const p = new SmartShuffle(s, { shuffleTicketGap: 150 });
  assert.match(p.triggerSkip(p.roundResult({ winner: { team: '1', tickets: 120 }, loser: { team: '2', tickets: 0 } })), /ticket gap 120/);
  assert.equal(p.triggerSkip(p.roundResult({ winner: { team: '2', tickets: 210 }, loser: { team: '1', tickets: 0 } })), null);
  assert.equal(p.triggerSkip(p.roundResult(undefined)), null);
  const off = new SmartShuffle(s, {});
  assert.equal(off.triggerSkip(off.roundResult({ winner: { team: '1', tickets: 5 }, loser: { team: '2', tickets: 0 } })), null);
});

test('win streak trigger: the same players winning 3 rounds in a row shuffles', () => {
  const s = fakeServer(players(10, 5));
  const p = new SmartShuffle(s, { shuffleWinStreak: 3 });
  const win1 = { winner: { team: '1', tickets: 50 }, loser: { team: '2', tickets: 0 } };
  assert.match(p.triggerSkip(p.roundResult(win1)), /win streak 1/);
  // the map changes and the game swaps the team numbers: the same players now win as team 2
  for (const x of s.players) x.teamID = 3 - x.teamID;
  assert.match(p.triggerSkip(p.roundResult({ winner: { team: '2', tickets: 50 }, loser: { team: '1', tickets: 0 } })), /win streak 2/);
  assert.equal(p.triggerSkip(p.roundResult({ winner: { team: '2', tickets: 50 }, loser: { team: '1', tickets: 0 } })), null);
  // the other group wins: the streak starts again
  assert.match(p.triggerSkip(p.roundResult(win1)), /win streak 1/);
});

test('moveSquads keeps whole squads up to maxPartySize on one side', async () => {
  // one squad of 4 strong players on each team and free players, so a plain split would break the squads up
  const s = fakeServer(players(16, 8, (i) => ({ squadID: i < 4 ? 1 : i >= 8 && i < 12 ? 11 : null, isLeader: i === 0 || i === 8 })));
  const p = new SmartShuffle(s, { moveSquads: 'on', maxPartySize: 4, lockMode: 1 });
  await p.mount();
  s.emit('NEW_GAME', {});
  for (let k = 0; k < 3; k++) await s.listeners('UPDATED_PLAYER_INFORMATION')[0]();
  for (const pl of [...s.players.slice(0, 4), ...s.players.slice(8, 12)]) {
    for (let k = 0; k < 15; k++) {
      const victim = s.players.find((x) => x.teamID !== pl.teamID);
      s.emit('PLAYER_DIED', { attacker: pl, victim, teamkill: false });
      s.emit('PLAYER_DAMAGED', { attacker: pl, victim, damage: 100, teamkill: false });
    }
  }
  const { players: ps, team } = await p.plan(false);
  const bySquad = new Map();
  ps.forEach((pl, i) => {
    const k = `${pl.teamID}:${pl.squadID}`;
    if (!bySquad.has(k)) bySquad.set(k, new Set());
    bySquad.get(k).add(team[i]);
  });
  for (const [k, sides] of bySquad) if (!k.endsWith(':null')) assert.equal(sides.size, 1, `squad ${k} split`);
  // the same plan without moveSquads splits at least one of the two strong squads
  p.squads = false;
  const plain = await p.plan(false);
  const split = [1, 11].some((sq) => new Set(plain.players.map((pl, i) => (pl.squadID === sq ? plain.team[i] : null)).filter((x) => x !== null)).size > 1);
  assert.ok(split, 'the test squads would be split without moveSquads');
  await p.unmount();
});

test('switch gate: moves when the sizes allow, queues when not, swaps two waiting players', async () => {
  const s = fakeServer(players(9, 5)); // 5 v 4
  const p = new SmartShuffle(s, { switchCommand: 'switch', switchMaxDiff: 1, lockCheckSeconds: 0 });
  await p.mount();
  s.emit('NEW_GAME', {});
  // team 1 has more: one of them may go to team 2 (ends 4 v 5)
  await p.onSwitchCommand({ eosID: 'e00', message: '' });
  assert.equal(s.players[0].teamID, 2);
  assert.ok(warned(s, 'e00', 'Smart Shuffle: you were moved to team 2.'));
  // now 4 v 5: another from team 2 to team 1 fits (5 v 4), but a team 1 player asking for team 2 does not
  await p.onSwitchCommand({ eosID: 'e01', message: '' });
  assert.equal(s.players[1].teamID, 1, 'waits');
  assert.ok(warned(s, 'e01', 'Smart Shuffle: team 2 is full, you are in the queue'));
  assert.equal(p.queue.length, 1);
  // a team 2 player asks for team 1: the two are swapped
  await p.onSwitchCommand({ eosID: 'e08', message: '' });
  assert.equal(s.players[1].teamID, 2);
  assert.equal(s.players[8].teamID, 1);
  assert.equal(p.queue.length, 0);
  await p.unmount();
});

test('switch gate: the queue moves a player when a slot opens and drops him when it times out', async () => {
  const s = fakeServer(players(9, 5));
  const p = new SmartShuffle(s, { switchCommand: 'switch', switchMaxDiff: 1, switchQueueMinutes: 1, lockCheckSeconds: 0 });
  await p.mount();
  s.emit('NEW_GAME', {});
  await p.onSwitchCommand({ eosID: 'e05', message: '' }); // team 2 -> 1 would be 6 v 3: queued
  assert.equal(p.queue.length, 1);
  s.players[0].teamID = 2; // someone left team 1 by himself: 4 v 5
  await p.runQueue(Date.now());
  assert.equal(s.players[5].teamID, 1);
  await p.onSwitchCommand({ eosID: 'e06', message: '' }); // 5 v 4 now: team 2 -> 1 would be 6 v 3: queued
  await p.runQueue(Date.now() + 2 * 60000);
  assert.equal(p.queue.length, 0);
  assert.ok(warned(s, 'e06', 'Smart Shuffle: your switch request timed out.'));
  await p.unmount();
});

test('switch gate in a locked round: needs a token, refuses without tokens', async () => {
  const file = path.join(dir, 'gate-tokens.json');
  const s = fakeServer(players(8, 4));
  const p = new SmartShuffle(s, { switchCommand: 'switch', switchTokens: 'on', tokenStart: 1, tokenFile: file,
    tokenSeedMinutes: [], lockCheckSeconds: 0 });
  await p.mount();
  s.emit('NEW_GAME', {});
  p.lock = new Map(s.players.map((x) => [x.eosID, x.teamID]));
  await p.onSwitchCommand({ eosID: 'e00', message: '' }); // 4 v 4 -> 3 v 5 fits the default diff 2
  assert.equal(s.players[0].teamID, 2);
  assert.ok(warned(s, 'e00', 'Smart Shuffle: you were moved to team 2. 1 switch token used, 0 left.'));
  assert.equal(p.lock.get('e00'), 2, 'the lock follows the paid move');
  await p.onSwitchCommand({ eosID: 'e00', message: '' });
  assert.equal(s.players[0].teamID, 2);
  assert.ok(warned(s, 'e00', 'Smart Shuffle: teams are locked this round and you have no switch tokens left.'));
  await p.unmount();

  const s2 = fakeServer(players(8, 4));
  const noTok = new SmartShuffle(s2, { switchCommand: 'switch', lockCheckSeconds: 0 });
  await noTok.mount();
  s2.emit('NEW_GAME', {});
  noTok.lock = new Map(s2.players.map((x) => [x.eosID, x.teamID]));
  await noTok.onSwitchCommand({ eosID: 'e00', message: '' });
  assert.equal(s2.players[0].teamID, 1);
  assert.ok(warned(s2, 'e00', 'Smart Shuffle: teams are locked this round, switching opens after the round ends.'));
  await noTok.unmount();
});

test('switch gate off by default: no !switch listener', async () => {
  const s = fakeServer(players(4, 2));
  const p = new SmartShuffle(s, { lockCheckSeconds: 0 });
  await p.mount();
  assert.equal(s.listenerCount('CHAT_COMMAND:switch'), 0);
  await p.unmount();
});

test('imbalance alert goes to the admins online only', async () => {
  const s = fakeServer(players(20, 10, (i) => ({ isLeader: i % 10 === 0 })), ['e00']);
  const p = new SmartShuffle(s, { imbalanceAlertMinutes: 20, imbalanceAlertGap: 10, lockCheckSeconds: 0 });
  await p.mount();
  s.emit('NEW_GAME', {});
  for (let k = 0; k < 3; k++) await s.listeners('UPDATED_PLAYER_INFORMATION')[0]();
  for (const pl of s.players.filter((x) => x.teamID === 1)) {
    for (let k = 0; k < 12; k++) {
      const victim = s.players.find((x) => x.teamID === 2);
      s.emit('PLAYER_WOUNDED', { attacker: pl, victim, teamkill: false });
      s.emit('PLAYER_DIED', { attacker: pl, victim, teamkill: false });
      s.emit('PLAYER_DAMAGED', { attacker: pl, victim, damage: 100, teamkill: false });
    }
  }
  await p.imbalanceAlert();
  assert.ok(warned(s, 'e00', 'Smart Shuffle: teams look uneven 20 min in'));
  assert.ok(!s.calls.some((c) => c.startsWith('broadcast')), 'nothing to the server');
  await p.unmount();
});

// ---- everyone in a squad (squads of up to 9, the game's limit): squads must stay whole and the teams even ----

const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'golden.json'), 'utf8'));
const { planTeams, buildScores, FORMULAS } = mod;

function squadsOf(team, size = 9) {
  const out = [];
  for (const side of [0, 1]) {
    const ids = team.map((t, i) => (t === side ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k < ids.length; k += size) out.push(ids.slice(k, k + size));
  }
  return out.filter((g) => g.length >= 2);
}

function gap(P, team) {
  let a = 0;
  let b = 0;
  P.forEach((v, i) => (team[i] === 0 ? (a += v) : (b += v)));
  return Math.abs(a - b) / (a + b);
}

test('whole squads of 9 covering every player: no squad split, sizes even, balance better than before', () => {
  let before = 0;
  let after = 0;
  golden.cases.forEach((c, n) => {
    const S = c.visible;
    const groups = squadsOf(S.team);
    for (const fewer of [0, 1]) {
      const { team } = planTeams(S, 'k6', c.slGroups, groups, null, fewer);
      groups.forEach((g, k) => assert.equal(new Set(g.map((i) => team[i])).size, 1, `case ${n} fewer ${fewer} squad ${k} split`));
      const n0 = team.filter((x) => x === 0).length;
      assert.ok(Math.abs(n0 - (team.length - n0)) <= 2, `case ${n} fewer ${fewer}: ${n0} v ${team.length - n0}`);
      if (fewer === 0) {
        const { P } = buildScores(S, FORMULAS.k6);
        before += gap(P, S.team);
        after += gap(P, team);
      }
    }
  });
  assert.ok(after < 0.5 * before, `score gap ${before.toFixed(3)} -> ${after.toFixed(3)}`);
});

test('plugin with moveSquads and maxPartySize 9: four full squads, the strong one is traded whole', async () => {
  const s = fakeServer(players(36, 18, (i) => ({ squadID: 1 + Math.floor(i / 9), isLeader: i % 9 === 0 })));
  const p = new SmartShuffle(s, { moveSquads: 'on', maxPartySize: 9, lockMode: 1, lockCheckSeconds: 0 });
  await p.mount();
  s.emit('NEW_GAME', {});
  for (let k = 0; k < 3; k++) await s.listeners('UPDATED_PLAYER_INFORMATION')[0]();
  // squads 1 and 2 (team 1) are both strong: a good split sends one of them to team 2
  for (const pl of s.players.slice(0, 18)) {
    for (let k = 0; k < 10; k++) {
      const victim = s.players.find((x) => x.teamID === 2);
      s.emit('PLAYER_DIED', { attacker: pl, victim, teamkill: false });
      s.emit('PLAYER_DAMAGED', { attacker: pl, victim, damage: 100, teamkill: false });
    }
  }
  const { players: ps, team } = await p.plan(false);
  const side = new Map();
  ps.forEach((pl, i) => {
    const k = pl.squadID;
    if (!side.has(k)) side.set(k, new Set());
    side.get(k).add(team[i]);
  });
  for (const [k, sides] of side) assert.equal(sides.size, 1, `squad ${k} split`);
  assert.notEqual([...side.get(1)][0], [...side.get(2)][0], 'the two strong squads end on different sides');
  assert.equal(team.filter((x) => x === 0).length, 18);
  await p.unmount();
});
