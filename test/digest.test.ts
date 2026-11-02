import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const run = { at: '2026-10-28T23:00:02+01:00', job: 'job', status: 'ok', owner: null };

describe('readNight', () => {
  it('reads the real night, including its truncated line', () => {
    const result = readNight('runs', '2026-10-28');
    expect(result.kind).toBe('present');
    if (result.kind !== 'present') throw new Error('fixture missing');
    expect(result.malformedLines).toBe(1);
    expect(result.rows.map(row => row.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(result.rows[1]).toEqual({ job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3,
      lastStatus: 'ok', lastError: 'upstream 503', firstTime: '2026-10-29T01:30:00+01:00', lastTime: '2026-10-29T01:37:00+01:00' });
    expect(result.rows[0].owner).toBeNull();
  });

  it('distinguishes missing, empty and wholly malformed files', () => {
    const dir = tempDir();
    expect(readNight(dir, '2026-10-28')).toEqual({ kind: 'missing' });
    writeFileSync(join(dir, '2026-10-28.jsonl'), '\n  \r\n');
    expect(readNight(dir, '2026-10-28')).toEqual({ kind: 'present', rows: [], malformedLines: 0 });
    writeFileSync(join(dir, '2026-10-28.jsonl'), 'bad\n{}\n');
    expect(readNight(dir, '2026-10-28')).toEqual({ kind: 'present', rows: [], malformedLines: 2 });
  });

  it('validates every input field and counts malformed nonempty lines', () => {
    const dir = tempDir();
    const invalid = [null, [], {}, { ...run, at: '2026-02-30T00:00:00Z' }, { ...run, at: 'yesterday' },
      { ...run, job: '' }, { ...run, status: 'other' }, { ...run, owner: 42 },
      { ...run, owner: undefined }, { ...run, error: null }, { ...run, error: 7 }];
    writeFileSync(join(dir, '2026-10-28.jsonl'), [...invalid, run].map(entry => JSON.stringify(entry)).join('\n'));
    const result = readNight(dir, '2026-10-28');
    expect(result.kind).toBe('present');
    if (result.kind !== 'present') throw new Error('file missing');
    expect(result.malformedLines).toBe(invalid.length);
    expect(result.rows).toHaveLength(1);
  });

  it('aggregates in file order, retaining offsets and the latest supplied error', () => {
    const dir = tempDir();
    const entries = [ { ...run, job: 'z', status: 'fail', owner: 'first', error: 'first error' },
      { ...run, job: 'a' }, { ...run, job: 'z', status: 'retry', at: '2026-10-28T01:00:00-05:00', owner: null, error: 'new error' },
      { ...run, job: 'z', at: '2026-10-28T00:00:00Z', owner: 'last' } ];
    writeFileSync(join(dir, '2026-10-28.jsonl'), entries.map(entry => JSON.stringify(entry)).join('\r\n'));
    const result = readNight(dir, '2026-10-28');
    expect(result).toEqual({ kind: 'present', malformedLines: 0, rows: [
      { job: 'a', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstTime: run.at, lastTime: run.at },
      { job: 'z', owner: 'last', runs: 3, retries: 1, lastStatus: 'ok', lastError: 'new error', firstTime: run.at, lastTime: '2026-10-28T00:00:00Z' },
    ] });
  });

  it('rejects traversal and invalid dates and propagates other I/O errors', () => {
    const dir = tempDir();
    for (const night of ['../secret', '2026-10-28/../../secret', '2026-02-29', '2026-1-01']) {
      expect(() => readNight(dir, night)).toThrow();
    }
    writeFileSync(join(dir, 'not-a-directory'), '');
    expect(() => readNight(join(dir, 'not-a-directory'), '2026-10-28')).toThrow();
  });
});
