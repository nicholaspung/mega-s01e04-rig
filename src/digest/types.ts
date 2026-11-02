/** The status recorded for a single run. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's runs in file order. Times retain the original timestamp and offset. */
export interface DigestRow {
  job: string;
  /** Owner on the last valid run; null means no owner was recorded. */
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  /** Most recent error supplied by a valid run, or null if none was supplied. */
  lastError: string | null;
  firstTime: string;
  lastTime: string;
}

/** Missing files are distinct from present files, including empty or wholly malformed files. */
export type ReadNightResult =
  | { kind: 'missing' }
  | { kind: 'present'; rows: DigestRow[]; malformedLines: number };

/**
 * Synchronously read <runsDir>/<night>.jsonl. Night must be a YYYY-MM-DD date;
 * invalid names throw. Valid records are aggregated in file order and rows are
 * sorted by job. Nonempty malformed lines are counted. Other I/O errors throw.
 */
export declare function readNight(runsDir: string, night: string): ReadNightResult;
