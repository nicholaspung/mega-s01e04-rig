import type { ReadNightResult } from '../digest/types.js';

export function Digest({ night, result }: { night: string; result: ReadNightResult }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {result.kind === 'missing' ? <p>night not found</p> : (
        <>
          {result.malformedLines > 0 && (
            <p class="warn">malformed lines: {result.malformedLines}</p>
          )}
          {result.rows.length === 0 ? <p class="mute">nothing ran</p> : (
            <table>
              <thead>
                <tr>
                  <th scope="col">job</th><th scope="col">owner</th>
                  <th scope="col">runs</th><th scope="col">retries</th>
                  <th scope="col">last status</th><th scope="col">last error</th>
                  <th scope="col">first time</th><th scope="col">last time</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr>
                    <th scope="row">{row.job}</th><td>{row.owner || '—'}</td>
                    <td>{row.runs}</td>
                    <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                    <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
                    <td>{row.lastError || '—'}</td>
                    <td>{row.firstTime}</td><td>{row.lastTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
