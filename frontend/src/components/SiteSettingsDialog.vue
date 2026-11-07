<script setup>
const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
</script>

<template>
	<div v-if="app.settingsOpen" class="overlay" @click.self="app.settingsOpen = false">
		<section class="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
			<header class="editor-header"><div><p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.settingsLabel }}</p><h2 id="settings-title">{{ app.site.settingsLabel }}</h2></div><button class="dialog-close" :aria-label="app.currentLocale.ui.closeSettingsLabel" @click="app.settingsOpen = false">×</button></header>
			<p class="dialog-note settings-note">{{ app.site.settingsNote }}</p>
			<section class="ai-settings-panel">
				<h3>{{ app.currentLocale.ai.settingsHeading }}</h3>
				<p class="ai-settings-description">{{ app.currentLocale.ai.settingsDescription }}</p>
				<div class="ai-settings-grid">
					<label>{{ app.currentLocale.ai.providerLabel }}<select v-model="app.aiConfig.provider" @change="app.changeAiProvider"><option v-for="provider in app.aiConfig.providers" :key="provider.id" :value="provider.id" :disabled="!provider.configured">{{ app.currentLocale.ai.providers[provider.id] }}{{ provider.configured ? '' : ' · —' }}</option></select></label>
					<label>{{ app.currentLocale.ai.modelLabel }}<input v-model="app.aiConfig.model" maxlength="120" /></label>
				</div>
				<label class="ai-archive-toggle"><input v-model="app.aiConfig.archiveEnabled" type="checkbox" />{{ app.currentLocale.ai.archiveToggle }}</label>
				<p class="ai-settings-description">{{ app.currentLocale.ai.archiveDescription }}</p>
				<p class="ai-settings-hint">{{ app.currentLocale.ai.apiKeyHint }}</p>
				<div class="ai-settings-actions"><span>{{ app.currentLocale.ai.statusLabel }}: {{ app.currentLocale.ai.status[app.aiStatus.state] || app.aiStatus.state }}</span><button class="outline-button compact-action" type="button" @click="app.checkAiStatus">{{ app.currentLocale.ai.checkStatus }}</button><button class="primary-button compact-action" type="button" :disabled="app.aiSettingsBusy" @click="app.saveAiSettings">{{ app.aiSettingsBusy ? app.site.savingLabel : app.currentLocale.ai.saveSettings }}</button></div>
				<p v-if="app.aiSettingsError" class="form-error">{{ app.aiSettingsError }}</p>
				<p v-if="app.aiSettingsNotice" class="form-note">{{ app.aiSettingsNotice }}</p>
			</section>
			<form @submit.prevent="app.saveSettings">
				<section v-for="group in app.siteFields" :key="group.heading" class="settings-group"><h3>{{ app.fieldGroupHeading(group.heading) }}</h3><div class="settings-grid"><label v-for="key in group.keys" :key="key">{{ app.localizedFieldLabels[key] }}<input v-model="app.siteDraft[key]" :disabled="key === 'blogName' && app.siteNameManagedByEnv" /><small v-if="key === 'blogName' && app.siteNameManagedByEnv" class="site-name-env-hint">{{ app.currentLocale.ui.siteNameManagedHint }}</small></label></div></section>
				<div class="editor-actions settings-actions"><button type="button" class="quiet-button" @click="app.settingsOpen = false">{{ app.site.cancelLabel }}</button><button class="primary-button" :disabled="app.busy">{{ app.busy ? app.site.savingLabel : app.site.saveLabel }} <span aria-hidden="true">↗</span></button></div>
			</form>
		</section>
	</div>
</template>