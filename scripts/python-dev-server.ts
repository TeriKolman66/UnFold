import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const allowedOrigins = new Set(['http://127.0.0.1:1420', 'http://localhost:1420']);
let running = false;

function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function execute(code: string) {
  const folder = await mkdtemp(join(tmpdir(), 'unfold-python-'));
  const file = join(folder, 'script.py');
  try {
    await writeFile(file, code, 'utf8');
    const launch = (program: string, args: string[]) => new Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }>((resolve, reject) => {
      const child = spawn(program, args, { cwd: folder, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = ''; let timedOut = false;
      const append = (value: string, chunk: Buffer) => (value + chunk.toString('utf8')).slice(0, 32_768);
      child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, 5_000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('close', (exitCode) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode, timedOut }); });
    });
    return await launch('py', ['-3', '-I', '-S', '-B', file]).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return launch('python', ['-I', '-S', '-B', file]);
    });
  } finally {
    await unlink(file).catch(() => {});
    await rmdir(folder).catch(() => {});
  }
}

export function pythonDevServer(): Plugin {
  return {
    name: 'unfold-local-python-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__unfold/python', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST' || !allowedOrigins.has(req.headers.origin ?? '')) { reply(res, 403, { error: 'Request not allowed' }); return; }
        if (running) { reply(res, 429, { error: 'A Python file is already running' }); return; }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 70_000) { reply(res, 413, { error: 'Python file is too large' }); return; }
          chunks.push(chunk);
        }
        let code: unknown;
        try { code = JSON.parse(Buffer.concat(chunks).toString('utf8')).code; }
        catch { reply(res, 400, { error: 'Invalid request' }); return; }
        if (typeof code !== 'string' || Buffer.byteLength(code, 'utf8') > 65_536) { reply(res, 413, { error: 'Python file is too large' }); return; }
        running = true;
        try { reply(res, 200, await execute(code)); }
        catch { reply(res, 503, { error: 'Python 3 is not available on this computer' }); }
        finally { running = false; }
      });
    },
  };
}
