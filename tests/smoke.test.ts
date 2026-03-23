/**
 * @file smoke.test.ts
 * @description Basic smoke tests for Corev OpenClaw Plugin package.
 *
 * This test serves as a simple sanity check to ensure that the testing environment is
 * properly configured and that Vitest is functioning as expected. It verifies that basic
 * arithmetic works correctly (i.e., 1 + 1 equals 2).
 *
 * Usage:
 *   Run this test along with your other tests using:
 *     npm test
 *
 * @example
 *   // Example command to run tests:
 *   npm test
 *
 * @author		Doğu Abaris <abaris@null.net>
 * @license		MIT
 * @see			README.md for more details on using corev.
 */

import {describe, expect, it} from 'vitest';
import fs from 'fs';
import path from 'path';

describe('corev openclaw plugin smoke test', () => {
	it('adds numbers correctly', () => {
		expect(1 + 1).toBe(2);
	});

	it('has required plugin files', () => {
		expect(fs.existsSync(path.resolve('index.ts'))).toBe(true);
		expect(fs.existsSync(path.resolve('openclaw.plugin.json'))).toBe(true);
		expect(fs.existsSync(path.resolve('src/host/server/package.json'))).toBe(true);
	});
});
