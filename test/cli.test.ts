import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cli = fileURLToPath(new URL('../dist/cli/index.js', import.meta.url));
const running: ChildProcess[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    }).on('error', reject);
  });
}

async function startCli(args: string[]) {
  const cwd = await mkdtemp(join(tmpdir(), 'mock-bridge-cli-'));
  const child = spawn(process.execPath, [cli, ...args], { cwd, env: { ...process.env, SHOPIFY_API_KEY: '' } });
  running.push(child);
  return cwd;
}

const config = (port: number) => vi.waitFor(async () => (await fetch(`http://localhost:${port}/api/config`)).json(), { timeout: 10_000 });

afterEach(() => {
  running.splice(0).forEach(child => child.kill());
});

describe('mock-bridge CLI', { timeout: 20_000 }, () => {
  it("uses the config file's port", async () => {
    const port = await freePort();
    const cwd = await mkdtemp(join(tmpdir(), 'mock-bridge-config-'));
    const file = join(cwd, 'mock.config.json');
    await writeFile(file, JSON.stringify({ appUrl: 'http://localhost:1', port, clientId: 'from-config' }));

    await startCli(['--config', file]);

    expect(await config(port)).toMatchObject({ clientId: 'from-config' });
  });

  it('lets --port override the config file', async () => {
    const [configPort, flagPort] = [await freePort(), await freePort()];
    const cwd = await mkdtemp(join(tmpdir(), 'mock-bridge-config-'));
    const file = join(cwd, 'mock.config.mjs');
    await writeFile(file, `export default { appUrl: 'http://localhost:1', port: ${configPort} };`);

    await startCli(['--config', file, '--port', String(flagPort)]);

    expect(await config(flagPort)).toMatchObject({ appUrl: 'http://localhost:1' });
  });
});
