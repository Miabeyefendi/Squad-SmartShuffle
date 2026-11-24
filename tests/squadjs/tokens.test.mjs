// Tests for settings parsing, switch tokens, lock messages and the fast lock check. Run: node --test tests/squadjs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../../src/squadjs/smart-shuffle.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-shuffle-tokens-'));
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
const { flag, num, TokenBook } = mod;
const SmartShuffle = mod.default;
const H = 3600000;
const D = 24 * H;

test('switches take on/off, true/false, 1/0; numbers take off/on', () => {
  for (const v of [true, 'on', 'ON', 'true', 'yes', 1, '1']) assert.equal(flag(v), true, String(v));
  for (const v of [false, 'off', 'Off', 'false', 'no', 0, '0', '']) assert.equal(flag(v, true), false, String(v));
  assert.equal(flag(undefined, true), true);
  assert.equal(num('off', 5), 0);
  assert.equal(num('on', 5), 1);
  assert.equal(num('2'), 2);
  assert.equal(num(0.3), 0.3);
  assert.equal(num(undefined, 4), 4);
});

test('plugin options accept "off" everywhere', () => {
  const s = new EventEmitter();
  s.players = [];
  const p = new SmartShuffle(s, { autoShuffle: 'on', lockMode: 'off', fewerMoves: 'off', historyRounds: 'off',
    broadcastResult: 'off', switchTokens: 'off', tokenCommand: 'off', keepParties: 'on' });
  assert.equal(p.auto, true);
  assert.equal(p.locking, false);
  assert.equal(p.options.fewerMoves, 0);
  assert.equal(p.historyOn, false);
  assert.equal(p.options.broadcastResult, false);
  assert.equal(p.tokens, null);
  assert.equal(p.tokenCmd, null);
  assert.equal(p.friends, true);
});

test('tokens: start, spend, refill after the set hours', () => {
  const b = new TokenBook({ start: 2, max: 5, refillHours: 24, decayDays: 21, seedSteps: [15, 60, 180] });
  const t0 = Date.UTC(2026, 10, 1, 12);
  assert.equal(b.touch('a', t0)[0].tokens, 2);
  assert.equal(b.spend('a', t0), true);
  assert.equal(b.spend('a', t0 + H), true);
  assert.equal(b.spend('a', t0 + 2 * H), false);
  assert.equal(b.touch('a', t0 + 23 * H)[0].tokens, 0);
  assert.equal(b.touch('a', t0 + 25 * H)[0].tokens, 1);
  assert.equal(b.touch('a', t0 + 49 * H)[0].tokens, 2);
  assert.equal(b.touch('a', t0 + 200 * H)[0].tokens, 2, 'refill stops at the start value');
});

test('tokens: seeding 15 min = +1, 1 h = +2, 3 h = +3 in a day, capped, counted again the next day', () => {
  const b = new TokenBook({ start: 2, max: 6, refillHours: 0, decayDays: 0, seedSteps: [15, 60, 180] });
  const t0 = Date.UTC(2026, 10, 1, 8);
  assert.equal(b.seed('a', t0, 10), 0);
  assert.equal(b.seed('a', t0, 5), 1);
  assert.equal(b.seed('a', t0, 45), 1);
  assert.equal(b.seed('a', t0, 119), 0);
  assert.equal(b.seed('a', t0, 1), 1);
  assert.equal(b.players.a.tokens, 5);
  assert.equal(b.seed('a', t0 + D, 200), 1, 'next day counts again, capped at 6');
  assert.equal(b.players.a.tokens, 6);
});

test('tokens: a long break removes one earned token per period, never below the start value', () => {
  const b = new TokenBook({ start: 2, max: 0, refillHours: 0, decayDays: 21, seedSteps: [15, 60, 180] });
  const t0 = Date.UTC(2026, 10, 1, 8);
  b.seed('a', t0, 200);
  assert.equal(b.players.a.tokens, 5);
  let [r, notes] = b.touch('a', t0 + 20 * D);
  assert.equal(r.tokens, 5);
  assert.equal(notes.length, 0);
  [r, notes] = b.touch('a', t0 + 20 * D + 43 * D);
  assert.equal(r.tokens, 3);
  assert.deepEqual(notes, [{ kind: 'decay', lost: 2 }]);
  [r] = b.touch('a', t0 + 400 * D);
  assert.equal(r.tokens, 2);
});

function fakeServer(players) {
  const server = new EventEmitter();
  server.players = players.map((p) => ({ ...p }));
  server.calls = [];
  server.rules = [];
  server.updates = 0;
  server.logParser = { getRules: () => server.rules };
  server.updatePlayerList = async () => {
    server.updates += 1;
  };
  server.rcon = {
    execute: async () => '',
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

const twoPlayers = () => [
  { eosID: 'a1', name: 'A', teamID: 1 },
  { eosID: 'b2', name: 'B', teamID: 2 }
];

test('locked round: a token pays for a switch, without one the player is moved back', async () => {
  const file = path.join(dir, 'tok1.json');
  const s = fakeServer(twoPlayers());
  const p = new SmartShuffle(s, { switchTokens: 'on', tokenStart: 1, tokenFile: file, tokenSeedMinutes: [],
    lockCheckSeconds: 0 });
  await p.mount();
  p.lock = new Map([['a1', 1], ['b2', 2]]);
  s.players[0].teamID = 2;
  await p.onPlayerInfo();
  assert.equal(s.players[0].teamID, 2, 'token used, player stays');
  assert.ok(s.calls.some((c) => c === 'warn a1 Smart Shuffle: you used 1 switch token to change team. 0 left.'));
  s.players[0].teamID = 1;
  await p.onPlayerInfo();
  assert.equal(s.players[0].teamID, 2, 'no token left: moved back to the side he paid for');
  assert.ok(s.calls.some((c) => c.startsWith('warn a1 Smart Shuffle: team changes are locked until this round ends, you were moved back. You have no switch tokens left')));
  await p.unmount();
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.players.a1.tokens, 0);
  const p2 = new SmartShuffle(fakeServer(twoPlayers()), { switchTokens: 'on', tokenFile: file, lockCheckSeconds: 0 });
  await p2.mount();
  assert.equal(p2.tokens.players.a1.tokens, 0, 'tokens survive a restart');
  await p2.unmount();
});

test('!tokens answers the player; tokens off means no command and the old behaviour', async () => {
  const s = fakeServer(twoPlayers());
  const p = new SmartShuffle(s, { switchTokens: true, tokenFile: path.join(dir, 'tok2.json'), lockCheckSeconds: 0 });
  await p.mount();
  s.emit('CHAT_COMMAND:tokens', { eosID: 'a1', chat: 'ChatAll', message: '' });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(s.calls.some((c) => c.startsWith('warn a1 Smart Shuffle: you have 2 switch tokens.')));
  await p.unmount();

  const s2 = fakeServer(twoPlayers());
  const off = new SmartShuffle(s2, { lockCheckSeconds: 0 });
  await off.mount();
  off.lock = new Map([['a1', 1], ['b2', 2]]);
  s2.players[0].teamID = 2;
  await off.onPlayerInfo();
  assert.equal(s2.players[0].teamID, 1, 'tokens off: moved back as before');
  await off.unmount();
});

test('fast lock check reads the player list only while teams are locked', async () => {
  const s = fakeServer(twoPlayers());
  const p = new SmartShuffle(s, { lockCheckSeconds: 0 });
  await p.onLockCheck();
  assert.equal(s.updates, 0);
  p.lock = new Map([['a1', 1]]);
  await p.onLockCheck();
  assert.equal(s.updates, 1);
});
