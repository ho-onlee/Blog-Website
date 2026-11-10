const providerDefinitions = [
	{ id: 'ollama', envKey: null, label: 'Ollama' },
	{ id: 'openai', envKey: 'OPENAI_API_KEY', label: 'OpenAI' },
	{ id: 'anthropic', envKey: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
	{ id: 'gemini', envKey: 'GEMINI_API_KEY', label: 'Google Gemini' }
];

const defaultModels = {
	ollama: 'qwen2.5:3b',
	openai: 'gpt-4o-mini',
	anthropic: 'claude-3-5-haiku-latest',
	gemini: 'gemini-2.5-flash'
};
const ollamaPulls = new Map();
const ollamaPullFailures = new Map();

function getProvider(providerId) {
	return providerDefinitions.find((provider) => provider.id === providerId);
}

function getDefaultModel(providerId) {
	const initialProvider = process.env.AI_PROVIDER || 'ollama';
	return process.env[`${providerId.toUpperCase()}_MODEL`] || (providerId === initialProvider ? process.env.AI_MODEL : '') || defaultModels[providerId];
}

function getSettings(site = {}) {
	const configuredProvider = site.aiProvider || process.env.AI_PROVIDER || 'ollama';
	const provider = getProvider(configuredProvider) ? configuredProvider : 'ollama';
	const model = typeof site.aiModel === 'string' && site.aiModel.trim()
		? site.aiModel.trim()
		: getDefaultModel(provider);
	return { provider, model };
}

function getProviderOptions() {
	return providerDefinitions.map((provider) => ({
		id: provider.id,
		configured: provider.envKey ? Boolean(process.env[provider.envKey]) : true,
		defaultModel: getDefaultModel(provider.id)
	}));
}

function validateSettings(providerId, model) {
	const provider = getProvider(providerId);
	if (!provider) throw new Error('Unsupported AI provider.');
	if (provider.envKey && !process.env[provider.envKey]) {
		throw new Error(`Configure ${provider.envKey} in the server environment before selecting this provider.`);
	}
	if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(model)) {
		throw new Error('Enter a valid model name.');
	}
}

function ollamaBaseUrl() {
	return (process.env.AI_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
}

function providerKey(providerId) {
	return process.env[getProvider(providerId)?.envKey] || '';
}

function providerModelUrl(providerId, model) {
	if (providerId === 'openai') return `${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/models`;
	if (providerId === 'anthropic') return 'https://api.anthropic.com/v1/models';
	if (providerId === 'gemini') return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}`;
	return `${ollamaBaseUrl()}/api/tags`;
}

function providerHeaders(providerId) {
	const key = providerKey(providerId);
	if (providerId === 'openai') return { Authorization: `Bearer ${key}` };
	if (providerId === 'anthropic') return { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
	if (providerId === 'gemini') return { 'x-goog-api-key': key };
	return {};
}

async function requestJson(url, options = {}) {
	let response;
	const timeoutMs = options.timeoutMs || 8000;
	const fetchOptions = { ...options };
	delete fetchOptions.timeoutMs;
	try {
		response = await fetch(url, { ...fetchOptions, signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs) });
	} catch {
		throw new Error('The AI provider could not be reached.');
	}
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(`The AI provider returned HTTP ${response.status}.`);
		error.status = response.status;
		throw error;
	}
	return payload;
}

function modelIsListed(providerId, payload, model) {
	if (providerId === 'ollama') {
		const normalize = (name) => typeof name === 'string' && name.lastIndexOf(':') <= name.lastIndexOf('/') ? `${name}:latest` : name;
		return (payload.models || []).some((item) => normalize(item.name) === normalize(model) || normalize(item.model) === normalize(model));
	}
	if (providerId === 'openai') return (payload.data || []).some((item) => item.id === model);
	if (providerId === 'anthropic') return (payload.data || []).some((item) => item.id === model);
	return payload.supportedGenerationMethods.includes('generateContent');
}

function startOllamaPull(model) {
	if (ollamaPulls.has(model)) return;
	ollamaPullFailures.delete(model);
	const pull = requestJson(`${ollamaBaseUrl()}/api/pull`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, stream: false }),
		timeoutMs: 30 * 60 * 1000
	}).then((payload) => {
		if (payload.error) throw new Error(payload.error);
	}).catch((error) => {
		console.error(`Ollama model download failed for ${model}: ${error.message}`);
		ollamaPullFailures.set(model, true);
	}).finally(() => ollamaPulls.delete(model));
	ollamaPulls.set(model, pull);
}

async function checkAvailability(settings, options = {}) {
	const provider = getProvider(settings.provider);
	if (provider.envKey && !process.env[provider.envKey]) {
		return { available: false, state: 'not_configured' };
	}
	try {
		const payload = await requestJson(providerModelUrl(settings.provider, settings.model), { headers: providerHeaders(settings.provider) });
		if (settings.provider === 'gemini' && (typeof payload.name !== 'string' || !Array.isArray(payload.supportedGenerationMethods))) throw new Error('Invalid model response.');
		if (!modelIsListed(settings.provider, payload, settings.model)) {
			if (settings.provider === 'ollama') {
				if (ollamaPullFailures.has(settings.model) && !options.retryModelDownload) return { available: false, state: 'model_download_failed' };
				startOllamaPull(settings.model);
				return { available: false, state: 'model_downloading' };
			}
			return { available: false, state: settings.provider === 'gemini' ? 'model_unsupported' : 'model_missing' };
		}
		return { available: !ollamaPulls.has(settings.model), state: ollamaPulls.has(settings.model) ? 'model_downloading' : 'ready' };
	} catch (error) {
		return { available: false, state: settings.provider === 'gemini' && error.status === 404 ? 'model_missing' : 'unavailable' };
	}
}

async function generateText(settings, systemPrompt, userPrompt, options = {}) {
	const { provider, model } = settings;
	const maxTokens = options.maxTokens || 1600;
	let url;
	let body;
	const headers = { 'Content-Type': 'application/json', ...providerHeaders(provider) };

	if (provider === 'ollama') {
		url = `${ollamaBaseUrl()}/api/chat`;
		body = {
			model,
			stream: false,
			messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
			options: { temperature: options.temperature ?? 0.3, num_predict: maxTokens }
		};
	} else if (provider === 'openai') {
		url = `${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
		body = {
			model,
			max_tokens: maxTokens,
			temperature: options.temperature ?? 0.3,
			messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
		};
	} else if (provider === 'anthropic') {
		url = 'https://api.anthropic.com/v1/messages';
		body = { model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] };
	} else {
		url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`;
		body = {
			systemInstruction: { parts: [{ text: systemPrompt }] },
			contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
			generationConfig: { temperature: options.temperature ?? 0.3, maxOutputTokens: maxTokens }
		};
	}

	const payload = await requestJson(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS) || 120000
	});
	let text = '';
	if (provider === 'ollama') text = payload.message?.content || '';
	else if (provider === 'openai') text = payload.choices?.[0]?.message?.content || '';
	else if (provider === 'anthropic') text = (payload.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
	else text = (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n');
	if (!text.trim()) throw new Error('The AI provider returned an empty response.');
	return text.trim();
}

module.exports = { checkAvailability, generateText, getProviderOptions, getSettings, validateSettings };