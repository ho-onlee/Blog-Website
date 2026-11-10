const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../ai');

test('model defaults remain specific to their provider', () => {
	const keys = ['AI_PROVIDER', 'AI_MODEL', 'OLLAMA_MODEL', 'OPENAI_MODEL'];
	const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
	try {
		process.env.AI_PROVIDER = 'ollama';
		process.env.AI_MODEL = 'local-model';
		delete process.env.OLLAMA_MODEL;
		delete process.env.OPENAI_MODEL;
		const providers = ai.getProviderOptions();
		assert.equal(providers.find((provider) => provider.id === 'ollama').defaultModel, 'local-model');
		assert.equal(providers.find((provider) => provider.id === 'openai').defaultModel, 'gpt-4o-mini');

		process.env.AI_PROVIDER = 'openai';
		process.env.AI_MODEL = 'custom-openai';
		assert.equal(ai.getSettings().model, 'custom-openai');
		process.env.OPENAI_MODEL = 'explicit-openai';
		assert.equal(ai.getSettings().model, 'explicit-openai');
	} finally {
		for (const key of keys) {
			if (original[key] === undefined) delete process.env[key];
			else process.env[key] = original[key];
		}
	}
});

test('missing Ollama models download and become available', async () => {
	const originalBaseUrl = process.env.AI_BASE_URL;
	const originalFetch = global.fetch;
	const model = 'test-auto-download';
	let installed = false;
	let releasePull;
	let finishPull;
	const pullGate = new Promise((resolve) => { releasePull = resolve; });
	const pullFinished = new Promise((resolve) => { finishPull = resolve; });
	process.env.AI_BASE_URL = 'http://ollama.test';
	global.fetch = async (url) => {
		if (url.endsWith('/api/tags')) {
			return new Response(JSON.stringify({ models: installed ? [{ name: `${model}:latest` }] : [] }));
		}
		if (url.endsWith('/api/pull')) {
			await pullGate;
			installed = true;
			finishPull();
			return new Response(JSON.stringify({ status: 'success' }));
		}
		throw new Error(`Unexpected Ollama URL: ${url}`);
	};
	try {
		const settings = { provider: 'ollama', model };
		assert.equal((await ai.checkAvailability(settings)).state, 'model_downloading');
		releasePull();
		await pullFinished;
		await new Promise(setImmediate);
		assert.deepEqual(await ai.checkAvailability(settings), { available: true, state: 'ready' });
	} finally {
		releasePull();
		global.fetch = originalFetch;
		if (originalBaseUrl === undefined) delete process.env.AI_BASE_URL;
		else process.env.AI_BASE_URL = originalBaseUrl;
	}
});

test('failed Ollama downloads stop polling and can be retried', async () => {
	const originalBaseUrl = process.env.AI_BASE_URL;
	const originalFetch = global.fetch;
	const model = 'test-download-retry';
	let installed = false;
	let pulls = 0;
	process.env.AI_BASE_URL = 'http://ollama.test';
	global.fetch = async (url) => {
		if (url.endsWith('/api/tags')) {
			return new Response(JSON.stringify({ models: installed ? [{ name: `${model}:latest` }] : [] }));
		}
		if (url.endsWith('/api/pull')) {
			pulls += 1;
			if (pulls === 1) return new Response(JSON.stringify({ error: 'unknown model' }));
			installed = true;
			return new Response(JSON.stringify({ status: 'success' }));
		}
		throw new Error(`Unexpected Ollama URL: ${url}`);
	};
	try {
		const settings = { provider: 'ollama', model };
		assert.equal((await ai.checkAvailability(settings)).state, 'model_downloading');
		await new Promise(setImmediate);
		assert.equal((await ai.checkAvailability(settings)).state, 'model_download_failed');
		assert.equal(pulls, 1);
		assert.equal((await ai.checkAvailability(settings, { retryModelDownload: true })).state, 'model_downloading');
		await new Promise(setImmediate);
		assert.deepEqual(await ai.checkAvailability(settings), { available: true, state: 'ready' });
		assert.equal(pulls, 2);
	} finally {
		global.fetch = originalFetch;
		if (originalBaseUrl === undefined) delete process.env.AI_BASE_URL;
		else process.env.AI_BASE_URL = originalBaseUrl;
	}
});