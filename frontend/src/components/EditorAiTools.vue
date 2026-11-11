<script setup>
const props = defineProps({ app: { type: Object, required: true } });
const emit = defineEmits(['close']);
const app = props.app;

function useSuggestion() {
	app.useAiSuggestion();
	emit('close');
}

function dismissSuggestion() {
	app.dismissAiSuggestion();
	emit('close');
}
</script>

<template>
	<div class="editor-ai-actions" :aria-label="app.currentLocale.ai.editorHeading">
		<select v-model="app.aiAction" :disabled="app.aiAssistantBusy || !!app.aiSuggestion" :aria-label="app.currentLocale.ai.actionLabel"><option v-for="(label, action) in app.currentLocale.ai.actions" :key="action" :value="action">{{ label }}</option></select>
		<select v-if="app.aiAction === 'translate'" v-model="app.aiTargetLanguage" :disabled="app.aiAssistantBusy || !!app.aiSuggestion" :aria-label="app.currentLocale.ai.targetLanguage"><option value="en">{{ app.currentLocale.ui.languageEnglishName }}</option><option value="ko">{{ app.currentLocale.ui.languageKoreanName }}</option></select>
		<button class="ai-generate-button" type="button" :disabled="app.aiAssistantBusy" :aria-label="app.aiAssistantBusy ? app.currentLocale.ai.generating : app.currentLocale.ai.generate" :title="app.aiAssistantBusy ? app.currentLocale.ai.generating : app.currentLocale.ai.generate" @click="app.runAiAction"><span aria-hidden="true">✦</span></button>
		<template v-if="app.aiSuggestion">
			<button class="ai-suggestion-action accept" type="button" :aria-label="app.currentLocale.ai.useSuggestion" :title="app.currentLocale.ai.useSuggestion" @click="useSuggestion">✓</button>
			<button class="ai-suggestion-action decline" type="button" :aria-label="app.currentLocale.ai.dismissSuggestion" :title="app.currentLocale.ai.dismissSuggestion" @click="dismissSuggestion">×</button>
		</template>
		<p v-if="app.aiAssistantError" class="form-error editor-ai-error">{{ app.aiAssistantError }}</p>
	</div>
</template>