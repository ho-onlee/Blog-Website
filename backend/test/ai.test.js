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