import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNightResult, RunStatus } from './types';

export type { DigestRow, ReadNightResult, RunStatus } from './types';

interface Run {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
}

function validDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function validNight(night: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(night);
  return match !== null && validDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function validTimestamp(at: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(at);
  return match !== null && validDate(Number(match[1]), Number(match[2]), Number(match[3])) &&
    Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59 &&
    (match[7] === 'Z' || (Number(match[8]) <= 23 && Number(match[9]) <= 59));
}

function parseRun(line: string): Run | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.at !== 'string' || !validTimestamp(record.at) ||
      typeof record.job !== 'string' || record.job.trim().length === 0 ||
      (record.status !== 'ok' && record.status !== 'retry' && record.status !== 'fail') ||
      (record.owner !== null && typeof record.owner !== 'string') ||
      ('error' in record && typeof record.error !== 'string')) return null;
  return { at: record.at, job: record.job, status: record.status, owner: record.owner,
    ...(typeof record.error === 'string' ? { error: record.error } : {}) };
}

export function readNight(runsDir: string, night: string): ReadNightResult {
  if (!validNight(night)) throw new Error('Night must be a valid YYYY-MM-DD date');
  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' };
    throw error;
  }

  const jobs = new Map<string, DigestRow>();
  let malformedLines = 0;
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const run = parseRun(line);
    if (run === null) {
      malformedLines++;
      continue;
    }
    const row = jobs.get(run.job);
    if (row === undefined) {
      jobs.set(run.job, { job: run.job, owner: run.owner, runs: 1,
        retries: Number(run.status === 'retry'), lastStatus: run.status,
        lastError: run.error ?? null, firstTime: run.at, lastTime: run.at });
    } else {
      row.owner = run.owner;
      row.runs++;
      row.retries += Number(run.status === 'retry');
      row.lastStatus = run.status;
      if (run.error !== undefined) row.lastError = run.error;
      row.lastTime = run.at;
    }
  }
  const rows = [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return { kind: 'present', rows, malformedLines };
}
