// Smart Shuffle for SquadJS.
// Balances the two teams at round end from this match's stats and the last rounds of the session (kept in memory).
// Nothing is written to disk, except the switch tokens file when switchTokens is on.
// Install: copy this one file to SquadJS/squad-server/plugins/ and add an entry to config.json:
//   { "plugin": "SmartShuffle", "enabled": true, "autoShuffle": false, "lockMode": 2 }
// Admin chat: !smartshuffle now | cancel | preview | auto on/off | friends on/off | history on/off | tokens on/off |
//             lock 0/1/2 | unlock | status. Players: !tokens (when switchTokens is on).
// The scoring and balancing part is a port of the offline reference model the formula was tuned with;
// tests/squadjs/core.test.mjs checks it against that model's outputs (tests/squadjs/golden.json).
import fs from 'node:fs';
import BasePlugin from './base-plugin.js';

// ---------------------------------------------------------------------------------------------
// Settings: every switch takes true/false or "on"/"off" (also 1/0, "yes"/"no"); every number takes a
// number, "off" (= 0) or "on" (= 1). 0 always turns a numeric feature off.
// ---------------------------------------------------------------------------------------------

export function flag(v, dflt = false) {
  if (v === undefined || v === null) return dflt;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['on', 'true', 'yes', '1', 'enabled'].includes(s)) return true;
  if (['off', 'false', 'no', '0', '', 'disabled'].includes(s)) return false;
  return dflt;
}

export function num(v, dflt = 0) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === 'off') return 0;
  if (s === 'on') return 1;
  const x = Number(s);
  return Number.isFinite(x) ? x : dflt;
}

// ---------------------------------------------------------------------------------------------
// Switch tokens: kept in a small JSON file so they survive a SquadJS restart (only when switchTokens is on)
// ---------------------------------------------------------------------------------------------

const DAY_MS = 86400000;

export class TokenBook {
  // opts: { start, max, refillHours, decayDays, seedSteps: [minutes...] }
  constructor(opts, data = null) {
    this.o = opts;
    this.players = (data && data.players) || {};
  }

  // the player's record, with refill and inactivity decay applied up to `now`; returns [record, notes]
  touch(id, now) {
    const o = this.o;
    const notes = [];
    let r = this.players[id];
    if (!r) {
      r = { tokens: o.start, lastSeen: now, refillAt: now, seedDay: '', seedMin: 0, seedGot: 0 };
      this.players[id] = r;
      return [r, notes];
    }
    if (o.decayDays > 0 && r.tokens > o.start) {
      const periods = Math.floor((now - r.lastSeen) / (o.decayDays * DAY_MS));
      const lose = Math.min(periods, r.tokens - o.start);
      if (lose > 0) {
        r.tokens -= lose;
        notes.push({ kind: 'decay', lost: lose });
      }
    }
    if (o.refillHours > 0 && r.tokens < o.start) {
      const gain = Math.floor((now - r.refillAt) / (o.refillHours * 3600000));
      if (gain > 0) {
        const got = Math.min(gain, o.start - r.tokens);
        r.tokens += got;
        r.refillAt += gain * o.refillHours * 3600000;
        notes.push({ kind: 'refill', got });
      }
    } else r.refillAt = now;
    r.lastSeen = now;
    return [r, notes];
  }

  spend(id, now) {
    const [r] = this.touch(id, now);
    if (r.tokens <= 0) return false;
    if (r.tokens === this.o.start) r.refillAt = now; // refill clock starts with the first spent token
    r.tokens -= 1;
    return true;
  }

  // minutes of seeding by this player, counted per calendar day; returns how many tokens were just earned
  seed(id, now, minutes) {
    const [r] = this.touch(id, now);
    const day = new Date(now).toISOString().slice(0, 10);
    if (r.seedDay !== day) {
      r.seedDay = day;
      r.seedMin = 0;
      r.seedGot = 0;
    }
    r.seedMin += minutes;
    const reached = this.o.seedSteps.filter((m) => m > 0 && r.seedMin >= m).length;
    let earned = 0;
    while (r.seedGot < reached) {
      r.seedGot += 1;
      if (!this.o.max || r.tokens < this.o.max) {
        r.tokens += 1;
        earned += 1;
      }
    }
    return earned;
  }

  toJSON() {
    return { version: 1, players: this.players };
  }
}

// groups (arrays of player indexes) that share a player become one group
export function mergeGroups(groups) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  for (const g of groups) {
    for (const i of g) if (!parent.has(i)) parent.set(i, i);
    for (let k = 1; k < g.length; k++) {
      const a = find(g[0]);
      const b = find(g[k]);
      if (a !== b) parent.set(b, a);
    }
  }
  const out = new Map();
  for (const i of parent.keys()) {
    const r = find(i);
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(i);
  }
  return [...out.values()].map((g) => g.sort((a, b) => a - b)).filter((g) => g.length >= 2);
}

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
  const others = [...Array(P.length).keys()].filter((i) => !sl[i]);
  return multiSwaps(team, P, cats, lam, others, maxIter);
}

// pair swaps among `others` that shrink the score gap and the gap in every extra dimension (changes team)
function multiSwaps(team, P, cats, lam, others, maxIter = 100) {
  const n = P.length;
  const D = cats.length;
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

// friends on: every friend group (party) goes to its majority side, the most similar free player moves the
// other way, then swaps among free players only repair the balance: with cats the same target as
// balanceMulti (score sum and every extra dimension), without cats the score sum alone
// sideOf: optional function group -> side the group should end on (fewerMoves: the side it plays on now);
// left out, a group goes to its majority side in `team`
export function keepGroups(team, P, groups, sl, cats = null, lam = 1, sideOf = null) {
  const t = team.slice();
  const n = P.length;
  const gid = new Array(n).fill(-1);
  groups.forEach((g, k) => g.forEach((i) => (gid[i] = k)));
  for (const g of groups) {
    const c0 = g.filter((i) => t[i] === 0).length;
    const c1 = g.length - c0;
    let maj;
    if (sideOf) maj = sideOf(g);
    else if (c0 !== c1) maj = c0 > c1 ? 0 : 1;
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
  const free = (i) => gid[i] === -1 && !sl[i];
  if (!cats) return swapPhase(t, P, free);
  return multiSwaps(t, P, cats, lam, [...Array(n).keys()].filter(free));
}

// fewer moves: first swap the two team labels if more than half of the players would change side (same
// split), then move players back to their current side in pairs (one each way, the pair that keeps the
// balance target lowest first) while the target stays within (1 + slack) of the balanced split.
// Squad leaders and kept friend groups are not moved back. current: 0/1 side each player is on now.
export function moveBack(team, P, cats, lam, sl, groups, current, slack) {
  const n = P.length;
  let t = team.slice();
  let moved = 0;
  for (let i = 0; i < n; i++) if (t[i] !== current[i]) moved += 1;
  if (moved > n / 2) t = t.map((x) => 1 - x);
  if (!(slack > 0)) return t;
  const kept = new Array(n).fill(false);
  groups.forEach((g) => g.forEach((i) => (kept[i] = true)));
  const D = cats.length;
  const tp = sum(P);
  const tc = cats.map((row) => Math.max(sum(row), 1e-9));
  const sideSum = (row, s) => {
    let v = 0;
    for (let i = 0; i < n; i++) if (t[i] === s) v += row[i];
    return v;
  };
  let dP = sideSum(P, 0) - sideSum(P, 1);
  let dC = cats.map((row) => sideSum(row, 0) - sideSum(row, 1));
  const costOf = (np, nc) => {
    let m = 0;
    for (let d = 0; d < D; d++) m += Math.abs(nc[d]) / tc[d];
    return Math.abs(np) / tp + lam * (m / D);
  };
  const limit = (1 + slack) * costOf(dP, dC);
  const nC = new Array(D);
  for (let it = 0; it < 200; it++) {
    const A = [];
    const B = [];
    for (let i = 0; i < n; i++) {
      if (sl[i] || kept[i] || t[i] === current[i]) continue;
      (t[i] === 0 ? A : B).push(i);
    }
    let best = null;
    for (const a of A) {
      for (const b of B) {
        const np = dP - 2 * (P[a] - P[b]);
        for (let d = 0; d < D; d++) nC[d] = dC[d] - 2 * (cats[d][a] - cats[d][b]);
        const cost = costOf(np, nC);
        if (cost <= limit && (best === null || cost < best.cost)) best = { cost, a, b, np, nc: nC.slice() };
      }
    }
    if (best === null) break;
    t[best.a] = 1;
    t[best.b] = 0;
    dP = best.np;
    dC = best.nc;
  }
  return t;
}

// whole pipeline: S as for buildScores, slGroups per player, groups = friend groups to keep together or []
// adjust: optional function P -> P, applied to the scores before the split (outside rating, see blendScores)
// fewerMoves: 0 = off; above 0 the split moves fewer players, allowing the balance target to grow to (1 + fewerMoves) x
export function planTeams(S, formula, slGroups, groups = [], adjust = null, fewerMoves = 0) {
  const f = FORMULAS[formula];
  const scored = buildScores(S, f);
  const sub = scored.sub;
  const P = adjust ? adjust(scored.P) : scored.P;
  const dims = f.rateDims ? [...sub, ...rateDims(S), ...kitRows(S.role)] : [...sub, ...kitRows(S.role)];
  let team = balanceMulti(S.sl, P, dims, f.lam, slGroups);
  if (fewerMoves > 0) {
    // fewer moves: label the split to the current teams, keep each friend group on the side it plays on now
    // (its majority there), then move players back while the balance allows it
    const cur = S.team;
    let moved = 0;
    for (let i = 0; i < team.length; i++) if (team[i] !== cur[i]) moved += 1;
    if (moved > team.length / 2) team = team.map((x) => 1 - x);
    if (groups.length) {
      const sideNow = (g) => {
        const on1 = g.filter((i) => cur[i] === 1).length;
        return 2 * on1 > g.length ? 1 : 2 * on1 < g.length ? 0 : cur[g[0]];
      };
      team = keepGroups(team, P, groups, S.sl, dims, f.lam, sideNow);
    }
    team = moveBack(team, P, dims, f.lam, S.sl, groups, cur, fewerMoves);
  } else if (groups.length) team = keepGroups(team, P, groups, S.sl, dims, f.lam);
  return { P, team };
}

// ---------------------------------------------------------------------------------------------
// optional inputs: earlier rounds of this session, and an outside long term rating
// ---------------------------------------------------------------------------------------------

// Session history: this match plus the average of the player's earlier rounds (rounds: array of stat
// objects). The formula itself is unchanged, it only sees more minutes of the same player.
export function withHistory(now, rounds) {
  if (!rounds || !rounds.length) return now;
  const out = {};
  for (const k of STAT_KEYS) {
    let s = 0;
    for (const r of rounds) s += r[k] || 0;
    out[k] = ((now && now[k]) || 0) + s / rounds.length;
  }
  return out;
}

function zScores(x, ok) {
  let n = 0;
  let m = 0;
  for (let i = 0; i < x.length; i++) if (ok[i]) { n += 1; m += x[i]; }
  m /= Math.max(n, 1);
  let v = 0;
  for (let i = 0; i < x.length; i++) if (ok[i]) v += (x[i] - m) ** 2;
  const sd = Math.sqrt(v / Math.max(n, 1));
  return x.map((value) => (sd > 0 ? (value - m) / sd : 0));
}

// Long term rating from all-time totals as a stats site gives them (no play time): (kills + wounds) per
// death and revives per death, each pulled toward the average of the known players with 30 deaths, as
// z-scores weighted 0.7 / 0.3. tot: { kills, knocks, deaths, revives } arrays, known: bool array.
// Returns one value per player, NaN where there is no usable data (unknown, or under 30 deaths).
export function longTermRating(tot, known, priorDeaths = 30, minDeaths = 30) {
  const n = known.length;
  const ok = known.map((k, i) => !!k && tot.deaths[i] >= minDeaths);
  if (ok.filter(Boolean).length < 10) return new Array(n).fill(NaN);
  let dsum = 0;
  for (let i = 0; i < n; i++) if (ok[i]) dsum += tot.deaths[i];
  const out = new Array(n).fill(0);
  const parts = [[tot.kills.map((v, i) => v + tot.knocks[i]), 0.7], [tot.revives, 0.3]];
  for (const [arr, weight] of parts) {
    let asum = 0;
    for (let i = 0; i < n; i++) if (ok[i]) asum += arr[i];
    const m0 = asum / Math.max(dsum, 1e-9);
    const zs = zScores(arr.map((v, i) => (v + priorDeaths * m0) / (tot.deaths[i] + priorDeaths)), ok);
    for (let i = 0; i < n; i++) out[i] += weight * zs[i];
  }
  const L = zScores(out, ok);
  return L.map((v, i) => (ok[i] ? v : NaN));
}

// Outside rating on: the score becomes (1 - w) * this match + w * long term, on the scale of P.
// A player without long term data keeps the score of this match.
export function blendScores(P, L, w) {
  if (!(w > 0)) return P;
  const all = P.map(() => true);
  const zp = zScores(P, all);
  const mean = sum(P) / P.length;
  const sd = Math.sqrt(sum(P.map((v) => (v - mean) ** 2)) / P.length);
  return P.map((_, i) => Math.max(mean + sd * ((1 - w) * zp[i] + w * (Number.isNaN(L[i]) ? zp[i] : L[i])), 0.02 * mean));
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

// difference between the two sides' score sums, in percent of the total
function scoreGap(P, isTeam2) {
  let a = 0;
  let b = 0;
  P.forEach((v, i) => (isTeam2(i) ? (b += v) : (a += v)));
  return a + b > 0 ? (100 * Math.abs(a - b)) / (a + b) : 0;
}

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
      'Balances the teams at round end from this match and the last rounds of the session (kills, wounds, deaths, damage, revives, ' +
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
        description: 'Admin chat command: !<command> [status|now|cancel|preview|auto on|auto off|friends on|friends off|history on|history off|mss on|mss off|lock 0|lock 1|lock 2|unlock].',
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
      keepParties: {
        required: false,
        description: 'Keep friend groups (party) on one side when shuffling: true or false. Leave it out to follow lockMode (on for 2, off for 0 and 1).',
        default: null
      },
      shuffleDelaySeconds: {
        required: false,
        description: 'Seconds to wait after the round ends before players are moved, so they can read the scoreboard. 0 to 25. Cut short by itself when the moves need the time to finish before the map changes.',
        default: 0
      },
      shuffleDeadlineSeconds: {
        required: false,
        description: 'No player is moved later than this many seconds after the round ended, and never after the next map started.',
        default: 30
      },
      announceMinutes: {
        required: false,
        description: 'While a shuffle is due at round end, tell the server every this many minutes. 0 = no announcements.',
        default: 10
      },
      broadcastResult: {
        required: false,
        description: 'Tell the server after a shuffle how many players were moved.',
        default: true
      },
      warnMovedPlayers: {
        required: false,
        description: 'Tell every moved player in a private message that they changed team.',
        default: true
      },
      adminReport: {
        required: false,
        description: 'Send the result of a shuffle (moved, not placed, score gap before and after) to the admins online.',
        default: true
      },
      historyRounds: {
        required: false,
        description: 'Also count each player\'s earlier rounds of this session (kept in memory only): how many rounds back. 0 = only this match. Not used on the hybrid route.',
        default: 4
      },
      historyHours: {
        required: false,
        description: 'Earlier rounds older than this many hours are not counted.',
        default: 6
      },
      useMySquadStats: {
        required: false,
        description: 'Blend an all-time rating from mysquadstats.com into the score. Needs mySquadStatsToken. Experimental.',
        default: false
      },
      mySquadStatsToken: {
        required: false,
        description: 'Access token of your server for the MySquadStats API (the one the MySquadStats plugin uses).',
        default: ''
      },
      mySquadStatsWeight: {
        required: false,
        description: 'Share of the all-time rating in the score, 0 to 1.',
        default: 0.15
      },
      mySquadStatsDlc: {
        required: false,
        description: 'Which MySquadStats leaderboard to read.',
        default: 'vanilla'
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
      maxPartySize: {
        required: false,
        description: 'Lock mode 2: a friend group (party) up to this size stays together; a bigger party is split like everyone else. 0 = no limit.',
        default: 4
      },
      fewerMoves: {
        required: false,
        description: 'Move fewer players: 0 = off. Above 0 the shuffle keeps more players, and every kept friend group, on their current side and allows the balance target to grow by that factor (0.1 = 10 percent: a third fewer players moved, same balance in simulation; 4 = up to 5 times: about one player in ten moved, more stomped matches). 0 to 10.',
        default: 0
      },
      skipLayers: {
        required: false,
        description: 'Auto shuffle skips a round whose layer name contains one of these (case insensitive). An admin "now" always runs.',
        default: ['seed', 'jensen', 'invasion']
      },
      minPlayers: {
        required: false,
        description: 'Auto shuffle skips a round with fewer players than this. An admin "now" always runs.',
        default: 40
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
      },
      shuffleTicketGap: {
        required: false,
        description: 'Automatic shuffle only after a round won by at least this many tickets. 0 = every round. With shuffleWinStreak set too, either one is enough.',
        default: 0
      },
      shuffleWinStreak: {
        required: false,
        description: 'Automatic shuffle only after the same group of players won this many rounds in a row. 0 = off.',
        default: 0
      },
      moveSquads: {
        required: false,
        description: 'Keep whole squads together when shuffling (up to maxPartySize players), not only parties: on or off.',
        default: false
      },
      switchCommand: {
        required: false,
        description: 'Switch gate: players ask with this chat command (e.g. "switch" for !switch) and the plugin moves them when allowed (token in a locked round, team sizes), instead of switching and being moved back. "off" = no gate.',
        default: 'off'
      },
      switchMaxDiff: {
        required: false,
        description: 'Switch gate: a move is allowed while the bigger team ends at most this many players ahead.',
        default: 2
      },
      switchQueueMinutes: {
        required: false,
        description: 'Switch gate: a request that cannot be done now waits this many minutes for a free slot or a player switching the other way (then both are swapped). 0 = no queue.',
        default: 10
      },
      imbalanceAlertMinutes: {
        required: false,
        description: 'This many minutes into a match, tell the admins online (only them) when the teams look uneven. 0 = off.',
        default: 0
      },
      imbalanceAlertGap: {
        required: false,
        description: 'Score gap in percent that counts as uneven for imbalanceAlertMinutes.',
        default: 15
      },
      lockCheckSeconds: {
        required: false,
        description: 'While teams are locked, read the player list this often (seconds) so a switch is undone fast. 0 = only on SquadJS\'s own update (about every 30 s).',
        default: 5
      },
      announceLockStart: {
        required: false,
        description: 'At the start of a locked round tell the server that team changes are locked: on or off.',
        default: true
      },
      announceLockEnd: {
        required: false,
        description: 'When the lock ends at round end tell the server: on or off.',
        default: false
      },
      reportSkips: {
        required: false,
        description: 'Tell the admins online when an automatic shuffle is skipped and why: on or off.',
        default: true
      },
      switchTokens: {
        required: false,
        description: 'Switch tokens: during a locked round a player may switch team by spending a token instead of being moved back. on or off.',
        default: false
      },
      tokenStart: {
        required: false,
        description: 'Tokens every player has (and gets back over time, see tokenRefillHours).',
        default: 2
      },
      tokenMax: {
        required: false,
        description: 'Most tokens a player can hold. 0 = no limit.',
        default: 5
      },
      tokenRefillHours: {
        required: false,
        description: 'A spent token comes back after this many hours, up to tokenStart. 0 = spent tokens do not come back.',
        default: 24
      },
      tokenSeedMinutes: {
        required: false,
        description: 'Seeding minutes in one day that earn a lasting token each, e.g. [15, 60, 180] = +1 after 15 min, +2 after 1 h, +3 after 3 h. [] = no seed tokens.',
        default: [15, 60, 180]
      },
      tokenSeedPlayers: {
        required: false,
        description: 'The server counts as seeding below this many players (or on a layer named seed). 0 = only seed layers.',
        default: 50
      },
      tokenDecayDays: {
        required: false,
        description: 'A player away this many days loses one earned token per period, never below tokenStart. 0 = never.',
        default: 21
      },
      tokenMessages: {
        required: false,
        description: 'Private messages about tokens (used, left, earned, lost): on or off.',
        default: true
      },
      tokenCommand: {
        required: false,
        description: 'Chat command any player can type to see his tokens, e.g. "tokens" for !tokens. "off" = no command.',
        default: 'tokens'
      },
      tokenFile: {
        required: false,
        description: 'File the tokens are kept in, relative to the SquadJS folder.',
        default: 'smart-shuffle-tokens.json'
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    // every switch accepts true/false or on/off, every number accepts a number or on/off (0 = off)
    const o = this.options;
    for (const k of ['autoShuffle', 'broadcastResult', 'warnMovedPlayers', 'adminReport', 'useMySquadStats',
      'useScoreboardDump', 'announceLockStart', 'announceLockEnd', 'reportSkips', 'switchTokens', 'tokenMessages', 'moveSquads']) {
      o[k] = flag(o[k], flag(SmartShuffle.optionsSpecification[k].default));
    }
    if (o.keepParties !== null && o.keepParties !== undefined) o.keepParties = flag(o.keepParties, true);
    for (const k of ['lockMode', 'shuffleDelaySeconds', 'shuffleDeadlineSeconds', 'announceMinutes', 'historyRounds',
      'historyHours', 'mySquadStatsWeight', 'lockedSquadMaxSize', 'maxPartySize', 'minPlayers', 'dumpWaitSeconds',
      'fewerMoves', 'lockCheckSeconds', 'tokenStart', 'tokenMax', 'tokenRefillHours', 'tokenSeedPlayers', 'tokenDecayDays',
      'shuffleTicketGap', 'shuffleWinStreak', 'switchMaxDiff', 'switchQueueMinutes', 'imbalanceAlertMinutes', 'imbalanceAlertGap']) {
      o[k] = num(o[k], SmartShuffle.optionsSpecification[k].default);
    }
    o.tokenSeedMinutes = [].concat(o.tokenSeedMinutes === 'off' ? [] : o.tokenSeedMinutes || [])
      .map((m) => num(m, 0)).filter((m) => m > 0).sort((a, b) => a - b);
    const tc = String(o.tokenCommand === undefined || o.tokenCommand === null ? 'tokens' : o.tokenCommand).trim().toLowerCase();
    this.tokenCmd = ['off', 'false', '0', '', 'no'].includes(tc) ? null : ['on', 'true', '1', 'yes'].includes(tc) ? 'tokens' : tc.replace(/^!/, '');
    const sc = String(o.switchCommand === undefined || o.switchCommand === null ? 'off' : o.switchCommand).trim().toLowerCase();
    this.switchCmd = ['off', 'false', '0', '', 'no'].includes(sc) ? null : ['on', 'true', '1', 'yes'].includes(sc) ? 'switch' : sc.replace(/^!/, '');
    this.queue = []; // switch gate requests waiting: { id, to, until }
    this.squads = o.moveSquads;
    this.streak = 0;
    this.lastWinners = null;
    this.matchStart = Date.now();
    this.alerted = false;
    this.tokens = o.switchTokens
      ? new TokenBook({ start: o.tokenStart, max: o.tokenMax, refillHours: o.tokenRefillHours,
          decayDays: o.tokenDecayDays, seedSteps: o.tokenSeedMinutes })
      : null;
    this.tokenDirty = false;
    this.tokenTimer = null;
    this.lockTimer = null;
    this.auto = !!this.options.autoShuffle;
    const mode = [0, 1, 2].includes(+this.options.lockMode) ? +this.options.lockMode : 2;
    this.locking = mode > 0; // hold the new teams for one round
    this.friends = typeof this.options.keepParties === 'boolean' ? this.options.keepParties : mode === 2;
    this.pendingNow = false;
    this.requester = null; // admin who asked for "now", gets the report
    this.lock = null; // Map eosID -> teamID, lives from a shuffle until the next round end
    this.lockAligned = true; // false from the map change until the team numbers were checked
    this.round = 0; // counts map changes; a shuffle that sees it change stops
    this.moveMs = 0; // slowest time per team change seen so far, used to budget the next shuffle
    this.historyOn = (+this.options.historyRounds || 0) > 0;
    this.history = new Map(); // eosID -> [{ t, s }] earlier rounds of this session, newest last
    this.roundCounts = false; // the round that just ended was a real one (not a skipped layer)
    this.outsideOn = !!this.options.useMySquadStats && !!this.options.mySquadStatsToken;
    this.outside = new Map(); // steamID -> { t, kills, knocks, deaths, revives } or { t, none: true }
    this.outsidePause = 0; // no API call before this time (after an error)
    this.outsideGapMs = 1000; // pause between two API calls
    this.outsideBusy = false;
    this.layerClass = null;
    this.announceTimer = null;
    this.busy = false;
    this.inMatch = true;
    this.lastTick = Date.now();
    this.stats = new Map();
    this.dump = null;
    this.reverting = new Set();
    this.last = null; // result of the latest shuffle: { moved, failed }
    this.skipLayers = []
      .concat(this.options.skipLayers || [])
      .flatMap((s) => String(s).split(','))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.re = {
      medic: this.options.kitMedic ? new RegExp(this.options.kitMedic, 'i') : null,
      logi: this.options.kitLogistics ? new RegExp(this.options.kitLogistics, 'i') : null,
      crew: this.options.kitCrew ? new RegExp(this.options.kitCrew, 'i') : null
    };
    for (const name of ['onCommand', 'onDamaged', 'onWounded', 'onDied', 'onRevived', 'onDeployable',
      'onTeamkill', 'onPlayerInfo', 'onRoundEnded', 'onNewGame', 'onAnnounce', 'onTokenCommand', 'onLockCheck',
      'onSwitchCommand']) {
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
    const minutes = +this.options.announceMinutes || 0;
    if (minutes > 0) {
      this.announceTimer = setInterval(this.onAnnounce, minutes * 60000);
      if (this.announceTimer.unref) this.announceTimer.unref();
    }
    const check = this.options.lockCheckSeconds;
    if (check > 0) {
      this.lockTimer = setInterval(this.onLockCheck, Math.max(check, 2) * 1000);
      if (this.lockTimer.unref) this.lockTimer.unref();
    }
    if (this.tokens) this.loadTokens();
    // registered even while tokens are off, so an admin can switch them on in game ("tokens on")
    if (this.tokenCmd) this.server.on(`CHAT_COMMAND:${this.tokenCmd}`, this.onTokenCommand);
    if (this.switchCmd) this.server.on(`CHAT_COMMAND:${this.switchCmd}`, this.onSwitchCommand);
    this.tokenTimer = setInterval(() => this.saveTokens(), 30000);
    if (this.tokenTimer.unref) this.tokenTimer.unref();
  }

  // ---- switch tokens ----

  loadTokens() {
    try {
      const data = JSON.parse(fs.readFileSync(this.options.tokenFile, 'utf8'));
      this.tokens = new TokenBook(this.tokens.o, data);
    } catch (err) {
      if (err.code !== 'ENOENT') this.verbose(1, `Switch tokens: could not read ${this.options.tokenFile}: ${err}`);
    }
  }

  saveTokens(force = false) {
    if (!this.tokens || (!this.tokenDirty && !force)) return;
    try {
      const tmp = `${this.options.tokenFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.tokens.toJSON()));
      fs.renameSync(tmp, this.options.tokenFile);
      this.tokenDirty = false;
    } catch (err) {
      this.verbose(1, `Switch tokens: could not write ${this.options.tokenFile}: ${err}`);
    }
  }

  tokenNote(id, text) {
    if (this.options.tokenMessages) return this.tell([id], `Smart Shuffle: ${text}`);
  }

  seeding() {
    const on = this.server.players.filter((p) => +p.teamID === 1 || +p.teamID === 2).length;
    const limit = this.options.tokenSeedPlayers;
    const layer = String((this.server.currentLayer && (this.server.currentLayer.name || this.server.currentLayer.layerid)) ||
      this.server.currentLayer || this.layerClass || '').toLowerCase();
    return layer.includes('seed') || (limit > 0 && on < limit);
  }

  // called on every player list update: last seen, refill, decay notices and seed tokens
  async tokenTick(dt, now = Date.now()) {
    if (!this.tokens) return;
    const seed = dt > 0 && this.options.tokenSeedMinutes.length > 0 && this.seeding();
    for (const p of this.server.players) {
      if (!p.eosID) continue;
      const [r, notes] = this.tokens.touch(p.eosID, now);
      this.tokenDirty = true;
      for (const n of notes) {
        if (n.kind === 'decay') await this.tokenNote(p.eosID, `${n.lost} switch token${n.lost > 1 ? 's' : ''} expired after a long break. You have ${r.tokens}.`);
      }
      if (seed && (+p.teamID === 1 || +p.teamID === 2)) {
        const got = this.tokens.seed(p.eosID, now, dt);
        if (got > 0) {
          await this.tokenNote(p.eosID, `+${got} switch token for seeding (${Math.round(r.seedMin)} min today). You have ${r.tokens}. Thank you!`);
        }
      }
    }
  }

  async onTokenCommand(info) {
    const id = info.eosID || (info.player && info.player.eosID);
    if (!id || !this.tokens) return;
    const [r] = this.tokens.touch(id, Date.now());
    this.tokenDirty = true;
    const next = this.options.tokenSeedMinutes.find((m) => m > r.seedMin);
    const refill = r.tokens < this.options.tokenStart && this.options.tokenRefillHours > 0
      ? ` Next refill in ${Math.max(1, Math.ceil((r.refillAt + this.options.tokenRefillHours * 3600000 - Date.now()) / 3600000))} h.`
      : '';
    const seed = next ? ` Seed ${Math.ceil(next - r.seedMin)} more min today for +1.` : '';
    await this.tell([id], `Smart Shuffle: you have ${r.tokens} switch token${r.tokens === 1 ? '' : 's'}. ` +
      `A token lets you change team while teams are locked.${refill}${seed}`);
  }

  // ---- switch gate (!switch): the plugin moves a player when it is allowed, so nobody switches and is sent back ----

  teamSizes() {
    const n = { 1: 0, 2: 0 };
    for (const p of this.server.players) if (+p.teamID === 1 || +p.teamID === 2) n[+p.teamID] += 1;
    return n;
  }

  // the move keeps the teams within switchMaxDiff of each other
  fits(from) {
    const n = this.teamSizes();
    const to = 3 - from;
    return n[to] + 1 - (n[from] - 1) <= Math.max(this.options.switchMaxDiff, 0);
  }

  // in a locked round a gate move costs a token; without tokens the lock forbids it
  canPay(id, now) {
    if (!(this.lock && this.locking)) return true;
    if (!this.tokens) return false;
    const [r] = this.tokens.touch(id, now);
    return r.tokens > 0;
  }

  async gateMove(p, now, how) {
    const from = +p.teamID;
    let paid = '';
    if (this.lock && this.locking) {
      if (this.tokens && this.tokens.spend(p.eosID, now)) {
        this.tokenDirty = true;
        paid = ` 1 switch token used, ${this.tokens.players[p.eosID].tokens} left.`;
      } else return false;
    }
    this.reverting.add(p.eosID);
    try {
      await this.server.rcon.switchTeam(p.eosID);
      p.teamID = 3 - from;
      if (this.lock) this.lock.set(p.eosID, 3 - from);
      await this.tell([p.eosID], `Smart Shuffle: you were moved to team ${3 - from}${how}.${paid}`);
      return true;
    } catch (err) {
      this.verbose(1, `Switch gate: could not move ${p.eosID}: ${err}`);
      return false;
    } finally {
      this.reverting.delete(p.eosID);
    }
  }

  async onSwitchCommand(info) {
    const id = info.eosID || (info.player && info.player.eosID);
    const p = id && this.server.players.find((x) => x.eosID === id);
    if (!p || !(+p.teamID === 1 || +p.teamID === 2)) return;
    const word = (info.message || '').trim().toLowerCase();
    const now = Date.now();
    if (word === 'cancel') {
      const had = this.queue.some((q) => q.id === id);
      this.queue = this.queue.filter((q) => q.id !== id);
      return this.tell([id], had ? 'Smart Shuffle: your switch request is cancelled.' : 'Smart Shuffle: you have no switch request.');
    }
    if (this.busy || !this.inMatch) return this.tell([id], 'Smart Shuffle: switching is closed until the next match starts.');
    if (!this.canPay(id, now)) {
      return this.tell([id], this.tokens
        ? 'Smart Shuffle: teams are locked this round and you have no switch tokens left.'
        : 'Smart Shuffle: teams are locked this round, switching opens after the round ends.');
    }
    const from = +p.teamID;
    // someone on the other team is waiting to come over: swap the two, the sizes stay the same
    const partner = this.queue.find((q) => q.to === from && this.canPay(q.id, now));
    if (partner) {
      const other = this.server.players.find((x) => x.eosID === partner.id);
      this.queue = this.queue.filter((q) => q !== partner);
      if (other && +other.teamID === 3 - from && (await this.gateMove(other, now, ' (swapped with a player who asked for your team)'))) {
        await this.gateMove(p, now, ' (swapped with a player who asked for your team)');
        return;
      }
    }
    if (this.fits(from)) {
      await this.gateMove(p, now, '');
      return;
    }
    const minutes = this.options.switchQueueMinutes;
    if (!(minutes > 0)) return this.tell([id], `Smart Shuffle: team ${3 - from} is full right now, try again later.`);
    this.queue = this.queue.filter((q) => q.id !== id);
    this.queue.push({ id, to: 3 - from, until: now + minutes * 60000 });
    await this.tell([id], `Smart Shuffle: team ${3 - from} is full, you are in the queue for ${minutes} min. ` +
      `You move when a slot opens or someone there wants your team. !${this.switchCmd} cancel to leave the queue.`);
  }

  // waiting requests: drop the expired ones, move whoever fits now
  async runQueue(now) {
    const keep = [];
    for (const q of this.queue) {
      const p = this.server.players.find((x) => x.eosID === q.id);
      if (!p || +p.teamID === q.to) continue; // left, or already over there
      if (now > q.until) {
        await this.tell([q.id], 'Smart Shuffle: your switch request timed out.');
        continue;
      }
      if (this.inMatch && !this.busy && this.canPay(q.id, now) && this.fits(+p.teamID) &&
          (await this.gateMove(p, now, ' (from the queue)'))) continue;
      keep.push(q);
    }
    this.queue = keep;
  }

  // ---- mid-match check for the admins ----

  async imbalanceAlert() {
    try {
      const plan = await this.plan(false);
      if (!plan) return;
      const { players, P } = plan;
      const gap = scoreGap(P, (i) => players[i].teamID === 2);
      if (gap < this.options.imbalanceAlertGap) return;
      const n = this.teamSizes();
      const strong = (() => {
        let a = 0;
        let b = 0;
        players.forEach((pl, i) => (pl.teamID === 2 ? (b += P[i]) : (a += P[i])));
        return a >= b ? 1 : 2;
      })();
      await this.tell(this.adminsOnline(null),
        `Smart Shuffle: teams look uneven ${this.options.imbalanceAlertMinutes} min in (score gap ${gap.toFixed(0)}%, ` +
        `team ${strong} stronger, ${n[1]} v ${n[2]} players). "!${this.options.command} now" balances them at round end.`);
    } catch (err) {
      this.verbose(1, `Imbalance check: ${err}`);
    }
  }

  // a faster read of the player list while teams are locked, so a switch is noticed within seconds
  async onLockCheck() {
    if (!this.lock || !this.locking || this.busy || this.checking) return;
    this.checking = true;
    try {
      await this.server.updatePlayerList();
    } catch (err) {
      this.verbose(1, `Lock check: ${err}`);
    } finally {
      this.checking = false;
    }
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
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.announceTimer = null;
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = null;
    if (this.tokenTimer) clearInterval(this.tokenTimer);
    this.tokenTimer = null;
    if (this.tokenCmd) this.server.removeListener(`CHAT_COMMAND:${this.tokenCmd}`, this.onTokenCommand);
    if (this.switchCmd) this.server.removeListener(`CHAT_COMMAND:${this.switchCmd}`, this.onSwitchCommand);
    if (this.tokens) this.saveTokens(true);
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
    if (this.outsideOn) this.fetchOutside().catch((err) => this.verbose(1, `MySquadStats: ${err}`));
    if (this.tokens) await this.tokenTick(this.inMatch ? dt : 0, now);
    if (this.queue.length) await this.runQueue(now);
    if (this.inMatch && !this.alerted && this.options.imbalanceAlertMinutes > 0 &&
        now - this.matchStart >= this.options.imbalanceAlertMinutes * 60000) {
      this.alerted = true;
      await this.imbalanceAlert();
    }
    if (!this.lock || !this.locking) return;
    const seen = this.server.players.filter((p) => (+p.teamID === 1 || +p.teamID === 2) && this.lock.has(p.eosID));
    if (!this.lockAligned) {
      // the game usually swaps the team numbers (1 <-> 2) at a map change, but not always. Wait until at
      // least half of the locked players are back on a team, then keep whichever reading fits more of them.
      if (seen.length < Math.max(2, 0.5 * this.lock.size)) return;
      const same = seen.filter((p) => +p.teamID === this.lock.get(p.eosID)).length;
      if (seen.length - same > same) {
        for (const [id, t] of this.lock) this.lock.set(id, 3 - t);
        this.verbose(1, 'Team numbers swapped at the map change; the lock follows them.');
      }
      this.lockAligned = true;
    }
    const wrong = seen.filter((p) => +p.teamID !== this.lock.get(p.eosID) && !this.reverting.has(p.eosID));
    // a few players switching back is what the lock is for. Many at once is not players switching, it is
    // the list being unreliable (map load): moving them would be a second shuffle in mid-match.
    if (wrong.length > Math.max(3, 0.15 * seen.length)) {
      this.verbose(1, `Lock check skipped: ${wrong.length} of ${seen.length} players look switched at once.`);
      return;
    }
    for (const p of wrong) {
      // a switch token pays for the change: the player stays and the lock follows him
      if (this.tokens && this.tokens.spend(p.eosID, now)) {
        this.tokenDirty = true;
        this.lock.set(p.eosID, +p.teamID);
        const left = this.tokens.players[p.eosID].tokens;
        await this.tokenNote(p.eosID, `you used 1 switch token to change team. ${left} left.`);
        continue;
      }
      this.reverting.add(p.eosID);
      try {
        await this.server.rcon.switchTeam(p.eosID);
        let tip = this.tokens
          ? ` You have no switch tokens left${this.options.tokenSeedMinutes.length ? ', seed the server to earn more' : ''}.`
          : '';
        if (this.switchCmd) tip += ` Type !${this.switchCmd} to ask for a switch.`;
        await this.server.rcon.warn(p.eosID, `Smart Shuffle: team changes are locked until this round ends, you were moved back.${tip}`);
      } catch (err) {
        this.verbose(1, `Could not move ${p.eosID} back: ${err}`);
      } finally {
        this.reverting.delete(p.eosID);
      }
    }
  }

  onNewGame(info) {
    this.round += 1; // a shuffle still running stops here: nobody is moved once the next match loads
    this.lockAligned = !this.lock;
    this.remember();
    this.layerClass = (info && (info.layerClassname || (info.layer && info.layer.classname))) || null;
    this.stats = new Map();
    this.dump = null;
    this.inMatch = true;
    this.lastTick = Date.now();
    this.matchStart = Date.now();
    this.alerted = false;
    this.queue = [];
    if (this.lock && this.locking && this.options.announceLockStart) {
      const how = this.tokens ? ` Switching team costs a switch token (type !${this.tokenCmd || 'tokens'} to see yours).` : ' Switching team is undone.';
      // after the map loads, so the players see it
      setTimeout(() => this.say(`Smart Shuffle: teams are locked this round.${how}`), 60000).unref?.();
    }
  }

  // ---- announcements ----

  shuffleDue() {
    return this.pendingNow || (this.auto && !this.skipReason());
  }

  async say(text) {
    try {
      await this.server.rcon.broadcast(text);
    } catch (err) {
      this.verbose(1, `Broadcast failed: ${err}`);
    }
  }

  async onAnnounce() {
    if (this.inMatch && this.shuffleDue()) await this.say('Smart Shuffle: teams will be balanced at the end of this round.');
  }

  // eosIDs of the admins online (can see admin chat), plus extra
  adminsOnline(extra) {
    const ids = new Set();
    for (const type of ['steamID', 'eosID']) {
      try {
        for (const id of this.server.getAdminsWithPermission('canseeadminchat', type) || []) ids.add(id);
      } catch (err) {
        // no admin list on this SquadJS: only the requester gets the report
      }
    }
    const out = new Set(this.server.players.filter((p) => ids.has(p.steamID) || ids.has(p.eosID)).map((p) => p.eosID));
    if (extra) out.add(extra);
    return [...out];
  }

  async tell(eosIDs, text) {
    for (const id of eosIDs) {
      try {
        await this.server.rcon.warn(id, text);
      } catch (err) {
        this.verbose(1, `Could not message ${id}: ${err}`);
      }
    }
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

  // ---- session history ----

  // keep the round that just ended (called at the map change, before the stats are cleared)
  remember() {
    const now = Date.now();
    const depth = Math.max(+this.options.historyRounds || 0, 0);
    const maxAge = 3600000 * (+this.options.historyHours || 6);
    if (this.roundCounts && depth > 0) {
      for (const [id, s] of this.stats) {
        if (!(s.minutes > 0)) continue;
        const list = this.history.get(id) || [];
        list.push({ t: now, s });
        this.history.set(id, list.slice(-depth));
      }
    }
    for (const [id, list] of this.history) {
      const fresh = list.filter((r) => now - r.t <= maxAge);
      if (fresh.length) this.history.set(id, fresh);
      else this.history.delete(id);
    }
    this.roundCounts = false;
  }

  recent(eosID) {
    const maxAge = 3600000 * (+this.options.historyHours || 6);
    const now = Date.now();
    return (this.history.get(eosID) || []).filter((r) => now - r.t <= maxAge).map((r) => r.s);
  }

  // ---- outside rating (MySquadStats), optional ----

  // one request per player and never at round end: a few unknown players per tick, answers kept 12 hours
  async fetchOutside() {
    const now = Date.now();
    if (this.outsideBusy || now < this.outsidePause) return;
    const todo = this.server.players
      .filter((p) => p.steamID && !(this.outside.has(p.steamID) && now - this.outside.get(p.steamID).t < 43200000))
      .slice(0, 5);
    if (!todo.length) return;
    this.outsideBusy = true;
    try {
      for (const p of todo) {
        const row = await this.fetchPlayer(p.steamID);
        this.outside.set(p.steamID, { t: Date.now(), ...(row || { none: true }) });
        if (this.outsideGapMs > 0) await new Promise((r) => setTimeout(r, this.outsideGapMs));
      }
    } catch (err) {
      this.outsidePause = Date.now() + 600000;
      this.verbose(1, `MySquadStats not reachable, next try in 10 minutes: ${String(err).replace(this.options.mySquadStatsToken, '[token]')}`);
    } finally {
      this.outsideBusy = false;
    }
  }

  async fetchPlayer(steamID) {
    const url = new URL('https://api.mysquadstats.com/alltimeleaderboards');
    url.searchParams.set('dlc', this.options.mySquadStatsDlc || 'vanilla');
    url.searchParams.set('search', steamID);
    url.searchParams.set('accessToken', this.options.mySquadStatsToken);
    const body = await this.getJson(url);
    const row = body && Array.isArray(body.data) ? body.data.find((r) => String(r.steamID || steamID) === String(steamID)) : null;
    if (!row) return null;
    const num = (v) => (Number.isFinite(+v) ? +v : 0);
    return { kills: num(row.totalKills), knocks: num(row.totalWounds), deaths: num(row.totalDeaths), revives: num(row.totalRevives) };
  }

  async getJson(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'SquadJS-SmartShuffle' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // P -> P for planTeams, or null when the outside rating is off or knows too few of the players
  outsideAdjust(players) {
    if (!this.outsideOn) return null;
    const steam = new Map(this.server.players.map((p) => [p.eosID, p.steamID]));
    const tot = { kills: [], knocks: [], deaths: [], revives: [] };
    const known = [];
    for (const p of players) {
      const row = this.outside.get(steam.get(p.eosID));
      const has = !!row && !row.none;
      known.push(has);
      for (const k of Object.keys(tot)) tot[k].push(has ? row[k] : 0);
    }
    const L = longTermRating(tot, known);
    if (L.every((v) => Number.isNaN(v))) return null;
    const w = Math.min(Math.max(+this.options.mySquadStatsWeight || 0, 0), 1);
    return (P) => blendScores(P, L, w);
  }

  async onRoundEnded(info) {
    this.inMatch = false;
    this.roundCounts = !this.skipReason();
    const hadLock = !!this.lock && this.locking;
    this.lock = null;
    this.queue = [];
    const result = this.roundResult(info);
    const forced = this.pendingNow;
    if (!(this.auto || forced) || this.busy) {
      if (hadLock && this.options.announceLockEnd) await this.say('Smart Shuffle: team lock lifted, you may switch teams again.');
      return;
    }
    const skip = forced ? null : this.skipReason() || this.triggerSkip(result);
    if (skip) {
      this.verbose(1, `Auto shuffle skipped: ${skip}.`);
      if (this.options.reportSkips) await this.tell(this.adminsOnline(null), `Smart Shuffle: automatic shuffle skipped this round (${skip}).`);
      if (hadLock && this.options.announceLockEnd) await this.say('Smart Shuffle: team lock lifted, you may switch teams again.');
      return;
    }
    this.pendingNow = false;
    const requester = this.requester;
    this.requester = null;
    this.busy = true;
    try {
      await this.shuffle(this.round, Date.now(), requester);
      this.streak = 0; // new teams: a win streak starts again
      this.lastWinners = null;
    } catch (err) {
      this.verbose(1, `Shuffle failed: ${err}`);
    } finally {
      this.busy = false;
    }
  }

  // ticket gap and win streak of the round that just ended. info: SquadJS ROUND_ENDED data
  // ({ winner: { team, tickets }, loser: { team, tickets } }); missing fields leave the values null.
  roundResult(info) {
    const w = info && info.winner;
    const l = info && info.loser;
    const gap = w && l && Number.isFinite(+w.tickets) && Number.isFinite(+l.tickets) ? Math.abs(+w.tickets - +l.tickets) : null;
    const team = w && (+w.team === 1 || +w.team === 2) ? +w.team : null;
    if (team) {
      // the same group of players won again if most of today's winners were also among the last winners
      const winners = new Set(this.server.players.filter((p) => +p.teamID === team).map((p) => p.eosID));
      const prev = this.lastWinners || new Set();
      let same = 0;
      for (const id of winners) if (prev.has(id)) same += 1;
      this.streak = winners.size && same >= 0.5 * winners.size ? (this.streak || 1) + 1 : 1;
      this.lastWinners = winners;
    }
    return { gap, streak: team ? this.streak : null };
  }

  // a trigger is set and this round does not meet it (null = shuffle). With both set either one is enough;
  // a round whose result is unknown shuffles as before.
  triggerSkip(result) {
    const minGap = this.options.shuffleTicketGap;
    const minStreak = this.options.shuffleWinStreak;
    if (!(minGap > 0) && !(minStreak > 0)) return null;
    if (result.gap === null && result.streak === null) return null;
    if (minGap > 0 && result.gap !== null && result.gap >= minGap) return null;
    if (minStreak > 0 && result.streak !== null && result.streak >= minStreak) return null;
    const parts = [];
    if (minGap > 0) parts.push(`ticket gap ${result.gap === null ? '?' : result.gap}, needs ${minGap}`);
    if (minStreak > 0) parts.push(`win streak ${result.streak === null ? '?' : result.streak}, needs ${minStreak}`);
    return parts.join('; ');
  }

  // why an automatic shuffle should not run this round (null = run it)
  skipReason() {
    const layer = this.server.currentLayer;
    const text = (
      layer && typeof layer === 'object'
        ? [layer.name, layer.classname, layer.layerid, layer.gamemode].filter(Boolean).join(' ')
        : String(layer || '')
    ).concat(' ', this.layerClass || '').trim().toLowerCase();
    const hit = this.skipLayers.find((s) => text.includes(s));
    if (hit) return `layer "${text}" matches "${hit}"`;
    const count = this.server.players.length;
    const min = +this.options.minPlayers || 0;
    if (count < min) return `${count} players, minimum is ${min}`;
    return null;
  }

  kitClass(role) {
    if (this.re.medic && this.re.medic.test(role)) return 1;
    if (this.re.logi && this.re.logi.test(role)) return 2;
    if (this.re.crew && this.re.crew.test(role)) return 3;
    return 0;
  }

  // the plan for the players on the server right now; changes nothing. wait: wait for the scoreboard dump
  // (round end only; a preview in mid-match has none and uses the SquadJS numbers)
  async plan(wait) {
    const players = parseListPlayers(await this.server.rcon.execute('ListPlayers'));
    if (players.length < 2) return null;
    const [squads] = await this.server.rcon.getSquads();
    const lockedSmall = new Set(
      squads
        .filter((q) => q.locked === 'True' && +q.size <= +this.options.lockedSquadMaxSize)
        .map((q) => `${q.teamID}:${q.squadID}`)
    );

    let formula = 'k6';
    let dumped = null;
    if (this.options.useScoreboardDump && wait) {
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
      else if (this.historyOn) s = withHistory(s, this.recent(p.eosID));
      for (const k of STAT_KEYS) S[k].push((s && s[k]) || 0);
      const kit = this.kitClass(p.role);
      S.sl.push(p.isLeader);
      S.role.push(kit);
      S.team.push(p.teamID - 1);
      slGroups.push(p.isLeader && kit === 3 ? 0 : lockedSmall.has(`${p.teamID}:${p.squadID}`) ? 1 : 2);
    }

    let groups = [];
    if (this.friends) {
      const byParty = new Map();
      players.forEach((p, i) => {
        if (!p.partyID) return;
        if (!byParty.has(p.partyID)) byParty.set(p.partyID, []);
        byParty.get(p.partyID).push(i);
      });
      // a party bigger than maxPartySize is not kept together: it is split like free players
      const cap = +this.options.maxPartySize > 0 ? +this.options.maxPartySize : Infinity;
      groups = [...byParty.values()].filter((g) => g.length >= 2 && g.length <= cap);
    }
    if (this.squads) {
      // whole squads up to maxPartySize stay together too; a party and a squad that share a player are one group
      const cap = +this.options.maxPartySize > 0 ? +this.options.maxPartySize : Infinity;
      const bySquad = new Map();
      players.forEach((p, i) => {
        if (p.squadID === null || p.squadID === undefined) return;
        const k = `${p.teamID}:${p.squadID}`;
        if (!bySquad.has(k)) bySquad.set(k, []);
        bySquad.get(k).push(i);
      });
      groups = mergeGroups([...groups, ...[...bySquad.values()].filter((g) => g.length >= 2 && g.length <= cap)]);
    }

    const fewer = Math.min(Math.max(+this.options.fewerMoves || 0, 0), 10);
    const { P, team } = planTeams(S, formula, slGroups, groups, this.outsideAdjust(players), fewer);
    return { players, team, P, formula };
  }

  // Runs on the end screen only. Nobody is moved after the deadline or once the next map has started
  // (round changed): a team change in a running match costs players their squad, kit and vehicle.
  async shuffle(round, t0, requester) {
    const window = Math.max(5, +this.options.shuffleDeadlineSeconds || 30);
    const deadline = t0 + 1000 * window;
    const live = () => this.round === round && Date.now() < deadline;
    const plan = await this.plan(true);
    if (!plan) return;
    const { players, team, P, formula } = plan;

    // alternate the two directions, so a shuffle that has to stop early leaves even team sizes
    const to = [[], []];
    players.forEach((p, i) => {
      if (team[i] + 1 !== p.teamID) to[team[i]].push(p);
    });
    const order = [];
    for (let i = 0; i < Math.max(to[0].length, to[1].length); i++) {
      if (to[1][i]) order.push(to[1][i]);
      if (to[0][i]) order.push(to[0][i]);
    }

    // The moves have to be finished before the map changes, so the wait for the scoreboard only gets the
    // time that is left after the moves (twice the measured time per move, for the check afterwards) and
    // a reserve. With a slow RCON or many moves the wait shrinks, down to none.
    const need = order.length * Math.max(this.moveMs, 100) * 2 + 3000;
    const wanted = 1000 * Math.min(Math.max(+this.options.shuffleDelaySeconds || 0, 0), 25);
    const wait = Math.min(wanted, deadline - Date.now() - need);
    if (wanted > 0 && wait < wanted) this.verbose(1, `Scoreboard wait cut from ${wanted} to ${Math.max(wait, 0)} ms to finish in time.`);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    let sent = 0;
    const started = Date.now();
    for (const p of order) {
      if (!live()) break;
      try {
        await this.server.rcon.switchTeam(p.eosID);
      } catch (err) {
        // one failed command (player left, RCON hiccup) must not stop the others; the check below repeats it
        this.verbose(1, `Could not move ${p.eosID}: ${err}`);
      }
      sent += 1;
    }
    if (sent) this.moveMs = Math.max(this.moveMs, (Date.now() - started) / sent);
    const wrong = sent === order.length ? await this.settle(players, team, live) : null;
    if (!wrong) return this.stopped(sent, order.length, requester);
    const took = ((Date.now() - started) / 1000).toFixed(1);

    const landed = order.filter((p) => !wrong.has(p.eosID));
    this.last = { moved: landed.length, failed: wrong.size, stopped: false };
    if (this.locking) {
      this.lock = new Map(players.map((p, i) => [p.eosID, team[i] + 1]));
      this.lockAligned = this.round === round;
    }
    const lockText = this.locking ? ' Team changes are locked until the next round ends.' : '';
    const before = scoreGap(P, (i) => players[i].teamID === 2);
    const after = scoreGap(P, (i) => team[i] === 1);
    this.verbose(
      1,
      `Shuffled with ${formula}: ${players.length} players, ${landed.length} moved, ${wrong.size} not placed, ` +
        `score gap ${before.toFixed(0)}% -> ${after.toFixed(0)}%, lock ${this.locking ? 1 : 0}, friends ${this.friends ? 1 : 0}, ` +
        `moves took ${took} s.`
    );
    if (this.options.broadcastResult) {
      await this.say(`Smart Shuffle: teams balanced (${landed.length} players moved).${lockText}`);
    }
    if (this.options.adminReport) {
      await this.tell(
        this.adminsOnline(requester),
        `Smart Shuffle report: ${landed.length} moved, ${wrong.size} not placed, ` +
          `score gap ${before.toFixed(0)}% -> ${after.toFixed(0)}%, done in ${took} s.`
      );
    }
    if (this.options.warnMovedPlayers) {
      for (const p of landed) {
        if (this.round !== round) break;
        await this.tell([p.eosID], `Smart Shuffle: you were moved to the other team to balance the match.${lockText}`);
      }
    }
  }

  // a shuffle that ran out of time: no lock (the teams are not the planned ones), admins are told
  async stopped(sent, total, requester) {
    this.lock = null;
    this.last = { moved: sent, failed: total - sent, stopped: true };
    const text = `Smart Shuffle stopped early: ${sent} of ${total} moves done before the next map. No lock this round.`;
    this.verbose(1, text);
    if (this.options.adminReport) await this.tell(this.adminsOnline(requester), text);
  }

  // AdminForceTeamChange toggles and a command can be lost, so read the teams back after the moves and
  // toggle whoever is still on the wrong side (at most twice). Returns the eosIDs still wrong, or null
  // when time ran out. The refresh also keeps the lock check (it compares against server.players) from
  // reading a poll that started before the moves as players switching back.
  async settle(players, team, live) {
    let wrong = [];
    for (let attempt = 0; attempt <= 2; attempt++) {
      await this.server.updatePlayerList();
      if (!live()) return null;
      const now = new Map(this.server.players.map((p) => [p.eosID, +p.teamID]));
      wrong = players.filter((p, i) => now.has(p.eosID) && now.get(p.eosID) !== team[i] + 1);
      if (!wrong.length || attempt === 2) break;
      for (const p of wrong) {
        if (!live()) return null;
        try {
          await this.server.rcon.switchTeam(p.eosID);
        } catch (err) {
          this.verbose(1, `Could not move ${p.eosID}: ${err}`);
        }
      }
    }
    return new Set(wrong.map((p) => p.eosID));
  }

  // what a shuffle would do with this match so far; moves nobody. The reply is short (it goes out as an
  // in-game warning), the names of the players who would move go to the SquadJS log.
  async preview() {
    const plan = await this.plan(false);
    if (!plan) return 'Smart Shuffle preview: not enough players.';
    const { players, team, P } = plan;
    const now = scoreGap(P, (i) => players[i].teamID === 2);
    const after = scoreGap(P, (i) => team[i] === 1);
    const moves = [];
    players.forEach((p, i) => {
      if (team[i] + 1 !== p.teamID) moves.push(`${p.name} -> team ${team[i] + 1}`);
    });
    this.verbose(1, `Preview moves (${moves.length}): ${moves.join(', ')}`);
    return (
      `Smart Shuffle preview (this match so far): ${moves.length} of ${players.length} would move, ` +
      `score gap ${now.toFixed(0)}% -> ${after.toFixed(0)}%. Names are in the SquadJS log.`
    );
  }

  // ---- admin chat command ----

  async onCommand(info) {
    if (info.chat !== 'ChatAdmin') return;
    const args = (info.message || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    let reply;
    const id = info.eosID || (info.player && info.player.eosID);
    const notices = (+this.options.announceMinutes || 0) > 0;
    const onOff = (v) => (v ? 'on' : 'off');
    if (args[0] === 'now') {
      this.pendingNow = true;
      this.requester = id || null;
      reply = 'Smart Shuffle will run at the end of this round. Use "cancel" to call it off.';
      if (notices) await this.say('Smart Shuffle: teams will be balanced at the end of this round.');
    } else if (args[0] === 'cancel') {
      const was = this.pendingNow;
      this.pendingNow = false;
      this.requester = null;
      reply = was ? 'Smart Shuffle: the shuffle for this round is cancelled.' : 'Smart Shuffle: nothing to cancel.';
      if (this.auto) reply += ' Auto is still on, use "auto off" to stop it.';
      if (was && notices && !this.auto) await this.say('Smart Shuffle: the shuffle for this round is cancelled.');
    } else if (args[0] === 'preview') {
      reply = await this.preview();
    } else if (args[0] === 'auto' && ['on', 'off'].includes(args[1])) {
      this.auto = args[1] === 'on';
      reply = `Smart Shuffle auto: ${onOff(this.auto)}.`;
    } else if (args[0] === 'friends' && ['on', 'off'].includes(args[1])) {
      this.friends = args[1] === 'on';
      reply = `Smart Shuffle friends (keep parties together): ${onOff(this.friends)}.`;
    } else if (args[0] === 'lock' && ['0', '1', '2', 'on', 'off'].includes(args[1])) {
      // 0 / off: no lock. 1 / on: lock. 2: lock and keep parties (same as "lock on" plus "friends on")
      this.locking = !['0', 'off'].includes(args[1]);
      if (['0', '1', '2'].includes(args[1])) this.friends = args[1] === '2';
      if (!this.locking) this.lock = null;
      reply = `Smart Shuffle lock: ${onOff(this.locking)}, friends: ${onOff(this.friends)}.`;
    } else if (args[0] === 'history' && ['on', 'off'].includes(args[1])) {
      this.historyOn = args[1] === 'on' && (+this.options.historyRounds || 0) > 0;
      reply = `Smart Shuffle history (earlier rounds of this session): ${onOff(this.historyOn)}.`;
      if (args[1] === 'on' && !this.historyOn) reply += ' Set historyRounds above 0 in config.json first.';
    } else if (args[0] === 'mss' && ['on', 'off'].includes(args[1])) {
      this.outsideOn = args[1] === 'on' && !!this.options.mySquadStatsToken;
      reply = `Smart Shuffle MySquadStats rating: ${onOff(this.outsideOn)}.`;
      if (args[1] === 'on' && !this.outsideOn) reply += ' Set mySquadStatsToken in config.json first.';
    } else if (args[0] === 'tokens' && ['on', 'off'].includes(args[1])) {
      if (args[1] === 'off') {
        this.saveTokens(true);
        this.tokensPaused = this.tokens;
        this.tokens = null;
      } else if (!this.tokens) {
        this.tokens = this.tokensPaused || new TokenBook({ start: this.options.tokenStart, max: this.options.tokenMax,
          refillHours: this.options.tokenRefillHours, decayDays: this.options.tokenDecayDays,
          seedSteps: this.options.tokenSeedMinutes });
        if (!this.tokensPaused) this.loadTokens();
      }
      reply = `Smart Shuffle switch tokens: ${onOff(!!this.tokens)}.`;
    } else if (args[0] === 'unlock') {
      this.lock = null;
      reply = 'Smart Shuffle: lock lifted for this round.';
    } else {
      reply =
        `Smart Shuffle: auto ${onOff(this.auto)}, lock ${onOff(this.locking)}, friends ${onOff(this.friends)}, ` +
        `history ${onOff(this.historyOn)}, mss ${onOff(this.outsideOn)}, tokens ${onOff(!!this.tokens)}, ` +
        `pending ${this.pendingNow ? 1 : 0}, locked now ${this.lock ? 1 : 0}. ` +
        (this.last
          ? `Last shuffle: ${this.last.moved} moved, ${this.last.failed} not placed${this.last.stopped ? ', stopped early' : ''}. `
          : '') +
        `Use: now | cancel | preview | auto on/off | friends on/off | history on/off | mss on/off | tokens on/off | lock on/off | unlock`;
    }
    if (id) await this.server.rcon.warn(id, reply);
  }
}
