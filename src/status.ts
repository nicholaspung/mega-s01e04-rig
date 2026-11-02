import { readdirSync } from 'node:fs';
import { readNight, type RunStatus } from './digest/index.js';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: { night: string; counts: Record<RunStatus, number> }[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).flatMap((night) => {
      const result = readNight(config.runsDir, night);
      // A file may disappear after the directory was listed.
      if (result.kind === 'missing') return [];
      const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
      for (const row of result.rows) counts[row.lastStatus]++;
      return [{ night, counts }];
    }),
  };
}
