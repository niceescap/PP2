// ═══════════════════════════════════════════════════════════════
// Render server integration tests
//
// These drive the real Express app over a real HTTP socket: the FIT
// is uploaded as multipart, ffmpeg produces an actual MP4, and the
// temporary files are checked for cleanup.
//
// Requires the optional server dependencies (express, multer, canvas)
// and ffmpeg on PATH. The suite skips itself when they are missing.
// ═══════════════════════════════════════════════════════════════

import { describe, it, assert, assertEqual } from './harness.js';
import { createApp } from '../server/render-server.js';
import { buildFitFile, sampleFitRecords } from '../src/fit/fixtures.js';
import { spawn } from 'child_process';

let app: any = null;
let server: any = null;
let baseUrl = '';
let depsAvailable = false;

async function hasServerDeps(): Promise<boolean> {
  try {
    await import('express');
    await import('multer');
    await import('canvas');
    return true;
  } catch {
    return false;
  }
}

function hasFfmpeg(): boolean {
  return new Promise<boolean>(resolve => {
    const child = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });
}

/**
 * Start an HTTP server on an ephemeral port.
 * Returns null when the environment forbids listening (sandboxed CI),
 * so the suite can skip instead of crashing.
 */
async function listen(app: any): Promise<{ server: any; url: string } | null> {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', reject);
    });
  } catch {
    server.close();
    return null;
  }
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

/** Build a multipart/form-data body and POST it. */
function post(url: string, fields: Record<string, string>, file?: { name: string; data: Buffer }) {
  const boundary = '----pp2test' + Date.now();
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ));
  }
  if (file) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="activity.fit"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
    ));
    parts.push(file.data);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe('render server', () => {
  it('starts and answers on the export endpoint', async () => {
    depsAvailable = (await hasServerDeps()) && (await hasFfmpeg());
    if (!depsAvailable) {
      console.log('    (skipped: express/multer/canvas or ffmpeg unavailable)');
      return;
    }

    app = createApp({ uploadDir: '/tmp/pp2-test-uploads' });
    const listener = await listen(app);
    if (!listener) {
      console.log('    (skipped: the sandbox forbids opening a listening socket)');
      depsAvailable = false;
      return;
    }
    server = listener.server;
    baseUrl = listener.url;

    const response = await post(`${baseUrl}/export`, {}, { name: 'fit', data: Buffer.alloc(0) });
    assert(response.status === 400 || response.status === 500, 'expected a 4xx/5xx on an empty upload');
  });

  it('renders a real MP4 from a FIT upload', async () => {
    if (!depsAvailable) return;

    const fit = Buffer.from(buildFitFile(sampleFitRecords()));
    const response = await post(
      `${baseUrl}/export`,
      { range: '{"start":0,"end":5}', resolution: '[1280,720]', bgMode: 'green' },
      { name: 'fit', data: fit }
    );

    assertEqual(response.status, 200, 'expected HTTP 200');
    const body = Buffer.from(await response.arrayBuffer());

    assert(body.length > 1000, 'expected a non-empty video');
    // ISO base media file signature ("ftyp" box)
    assertEqual(body.subarray(4, 8).toString('ascii'), 'ftyp', 'expected an MP4 container');
  });

  it('rejects a malformed FIT with HTTP 400', async () => {
    if (!depsAvailable) return;

    const junk = Buffer.alloc(256, 7);
    const response = await post(
      `${baseUrl}/export`,
      { range: '{"start":0,"end":0}' },
      { name: 'fit', data: junk }
    );

    assertEqual(response.status, 400, 'expected HTTP 400 for an invalid FIT');
    const payload = await response.json() as { error?: string };
    assert(typeof payload.error === 'string' && payload.error.length > 0, 'expected an error message');
  });

  it('rejects an invalid resolution with HTTP 400', async () => {
    if (!depsAvailable) return;

    const fit = Buffer.from(buildFitFile(sampleFitRecords()));
    const response = await post(
      `${baseUrl}/export`,
      { range: '{"start":0,"end":0}', resolution: '[abc]' },
      { name: 'fit', data: fit }
    );

    assertEqual(response.status, 400, 'expected HTTP 400');
  });

  it('rejects an upload above the size limit with HTTP 413', async () => {
    if (!depsAvailable) return;

    const small = createApp({ uploadDir: '/tmp/pp2-test-uploads', maxUploadBytes: 1024 });
    const listener = await listen(small);
    if (!listener) return;

    try {
      // The payload must exceed the 1 KiB limit to be rejected.
      const fit = Buffer.concat([
        Buffer.from(buildFitFile(sampleFitRecords())),
        Buffer.alloc(4096, 0x41),
      ]);
      const response = await post(`${listener.url}/export`, { range: '{"start":0,"end":0}' }, { name: 'fit', data: fit });
      assertEqual(response.status, 413, `expected HTTP 413, got ${response.status}: ${(await response.text()).slice(0, 120)}`);
    } finally {
      listener.server.close();
    }
  });

  it('does not allow a foreign CORS origin', async () => {
    if (!depsAvailable) return;

    const response = await fetch(`${baseUrl}/export`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    const allowOrigin = response.headers.get('access-control-allow-origin');
    assert(allowOrigin === null, 'expected no CORS header for a foreign origin');
  });

  it('allows a localhost CORS origin', async () => {
    if (!depsAvailable) return;

    const response = await fetch(`${baseUrl}/export`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8001' },
    });
    assertEqual(response.headers.get('access-control-allow-origin'), 'http://localhost:8001');
  });

  it('cleans up its temporary files', async () => {
    if (!depsAvailable) return;

    const fs = await import('fs');
    const leftovers = fs.readdirSync('/tmp')
      .filter(name => name.startsWith('pp2-frames-') || name.startsWith('pp2-output-'));
    assertEqual(leftovers.length, 0, `leftover temp files: ${leftovers.join(', ')}`);
  });

  it('shuts down cleanly', async () => {
    if (!depsAvailable) return;
    await new Promise<void>(resolve => server.close(() => resolve()));
    server = null;
  });
});
