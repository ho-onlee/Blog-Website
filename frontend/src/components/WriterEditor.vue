<script setup>
import MdxEditor from './MdxEditor.vue';

const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
</script>

<template>
	<Teleport to="#editor-page" v-if="app.view === 'editor'">
		<div class="full-editor-heading">
			<button class="back-link" type="button" @click="app.cancelEditor"><span aria-hidden="true">←</span> {{ app.site.cancelLabel }}</button>
			<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.editingId ? app.site.editPostLabel : app.site.newPostLabel }}</p>
		</div>
		<form class="full-editor-form" @submit.prevent="app.savePost()">
			<label class="editor-title-field">{{ app.site.titleLabel }}<input class="editor-title-input" v-model="app.draft.title" required maxlength="180" :placeholder="app.site.titlePlaceholder" /></label>
			<div class="editor-workspace">
				<aside class="editor-settings-rail">
					<div class="editor-rail-heading"><span>{{ app.site.blogName.toUpperCase() }} / {{ app.editingId ? app.site.editPostLabel : app.site.newPostLabel }}</span><strong>{{ app.site.statusLabel }}</strong></div>
					<label>{{ app.site.tagsLabel }}<input v-model="app.draft.tags" :placeholder="app.site.tagsPlaceholder" /></label>
					<div class="editor-select-row">
						<label>{{ app.site.visibilityLabel }}<select v-model="app.draft.visibility"><option value="public">{{ app.site.publicLabel }}</option><option value="private">{{ app.site.privateOptionLabel }}</option></select></label>
						<label>{{ app.site.statusLabel }}<select v-model="app.draft.status"><option value="published">{{ app.site.publishedLabel }}</option><option value="draft">{{ app.site.draftLabel }}</option><option value="scheduled">{{ app.site.scheduledLabel }}</option></select></label>
					</div>
					<label v-if="app.draft.status === 'scheduled'">{{ app.site.scheduleLabel }}<input v-model="app.draft.scheduledAt" type="datetime-local" required /></label>
					<div class="full-editor-cover"><label>{{ app.site.coverLabel }}</label><div v-if="app.draft.coverImage" class="cover-preview"><img :src="app.draft.coverImage" :alt="app.draft.title || app.site.coverLabel" /><button class="text-action" type="button" @click="app.draft.coverImage = ''">{{ app.site.removeImageLabel }}</button></div><p v-else class="cover-empty">{{ app.site.uploadHint }}</p><div class="upload-row"><label class="upload-button">{{ app.site.chooseImageLabel }}<input class="file-input-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="app.uploadCover" /></label></div></div>
					<details class="seo-editor"><summary>{{ app.site.seoPreviewLabel }}</summary><button class="text-action" type="button" :disabled="app.aiMetadataBusy" @click="app.generateAiMetadata">{{ app.aiMetadataBusy ? app.currentLocale.ai.metadataGenerating : app.currentLocale.ai.metadataAction }}</button><label>{{ app.site.seoTitleLabel }}<input v-model="app.draft.seoTitle" maxlength="180" :placeholder="app.draft.title || app.site.titlePlaceholder" /></label><label>{{ app.site.seoDescriptionLabel }}<textarea v-model="app.draft.seoDescription" rows="2" maxlength="300" :placeholder="app.postSummary(app.draft.content)" /></label></details>
					<details v-if="app.editingId" class="revision-panel"><summary>{{ app.site.revisionsLabel }} · {{ app.revisions.length }}</summary><p v-if="!app.revisions.length">{{ app.site.noRevisionsLabel }}</p><ol v-else><li v-for="revision in app.revisions" :key="revision.id"><time :datetime="revision.createdAt">{{ app.formatDate(revision.createdAt.slice(0, 10)) }}</time><span>{{ revision.title }}</span><button type="button" class="text-action" @click="app.restoreRevision(revision)">{{ app.site.restoreLabel }}</button></li></ol></details>
				</aside>
				<section class="editor-writing-area">
					<section v-if="app.admin" class="ai-writing-tools">
						<div class="ai-tools-row">
							<strong>{{ app.currentLocale.ai.editorHeading }}</strong>
							<label>{{ app.currentLocale.ai.actionLabel }}<select v-model="app.aiAction"><option v-for="(label, action) in app.currentLocale.ai.actions" :key="action" :value="action">{{ label }}</option></select></label>
							<label v-if="app.aiAction === 'translate'">{{ app.currentLocale.ai.targetLanguage }}<select v-model="app.aiTargetLanguage"><option value="en">{{ app.currentLocale.ui.languageEnglishName }}</option><option value="ko">{{ app.currentLocale.ui.languageKoreanName }}</option></select></label>
							<button class="outline-button compact-action" type="button" :disabled="app.aiAssistantBusy" @click="app.runAiAction">{{ app.aiAssistantBusy ? app.currentLocale.ai.generating : app.currentLocale.ai.generate }}</button>
						</div>
						<p class="ai-settings-hint">{{ app.currentLocale.ai.draftPrivacyNote }}</p>
						<label v-if="app.aiSuggestion" class="ai-suggestion-field">{{ app.currentLocale.ai.suggestionLabel }}<textarea v-model="app.aiSuggestion" rows="5" /></label>
						<button v-if="app.aiSuggestion" class="text-action" type="button" @click="app.useAiSuggestion">{{ app.currentLocale.ai.useSuggestion }}</button>
						<p v-if="app.aiAssistantError" class="form-error">{{ app.aiAssistantError }}</p>
					</section>
					<MdxEditor v-model="app.draft.content" :placeholder="app.site.markdownPlaceholder" :locale="app.language" />
				</section>
			</div>
			<p v-if="app.editorError" class="form-error">{{ app.editorError }}</p>
			<div class="full-editor-actions"><button v-if="app.editingId" class="delete-button" type="button" @click="app.deletePost">{{ app.site.deleteLabel }}</button><button class="outline-button" type="button" :disabled="app.busy" @click="app.savePost('draft')">{{ app.site.draftLabel }}</button><p v-if="app.autosaveStatus" class="autosave-status" aria-live="polite">{{ app.autosaveStatus }}</p><span class="editor-action-spacer"></span><button class="quiet-button" type="button" @click="app.cancelEditor">{{ app.site.cancelLabel }}</button><button class="primary-button" :disabled="app.busy">{{ app.busy ? app.site.savingLabel : app.draft.status === 'scheduled' ? app.site.scheduledLabel : app.site.saveLabel }} <span aria-hidden="true">↗</span></button></div>
		</form>
	</Teleport>
</template>