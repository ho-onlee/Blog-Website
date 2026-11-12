import { reactive, ref, watch } from 'vue';
import { api } from '../storage.js';

export function useAiFeatures({ currentLocale, language, savedSite, draft }) {
	const aiConfig = reactive({ provider: 'ollama', model: 'qwen2.5:3b', archiveEnabled: false, providers: [] });
	const aiStatus = ref({ state: 'checking', available: false });
	const aiSettingsError = ref('');
	const aiSettingsNotice = ref('');
	const aiSettingsBusy = ref(false);
	const aiAction = ref('outline');
	const aiTargetLanguage = ref('en');
	const aiSuggestion = ref('');
	const aiAssistantError = ref('');
	const aiAssistantBusy = ref(false);
	const aiMetadataBusy = ref(false);
	const aiMetadataError = ref('');
	const archiveQuestion = ref('');
	const archiveAnswer = ref('');
	const archiveCitations = ref([]);
	const archiveBusy = ref(false);
	let aiRequestId = 0;
	let metadataRequestId = 0;
	let statusRequestId = 0;
	let statusTimer;
	let suggestionAction = '';
	let suggestionSource = '';
	const fixedAiErrors = {
		'Unsupported AI provider.': 'unsupportedProvider',
		'Enter a valid model name.': 'invalidModel',
		'The AI provider could not be reached.': 'providerUnavailable',
		'Invalid model response.': 'invalidModelResponse',
		'The AI provider returned an empty response.': 'emptyResponse',
		'The AI response was not valid JSON.': 'invalidJsonResponse',
		'AI request limit reached. Try again later.': 'requestLimit',
		'Choose a supported writing action.': 'unsupportedAction',
		'Add a title or draft before requesting help.': 'addTitleOrDraft',
		'Add a draft before generating metadata.': 'addDraftMetadata',
		'Add a draft before translating.': 'addDraftTranslation',
		'Archive questions are not enabled.': 'archiveDisabled',
		'Enter a question.': 'enterQuestion',
		'Too many questions. Try again later.': 'archiveRateLimit'
	};

	function translateAiError(error) {
		const message = String(error?.message || '');
		const errors = currentLocale.value.ai.errors;
		const fixedKey = fixedAiErrors[message];
		if (fixedKey) return errors[fixedKey];
		const configuration = message.match(/^Configure (.+) in the server environment before selecting this provider\.$/);
		if (configuration) return errors.configureProvider.replace('{{key}}', configuration[1]);
		const httpStatus = message.match(/^The AI provider returned HTTP (\d+)\.$/);
		if (httpStatus) return errors.providerHttp.replace('{{status}}', httpStatus[1]);
		return errors.generic;
	}

	watch(() => [aiConfig.provider, aiConfig.model], () => {
		statusRequestId += 1;
		clearTimeout(statusTimer);
		aiStatus.value = { state: 'unchecked', available: false };
		aiSettingsError.value = '';
	}, { flush: 'sync' });

	async function loadAiSettings() {
		try {
			const settings = await api('/ai/settings');
			Object.assign(aiConfig, settings);
			await checkAiStatus();
		} catch (error) {
			aiSettingsError.value = translateAiError(error);
		}
	}

	function changeAiProvider() {
		const provider = aiConfig.providers.find((item) => item.id === aiConfig.provider);
		if (provider?.defaultModel) aiConfig.model = provider.defaultModel;
	}

	async function checkAiStatus(retryModelDownload = true) {
		clearTimeout(statusTimer);
		const requestId = ++statusRequestId;
		aiStatus.value = { state: 'checking', available: false };
		aiSettingsError.value = '';
		try {
			const params = new URLSearchParams({ provider: aiConfig.provider, model: aiConfig.model, retry: retryModelDownload ? '1' : '0' });
			const status = await api(`/ai/status?${params}`);
			if (requestId === statusRequestId) {
				aiStatus.value = status;
				if (status.state === 'model_downloading') {
					statusTimer = setTimeout(() => {
						if (requestId === statusRequestId) checkAiStatus(false);
					}, 3000);
				}
			}
		} catch (error) {
			if (requestId === statusRequestId) {
				aiStatus.value = { state: 'unavailable', available: false };
				aiSettingsError.value = translateAiError(error);
			}
		}
	}

	async function saveAiSettings() {
		aiSettingsBusy.value = true;
		aiSettingsError.value = '';
		aiSettingsNotice.value = '';
		try {
			const settings = await api('/ai/settings', {
				method: 'PUT',
				body: JSON.stringify({ provider: aiConfig.provider, model: aiConfig.model, archiveEnabled: aiConfig.archiveEnabled })
			});
			Object.assign(aiConfig, settings);
			savedSite.value.aiArchiveEnabled = settings.archiveEnabled;
			aiSettingsNotice.value = currentLocale.value.ai.settingsSaved;
			await checkAiStatus();
		} catch (error) {
			aiSettingsError.value = translateAiError(error);
		} finally {
			aiSettingsBusy.value = false;
		}
	}

	async function runAiAction() {
		const requestId = ++aiRequestId;
		const action = aiAction.value;
		const source = draft.content;
		aiAssistantBusy.value = true;
		aiAssistantError.value = '';
		aiSuggestion.value = '';
		try {
			const request = action === 'translate'
				? api('/ai/translate', { method: 'POST', body: JSON.stringify({ content: draft.content, targetLanguage: aiTargetLanguage.value }) })
				: api('/ai/assist', { method: 'POST', body: JSON.stringify({ action, title: draft.title, content: draft.content, locale: language.value }) });
			const result = await request;
			if (requestId !== aiRequestId) return;
			suggestionAction = action;
			suggestionSource = source;
			aiSuggestion.value = result.text;
		} catch (error) {
			if (requestId === aiRequestId) aiAssistantError.value = translateAiError(error);
		} finally {
			if (requestId === aiRequestId) aiAssistantBusy.value = false;
		}
	}

	function useAiSuggestion() {
		if (!aiSuggestion.value) return;
		if (suggestionAction !== 'continue' && draft.content !== suggestionSource && !window.confirm(currentLocale.value.ai.draftChangedConfirm)) return;
		draft.content = suggestionAction === 'continue' && draft.content
			? `${draft.content.trimEnd()}\n\n${aiSuggestion.value}`
			: aiSuggestion.value;
		aiSuggestion.value = '';
	}

	function dismissAiSuggestion() {
		aiSuggestion.value = '';
	}

	function resetAiWriting() {
		aiRequestId += 1;
		metadataRequestId += 1;
		suggestionAction = '';
		suggestionSource = '';
		aiSuggestion.value = '';
		aiAssistantError.value = '';
		aiAssistantBusy.value = false;
		aiMetadataError.value = '';
		aiMetadataBusy.value = false;
	}

	async function generateAiMetadata() {
		const requestId = ++metadataRequestId;
		aiMetadataBusy.value = true;
		aiMetadataError.value = '';
		try {
			const result = await api('/ai/metadata', { method: 'POST', body: JSON.stringify({ title: draft.title, content: draft.content, locale: language.value }) });
			if (requestId !== metadataRequestId) return;
			if (!draft.title) draft.title = result.title;
			draft.tags = result.tags.join(', ');
			draft.seoTitle = result.seoTitle;
			draft.seoDescription = result.seoDescription || result.summary;
		} catch (error) {
			if (requestId === metadataRequestId) aiMetadataError.value = translateAiError(error);
		} finally {
			if (requestId === metadataRequestId) aiMetadataBusy.value = false;
		}
	}

	async function askPublicArchive() {
		archiveBusy.value = true;
		archiveAnswer.value = '';
		archiveCitations.value = [];
		try {
			const result = await api('/ai/archive-answer', { method: 'POST', body: JSON.stringify({ question: archiveQuestion.value, locale: language.value }) });
			archiveAnswer.value = result.answer || currentLocale.value.ai.archiveNoMatch;
			archiveCitations.value = result.citations || [];
		} catch (error) {
			archiveAnswer.value = translateAiError(error);
		} finally {
			archiveBusy.value = false;
		}
	}

	return {
		aiConfig, aiStatus, aiSettingsError, aiSettingsNotice, aiSettingsBusy,
		aiAction, aiTargetLanguage, aiSuggestion, aiAssistantError, aiAssistantBusy, aiMetadataBusy, aiMetadataError,
		archiveQuestion, archiveAnswer, archiveCitations, archiveBusy,
		loadAiSettings, changeAiProvider, checkAiStatus, saveAiSettings, runAiAction,
		useAiSuggestion, dismissAiSuggestion, resetAiWriting, generateAiMetadata, askPublicArchive
	};
}