import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import fs from 'node:fs';
import {promises as fsp} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

import pluginEntry from '../index';

type RegisteredTool = {
	name: string;
	execute: (toolCallId?: string, params?: Record<string, unknown>) => Promise<{
		content: Array<{type: string; text: string}>;
		details: Record<string, unknown>;
	}>;
};

const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corev-plugin-e2e-'));
const hostDir = path.join(workspaceDir, 'src', 'host', 'server');
const corevBinPath = path.join(workspaceDir, 'fake-corev.mjs');
const toolRegistry = new Map<string, RegisteredTool>();
const runE2E = process.env.COREV_PLUGIN_E2E === '1';
const describeE2E = runE2E ? describe : describe.skip;

let hostPort = 0;

function getText(result: {content: Array<{type: string; text: string}>}) {
	return result.content
		.filter(item => item.type === 'text')
		.map(item => item.text)
		.join('\n');
}

async function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Failed to acquire free port.'));
				return;
			}
			const port = address.port;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(port);
			});
		});
	});
}

async function writeFakeCorevBinary(targetPath: string): Promise<void> {
	const script = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();
const callLogPath = path.join(cwd, '.fake-corev-calls.jsonl');
const rcPath = path.join(cwd, '.corevrc.json');

function appendCall(entry) {
  fs.appendFileSync(callLogPath, JSON.stringify(entry) + '\\n', 'utf-8');
}

function argValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

if (!command) {
  console.error('No command provided');
  process.exit(1);
}

appendCall({ command, args: args.slice(1) });

switch (command) {
  case 'list':
    console.log('atlas@1.0.0');
    console.log('atlas@1.0.1');
    break;
  case 'pull': {
    const project = args[1] || 'unknown';
    const env = argValue('--env');
    console.log('Pulled ' + project + (env ? ' for env ' + env : ''));
    break;
  }
  case 'diff':
    console.log('Differences:');
    console.log('- foo: "bar"');
    console.log('+ foo: "baz"');
    break;
  case 'env': {
    const project = args[1] || 'unknown';
    const env = args[2] || 'default';
    const envDir = path.join(cwd, 'configs', project, 'env', env);
    fs.mkdirSync(envDir, { recursive: true });
    fs.writeFileSync(path.join(envDir, 'README.txt'), 'fake env readme\\n', 'utf-8');
    console.log('Created env folder for ' + project + ' / ' + env);
    break;
  }
  case 'push':
    console.log('Pushed config');
    break;
  case 'revert':
    console.log('Reverted config');
    break;
  case 'checkout':
    console.log('Checked out config');
    break;
  case 'init': {
    const api = argValue('--api');
    const token = argValue('--token');
    const rc = {};
    if (api) rc.api = api.replace(/\\/+$/, '');
    if (token) rc.token = token;
    fs.writeFileSync(rcPath, JSON.stringify(rc, null, 2), 'utf-8');
    console.log('Corev configured with:');
    if (api) console.log('API: ' + api);
    if (token) console.log('Token: [set]');
    break;
  }
  default:
    console.error('Unknown fake corev command: ' + command);
    process.exit(1);
}
`;

	await fsp.writeFile(targetPath, script, 'utf-8');
	await fsp.chmod(targetPath, 0o755);
}

async function writeFakeHostProject(targetDir: string): Promise<void> {
	await fsp.mkdir(targetDir, {recursive: true});

	const packageJson = {
		name: 'fake-corev-host',
		version: '0.0.1',
		private: true,
		scripts: {
			dev: 'node server.js'
		}
	};

	const serverJs = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\\r?\\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

loadEnvFile();

const users = new Set();
const port = Number(process.env.PORT || 3000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1:' + port);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    try {
      const body = await parseJsonBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'email and password are required' }));
        return;
      }

      if (users.has(email)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User already exists' }));
        return;
      }

      users.add(email);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: 'fake-token', apiSecret: 'fake-secret', email }));
      return;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json body' }));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, '127.0.0.1', () => {
  console.log('fake-host-listening:' + port);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`;

	await fsp.writeFile(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
	await fsp.writeFile(path.join(targetDir, 'server.js'), serverJs, 'utf-8');
}

function registerPluginTools(workDir: string, corevBin: string, apiUrl: string) {
	const api = {
		pluginConfig: {
			workingDirectory: workDir,
			corevBin,
			hostApiUrl: apiUrl,
			hostHealthPath: '/health',
			hostStartCommand: 'npm run dev'
		},
		registerTool: (tool: RegisteredTool) => {
			toolRegistry.set(tool.name, tool);
		}
	};

	pluginEntry.register(api as never);
}

async function executeTool(name: string, params: Record<string, unknown> = {}) {
	const tool = toolRegistry.get(name);
	expect(tool, `Tool not registered: ${name}`).toBeTruthy();
	const result = await tool!.execute('tool-call-1', params);
	return {
		result,
		text: getText(result)
	};
}

describeE2E('plugin end-to-end: local host bootstrap + all corev tools', () => {
	beforeAll(async () => {
		hostPort = await getFreePort();
		await writeFakeCorevBinary(corevBinPath);
		await writeFakeHostProject(hostDir);
		registerPluginTools(workspaceDir, corevBinPath, `http://127.0.0.1:${hostPort}`);
	}, 20000);

	afterAll(async () => {
		try {
			await executeTool('corev_host_stop', {force: true});
		} catch {
			// ignore cleanup issues
		}

		try {
			await fsp.rm(workspaceDir, {recursive: true, force: true});
		} catch {
			// ignore cleanup issues
		}
	});

	it('should bootstrap host, create initial user, configure corev, and run all tools', async () => {
		const expectedTools = [
			'corev_list',
			'corev_pull',
			'corev_diff',
			'corev_env',
			'corev_push',
			'corev_revert',
			'corev_checkout',
			'corev_init',
			'corev_host_status',
			'corev_host_start',
			'corev_host_stop',
			'corev_host_bootstrap',
			'corev_host_create_user'
		];

		for (const toolName of expectedTools) {
			expect(toolRegistry.has(toolName), `Missing tool: ${toolName}`).toBe(true);
		}

		const bootstrap = await executeTool('corev_host_bootstrap', {
			mongoUri: 'mongodb://127.0.0.1:27017/corev-plugin-e2e',
			port: String(hostPort),
			apiUrl: `http://127.0.0.1:${hostPort}`,
			waitMs: 10000,
			createUserEmail: 'root@root.rs',
			createUserPassword: 'root'
		});
		expect(bootstrap.text).toContain('host env configured');
		expect(bootstrap.text).toContain('host create user via api: ok');
		expect(bootstrap.text).toContain('corev init: ok');

		const envPath = path.join(hostDir, '.env');
		expect(fs.existsSync(envPath)).toBe(true);
		const envContent = fs.readFileSync(envPath, 'utf-8');
		expect(envContent).toContain('MONGO_URI=mongodb://127.0.0.1:27017/corev-plugin-e2e');
		expect(envContent).toContain(`PORT=${hostPort}`);

		const statusRunning = await executeTool('corev_host_status', {
			apiUrl: `http://127.0.0.1:${hostPort}`
		});
		expect(statusRunning.text).toContain('process: running');
		expect(statusRunning.text).toContain('health OK');

		const fileA = path.join(workspaceDir, 'a.json');
		const fileB = path.join(workspaceDir, 'b.json');
		fs.writeFileSync(fileA, JSON.stringify({foo: 'bar'}, null, 2), 'utf-8');
		fs.writeFileSync(fileB, JSON.stringify({foo: 'baz'}, null, 2), 'utf-8');

		const list = await executeTool('corev_list');
		expect(list.text).toContain('corev command succeeded');

		const pull = await executeTool('corev_pull', {project: 'atlas', env: 'staging'});
		expect(pull.text).toContain('corev command succeeded');

		const diff = await executeTool('corev_diff', {fileA, fileB});
		expect(diff.text).toContain('Differences:');

		const env = await executeTool('corev_env', {project: 'atlas', env: 'staging'});
		expect(env.text).toContain('corev command succeeded');

		const push = await executeTool('corev_push', {file: fileA, env: 'staging'});
		expect(push.text).toContain('corev command succeeded');

		const revert = await executeTool('corev_revert', {project: 'atlas', version: '1.0.0', env: 'staging'});
		expect(revert.text).toContain('corev command succeeded');

		const checkout = await executeTool('corev_checkout', {project: 'atlas', version: '1.0.1'});
		expect(checkout.text).toContain('corev command succeeded');

		const init = await executeTool('corev_init', {api: `http://127.0.0.1:${hostPort}`, token: 'fake-token'});
		expect(init.text).toContain('corev command succeeded');

		const createUserAgain = await executeTool('corev_host_create_user', {
			apiUrl: `http://127.0.0.1:${hostPort}`,
			createUserEmail: 'root@root.rs',
			createUserPassword: 'root'
		});
		expect(createUserAgain.text).toContain('host create user via api: ok');

		const stop = await executeTool('corev_host_stop', {force: true});
		expect(stop.text).toContain('corev-host stopped');

		const statusStopped = await executeTool('corev_host_status', {
			apiUrl: `http://127.0.0.1:${hostPort}`
		});
		expect(statusStopped.text).toContain('process: not running');

		const callLogPath = path.join(workspaceDir, '.fake-corev-calls.jsonl');
		expect(fs.existsSync(callLogPath)).toBe(true);
		const commands = fs
			.readFileSync(callLogPath, 'utf-8')
			.trim()
			.split('\n')
			.filter(Boolean)
			.map(line => JSON.parse(line) as {command: string})
			.map(entry => entry.command);

		for (const command of ['list', 'pull', 'diff', 'env', 'push', 'revert', 'checkout', 'init']) {
			expect(commands).toContain(command);
		}
	}, 120000);

	it('should follow README quickstart workflow from plugin install to daily usage', async () => {
		const manifestPath = path.resolve('openclaw.plugin.json');
		expect(fs.existsSync(manifestPath)).toBe(true);
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
			id?: string;
			name?: string;
		};
		expect(manifest.id).toBe('corev');
		expect(manifest.name).toBe('Corev');

		const requiredTools = ['corev_list', 'corev_pull', 'corev_diff', 'corev_env'];
		for (const toolName of requiredTools) {
			expect(toolRegistry.has(toolName), `Missing required README tool: ${toolName}`).toBe(true);
		}

		const optionalTools = ['corev_push', 'corev_revert', 'corev_checkout', 'corev_init'];
		for (const toolName of optionalTools) {
			expect(toolRegistry.has(toolName), `Missing optional README tool: ${toolName}`).toBe(true);
		}

		const bootstrap = await executeTool('corev_host_bootstrap', {
			mongoUri: 'mongodb://127.0.0.1:27017/corev-plugin-readme-flow',
			port: String(hostPort),
			apiUrl: `http://127.0.0.1:${hostPort}`,
			waitMs: 10000,
			createUserEmail: 'root@root.rs',
			createUserPassword: 'root'
		});
		expect(bootstrap.text).toContain('host env configured');
		expect(bootstrap.text).toContain('corev init: ok');

		const rcPath = path.join(workspaceDir, '.corevrc.json');
		expect(fs.existsSync(rcPath)).toBe(true);
		const rc = JSON.parse(fs.readFileSync(rcPath, 'utf-8')) as {api?: string};
		expect(rc.api).toBe(`http://127.0.0.1:${hostPort}`);

		const status = await executeTool('corev_host_status', {
			apiUrl: `http://127.0.0.1:${hostPort}`
		});
		expect(status.text).toContain('process: running');
		expect(status.text).toContain('health OK');

		const fileA = path.join(workspaceDir, 'readme-a.json');
		const fileB = path.join(workspaceDir, 'readme-b.json');
		fs.writeFileSync(fileA, JSON.stringify({feature: 'old'}, null, 2), 'utf-8');
		fs.writeFileSync(fileB, JSON.stringify({feature: 'new'}, null, 2), 'utf-8');

		const list = await executeTool('corev_list');
		expect(list.text).toContain('corev command succeeded');

		const pull = await executeTool('corev_pull', {project: 'atlas'});
		expect(pull.text).toContain('corev command succeeded');

		const diff = await executeTool('corev_diff', {fileA, fileB});
		expect(diff.text).toContain('Differences:');

		const env = await executeTool('corev_env', {project: 'atlas', env: 'staging'});
		expect(env.text).toContain('corev command succeeded');

		const push = await executeTool('corev_push', {file: fileA, env: 'staging'});
		expect(push.text).toContain('corev command succeeded');

		const revert = await executeTool('corev_revert', {project: 'atlas', version: '1.0.0', env: 'staging'});
		expect(revert.text).toContain('corev command succeeded');

		const checkout = await executeTool('corev_checkout', {project: 'atlas', version: '1.0.1'});
		expect(checkout.text).toContain('corev command succeeded');

		const stop = await executeTool('corev_host_stop', {force: true});
		expect(stop.text).toContain('corev-host stopped');
	}, 120000);
});
