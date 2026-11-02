import { Hono } from 'hono';
import { readNight } from './digest/index.js';
import { Digest } from './views/digest.js';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    // Validate before calling the reader, which throws for invalid night names.
    const date = new Date(`${night}T00:00:00Z`);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(night) &&
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === night;
    const result = valid ? readNight(config.runsDir, night) : { kind: 'missing' as const };
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <Digest night={night} result={result} />
      </Layout>,
      result.kind === 'missing' ? 404 : 200,
    );
  });

  return app;
}
