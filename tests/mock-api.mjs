/**
 * @file mock-api.mjs
 * @description A simple Express mock API server for plugin/corev command integration tests.
 *
 * This mock API provides two endpoints:
 *
 * 1. GET /configs/:project/latest
 *    - Returns the latest configuration for the specified project.
 *    - The response is a JSON object containing a “version”, and a "config" object.
 *
 *    Example response for GET /configs/atlas/latest:
 *    {
 *      "name": "atlas",
 *      "version": "1.0.0",
 *      "config": {
 *        "detector": "ATLAS",
 *        "trigger_threshold": 0.75,
 *        "compression": "zstd"
 *      }
 *    }
 *
 * 2. GET /configs/:project/:version
 *    - Returns a specific configuration version for the specified project.
 *    - Simulates different configurations for '1.0.0' and '1.0.1'.
 *    - Returns 404 for other versions.
 *
 *    Example response for GET /configs/atlas/1.0.0:
 *    {
 *      "name": "atlas",
 *      "version": "1.0.0",
 *      "config": { ... }
 *    }
 *
 * 3. POST /configs/:project
 *    - Accepts a configuration payload for the specified project.
 *    - Logs the received configuration and returns a confirmation message.
 *
 *    Example request for POST /configs/atlas:
 *    {
 *      "name": "atlas",
 *      "version": "1.0.1",
 *      "config": { ... }
 *    }
 *    Response:
 *    { "message": "Config for atlas accepted." }
 *
 * Usage:
 *   Run the server with:
 *     node tests/mock-api.mjs
 *
 * This server is intended for local and integration testing of the corev CLI tool.
 *
 * @author		Doğu Abaris <abaris@null.net>
 * @license		MIT
 * @see			README.md for more details on using corev.
 */

import express from 'express';
import bodyParser from 'body-parser';

const app = express();
const port = 3000;

app.use(bodyParser.json({limit: '100kb'}));

const MAX_DEPTH = 20;
const MAX_NODES = 5000;

function isContainer(value) {
	return typeof value === 'object' && value !== null;
}

function exceedsTraversalLimits(input) {
	if (!isContainer(input)) return false;
	const stack = [{value: input, depth: 1}];
	const visited = new WeakSet();
	let nodes = 0;

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || !isContainer(current.value)) continue;
		if (current.depth > MAX_DEPTH) return true;

		if (visited.has(current.value)) continue;
		visited.add(current.value);
		nodes += 1;
		if (nodes > MAX_NODES) return true;

		const values = Array.isArray(current.value)
			? current.value
			: Object.values(current.value);

		for (const child of values) {
			if (isContainer(child)) {
				stack.push({value: child, depth: current.depth + 1});
			}
		}
	}

	return false;
}

function validateConfigPayload(body) {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return {ok: false, errors: ['Body must be an object.']};
	}
	if (exceedsTraversalLimits(body)) {
		return {ok: false, errors: ['Payload is too deeply nested.']};
	}

	const keys = Object.keys(body);
	for (const key of keys) {
		if (!['name', 'version', 'config'].includes(key)) {
			return {ok: false, errors: [`Unexpected field: ${key}`]};
		}
	}
	if (typeof body.name !== 'string' || body.name.trim() === '') {
		return {ok: false, errors: ['name must be a non-empty string']};
	}
	if (typeof body.version !== 'string' || body.version.trim() === '') {
		return {ok: false, errors: ['version must be a non-empty string']};
	}
	if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) {
		return {ok: false, errors: ['config must be an object']};
	}
	return {ok: true};
}

const mockConfigurations = {
	atlas: {
		'1.0.0': {
			name: 'atlas',
			version: '1.0.0',
			config: {
				foo: 'bar',
				detector: 'ATLAS',
				trigger_threshold: 0.75,
				compression: 'zstd'
			}
		},
		'1.0.1': {
			name: 'atlas',
			version: '1.0.1',
			config: {
				foo: 'baz',
				detector: 'ATLAS',
				trigger_threshold: 0.80,
				compression: 'gzip',
				new_feature_flag: true
			}
		},
		'2.0.0': {
			name: 'atlas',
			version: '2.0.0',
			config: {
				detector: 'ATLAS_v2',
				trigger_threshold: 0.90,
				compression: 'brotli',
				logging_level: 'debug',
				experiment_id: 'EXP-A-123'
			}
		}
	}
};

app.get('/configs/:project/latest', (req, res) => {
	const {project} = req.params;
	const latest = mockConfigurations[project]?.['1.0.0'];

	if (!latest) {
		return res.status(404).json({message: `No config found for ${project}`});
	}

	res.json(latest);
});

app.get('/configs/:project/:version', (req, res) => {
	const {project, version} = req.params;
	const projectConfigs = mockConfigurations[project];

	if (!projectConfigs) {
		return res.status(404).json({message: `Project '${project}' not found.`});
	}

	const config = projectConfigs[version];

	if (!config) {
		return res.status(404).json({message: `Config for project '${project}' with version '${version}' not found.`});
	}

	res.json(config);
});

app.post('/configs/:project', (req, res) => {
	const {project} = req.params;
	const body = req.body;

	if (
		!body ||
		typeof body !== 'object' ||
		Array.isArray(body)
	) {
		return res.status(400).json({error: 'Malformed request body.'});
	}

	const validation = validateConfigPayload(body);
	if (!validation.ok) {
		console.warn(`Invalid config for ${project}`);
		console.warn(validation.errors);
		return res.status(400).json({
			error: 'Invalid config format.',
			validation: validation.errors
		});
	}

	console.log(`Valid config received for ${project}:`);
	console.dir(body, {depth: null});

	res.status(200).json({message: `Config for ${project} accepted.`});
});

app.get('/health', (_req, res) => {
	res.status(200).json({status: 'ok'});
});

app.listen(port, () => {
	console.log(`Mock API listening on http://localhost:${port}`);
});
