// Smart Shuffle for SquadJS.
// Balances the two teams at round end from this match's stats only. Nothing is stored between matches.
// Install: copy this one file to SquadJS/squad-server/plugins/ and add an entry to config.json:
//   { "plugin": "SmartShuffle", "enabled": true, "autoShuffle": false, "lockMode": 2 }
// Admin chat: !smartshuffle now | auto on | auto off | lock 0 | lock 1 | lock 2 | unlock | status
// The scoring and balancing part is a port of the offline reference model the formula was tuned with;
// tests/squadjs/core.test.mjs checks it against that model's outputs (tests/squadjs/golden.json).
import BasePlugin from './base-plugin.js';

// ---------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------

const FLOOR = 0.05;
const TK_PENALTY = 0.1;
const SPEC = 1.0;
const PRIOR_MIN = 30.0;
const TEAM_REL = 0.5;
const ZCLIP = 3.0;
const SOFT_K = 8.0;
const RATE_PRIOR = 30.0;

const SUB_COMBAT = [['kills', 0.4], ['knocks', 0.2], ['damage', 0.25], ['supp', 0.15]];
const SUB_TEAM_OTHER = [['revives', 0.4], ['heal', 0.3], ['logi', 0.3]];
const SUB_TEAM_SL = [['revives', 0.15], ['heal', 0.1], ['logi', 0.15], ['markers', 0.35], ['support', 0.25]];
const SUB_OBJ = [['caps', 0.3], ['cticks', 0.45], ['dticks', 0.25]];
const ALL_SUBS = ['kills', 'knocks', 'damage', 'supp', 'revives', 'heal', 'logi', 'markers', 'support',
  'caps', 'cticks', 'dticks'];
export const STAT_KEYS = ['kills', 'knocks', 'deaths', 'revives', 'heal', 'damage', 'supp', 'supp_recv', 'ammo',
  'constr', 'markers', 'support', 'caps', 'cticks', 'dticks', 'tk', 'minutes'];

// kit classes: 1 medic, 2 logistics, 3 vehicle crew
const ROLE_W = { 1: [0.15, 0.1, 0.5, 0.25], 2: [0.1, 0.1, 0.55, 0.25] };
const SUPPORT_W = [0.12, 0.1, 0.53, 0.25];

function dropObj(w) {
  const s = w[0] + w[1] + w[2];
  return [w[0] / s, w[1] / s, w[2] / s, 0.0];
}

// k6: SquadJS log data (no flag, heal, ammo, suppression, marker data). v4a: full scoreboard (hybrid route).
export const FORMULAS = {
  k6: {
    wo: [0.3, 0.3, 0.4, 0.0],
    wsl: [0.2, 0.2, 0.6, 0.0],
    roleW: { 1: dropObj(ROLE_W[1]), 2: dropObj(ROLE_W[2]) },
    softW: dropObj(SUPPORT_W),
    lam: 1.0,
    rateDims: true
  },
  v4a: {
    wo: [0.25, 0.25, 0.25, 0.25],
    wsl: [0.15, 0.15, 0.3, 0.4],
    roleW: ROLE_W,
    softW: SUPPORT_W,
    lam: 0.5,
    rateDims: false
  }
};

function sum(a) {
  let s = 0;
  for (const x of a) s += x;
  return s;
}

function zLogistic(x) {
  const n = x.length;
  const mean = sum(x) / n;
  let v = 0;
  for (const xi of x) v += (xi - mean) * (xi - mean);
  const sd = Math.sqrt(v / n);
  return x.map((xi) => {
    const z = Math.min(ZCLIP, Math.max(-ZCLIP, (xi - mean) / (sd + 1e-9)));
    return Math.max(FLOOR, 1.0 / (1.0 + Math.exp(-1.7 * z)));
  });
}

function rawStat(S, k, i) {
  return k === 'logi' ? S.ammo[i] + S.constr[i] : S[k][i];
}

// sub-area and KDA scores of the players in idx, computed inside that group (zeb base)
function groupScores(S, idx) {
  const mins = idx.map((i) => S.minutes[i]);
  const minSum = sum(mins);
  const sub = {};
  for (const k of ALL_SUBS) {
    const r = idx.map((i) => rawStat(S, k, i));
    const m0 = minSum > 0 ? sum(r) / minSum : 0;
    sub[k] = zLogistic(r.map((ri, j) => Math.log1p(((ri + PRIOR_MIN * m0) / (mins[j] + PRIOR_MIN)) * 30.0)));
  }
  const kda = zLogistic(idx.map((i) =>
    Math.log((S.kills[i] + S.knocks[i] + S.revives[i] + 1) / (S.deaths[i] + 2) + 1e-3)));
  return { sub, kda };
}

// S: one array per stat key plus sl (bool), role (int), team (0/1). Returns P and the 13 score rows.
export function buildScores(S, f) {
  const n = S.minutes.length;
  const all = [...Array(n).keys()];
  const g = groupScores(S, all);
  const sub = {};
  for (const k of ALL_SUBS) sub[k] = g.sub[k].slice();
  const kda = g.kda.slice();
  const subT = {};
  for (const k of ALL_SUBS) subT[k] = new Array(n).fill(0);
  const kdaT = new Array(n).fill(0);
  for (const tv of [...new Set(S.team)].sort((a, b) => a - b)) {
    const idx = all.filter((i) => S.team[i] === tv);
    const gt = groupScores(S, idx);
    idx.forEach((i, j) => {
      for (const k of ALL_SUBS) subT[k][i] = gt.sub[k][j];
      kdaT[i] = gt.kda[j];
    });
  }
  for (const k of ALL_SUBS) for (let i = 0; i < n; i++) sub[k][i] = (1 - TEAM_REL) * sub[k][i] + TEAM_REL * subT[k][i];
  for (let i = 0; i < n; i++) kda[i] = (1 - TEAM_REL) * kda[i] + TEAM_REL * kdaT[i];

  const wsum = (pairs, i) => {
    let s = 0;
    for (const [k, w] of pairs) s += w * sub[k][i];
    return s;
  };
  const P = new Array(n);
  for (let i = 0; i < n; i++) {
    let tO = wsum(SUB_TEAM_OTHER, i);
    let tS = wsum(SUB_TEAM_SL, i);
    tO = Math.max(tO, SPEC * Math.max(...SUB_TEAM_OTHER.map(([k]) => sub[k][i])));
    tS = Math.max(tS, SPEC * Math.max(...SUB_TEAM_SL.map(([k]) => sub[k][i])));
    const C = [kda[i], wsum(SUB_COMBAT, i), S.sl[i] ? tS : tO, wsum(SUB_OBJ, i)].map((c) => Math.max(FLOOR, c));
    let W = S.sl[i] ? f.wsl : f.wo;
    if (!S.sl[i]) {
      const sup = Math.max(sub.revives[i], sub.heal[i], sub.logi[i]);
      const cmb = Math.max(sub.kills[i], sub.knocks[i], sub.damage[i]);
      const a = 1.0 / (1.0 + Math.exp(-SOFT_K * (sup - cmb)));
      W = f.wo.map((w, c) => (1 - a) * w + a * f.softW[c]);
      if (f.roleW[S.role[i]]) W = f.roleW[S.role[i]];
    }
    let e = 0;
    for (let c = 0; c < 4; c++) e += W[c] * Math.log(C[c]);
    P[i] = Math.exp(e) * Math.max(0.0, 1.0 - TK_PENALTY * S.tk[i]);
  }
  return { P, sub: [kda, ...ALL_SUBS.map((k) => sub[k])] };
}

// per-minute rates, smoothed toward the match average (30 minute prior), divided by their mean
export function rateDims(S) {
  const n = S.minutes.length;
  const mins = S.minutes.map((m) => Math.max(m, 1.0));
  const minSum = Math.max(sum(mins), 1e-9);
  const cols = [
    S.kills.map((k, i) => k + S.knocks[i]),
    S.damage,
    S.deaths,
    S.revives,
    S.constr
  ];
  return cols.map((x) => {
    const m0 = sum(x) / minSum;
    const r = x.map((xi, i) => (xi + RATE_PRIOR * m0) / (mins[i] + RATE_PRIOR));
    const mean = Math.max(sum(r) / n, 1e-9);
    return r.map((ri) => ri / mean);
  });
}

export function kitRows(role) {
  return [1, 2, 3].map((c) => role.map((r) => (r === c ? 1 : 0)));
}

// ---------------------------------------------------------------------------------------------
// Balancing
// ---------------------------------------------------------------------------------------------

function byPDesc(idx, P) {
  return idx.slice().sort((a, b) => P[b] - P[a]);
}

// SLs split by group (0 vehicle SL, 1 locked small squad SL, 2 open SL), others greedy to the lower sum,
// then pair swaps among non-SL players.
export function shuffleSum(sl, P, slGroups, tol = 0.003, maxIter = 300) {
  const n = P.length;
  const team = new Array(n).fill(0);
  const sums = [0.0, 0.0];
  const counts = [0, 0];
  const slIdx = byPDesc([...Array(n).keys()].filter((i) => sl[i]), P);
  const slTotal = [0, 0];
  for (const group of [...new Set(slIdx.map((j) => slGroups[j]))].sort((a, b) => a - b)) {
    const inGroup = [0, 0];
    for (const i of slIdx.filter((j) => slGroups[j] === group)) {
      let t;
      if (inGroup[0] !== inGroup[1]) t = inGroup[0] < inGroup[1] ? 0 : 1;
      else if (slTotal[0] !== slTotal[1]) t = slTotal[0] < slTotal[1] ? 0 : 1;
      else t = sums[0] <= sums[1] ? 0 : 1;
      team[i] = t;
      inGroup[t] += 1;
      slTotal[t] += 1;
      sums[t] += P[i];
      counts[t] += 1;
    }
  }
  const others = byPDesc([...Array(n).keys()].filter((i) => !sl[i]), P);
  for (const i of others) {
    let t;
    if (counts[0] - counts[1] >= 1) t = 1;
    else if (counts[1] - counts[0] >= 1) t = 0;
    else t = sums[0] <= sums[1] ? 0 : 1;
    team[i] = t;
    sums[t] += P[i];
    counts[t] += 1;
  }
  const total = sums[0] + sums[1];
  for (let it = 0; it < maxIter; it++) {
    const diff = sums[0] - sums[1];
    if (total <= 0 || Math.abs(diff) / total < tol) break;
    let best = null;
    const t0 = others.filter((i) => team[i] === 0);
    const t1 = others.filter((i) => team[i] === 1);
    for (const a of t0) {
      for (const b of t1) {
        const nd = Math.abs(diff - 2 * (P[a] - P[b]));
        if (nd < Math.abs(diff) && (best === null || nd < best[0])) best = [nd, a, b];
      }
    }
    if (best === null) break;
    const [, a, b] = best;
    team[a] = 1;
    team[b] = 0;
    sums[0] += P[b] - P[a];
    sums[1] += P[a] - P[b];
  }
  return team;
}

// start from shuffleSum, then swaps that also even out every extra dimension (cats: rows x players)
export function balanceMulti(sl, P, cats, lam, slGroups, maxIter = 100) {
  const team = shuffleSum(sl, P, slGroups);
  const n = P.length;
  const D = cats.length;
  const others = [...Array(n).keys()].filter((i) => !sl[i]);
  const tp = sum(P);
  const tc = cats.map((row) => Math.max(sum(row), 1e-9));
  const sideSum = (row, t) => {
    let s = 0;
    for (let i = 0; i < n; i++) if (team[i] === t) s += row[i];
    return s;
  };
  let dP = sideSum(P, 0) - sideSum(P, 1);
  let dC = cats.map((row) => sideSum(row, 0) - sideSum(row, 1));
  const costOf = (np, nc) => {
    let m = 0;
    for (let d = 0; d < D; d++) m += Math.abs(nc[d]) / tc[d];
    return Math.abs(np) / tp + lam * (m / D);
  };
  let cur = costOf(dP, dC);
  const nC = new Array(D);
  for (let it = 0; it < maxIter; it++) {
    const A = others.filter((i) => team[i] === 0);
    const B = others.filter((i) => team[i] === 1);
    if (A.length === 0 || B.length === 0) break;
    let best = null;
    for (const a of A) {
      for (const b of B) {
        const np = dP - 2 * (P[a] - P[b]);
        for (let d = 0; d < D; d++) nC[d] = dC[d] - 2 * (cats[d][a] - cats[d][b]);
        const cost = costOf(np, nC);
        if (best === null || cost < best.cost) best = { cost, a, b, np, nc: nC.slice() };
      }
    }
    if (best.cost >= cur - 1e-12) break;
    team[best.a] = 1;
    team[best.b] = 0;
    dP = best.np;
    dC = best.nc;
    cur = best.cost;
  }
  return team;
}

// pair swaps that shrink the sum gap, only between players allowed(i)
function swapPhase(team, P, allowed, tol = 0.003, maxIter = 300) {
  const others = [...Array(P.length).keys()].filter(allowed);
  let s0 = 0;
  let s1 = 0;
  for (let i = 0; i < P.length; i++) {
    if (team[i] === 0) s0 += P[i];
    else s1 += P[i];
  }
  const total = s0 + s1;
  for (let it = 0; it < maxIter; it++) {
    const diff = s0 - s1;
    if (total <= 0 || Math.abs(diff) / total < tol) break;
    let best = null;
    const t0 = others.filter((i) => team[i] === 0);
    const t1 = others.filter((i) => team[i] === 1);
    for (const a of t0) {
      for (const b of t1) {
        const nd = Math.abs(diff - 2 * (P[a] - P[b]));
        if (nd < Math.abs(diff) && (best === null || nd < best[0])) best = [nd, a, b];
      }
    }
    if (best === null) break;
    const [, a, b] = best;
    team[a] = 1;
    team[b] = 0;
    s0 += P[b] - P[a];
    s1 += P[a] - P[b];
  }
  return team;
}

// lock mode 2: every friend group (party) goes to its majority side, the most similar free player
// moves the other way, then the sums are evened out again with swaps among free players only
export function keepGroups(team, P, groups, sl) {
  const t = team.slice();
  const n = P.length;
  const gid = new Array(n).fill(-1);
  groups.forEach((g, k) => g.forEach((i) => (gid[i] = k)));
  for (const g of groups) {
    const c0 = g.filter((i) => t[i] === 0).length;
    const c1 = g.length - c0;
    let maj;
    if (c0 !== c1) maj = c0 > c1 ? 0 : 1;
    else maj = t[g.reduce((best, i) => (P[i] > P[best] ? i : best), g[0])];
    for (const m of g.filter((i) => t[i] !== maj)) {
      let j = -1;
      for (let c = 0; c < n; c++) {
        if (t[c] !== maj || gid[c] !== -1 || sl[c] !== sl[m]) continue;
        if (j === -1 || Math.abs(P[c] - P[m]) < Math.abs(P[j] - P[m])) j = c;
      }
      if (j === -1) continue;
      t[m] = maj;
      t[j] = 1 - maj;
    }
  }
  return swapPhase(t, P, (i) => gid[i] === -1 && !sl[i]);
}

// whole pipeline: S as for buildScores, slGroups per player, groups = friend groups (lock mode 2) or []
export function planTeams(S, formula, slGroups, groups = []) {
  const f = FORMULAS[formula];
  const { P, sub } = buildScores(S, f);
  const dims = f.rateDims ? [...sub, ...rateDims(S), ...kitRows(S.role)] : [...sub, ...kitRows(S.role)];
  let team = balanceMulti(S.sl, P, dims, f.lam, slGroups);
  if (groups.length) team = keepGroups(team, P, groups, S.sl);
  return { P, team };
}

// ---------------------------------------------------------------------------------------------
// SquadJS plugin
// ---------------------------------------------------------------------------------------------

const LIST_PLAYERS_RE =
  /^ID: (\d+) \| Online IDs:([^|]+)\| Name: (.+) \| Team ID: (\d|N\/A)(?: \| Party ID: ([^|]*?))? \| Squad ID: (\d+|N\/A) \| Is Leader: (True|False) \| Role: (.+?)(?: \| Vehicle: .*)?$/;
const DUMP_RE = /^\[([0-9.:-]+)]\[([ 0-9]*)]\w+: .*?SmartShuffleDump (BEGIN|END|P (.*))\s*$/;
const DUMP_KEYS = {
  k: 'kills', w: 'knocks', d: 'deaths', r: 'revives', h: 'heal', dmg: 'damage', s: 'supp', sr: 'supp_recv',
  a: 'ammo', c: 'constr', m: 'markers', ts: 'support', cap: 'caps', capn: 'caps', ct: 'cticks', dt: 'dticks',
  tk: 'tk', min: 'minutes'
};

export function parseListPlayers(text) {
  const out = [];
  for (const line of (text || '').split('\n')) {
    const m = line.trim().match(LIST_PLAYERS_RE);
    if (!m) continue;
    const eos = m[2].match(/EOS: *([0-9a-fA-F]+)/);
    if (!eos || m[4] === 'N/A') continue;
    const party = (m[5] || '').trim();
    out.push({
      eosID: eos[1],
      name: m[3],
      teamID: +m[4],
      partyID: party && party !== 'N/A' ? party : null,
      squadID: m[6] !== 'N/A' ? +m[6] : null,
      isLeader: m[7] === 'True',
      role: m[8]
    });
  }
  return out;
}

// one dump line: "P eos=<id> name=<name>" plus key=value stats, e.g. "P eos=00ab k=12 w=20 ... name=Some Name"
export function parseDumpLine(body) {
  const nameAt = body.indexOf(' name=');
  const head = nameAt >= 0 ? body.slice(0, nameAt) : body;
  const rec = { name: nameAt >= 0 ? body.slice(nameAt + 6) : null, eosID: null, stats: {} };
  for (const tok of head.split(/\s+/)) {
    const eq = tok.indexOf('=');
    if (eq < 0) continue;
    const key = tok.slice(0, eq);
    const val = tok.slice(eq + 1);
    if (key === 'eos') {
      // the game may print "EOS:<id>", "<id>" or a list of IDs; keep the 32 hex digit EOS ID
      const hex = val.match(/[0-9a-f]{32}/i);
      rec.eosID = hex ? hex[0] : val && val !== '-' ? val : null;
    }
    else if (DUMP_KEYS[key]) {
      // keys that map to the same stat add up (cap = captures, capn = neutralizations)
      const k = DUMP_KEYS[key];
      rec.stats[k] = (rec.stats[k] || 0) + (parseFloat(val) || 0);
    }
  }
  return rec;
}

export default class SmartShuffle extends BasePlugin {
  static get description() {
    return (
      'Balances the teams at round end from this match only (kills, wounds, deaths, damage, revives, ' +
      'deployables, kit, squad leaders, friend groups). After a shuffle, team changes are locked for one round.'
    );
  }

  static get defaultEnabled() {
    return false;
  }

  static get optionsSpecification() {
    return {
      command: {
        required: false,
        description: 'Admin chat command: !<command> [status|now|auto on|auto off|lock 0|lock 1|lock 2|unlock].',
        default: 'smartshuffle'
      },
      autoShuffle: {
        required: false,
        description: 'Shuffle automatically at the end of every round.',
        default: false
      },
      lockMode: {
        required: false,
        description: 'After a shuffle, for one round: 0 no lock, 1 hard lock, 2 lock that keeps friend groups (party) together.',
        default: 2
      },
      kitMedic: {
        required: false,
        description: 'Regex on the Role name for medic kits.',
        default: 'Medic'
      },
      kitLogistics: {
        required: false,
        description: 'Regex on the Role name for logistics kits. Empty = not used.',
        default: ''
      },
      kitCrew: {
        required: false,
        description: 'Regex on the Role name for vehicle crew kits (crew SLs form their own SL group).',
        default: 'Crewman|Pilot'
      },
      lockedSquadMaxSize: {
        required: false,
        description: 'A locked squad up to this size counts as a friend squad; its SL is split as its own group.',
        default: 3
      },
      useScoreboardDump: {
        required: false,
        description: 'Hybrid route: read the full scoreboard written to the server log by the ModLoader ruleset.',
        default: false
      },
      dumpWaitSeconds: {
        required: false,
        description: 'Hybrid route: how long to wait at round end for the scoreboard dump.',
        default: 10
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    this.auto = !!this.options.autoShuffle;
    this.lockMode = [0, 1, 2].includes(+this.options.lockMode) ? +this.options.lockMode : 2;
    this.pendingNow = false;
    this.lock = null; // Map eosID -> teamID, lives from a shuffle until the next round end
    this.busy = false;
    this.inMatch = true;
    this.lastTick = Date.now();
    this.stats = new Map();
    this.dump = null;
    this.reverting = new Set();
    this.re = {
      medic: this.options.kitMedic ? new RegExp(this.options.kitMedic, 'i') : null,
      logi: this.options.kitLogistics ? new RegExp(this.options.kitLogistics, 'i') : null,
      crew: this.options.kitCrew ? new RegExp(this.options.kitCrew, 'i') : null
    };
    for (const name of ['onCommand', 'onDamaged', 'onWounded', 'onDied', 'onRevived', 'onDeployable',
      'onTeamkill', 'onPlayerInfo', 'onRoundEnded', 'onNewGame']) {
      this[name] = this[name].bind(this);
    }
    this.dumpRule = {
      regex: DUMP_RE,
      onMatch: (args) => this.onDumpLine(args[3], args[4])
    };
  }

  async mount() {
    this.server.on(`CHAT_COMMAND:${this.options.command}`, this.onCommand);
    this.server.on('PLAYER_DAMAGED', this.onDamaged);
    this.server.on('PLAYER_WOUNDED', this.onWounded);
    this.server.on('PLAYER_DIED', this.onDied);
    this.server.on('PLAYER_REVIVED', this.onRevived);
    this.server.on('DEPLOYABLE_SPAWNED', this.onDeployable);
    this.server.on('TEAMKILL', this.onTeamkill);
    this.server.on('UPDATED_PLAYER_INFORMATION', this.onPlayerInfo);
    this.server.on('ROUND_ENDED', this.onRoundEnded);
    this.server.on('NEW_GAME', this.onNewGame);
    if (this.options.useScoreboardDump) this.server.logParser.getRules().unshift(this.dumpRule);
  }

  async unmount() {
    this.server.removeListener(`CHAT_COMMAND:${this.options.command}`, this.onCommand);
    this.server.removeListener('PLAYER_DAMAGED', this.onDamaged);
    this.server.removeListener('PLAYER_WOUNDED', this.onWounded);
    this.server.removeListener('PLAYER_DIED', this.onDied);
    this.server.removeListener('PLAYER_REVIVED', this.onRevived);
    this.server.removeListener('DEPLOYABLE_SPAWNED', this.onDeployable);
    this.server.removeListener('TEAMKILL', this.onTeamkill);
    this.server.removeListener('UPDATED_PLAYER_INFORMATION', this.onPlayerInfo);
    this.server.removeListener('ROUND_ENDED', this.onRoundEnded);
    this.server.removeListener('NEW_GAME', this.onNewGame);
    const rules = this.server.logParser.getRules();
    const at = rules.indexOf(this.dumpRule);
    if (at >= 0) rules.splice(at, 1);
  }

  // ---- stat collection (this match only) ----

  stat(eosID) {
    if (!eosID) return null;
    let s = this.stats.get(eosID);
    if (!s) {
      s = {};
      for (const k of STAT_KEYS) s[k] = 0;
      this.stats.set(eosID, s);
    }
    return s;
  }

  credited(info) {
    const a = info.attacker ? info.attacker.eosID : info.attackerEOSID;
    const v = info.victim ? info.victim.eosID : null;
    if (!this.inMatch || !a || a === v || info.teamkill) return null;
    return this.stat(a);
  }

  onDamaged(info) {
    const s = this.credited(info);
    if (s) s.damage += info.damage || 0;
  }

  onWounded(info) {
    const s = this.credited(info);
    if (s) s.knocks += 1;
  }

  onDied(info) {
    if (!this.inMatch) return;
    if (info.victim) this.stat(info.victim.eosID).deaths += 1;
    const s = this.credited(info);
    if (s) s.kills += 1;
  }

  onRevived(info) {
    const id = info.reviver ? info.reviver.eosID : info.reviverEOSID;
    const v = info.victim ? info.victim.eosID : info.victimEOSID;
    if (this.inMatch && id && id !== v) this.stat(id).revives += 1;
  }

  onDeployable(info) {
    const id = info.player ? info.player.eosID : info.playerEOSID;
    if (this.inMatch && id) this.stat(id).constr += 1;
  }

  onTeamkill(info) {
    const id = info.attacker ? info.attacker.eosID : info.attackerEOSID;
    if (this.inMatch && id) this.stat(id).tk += 1;
  }

  async onPlayerInfo() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 60000, 1.5);
    this.lastTick = now;
    if (this.inMatch) {
      for (const p of this.server.players) if (p.teamID) this.stat(p.eosID).minutes += dt;
    }
    if (!this.lock || this.lockMode === 0) return;
    for (const p of this.server.players) {
      const want = this.lock.get(p.eosID);
      if (!want || !p.teamID || p.teamID === want || this.reverting.has(p.eosID)) continue;
      this.reverting.add(p.eosID);
      try {
        await this.server.rcon.switchTeam(p.eosID);
        await this.server.rcon.warn(p.eosID, 'Smart Shuffle: team changes are locked until this round ends.');
      } catch (err) {
        this.verbose(1, `Could not move ${p.eosID} back: ${err}`);
      } finally {
        this.reverting.delete(p.eosID);
      }
    }
  }

  onNewGame() {
    this.stats = new Map();
    this.dump = null;
    this.inMatch = true;
    this.lastTick = Date.now();
  }

  // ---- hybrid route: scoreboard dump lines from the ModLoader ruleset ----

  onDumpLine(kind, body) {
    if (kind === 'BEGIN') this.dump = { records: [], done: false };
    else if (kind === 'END') {
      if (this.dump) this.dump.done = true;
    } else if (this.dump && !this.dump.done && body) this.dump.records.push(parseDumpLine(body));
  }

  async waitForDump() {
    const until = Date.now() + 1000 * (+this.options.dumpWaitSeconds || 0);
    while (Date.now() < until && !(this.dump && this.dump.done)) await new Promise((r) => setTimeout(r, 250));
    return this.dump && this.dump.done ? this.dump.records : null;
  }

  // ---- round end ----

  async onRoundEnded() {
    this.inMatch = false;
    this.lock = null;
    if (!(this.auto || this.pendingNow) || this.busy) return;
    this.pendingNow = false;
    this.busy = true;
    try {
      await this.shuffle();
    } catch (err) {
      this.verbose(1, `Shuffle failed: ${err}`);
    } finally {
      this.busy = false;
    }
  }

  kitClass(role) {
    if (this.re.medic && this.re.medic.test(role)) return 1;
    if (this.re.logi && this.re.logi.test(role)) return 2;
    if (this.re.crew && this.re.crew.test(role)) return 3;
    return 0;
  }

  async shuffle() {
    const players = parseListPlayers(await this.server.rcon.execute('ListPlayers'));
    if (players.length < 2) return;
    const [squads] = await this.server.rcon.getSquads();
    const lockedSmall = new Set(
      squads
        .filter((q) => q.locked === 'True' && +q.size <= +this.options.lockedSquadMaxSize)
        .map((q) => `${q.teamID}:${q.squadID}`)
    );

    let formula = 'k6';
    let dumped = null;
    if (this.options.useScoreboardDump) {
      const recs = await this.waitForDump();
      if (recs && recs.length) {
        dumped = new Map();
        for (const r of recs) dumped.set(r.eosID || `name:${r.name}`, r.stats);
        const hit = players.filter((p) => dumped.has(p.eosID) || dumped.has(`name:${p.name}`)).length;
        if (hit >= 0.8 * players.length) formula = 'v4a';
      }
    }

    const S = { sl: [], role: [], team: [] };
    for (const k of STAT_KEYS) S[k] = [];
    const slGroups = [];
    for (const p of players) {
      let s = this.stats.get(p.eosID);
      if (formula === 'v4a') s = { ...s, ...(dumped.get(p.eosID) || dumped.get(`name:${p.name}`) || {}) };
      for (const k of STAT_KEYS) S[k].push((s && s[k]) || 0);
      const kit = this.kitClass(p.role);
      S.sl.push(p.isLeader);
      S.role.push(kit);
      S.team.push(p.teamID - 1);
      slGroups.push(p.isLeader && kit === 3 ? 0 : lockedSmall.has(`${p.teamID}:${p.squadID}`) ? 1 : 2);
    }

    let groups = [];
    if (this.lockMode === 2) {
      const byParty = new Map();
      players.forEach((p, i) => {
        if (!p.partyID) return;
        if (!byParty.has(p.partyID)) byParty.set(p.partyID, []);
        byParty.get(p.partyID).push(i);
      });
      groups = [...byParty.values()].filter((g) => g.length >= 2);
    }

    const { team } = planTeams(S, formula, slGroups, groups);
    let moved = 0;
    for (let i = 0; i < players.length; i++) {
      if (team[i] + 1 === players[i].teamID) continue;
      await this.server.rcon.switchTeam(players[i].eosID);
      moved += 1;
    }
    // the lock check compares against server.players; refresh it first so a poll that started
    // before the moves cannot look like players switching back
    await this.server.updatePlayerList();
    if (this.lockMode > 0) this.lock = new Map(players.map((p, i) => [p.eosID, team[i] + 1]));
    const lockText = this.lockMode > 0 ? ' Team changes are locked until the next round ends.' : '';
    await this.server.rcon.broadcast(`Smart Shuffle: teams balanced (${moved} players moved).${lockText}`);
    this.verbose(1, `Shuffled with ${formula}: ${players.length} players, ${moved} moved, lock ${this.lockMode}.`);
  }

  // ---- admin chat command ----

  async onCommand(info) {
    if (info.chat !== 'ChatAdmin') return;
    const args = (info.message || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    let reply;
    if (args[0] === 'now') {
      this.pendingNow = true;
      reply = 'Smart Shuffle will run at the end of this round.';
    } else if (args[0] === 'auto' && ['on', 'off'].includes(args[1])) {
      this.auto = args[1] === 'on';
      reply = `Smart Shuffle auto: ${this.auto ? 'on' : 'off'}.`;
    } else if (args[0] === 'lock' && ['0', '1', '2'].includes(args[1])) {
      this.lockMode = +args[1];
      if (this.lockMode === 0) this.lock = null;
      reply = `Smart Shuffle lock: ${this.lockMode}.`;
    } else if (args[0] === 'unlock') {
      this.lock = null;
      reply = 'Smart Shuffle: lock lifted for this round.';
    } else {
      reply =
        `Smart Shuffle: auto ${this.auto ? 1 : 0}, lock ${this.lockMode}, ` +
        `pending ${this.pendingNow ? 1 : 0}, locked now ${this.lock ? 1 : 0}. ` +
        `Use: now | auto on/off | lock 0/1/2 | unlock`;
    }
    const id = info.eosID || (info.player && info.player.eosID);
    if (id) await this.server.rcon.warn(id, reply);
  }
}
