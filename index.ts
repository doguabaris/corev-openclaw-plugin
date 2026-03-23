import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import {promises as fsp} from 'node:fs';
import path from 'node:path';
import {Type} from '@sinclair/typebox';
import {definePluginEntry} from 'openclaw/plugin-sdk/plugin-entry';

type PluginConfig = {
	corevBin?: string;
	workingDirectory?: string;
	defaultProject?: string;
	defaultEnv?: string;
	hostApiUrl?: string;
	hostMongoUri?: string;
	hostPort?: string;
	hostSessionSecret?: string;
	hostJwtSecret?: string;
	hostNodeEnv?: string;
	hostStartCommand?: string;
	hostStopCommand?: string;
	hostCreateUserCommand?: string;
	hostHealthPath?: string;
};

const PID_FILE = 'corev-host.pid';
const LOG_FILE = 'corev-host.log';
const DEFAULT_BUNDLED_HOST_SERVER_RELATIVE_PATH = path.join('src', 'host', 'server');
const DEFAULT_HOST_API_URL = 'http://127.0.0.1:3000';

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function normalizeParams(params: unknown): Record<string, unknown> {
	return params && typeof params === 'object' ? params as Record<string, unknown> : {};
}

function textResponse(text: string) {
	return {
		details: {},
		content: [
			{
				type: 'text' as const,
				text
			}
		]
	};
}

function stripAnsi(input: string): string {
	let out = '';
	let i = 0;

	while (i < input.length) {
		const code = input.charCodeAt(i);
		const next = input.charCodeAt(i + 1);

		if (code === 27 && next === 91) {
			i += 2;
			while (i < input.length) {
				const c = input.charCodeAt(i);
				i += 1;
				if (c >= 64 && c <= 126) break;
			}
			continue;
		}

		out += input[i];
		i += 1;
	}

	return out;
}

function trimResult(text: string): string {
	const normalized = stripAnsi(text).trim();
	return normalized.length > 0 ? normalized : '(no output)';
}

function buildResponse(command: string, result: { ok: boolean; code: number; stdout: string; stderr: string }) {
	const summary = result.ok
		? `corev command succeeded (${command})`
		: `corev command failed (${command}, exit ${result.code})`;

	const details = [
		`stdout:\n${trimResult(result.stdout)}`,
		`stderr:\n${trimResult(result.stderr)}`
	].join('\n\n');

	return textResponse(`${summary}\n\n${details}`);
}

function resolveProject(params: Record<string, unknown>, pluginConfig: PluginConfig): string | undefined {
	return asString(params.project) || asString(pluginConfig.defaultProject);
}

function resolveEnv(params: Record<string, unknown>, pluginConfig: PluginConfig): string | undefined {
	return asString(params.env) || asString(pluginConfig.defaultEnv);
}

function resolveHostApiUrl(params: Record<string, unknown>, pluginConfig: PluginConfig): string {
	return asString(params.apiUrl) || asString(pluginConfig.hostApiUrl) || DEFAULT_HOST_API_URL;
}

function resolveHostHealthPath(params: Record<string, unknown>, pluginConfig: PluginConfig): string {
	return asString(params.healthPath) || asString(pluginConfig.hostHealthPath) || '/health';
}

function resolveHostCreateUserCommand(params: Record<string, unknown>, pluginConfig: PluginConfig): string | undefined {
	return asString(params.createUserCommand) || asString(pluginConfig.hostCreateUserCommand);
}

function resolveHostCreateUserEmail(params: Record<string, unknown>): string {
	return asString(params.createUserEmail) || 'root@root.rs';
}

function resolveHostCreateUserPassword(params: Record<string, unknown>): string {
	return asString(params.createUserPassword) || 'root';
}

function resolveHostMongoUri(params: Record<string, unknown>, pluginConfig: PluginConfig): string | undefined {
	return asString(params.mongoUri) || asString(pluginConfig.hostMongoUri) || asString(process.env.MONGO_URI);
}

function resolveHostPort(params: Record<string, unknown>, pluginConfig: PluginConfig): string {
	return asString(params.port) || asString(pluginConfig.hostPort) || asString(process.env.PORT) || '3000';
}

function resolveHostSessionSecret(params: Record<string, unknown>, pluginConfig: PluginConfig): string | undefined {
	return asString(params.sessionSecret) || asString(pluginConfig.hostSessionSecret) || asString(process.env.SESSION_SECRET);
}

function resolveHostJwtSecret(params: Record<string, unknown>, pluginConfig: PluginConfig): string | undefined {
	return asString(params.jwtSecret) || asString(pluginConfig.hostJwtSecret) || asString(process.env.JWT_SECRET);
}

function resolveHostNodeEnv(params: Record<string, unknown>, pluginConfig: PluginConfig): string {
	return asString(params.nodeEnv) || asString(pluginConfig.hostNodeEnv) || asString(process.env.NODE_ENV) || 'development';
}

function requireField(name: string, value: string | undefined): asserts value is string {
	if (!value) {
		throw new Error(`Missing required field: ${name}`);
	}
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function getWorkingDirectory(pluginConfig: PluginConfig): string {
	return asString(pluginConfig.workingDirectory) || process.cwd();
}

function getStateDir(pluginConfig: PluginConfig): string {
	const base = getWorkingDirectory(pluginConfig);
	return path.resolve(base, '.corev-openclaw-plugin');
}

function resolveBundledHostPath(pluginConfig: PluginConfig): string {
	return path.resolve(getWorkingDirectory(pluginConfig), DEFAULT_BUNDLED_HOST_SERVER_RELATIVE_PATH);
}

function resolveHostPath(pluginConfig: PluginConfig): string {
	return resolveBundledHostPath(pluginConfig);
}

async function ensureStateDir(pluginConfig: PluginConfig): Promise<string> {
	const dir = getStateDir(pluginConfig);
	await fsp.mkdir(dir, {recursive: true});
	return dir;
}

function getPidFilePath(pluginConfig: PluginConfig): string {
	return path.join(getStateDir(pluginConfig), PID_FILE);
}

function getLogFilePath(pluginConfig: PluginConfig): string {
	return path.join(getStateDir(pluginConfig), LOG_FILE);
}

async function readHostPid(pluginConfig: PluginConfig): Promise<number | null> {
	try {
		const raw = await fsp.readFile(getPidFilePath(pluginConfig), 'utf-8');
		const pid = Number(raw.trim());
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

async function writeHostPid(pluginConfig: PluginConfig, pid: number): Promise<void> {
	await ensureStateDir(pluginConfig);
	await fsp.writeFile(getPidFilePath(pluginConfig), `${pid}\n`, 'utf-8');
}

async function clearHostPid(pluginConfig: PluginConfig): Promise<void> {
	try {
		await fsp.unlink(getPidFilePath(pluginConfig));
	} catch {
		// ignore missing pid file
	}
}

async function ensureLocalHostServer(hostPath: string): Promise<{ ok: boolean; text: string }> {
	const packageJsonPath = path.join(hostPath, 'package.json');
	if (fs.existsSync(packageJsonPath)) {
		return {
			ok: true,
			text: `using local corev-host server at ${hostPath}`
		};
	}

	return {
		ok: false,
		text: `corev-host server was not found at ${hostPath}. add host sources into src/host/server (with package.json) and run again.`
	};
}

async function ensureHostDependencies(hostPath: string): Promise<{ ok: boolean; text: string }> {
	const nodeModulesPath = path.join(hostPath, 'node_modules');
	if (fs.existsSync(nodeModulesPath)) {
		return {
			ok: true,
			text: 'host dependencies already installed.'
		};
	}

	const install = await execCommand('npm', ['install'], hostPath, false);
	if (!install.ok) {
		return {
			ok: false,
			text: `host dependency install failed (${install.code}).\n\nstdout:\n${trimResult(install.stdout)}\n\nstderr:\n${trimResult(install.stderr)}`
		};
	}

	return {
		ok: true,
		text: 'host dependencies installed (npm install).'
	};
}

function parseDotEnv(content: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		out[key] = value;
	}
	return out;
}

function generateStrongSecret(bytes = 48): string {
	return randomBytes(bytes).toString('hex');
}

async function ensureHostEnvFile(
	hostPath: string,
	params: Record<string, unknown>,
	pluginConfig: PluginConfig
): Promise<{ ok: boolean; text: string }> {
	const envFile = path.join(hostPath, '.env');
	const existingRaw = fs.existsSync(envFile) ? await fsp.readFile(envFile, 'utf-8') : '';
	const existing = parseDotEnv(existingRaw);

	const mongoUri = resolveHostMongoUri(params, pluginConfig) || existing.MONGO_URI;
	if (!mongoUri) {
		return {
			ok: false,
			text: `Missing MongoDB URI. provide "mongoUri" in tool params or "hostMongoUri" in plugin config. env file: ${envFile}`
		};
	}

	const values: Record<string, string> = {
		MONGO_URI: mongoUri,
		PORT: resolveHostPort(params, pluginConfig) || existing.PORT || '3000',
		SESSION_SECRET: resolveHostSessionSecret(params, pluginConfig) || existing.SESSION_SECRET || generateStrongSecret(),
		JWT_SECRET: resolveHostJwtSecret(params, pluginConfig) || existing.JWT_SECRET || generateStrongSecret(),
		NODE_ENV: resolveHostNodeEnv(params, pluginConfig) || existing.NODE_ENV || 'development'
	};

	const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
	await fsp.writeFile(envFile, `${lines.join('\n')}\n`, 'utf-8');

	return {
		ok: true,
		text: `host env configured at ${envFile} (MONGO_URI, PORT, SESSION_SECRET, JWT_SECRET, NODE_ENV).`
	};
}

async function createHostDashboardUser(
	params: Record<string, unknown>,
	pluginConfig: PluginConfig,
	hostPath: string
): Promise<{ ok: boolean; text: string }> {
	const createUserCommand = resolveHostCreateUserCommand(params, pluginConfig);
	if (createUserCommand) {
		const createUser = await execCommand(createUserCommand, [], hostPath, true);
		return {
			ok: createUser.ok,
			text: [
				`host create user via command: ${createUser.ok ? 'ok' : `failed (${createUser.code})`}`,
				`stdout:\n${trimResult(createUser.stdout)}`,
				`stderr:\n${trimResult(createUser.stderr)}`
			].join('\n\n')
		};
	}

	const apiUrl = resolveHostApiUrl(params, pluginConfig);
	if (!apiUrl) {
		return {
			ok: false,
			text: 'host user creation requires hostApiUrl/apiUrl when createUserCommand is not set.'
		};
	}

	const email = resolveHostCreateUserEmail(params);
	const password = resolveHostCreateUserPassword(params);
	const url = new URL('/api/auth/signup', apiUrl).toString();

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email,
				password
			})
		});
		const body = await response.text();
		const ok = response.ok || response.status === 409;

		return {
			ok,
			text: [
				`host create user via api: ${ok ? 'ok' : 'failed'} (status ${response.status})`,
				`email: ${email}`,
				`endpoint: ${url}`,
				`response:\n${trimResult(body)}`
			].join('\n')
		};
	} catch (error: unknown) {
		return {
			ok: false,
			text: `host create user via api failed. endpoint: ${url}. error: ${error instanceof Error ? error.message : 'Unknown network error'}`
		};
	}
}

async function checkHostHealth(apiUrl: string, healthPath: string, timeoutMs = 2500): Promise<{
	ok: boolean;
	status?: number;
	url: string;
	error?: string;
}> {
	const url = new URL(healthPath, apiUrl).toString();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(url, {
			method: 'GET',
			signal: controller.signal
		});
		return {
			ok: res.ok,
			status: res.status,
			url
		};
	} catch (error: unknown) {
		return {
			ok: false,
			url,
			error: error instanceof Error ? error.message : 'Unknown network error'
		};
	} finally {
		clearTimeout(timer);
	}
}

function execCommand(command: string, args: string[], cwd: string, shell = false) {
	return new Promise<{
		ok: boolean;
		code: number;
		stdout: string;
		stderr: string;
		command: string;
	}>((resolve) => {
		const child = spawn(command, args, {
			cwd,
			env: process.env,
			shell,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			resolve({
				ok: false,
				code: -1,
				stdout,
				stderr: `${stderr}\n${error.message}`.trim(),
				command: [command, ...args].join(' ')
			});
		});

		child.on('close', (code) => {
			resolve({
				ok: code === 0,
				code: code ?? -1,
				stdout,
				stderr,
				command: [command, ...args].join(' ')
			});
		});
	});
}

function execCorev(api: { pluginConfig?: unknown }, args: string[]) {
	const pluginConfig = (api.pluginConfig || {}) as PluginConfig;
	const command = asString(pluginConfig.corevBin) || 'corev';
	const cwd = asString(pluginConfig.workingDirectory) || process.cwd();

	return execCommand(command, args, cwd, false);
}

async function runAndRespond(api: { pluginConfig?: unknown }, args: string[]) {
	const result = await execCorev(api, args);
	return buildResponse(result.command, result);
}

async function startHost(
	params: Record<string, unknown>,
	pluginConfig: PluginConfig
): Promise<{ text: string; ok: boolean }> {
	const hostPath = resolveHostPath(pluginConfig);

	const startCommand = asString(params.command) || asString(pluginConfig.hostStartCommand) || 'npm run dev';
	const apiUrl = resolveHostApiUrl(params, pluginConfig);
	const healthPath = resolveHostHealthPath(params, pluginConfig);
	const waitMs = Math.max(asNumber(params.waitMs) ?? 15000, 1000);
	const installDeps = asBoolean(params.installDeps) !== false;

	const existingPid = await readHostPid(pluginConfig);
	if (existingPid && isProcessAlive(existingPid)) {
		const health = await checkHostHealth(apiUrl, healthPath);
		const healthText = health.ok
			? `health OK (${health.status}) at ${health.url}`
			: `health NOT READY at ${health.url}${health.error ? ` (${health.error})` : ''}`;

		return {
			ok: true,
			text: `corev-host already running (pid ${existingPid}). ${healthText}`
		};
	}

	const ensuredLocalHost = await ensureLocalHostServer(hostPath);
	if (!ensuredLocalHost.ok) {
		return {
			ok: false,
			text: ensuredLocalHost.text
		};
	}

	const envSetup = await ensureHostEnvFile(hostPath, params, pluginConfig);
	if (!envSetup.ok) {
		return {
			ok: false,
			text: `${ensuredLocalHost.text}\n${envSetup.text}`
		};
	}

	const installNotes: string[] = [ensuredLocalHost.text, envSetup.text];
	if (installDeps) {
		const ensuredDeps = await ensureHostDependencies(hostPath);
		installNotes.push(ensuredDeps.text);
		if (!ensuredDeps.ok) {
			return {
				ok: false,
				text: installNotes.join('\n')
			};
		}
	}

	await ensureStateDir(pluginConfig);
	const logFile = getLogFilePath(pluginConfig);
	const logFd = fs.openSync(logFile, 'a');

	const child = spawn(startCommand, {
		cwd: hostPath,
		env: process.env,
		shell: true,
		detached: true,
		stdio: ['ignore', logFd, logFd]
	});
	child.unref();
	fs.closeSync(logFd);

	if (!child.pid) {
		return {
			ok: false,
			text: `failed to start corev-host. start command: ${startCommand}`
		};
	}

	await writeHostPid(pluginConfig, child.pid);

	const deadline = Date.now() + waitMs;
	while (Date.now() < deadline) {
		const health = await checkHostHealth(apiUrl, healthPath);
		if (health.ok) {
			return {
				ok: true,
				text: `${installNotes.join('\n')}\ncorev-host started (pid ${child.pid}). health OK (${health.status}) at ${health.url}. log: ${logFile}`
			};
		}
		await sleep(1000);
	}

	const health = await checkHostHealth(apiUrl, healthPath);
	return {
		ok: false,
		text: `corev-host process started (pid ${child.pid}) but health is not ready at ${health.url}${health.error ? ` (${health.error})` : ''}. log: ${logFile}`
	};
}

async function stopHost(
	params: Record<string, unknown>,
	pluginConfig: PluginConfig
): Promise<{ text: string; ok: boolean }> {
	const hostPath = resolveHostPath(pluginConfig);
	const stopCommand = asString(params.command) || asString(pluginConfig.hostStopCommand);

	if (stopCommand) {
		const result = await execCommand(stopCommand, [], hostPath, true);
		await clearHostPid(pluginConfig);
		return {
			ok: result.ok,
			text: `stop command ${result.ok ? 'succeeded' : 'failed'} (${result.command}).\n\nstdout:\n${trimResult(result.stdout)}\n\nstderr:\n${trimResult(result.stderr)}`
		};
	}

	const pid = asNumber(params.pid) ?? (await readHostPid(pluginConfig));
	if (!pid) {
		return {
			ok: false,
			text: 'no corev-host pid found (pid file missing). set hostStopCommand or provide pid.'
		};
	}

	if (!isProcessAlive(pid)) {
		await clearHostPid(pluginConfig);
		return {
			ok: true,
			text: `pid ${pid} is not running. pid file removed.`
		};
	}

	const force = asBoolean(params.force) === true;

	try {
		process.kill(-pid, 'SIGTERM');
	} catch {
		process.kill(pid, 'SIGTERM');
	}

	for (let i = 0; i < 5; i += 1) {
		if (!isProcessAlive(pid)) {
			await clearHostPid(pluginConfig);
			return {
				ok: true,
				text: `corev-host stopped (pid ${pid}).`
			};
		}
		await sleep(500);
	}

	if (force) {
		try {
			process.kill(-pid, 'SIGKILL');
		} catch {
			process.kill(pid, 'SIGKILL');
		}
		await sleep(300);
	}

	const alive = isProcessAlive(pid);
	if (!alive) {
		await clearHostPid(pluginConfig);
	}

	return {
		ok: !alive,
		text: alive
			? `failed to stop corev-host (pid ${pid}).`
			: `corev-host stopped (pid ${pid}).`
	};
}

export default definePluginEntry({
	id: 'corev',
	name: 'Corev',
	description: 'Expose Corev operations as OpenClaw agent tools.',
	register(api) {
		api.registerTool({
			name: 'corev_list',
			label: 'corev_list',
			description: 'List local Corev config versions',
			parameters: Type.Object({}),
			async execute() {
				return runAndRespond(api, ['list']);
			}
		});

		api.registerTool({
			name: 'corev_pull',
			label: 'corev_pull',
			description: 'Pull latest config for a project',
			parameters: Type.Object({
				project: Type.Optional(Type.String()),
				env: Type.Optional(Type.String())
			}),
			async execute(_id, params) {
				const p = normalizeParams(params);
				const project = resolveProject(p, (api.pluginConfig || {}) as PluginConfig);
				requireField('project', project);

				const env = resolveEnv(p, (api.pluginConfig || {}) as PluginConfig);
				const args = ['pull', project];
				if (env) args.push('--env', env);

				return runAndRespond(api, args);
			}
		});

		api.registerTool({
			name: 'corev_diff',
			label: 'corev_diff',
			description: 'Diff two local Corev config JSON files',
			parameters: Type.Object({
				fileA: Type.String(),
				fileB: Type.String()
			}),
			async execute(_id, params) {
				const p = normalizeParams(params);
				const fileA = asString(p.fileA);
				const fileB = asString(p.fileB);
				requireField('fileA', fileA);
				requireField('fileB', fileB);

				return runAndRespond(api, ['diff', fileA, fileB]);
			}
		});

		api.registerTool({
			name: 'corev_env',
			label: 'corev_env',
			description: 'Create Corev environment folder for a project',
			parameters: Type.Object({
				project: Type.Optional(Type.String()),
				env: Type.Optional(Type.String())
			}),
			async execute(_id, params) {
				const p = normalizeParams(params);
				const project = resolveProject(p, (api.pluginConfig || {}) as PluginConfig);
				const env = resolveEnv(p, (api.pluginConfig || {}) as PluginConfig);
				requireField('project', project);
				requireField('env', env);

				return runAndRespond(api, ['env', project, env]);
			}
		});

		api.registerTool(
			{
				name: 'corev_push',
				label: 'corev_push',
				description: 'Push local config JSON to Corev backend',
				parameters: Type.Object({
					file: Type.String(),
					env: Type.Optional(Type.String())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const file = asString(p.file);
					requireField('file', file);

					const env = resolveEnv(p, (api.pluginConfig || {}) as PluginConfig);
					const args = ['push', file];
					if (env) args.push('--env', env);

					return runAndRespond(api, args);
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_revert',
				label: 'corev_revert',
				description: 'Revert remote config to a local version',
				parameters: Type.Object({
					project: Type.Optional(Type.String()),
					version: Type.String(),
					env: Type.Optional(Type.String())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const project = resolveProject(p, (api.pluginConfig || {}) as PluginConfig);
					const version = asString(p.version);
					requireField('project', project);
					requireField('version', version);

					const env = resolveEnv(p, (api.pluginConfig || {}) as PluginConfig);
					const args = ['revert', project, version];
					if (env) args.push('--env', env);

					return runAndRespond(api, args);
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_checkout',
				label: 'corev_checkout',
				description: 'Checkout and save a specific config version',
				parameters: Type.Object({
					project: Type.Optional(Type.String()),
					version: Type.String()
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const project = resolveProject(p, (api.pluginConfig || {}) as PluginConfig);
					const version = asString(p.version);
					requireField('project', project);
					requireField('version', version);

					return runAndRespond(api, ['checkout', project, version]);
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_init',
				label: 'corev_init',
				description: 'Configure Corev API endpoint and optional token',
				parameters: Type.Object({
					api: Type.Optional(Type.String()),
					token: Type.Optional(Type.String())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const apiUrl = asString(p.api);
					const token = asString(p.token);

					if (!apiUrl && !token) {
						throw new Error('At least one of "api" or "token" is required.');
					}

					const args = ['init'];
					if (apiUrl) args.push('--api', apiUrl);
					if (token) args.push('--token', token);

					return runAndRespond(api, args);
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_host_status',
				label: 'corev_host_status',
				description: 'Check corev-host process and health status',
				parameters: Type.Object({
					apiUrl: Type.Optional(Type.String()),
					healthPath: Type.Optional(Type.String())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const pluginConfig = (api.pluginConfig || {}) as PluginConfig;
					const hostPath = resolveHostPath(pluginConfig);
					const apiUrl = resolveHostApiUrl(p, pluginConfig);
					const healthPath = resolveHostHealthPath(p, pluginConfig);
					const pid = await readHostPid(pluginConfig);
					const alive = pid ? isProcessAlive(pid) : false;
					const health = await checkHostHealth(apiUrl, healthPath);
					const healthLine = health.ok
						? `health OK (${health.status}) at ${health.url}`
						: `health NOT READY at ${health.url}${health.error ? ` (${health.error})` : ''}`;

					const lines = [
						`hostPath: ${hostPath}`,
						`pid: ${pid ?? '(none)'}`,
						`process: ${alive ? 'running' : 'not running'}`,
						healthLine
					];

					return textResponse(lines.join('\n'));
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_host_start',
				label: 'corev_host_start',
				description: 'Start local corev-host from src/host/server',
				parameters: Type.Object({
					apiUrl: Type.Optional(Type.String()),
					mongoUri: Type.Optional(Type.String()),
					port: Type.Optional(Type.String()),
					sessionSecret: Type.Optional(Type.String()),
					jwtSecret: Type.Optional(Type.String()),
					nodeEnv: Type.Optional(Type.String()),
					healthPath: Type.Optional(Type.String()),
					command: Type.Optional(Type.String()),
					installDeps: Type.Optional(Type.Boolean()),
					waitMs: Type.Optional(Type.Number())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const started = await startHost(p, (api.pluginConfig || {}) as PluginConfig);
					return textResponse(started.text);
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_host_stop',
				label: 'corev_host_stop',
				description: 'Stop corev-host process (pid file or command based)',
				parameters: Type.Object({
					command: Type.Optional(Type.String()),
					pid: Type.Optional(Type.Number()),
					force: Type.Optional(Type.Boolean())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const stopped = await stopHost(p, (api.pluginConfig || {}) as PluginConfig);
					return textResponse(stopped.text);
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_host_bootstrap',
				label: 'corev_host_bootstrap',
				description: 'Install/start corev-host, create dashboard user, initialize corev API endpoint',
				parameters: Type.Object({
					apiUrl: Type.Optional(Type.String()),
					mongoUri: Type.Optional(Type.String()),
					port: Type.Optional(Type.String()),
					sessionSecret: Type.Optional(Type.String()),
					jwtSecret: Type.Optional(Type.String()),
					nodeEnv: Type.Optional(Type.String()),
					token: Type.Optional(Type.String()),
					install: Type.Optional(Type.Boolean()),
					start: Type.Optional(Type.Boolean()),
					createUser: Type.Optional(Type.Boolean()),
					createUserCommand: Type.Optional(Type.String()),
					createUserEmail: Type.Optional(Type.String()),
					createUserPassword: Type.Optional(Type.String()),
					command: Type.Optional(Type.String()),
					healthPath: Type.Optional(Type.String()),
					waitMs: Type.Optional(Type.Number())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const pluginConfig = (api.pluginConfig || {}) as PluginConfig;
					const hostPath = resolveHostPath(pluginConfig);

					const doInstall = asBoolean(p.install) !== false;
					const doStart = asBoolean(p.start) !== false;
					const doCreateUser = asBoolean(p.createUser) !== false;
					const apiUrl = resolveHostApiUrl(p, pluginConfig);
					const token = asString(p.token);
					const notes: string[] = [];

					const ensureRepo = await ensureLocalHostServer(hostPath);
					notes.push(ensureRepo.text);
					if (!ensureRepo.ok) {
						return textResponse(notes.join('\n\n'));
					}

					const envSetup = await ensureHostEnvFile(hostPath, p, pluginConfig);
					notes.push(envSetup.text);
					if (!envSetup.ok) {
						return textResponse(notes.join('\n\n'));
					}

					if (doInstall) {
						const install = await ensureHostDependencies(hostPath);
						notes.push(install.text);
						if (!install.ok) {
							return textResponse(notes.join('\n\n'));
						}
					}

					if (doStart) {
						const startResult = await startHost(p, pluginConfig);
						notes.push(startResult.text);
					}

					if (doCreateUser) {
						const createUser = await createHostDashboardUser(p, pluginConfig, hostPath);
						notes.push(createUser.text);
						if (!createUser.ok) {
							return textResponse(notes.join('\n\n'));
						}
					}

					const args = ['init', '--api', apiUrl];
					if (token) args.push('--token', token);
					const initResult = await execCorev(api, args);
					notes.push(
						`corev init: ${initResult.ok ? 'ok' : `failed (${initResult.code})`}`,
						`stdout:\n${trimResult(initResult.stdout)}`,
						`stderr:\n${trimResult(initResult.stderr)}`
					);

					return textResponse(notes.join('\n\n'));
				}
			},
			{optional: true}
		);

		api.registerTool(
			{
				name: 'corev_host_create_user',
				label: 'corev_host_create_user',
				description: 'Create corev-host dashboard user (custom command or /api/auth/signup)',
				parameters: Type.Object({
					apiUrl: Type.Optional(Type.String()),
					createUserCommand: Type.Optional(Type.String()),
					createUserEmail: Type.Optional(Type.String()),
					createUserPassword: Type.Optional(Type.String())
				}),
				async execute(_id, params) {
					const p = normalizeParams(params);
					const pluginConfig = (api.pluginConfig || {}) as PluginConfig;
					const hostPath = resolveHostPath(pluginConfig);

					const ensureRepo = await ensureLocalHostServer(hostPath);
					if (!ensureRepo.ok) return textResponse(ensureRepo.text);
					const createUser = await createHostDashboardUser(p, pluginConfig, hostPath);
					return textResponse([ensureRepo.text, createUser.text].join('\n\n'));
				}
			},
			{optional: true}
		);
	}
});
