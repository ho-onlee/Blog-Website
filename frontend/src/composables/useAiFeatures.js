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
	let suggestionAction = '';
	let suggestionSource = '';

	watch(() => [aiConfig.provider, aiConfig.model], () => {
		statusRequestId += 1;
		aiStatus.value = { state: 'unchecked', available: false };
		aiSettingsError.value = '';
	}, { flush: 'sync' });

	async function loadAiSettings() {
		try {
			const settings = await api('/ai/settings');
			Object.assign(aiConfig, settings);
			await checkAiStatus();
		} catch (error) {
			aiSettingsError.value = error.message;
		}
	}

	function changeAiProvider() {
		const provider = aiConfig.providers.find((item) => item.id === aiConfig.provider);
		if (provider?.defaultModel) aiConfig.model = provider.defaultModel;
	}

	async function checkAiStatus() {
		const requestId = ++statusRequestId;
		aiStatus.value = { state: 'checking', available: false };
		aiSettingsError.value = '';
		try {
			const params = new URLSearchParams({ provider: aiConfig.provider, model: aiConfig.model });
			const status = await api(`/ai/status?${params}`);
			if (requestId === statusRequestId) aiStatus.value = status;
		} catch (error) {
			if (requestId === statusRequestId) {
				aiStatus.value = { state: 'unavailable', available: false };
				aiSettingsError.value = error.message;
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
			aiSettingsError.value = error.message;
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
			if (requestId === aiRequestId) aiAssistantError.value = error.message;
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
			if (requestId === metadataRequestId) aiMetadataError.value = error.message;
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
			archiveAnswer.value = error.message;
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