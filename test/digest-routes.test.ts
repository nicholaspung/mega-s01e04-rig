import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
let runsDir: string;
beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  vi.stubEnv('LANE_MARKER', 'route-test');
});
afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
function app() {
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}
function write(lines: unknown[]) {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.map(line => JSON.stringify(line)).join('\n'));
}
const at = '2026-10-28T23:00:00-05:00';
const last = '2026-10-29T01:00:00+01:00';

describe('digest routes', () => {
  it('serves complete ordered rows with HTML/JSON parity, warnings, nulls and source offsets', async () => {
    write([
      { at, job: 'zeta', owner: 'rook', status: 'retry', error: 'busy' },
      { at, job: 'alpha', owner: null, status: 'ok' },
      { at, job: 'zeta', owner: 'rook', status: 'retry' },
      { at, job: 'zeta', owner: 'rook', status: 'retry' },
      { at: last, job: 'zeta', owner: 'rook', status: 'fail', error: 'stopped' },
    ]);
    const server = app();
    const json = await server.request(`/api/digest/${night}`);
    expect(json.status).toBe(200);
    expect(json.headers.get('content-type')).toContain('application/json');
    const payload = await json.json();
    expect(payload).toEqual({ night, malformedLines: 0, rows: [
      { job: 'alpha', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstTime: at, lastTime: at },
      { job: 'zeta', owner: 'rook', runs: 4, retries: 3, lastStatus: 'fail', lastError: 'stopped', firstTime: at, lastTime: last },
    ] });
    const response = await server.request(`/digest/${night}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    const body = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? '';
    expect([...body.matchAll(/<th scope="row">(.*?)<\/th>/g)].map(match => match[1]))
      .toEqual(payload.rows.map((row: { job: string }) => row.job));
    expect(body).toBe(`<tr><th scope="row">alpha</th><td>—</td><td>1</td><td>0</td><td>ok</td><td>—</td><td>${at}</td><td>${at}</td></tr><tr><th scope="row">zeta</th><td>rook</td><td>4</td><td class="warn">3</td><td class="warn">fail</td><td>stopped</td><td>${at}</td><td>${last}</td></tr>`);
  });

  it.each(['2026-10-27', 'not-a-night', '2026-02-30', '2026-1-01'])('returns 404 for missing or invalid night %s', async requested => {
    const server = app();
    const page = await server.request(`/digest/${requested}`);
    expect(page.status).toBe(404);
    expect(await page.text()).toContain('night not found');
    const json = await server.request(`/api/digest/${requested}`);
    expect(json.status).toBe(404);
    expect(await json.json()).toEqual({ error: 'night not found' });
  });

  it('serves an empty file as nothing ran and an empty JSON row list', async () => {
    write([]);
    const server = app();
    const page = await server.request(`/digest/${night}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
    const json = await server.request(`/api/digest/${night}`);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ night, rows: [], malformedLines: 0 });
  });

  it('counts bad lines while rendering valid escaped values and preserving raw JSON strings', async () => {
    const job = '<script>alert("job")</script>';
    const owner = '<b>owner & team</b>';
    const error = '<img src=x onerror="alert(1)">';
    writeFileSync(join(runsDir, `${night}.jsonl`), `broken\n{}\n${JSON.stringify({ at, job, owner, status: 'fail', error })}\n`);
    const server = app();
    const page = await server.request(`/digest/${night}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('malformed lines: 2');
    expect(html).toContain('&lt;script&gt;alert(&quot;job&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;owner &amp; team&lt;/b&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    const json = await server.request(`/api/digest/${night}`);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ night, malformedLines: 2, rows: [
      { job, owner, runs: 1, retries: 0, lastStatus: 'fail', lastError: error, firstTime: at, lastTime: at },
    ] });
  });
});
