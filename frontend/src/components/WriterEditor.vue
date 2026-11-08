<script setup>
import { computed, ref } from 'vue';
import MdxEditor from './MdxEditor.vue';

const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
const tagInput = ref('');
const tagInputFocused = ref(false);
const draftTags = computed(() => app.draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean));
const tagSuggestions = computed(() => {
	const query = tagInput.value.trim().toLowerCase();
	if (!query && !tagInputFocused.value) return [];
	return app.allTags.filter((tag) => (!query || tag.toLowerCase().includes(query)) && !draftTags.value.some((draftTag) => draftTag.toLowerCase() === tag.toLowerCase())).slice(0, 6);
});

function addDraftTag(value = tagInput.value) {
	const tags = [...draftTags.value];
	for (const candidate of String(value).split(',')) {
		const typedTag = candidate.trim().slice(0, 32);
		const tag = app.allTags.find((existingTag) => existingTag.toLowerCase() === typedTag.toLowerCase()) || typedTag;
		if (tag && tags.length < 8 && !tags.some((draftTag) => draftTag.toLowerCase() === tag.toLowerCase())) tags.push(tag);
	}
	app.draft.tags = tags.join(', ');
	tagInput.value = '';
}

function removeDraftTag(tagToRemove) {
	app.draft.tags = draftTags.value.filter((tag) => tag !== tagToRemove).join(', ');
}

function handleTagInputKeydown(event) {
	if (event.key === ',') {
		event.preventDefault();
		addDraftTag();
	} else if (event.key === 'Backspace' && !tagInput.value && draftTags.value.length) {
		removeDraftTag(draftTags.value[draftTags.value.length - 1]);
	}
}
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
					<div class="editor-tag-field">
						<span class="editor-field-label">{{ app.site.tagsLabel }}</span>
						<div class="editor-tag-input">
							<div class="editor-tag-pills">
								<span v-for="tag in draftTags" :key="tag" class="editor-tag-pill"><span>{{ tag }}</span><button type="button" :aria-label="app.site.removeTagLabel.replace('{tag}', tag)" :title="app.site.removeTagLabel.replace('{tag}', tag)" @click="removeDraftTag(tag)">×</button></span>
							</div>
							<input v-model="tagInput" :aria-label="app.site.tagsLabel" aria-autocomplete="list" :aria-expanded="tagSuggestions.length > 0" :placeholder="app.site.tagsPlaceholder" @focus="tagInputFocused = true" @keydown="handleTagInputKeydown" @keydown.enter.prevent="addDraftTag()" @blur="addDraftTag(); tagInputFocused = false" />
						</div>
						<div v-if="tagSuggestions.length" class="editor-tag-suggestions" role="listbox">
							<button v-for="tag in tagSuggestions" :key="tag" type="button" role="option" :aria-selected="false" @pointerdown.prevent @click="addDraftTag(tag)">{{ tag }}</button>
						</div>
					</div>
					<div class="editor-select-row">
						<label>{{ app.site.visibilityLabel }}<select v-model="app.draft.visibility"><option value="public">{{ app.site.publicLabel }}</option><option value="private">{{ app.site.privateOptionLabel }}</option></select></label>
						<label>{{ app.site.statusLabel }}<select v-model="app.draft.status"><option value="published">{{ app.site.publishedLabel }}</option><option value="draft">{{ app.site.draftLabel }}</option><option value="scheduled">{{ app.site.scheduledLabel }}</option></select></label>
					</div>
					<label v-if="app.draft.status === 'scheduled'">{{ app.site.scheduleLabel }}<input v-model="app.draft.scheduledAt" type="datetime-local" required /></label>
					<div class="full-editor-cover"><label>{{ app.site.coverLabel }}</label><div v-if="app.draft.coverImage" class="cover-preview"><img class="cover-image-backdrop" :src="app.draft.coverImage" alt="" aria-hidden="true" /><img class="cover-image-foreground" :src="app.draft.coverImage" :alt="app.draft.title || app.site.coverLabel" /><button class="text-action" type="button" @click="app.draft.coverImage = ''">{{ app.site.removeImageLabel }}</button></div><p v-else class="cover-empty">{{ app.site.uploadHint }}</p><div class="upload-row"><label class="upload-button">{{ app.site.chooseImageLabel }}<input class="file-input-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="app.uploadCover" /></label></div></div>
					<details class="seo-editor"><summary>{{ app.site.seoPreviewLabel }}</summary><button class="text-action" type="button" :disabled="app.aiMetadataBusy" @click="app.generateAiMetadata">{{ app.aiMetadataBusy ? app.currentLocale.ai.metadataGenerating : app.currentLocale.ai.metadataAction }}</button><label>{{ app.site.seoTitleLabel }}<input v-model="app.draft.seoTitle" maxlength="180" :placeholder="app.draft.title || app.site.titlePlaceholder" /></label><label>{{ app.site.seoDescriptionLabel }}<textarea v-model="app.draft.seoDescription" rows="2" maxlength="300" :placeholder="app.postSummary(app.draft.content)" /></label></details>
					<details v-if="app.editingId" class="revision-panel"><summary>{{ app.site.revisionsLabel }} · {{ app.revisions.length }}</summary><p v-if="!app.revisions.length">{{ app.site.noRevisionsLabel }}</p><ol v-else><li v-for="revision in app.revisions" :key="revision.id"><time :datetime="revision.createdAt">{{ app.formatDate(revision.createdAt.slice(0, 10)) }}</time><span>{{ revision.title }}</span><button type="button" class="text-action" @click="app.restoreRevision(revision)">{{ app.site.restoreLabel }}</button></li></ol></details>
				</aside>
				<section class="editor-writing-area">
					<div v-if="app.aiSuggestion" class="ai-suggestion-preview" :aria-label="app.currentLocale.ai.suggestionLabel">{{ app.aiSuggestion }}</div>
					<MdxEditor v-model="app.draft.content" :placeholder="app.site.markdownPlaceholder" :locale="app.language" :translations="app.currentLocale.mdx" />
				</section>
			</div>
			<p v-if="app.editorError" class="form-error">{{ app.editorError }}</p>
			<div class="full-editor-actions">
				<div class="editor-action-group editor-action-start">
					<button v-if="app.editingId" class="delete-button" type="button" @click="app.deletePost">{{ app.site.deleteLabel }}</button>
					<button class="outline-button" type="button" :disabled="app.busy" @click="app.savePost('draft')">{{ app.site.draftLabel }}</button>
					<p v-if="app.autosaveStatus" class="autosave-status" aria-live="polite">{{ app.autosaveStatus }}</p>
				</div>
				<div v-if="app.admin" class="editor-ai-actions" :aria-label="app.currentLocale.ai.editorHeading">
					<select v-model="app.aiAction" :aria-label="app.currentLocale.ai.actionLabel"><option v-for="(label, action) in app.currentLocale.ai.actions" :key="action" :value="action">{{ label }}</option></select>
					<select v-if="app.aiAction === 'translate'" v-model="app.aiTargetLanguage" :aria-label="app.currentLocale.ai.targetLanguage"><option value="en">{{ app.currentLocale.ui.languageEnglishName }}</option><option value="ko">{{ app.currentLocale.ui.languageKoreanName }}</option></select>
					<button class="ai-generate-button" type="button" :disabled="app.aiAssistantBusy" :aria-label="app.aiAssistantBusy ? app.currentLocale.ai.generating : app.currentLocale.ai.generate" :title="app.aiAssistantBusy ? app.currentLocale.ai.generating : app.currentLocale.ai.generate" @click="app.runAiAction"><span aria-hidden="true">✦</span></button>
					<template v-if="app.aiSuggestion">
						<button class="ai-suggestion-action accept" type="button" :aria-label="app.currentLocale.ai.useSuggestion" :title="app.currentLocale.ai.useSuggestion" @click="app.useAiSuggestion">✓</button>
						<button class="ai-suggestion-action decline" type="button" :aria-label="app.currentLocale.ai.dismissSuggestion" :title="app.currentLocale.ai.dismissSuggestion" @click="app.dismissAiSuggestion">×</button>
					</template>
					<p v-if="app.aiAssistantError" class="form-error editor-ai-error">{{ app.aiAssistantError }}</p>
				</div>
				<div class="editor-action-group editor-action-end">
					<button class="quiet-button" type="button" @click="app.cancelEditor">{{ app.site.cancelLabel }}</button>
					<button class="primary-button" :disabled="app.busy">{{ app.busy ? app.site.savingLabel : app.draft.status === 'scheduled' ? app.site.scheduledLabel : app.site.saveLabel }} <span aria-hidden="true">↗</span></button>
				</div>
			</div>
		</form>
	</Teleport>
</template>