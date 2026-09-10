// Builds an unordered pair key for two student ids, order-independent.
export function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// Splits `studentCount` students into as-equal-as-possible group sizes,
// targeting either a fixed group size or a fixed number of groups. The
// remainder (if any) is spread across the first groups so sizes differ by at
// most one student.
export function computeGroupSizes(
  studentCount: number,
  opts: { groupSize?: number; groupCount?: number },
): number[] {
  if (studentCount <= 0) return [];

  let numGroups: number;
  if (opts.groupCount !== undefined) {
    numGroups = Math.max(1, Math.min(opts.groupCount, studentCount));
  } else if (opts.groupSize !== undefined) {
    numGroups = Math.max(1, Math.ceil(studentCount / Math.max(1, opts.groupSize)));
  } else {
    throw new Error("computeGroupSizes: either groupSize or groupCount must be given.");
  }

  const base = Math.floor(studentCount / numGroups);
  const remainder = studentCount - base * numGroups;
  return Array.from({ length: numGroups }, (_, i) => base + (i < remainder ? 1 : 0));
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type HasHistory = (a: number, b: number) => boolean;

export function hasHistoryPair(pairs: Set<string>): HasHistory {
  return (a, b) => pairs.has(pairKey(a, b));
}

function countConflicts(groups: number[][], hasHistory: HasHistory): number {
  let n = 0;
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (hasHistory(group[i], group[j])) n++;
      }
    }
  }
  return n;
}

// One greedy pass: shuffles students, then drops each into whichever
// not-yet-full group currently holds the fewest of their past partners
// (ties broken at random).
function assignOnce(studentIds: number[], sizes: number[], hasHistory: HasHistory): number[][] {
  const shuffled = shuffle(studentIds);
  const groups: number[][] = sizes.map(() => []);
  for (const id of shuffled) {
    const open = groups
      .map((g, i) => i)
      .filter((i) => groups[i].length < sizes[i]);
    const scored = open.map((i) => ({
      i,
      score: groups[i].reduce((n, other) => n + (hasHistory(id, other) ? 1 : 0), 0),
    }));
    const minScore = Math.min(...scored.map((s) => s.score));
    const best = scored.filter((s) => s.score === minScore);
    const chosen = best[Math.floor(Math.random() * best.length)]!.i;
    groups[chosen].push(id);
  }
  return groups;
}

export interface JumbleResult {
  groups: number[][];
  conflicts: number;
}

// Runs several randomized greedy passes and keeps the one with the fewest
// repeat pairings (per `hasHistory`). Stops early once a pass finds zero
// conflicts.
export function jumbleGroups(
  studentIds: number[],
  sizes: number[],
  hasHistory: HasHistory,
  attempts = 200,
): JumbleResult {
  let bestGroups = assignOnce(studentIds, sizes, hasHistory);
  let bestConflicts = countConflicts(bestGroups, hasHistory);
  for (let k = 1; k < attempts && bestConflicts > 0; k++) {
    const groups = assignOnce(studentIds, sizes, hasHistory);
    const conflicts = countConflicts(groups, hasHistory);
    if (conflicts < bestConflicts) {
      bestGroups = groups;
      bestConflicts = conflicts;
    }
  }
  return { groups: bestGroups, conflicts: bestConflicts };
}
