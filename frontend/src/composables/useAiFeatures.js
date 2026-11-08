import { reactive, ref } from 'vue';
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
	const archiveQuestion = ref('');
	const archiveAnswer = ref('');
	const archiveCitations = ref([]);
	const archiveBusy = ref(false);

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
		aiStatus.value = { state: 'checking', available: false };
		try {
			aiStatus.value = await api('/ai/status');
		} catch (error) {
			aiStatus.value = { state: 'unavailable', available: false };
			aiSettingsError.value = error.message;
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
		aiAssistantBusy.value = true;
		aiAssistantError.value = '';
		aiSuggestion.value = '';
		try {
			const request = aiAction.value === 'translate'
				? api('/ai/translate', { method: 'POST', body: JSON.stringify({ content: draft.content, targetLanguage: aiTargetLanguage.value }) })
				: api('/ai/assist', { method: 'POST', body: JSON.stringify({ action: aiAction.value, title: draft.title, content: draft.content, locale: language.value }) });
			const result = await request;
			aiSuggestion.value = result.text;
		} catch (error) {
			aiAssistantError.value = error.message;
		} finally {
			aiAssistantBusy.value = false;
		}
	}

	function useAiSuggestion() {
		if (!aiSuggestion.value) return;
		draft.content = aiAction.value === 'continue' && draft.content
			? `${draft.content.trimEnd()}\n\n${aiSuggestion.value}`
			: aiSuggestion.value;
		aiSuggestion.value = '';
	}

	function dismissAiSuggestion() {
		aiSuggestion.value = '';
	}

	async function generateAiMetadata() {
		aiMetadataBusy.value = true;
		aiAssistantError.value = '';
		try {
			const result = await api('/ai/metadata', { method: 'POST', body: JSON.stringify({ title: draft.title, content: draft.content, locale: language.value }) });
			if (!draft.title) draft.title = result.title;
			draft.tags = result.tags.join(', ');
			draft.seoTitle = result.seoTitle;
			draft.seoDescription = result.seoDescription || result.summary;
		} catch (error) {
			aiAssistantError.value = error.message;
		} finally {
			aiMetadataBusy.value = false;
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
		aiAction, aiTargetLanguage, aiSuggestion, aiAssistantError, aiAssistantBusy, aiMetadataBusy,
		archiveQuestion, archiveAnswer, archiveCitations, archiveBusy,
		loadAiSettings, changeAiProvider, checkAiStatus, saveAiSettings, runAiAction,
		useAiSuggestion, dismissAiSuggestion, generateAiMetadata, askPublicArchive
	};
}