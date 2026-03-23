/**
 * @file e2e.live.test.ts
 * @description Optional live end-to-end test against local corev-host.
 *
 * This suite is disabled by default. Enable with:
 *   COREV_LIVE_E2E=1 npm run test:e2e:live
 *
 * Optional env:
 *   COREV_HOST_DIR (default: <repo>/src/host/server)
 *   COREV_HOST_START_COMMAND (default: npm run dev)
 *   COREV_HOST_STOP_COMMAND (optional)
 *   COREV_HOST_API_URL (default: auto-selected free localhost port)
 *   COREV_HOST_HEALTH_PATH (default: /health)
 *   COREV_HOST_SESSION_SECRET (default: corev_live_e2e_session_secret_change_me)
 *   COREV_HOST_JWT_SECRET (default: corev_live_e2e_jwt_secret_change_me)
 *   COREV_HOST_NODE_ENV (default: development)
 *   COREV_HOST_CREATE_USER_COMMAND (optional; if omitted, test creates user via /api/auth/signup)
 *   COREV_HOST_CREATE_USER_EMAIL (default: root@root.rs)
 *   COREV_HOST_CREATE_USER_PASSWORD (default: root)
 *   COREV_API_TOKEN (optional, passed to corev init)
 */

import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {execFile as execFileCb, spawn} from 'child_process';
import {createRequire} from 'module';
import {promisify} from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import net from 'net';

const execFile = promisify(execFileCb);
const runLive = process.env.COREV_LIVE_E2E === '1';
const describeLive = runLive ? describe : describe.skip;

const hostStartCommand = process.env.COREV_HOST_START_COMMAND || 'npm run dev';
const hostStopCommand = process.env.COREV_HOST_STOP_COMMAND || '';
const configuredHostApiUrl = process.env.COREV_HOST_API_URL || '';
const hostHealthPath = process.env.COREV_HOST_HEALTH_PATH || '/health';
const hostSessionSecret = process.env.COREV_HOST_SESSION_SECRET || 'corev_live_e2e_session_secret_change_me';
const hostJwtSecret = process.env.COREV_HOST_JWT_SECRET || 'corev_live_e2e_jwt_secret_change_me';
const hostNodeEnv = process.env.COREV_HOST_NODE_ENV || 'development';
const hostCreateUserCommand = process.env.COREV_HOST_CREATE_USER_COMMAND || '';
const hostCreateUserEmail = process.env.COREV_HOST_CREATE_USER_EMAIL || 'root@root.rs';
const hostCreateUserPassword = process.env.COREV_HOST_CREATE_USER_PASSWORD || 'root';
const corevApiToken = process.env.COREV_API_TOKEN || '';

const repoRoot = path.resolve(__dirname, '..');
const tsxBinPath = path.resolve(repoRoot, 'node_modules', '.bin', 'tsx');
const initCommandPath = path.resolve(repoRoot, 'src', 'commands', 'init.ts');
const hostDir = process.env.COREV_HOST_DIR || path.resolve(repoRoot, 'src', 'host', 'server');
const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corev-live-e2e-'));
const rcPath = path.join(workspaceDir, '.corevrc.json');
const hostLogsPath = path.join(workspaceDir, 'corev-host.live.log');

type MongoMemoryServerLike = {
	stop: () => Promise<void>;
	getUri: () => string;
};

let hostProcess: ReturnType<typeof spawn> | null = null;
let mongoMemoryServer: MongoMemoryServerLike | null = null;
let resolvedHostMongoUri = '';
let resolvedHostApiUrl = configuredHostApiUrl;

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function getFreePort(): Promise<number> {
	return await new Promise((resolve, reject) => {
		const server = net.createServer();
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Could not allocate a free localhost port'));
				return;
			}
			const {port} = address;
			server.close(() => resolve(port));
		});
		server.on('error', reject);
	});
}

function getHostPortFromApiUrl(apiUrl: string): string {
	const parsed = new URL(apiUrl);
	if (parsed.port) return parsed.port;
	return parsed.protocol === 'https:' ? '443' : '80';
}

function buildHostEnvFileContent(port: string, mongoUri: string): string {
	return [
		`MONGO_URI=${mongoUri}`,
		`PORT=${port}`,
		`SESSION_SECRET=${hostSessionSecret}`,
		`JWT_SECRET=${hostJwtSecret}`,
		`NODE_ENV=${hostNodeEnv}`
	].join('\n') + '\n';
}

function appendHostLog(chunk: Buffer | string) {
	fs.appendFileSync(hostLogsPath, chunk.toString(), 'utf-8');
}

function readHostLogTail(maxChars = 8000): string {
	if (!fs.existsSync(hostLogsPath)) return '(host log not found)';
	const raw = fs.readFileSync(hostLogsPath, 'utf-8');
	if (raw.length <= maxChars) return raw;
	return raw.slice(raw.length - maxChars);
}

function hostExitInfo(): string {
	if (!hostProcess) return 'host process not started';
	return `pid=${hostProcess.pid ?? 'unknown'}, exitCode=${hostProcess.exitCode ?? 'null'}, signalCode=${hostProcess.signalCode ?? 'null'}`;
}

async function execCommand(command: string, args: string[], cwd: string, shell = false) {
	const {stdout, stderr} = await execFile(command, args, {
		cwd,
		shell,
		maxBuffer: 1024 * 1024 * 10,
		env: process.env
	});

	return {stdout, stderr};
}

async function execShell(command: string, cwd: string) {
	const {stdout, stderr} = await execFile('/bin/sh', ['-lc', command], {
		cwd,
		maxBuffer: 1024 * 1024 * 10,
		env: process.env
	});
	return {stdout, stderr};
}

async function waitForHealth(url: string, attempts = 60, delayMs = 1000): Promise<boolean> {
	for (let i = 0; i < attempts; i += 1) {
		const ok = await new Promise<boolean>((resolve) => {
			http
				.get(url, (res) => {
					res.resume();
					const status = res.statusCode || 500;
					resolve(status >= 200 && status < 300);
				})
				.on('error', () => resolve(false));
		});

		if (ok) return true;
		await sleep(delayMs);
	}

	return false;
}

async function createUserViaApi(apiUrl: string, email: string, password: string): Promise<void> {
	const signupUrl = new URL('/api/auth/signup', apiUrl).toString();
	let lastError: unknown = null;

	for (let i = 0; i < 10; i += 1) {
		try {
			const response = await fetch(signupUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({email, password})
			});
			if (response.ok || response.status === 409) {
				return;
			}

			const body = await response.text();
			lastError = new Error(`User creation failed (${response.status}): ${body}`);
		} catch (error) {
			lastError = error;
		}

		await sleep(1000);
	}

	const base = lastError instanceof Error ? lastError.message : String(lastError);
	throw new Error(
		[
			`User creation failed after retries: ${base}`,
			`Signup URL: ${signupUrl}`,
			`Host process: ${hostExitInfo()}`,
			`Host log tail:`,
			readHostLogTail()
		].join('\n')
	);
}

async function ensureMongoUri(hostPackageJsonPath: string): Promise<void> {
	try {
		const hostRequire = createRequire(hostPackageJsonPath);
		const mod = hostRequire('mongodb-memory-server') as {
			MongoMemoryServer: {create: (options?: {instance?: {ip?: string}}) => Promise<MongoMemoryServerLike>};
		};
		mongoMemoryServer = await mod.MongoMemoryServer.create({
			instance: {ip: '127.0.0.1'}
		});
		resolvedHostMongoUri = mongoMemoryServer.getUri();
		appendHostLog(`[live-e2e] started in-memory mongo at ${resolvedHostMongoUri}\n`);
	} catch (error: unknown) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(
			[
				'Failed to start in-memory MongoDB.',
				`Reason: ${reason}`
			].join('\n')
		);
	}
}

describeLive('live e2e: corev-host bootstrap + corev init', () => {
	beforeAll(async () => {
		const hostPackageJsonPath = path.join(hostDir, 'package.json');
		if (!fs.existsSync(hostPackageJsonPath)) {
			throw new Error(`Local corev-host server not found at: ${hostDir}`);
		}

		await execCommand('npm', ['install'], hostDir);
		await ensureMongoUri(hostPackageJsonPath);

		if (!configuredHostApiUrl) {
			const freePort = await getFreePort();
			resolvedHostApiUrl = `http://127.0.0.1:${freePort}`;
		}

		const hostPort = getHostPortFromApiUrl(resolvedHostApiUrl);
		const envPath = path.join(hostDir, '.env');
		fs.writeFileSync(envPath, buildHostEnvFileContent(hostPort, resolvedHostMongoUri), 'utf-8');

		hostProcess = spawn(hostStartCommand, {
			cwd: hostDir,
			shell: true,
			detached: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				MONGO_URI: resolvedHostMongoUri,
				PORT: hostPort,
				SESSION_SECRET: hostSessionSecret,
				JWT_SECRET: hostJwtSecret,
				NODE_ENV: hostNodeEnv
			}
		});
		if (hostProcess.stdout) hostProcess.stdout.on('data', appendHostLog);
		if (hostProcess.stderr) hostProcess.stderr.on('data', appendHostLog);

		const healthUrl = new URL(hostHealthPath, resolvedHostApiUrl).toString();
		const healthy = await waitForHealth(healthUrl);
		if (!healthy) {
			throw new Error(
				[
					`Host health did not become ready: ${healthUrl}`,
					`Host dir: ${hostDir}`,
					`Host start command: ${hostStartCommand}`,
					`Host mongo uri: ${resolvedHostMongoUri}`,
					`Host process: ${hostExitInfo()}`,
					`Host log tail:`,
					readHostLogTail()
				].join('\n')
			);
		}

		if (hostCreateUserCommand) {
			await execShell(hostCreateUserCommand, hostDir);
		} else {
			await createUserViaApi(resolvedHostApiUrl, hostCreateUserEmail, hostCreateUserPassword);
		}
	}, 240000);

	afterAll(async () => {
		if (hostStopCommand) {
			try {
				await execShell(hostStopCommand, hostDir);
			} catch {
				// ignore stop command failures in cleanup
			}
		} else if (hostProcess?.pid) {
			try {
				process.kill(hostProcess.pid, 'SIGTERM');
			} catch {
				// ignore cleanup failure
			}
		}

		if (mongoMemoryServer) {
			try {
				await mongoMemoryServer.stop();
			} catch {
				// ignore mongo cleanup failure
			}
		}

		try {
			fs.rmSync(workspaceDir, {recursive: true, force: true});
		} catch {
			// ignore workspace cleanup failures
		}
	});

	it('should configure corev CLI with live host backend api', async () => {
		const runnerScript = [
			`import initCommand from ${JSON.stringify(initCommandPath)};`,
			`(async () => {`,
			`  const action = initCommand['_actionHandler'];`,
			`  if (typeof action !== 'function') {`,
			`    throw new Error('init command action handler is not available');`,
			`  }`,
			`  initCommand.setOptionValue('api', process.env.COREV_TEST_INIT_API || null);`,
			`  initCommand.setOptionValue('token', process.env.COREV_TEST_INIT_TOKEN || null);`,
			`  initCommand.setOptionValue('host', false);`,
			`  await action([]);`,
			`})().catch((err) => {`,
			`  console.error(err);`,
			`  process.exit(1);`,
			`});`
		].join('\n');

		const result = await execFile(tsxBinPath, ['-e', runnerScript], {
			cwd: workspaceDir,
			maxBuffer: 1024 * 1024 * 10,
			env: {
				...process.env,
				COREV_TEST_INIT_API: resolvedHostApiUrl,
				COREV_TEST_INIT_TOKEN: corevApiToken
			}
		});

		const combined = `${result.stdout}\n${result.stderr}`;
		expect(combined).toContain('Corev configured with:');

		expect(fs.existsSync(rcPath)).toBe(true);

		const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8')) as { api?: string; token?: string };
		expect(rc.api).toContain(resolvedHostApiUrl.replace(/\/+$/, ''));
		if (corevApiToken) {
			expect(rc.token).toBe(corevApiToken);
		}
	});
});
