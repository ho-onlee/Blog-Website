<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import MdxEditor from './MdxEditor.vue';
import EditorAiTools from './EditorAiTools.vue';

const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
const coverInput = ref(null);
const uploadStatus = ref(null);
const mobileAiTrigger = ref(null);
const mobileAiClose = ref(null);
const aiToolsOpen = ref(false);
const tagInput = ref('');
const tagInputFocused = ref(false);
watch(() => app.uploadBusy, async (uploading) => {
	await nextTick();
	if (uploading) uploadStatus.value?.focus();
	else if (app.view === 'editor') coverInput.value?.focus();
});
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

async function openAiTools() {
	aiToolsOpen.value = true;
	await nextTick();
	mobileAiClose.value?.focus();
}

function closeAiTools() {
	aiToolsOpen.value = false;
	nextTick(() => mobileAiTrigger.value?.focus());
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
					<div class="full-editor-cover"><label>{{ app.site.coverLabel }}</label><div v-if="app.draft.coverImage" class="cover-preview"><img class="cover-image-backdrop" :src="app.draft.coverImage" alt="" aria-hidden="true" /><img class="cover-image-foreground" :src="app.draft.coverImage" :alt="app.draft.title || app.site.coverLabel" /><button class="text-action" type="button" @click="app.draft.coverImage = ''">{{ app.site.removeImageLabel }}</button></div><p v-else class="cover-empty">{{ app.site.uploadHint }}</p><div class="upload-row"><label class="upload-button">{{ app.site.chooseImageLabel }}<input ref="coverInput" class="file-input-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" :disabled="app.uploadBusy || app.busy" @change="app.uploadCover" /></label></div></div>
					<details class="seo-editor"><summary>{{ app.site.seoPreviewLabel }}</summary><button class="text-action" type="button" :disabled="app.aiMetadataBusy" @click="app.generateAiMetadata">{{ app.aiMetadataBusy ? app.currentLocale.ai.metadataGenerating : app.currentLocale.ai.metadataAction }}</button><p v-if="app.aiMetadataError" class="form-error" role="alert">{{ app.aiMetadataError }}</p><label>{{ app.site.seoTitleLabel }}<input v-model="app.draft.seoTitle" maxlength="180" :placeholder="app.draft.title || app.site.titlePlaceholder" /></label><label>{{ app.site.seoDescriptionLabel }}<textarea v-model="app.draft.seoDescription" rows="2" maxlength="300" :placeholder="app.postSummary(app.draft.content)" /></label></details>
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
					<p v-if="app.autosaveStatus" class="autosave-status" aria-live="polite">{{ app.autosaveStatus }}</p>
					<button v-if="app.admin" ref="mobileAiTrigger" class="outline-button compact-action mobile-ai-trigger" type="button" @click="openAiTools"><span aria-hidden="true">✦</span> {{ app.currentLocale.ai.editorHeading }}</button>
				</div>
				<EditorAiTools v-if="app.admin" :app="app" />
				<div class="editor-action-group editor-action-end">
					<button class="quiet-button" type="button" @click="app.cancelEditor">{{ app.site.cancelLabel }}</button>
					<button class="primary-button" :disabled="app.busy">{{ app.busy ? app.site.savingLabel : app.draft.status === 'scheduled' ? app.site.scheduledLabel : app.site.saveLabel }} <span aria-hidden="true">↗</span></button>
				</div>
			</div>
		</form>
	</Teleport>
	<Teleport to="body">
		<div v-if="aiToolsOpen" class="overlay mobile-ai-overlay" @click.self="closeAiTools" @keydown.esc.prevent="closeAiTools">
			<section class="dialog mobile-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="writer-ai-title" tabindex="-1">
				<header class="mobile-ai-heading"><h2 id="writer-ai-title">{{ app.currentLocale.ai.editorHeading }}</h2><button ref="mobileAiClose" class="dialog-close" type="button" :aria-label="app.currentLocale.ui.closeDialogLabel" @click="closeAiTools">×</button></header>
				<div v-if="app.aiSuggestion" class="ai-suggestion-preview" :aria-label="app.currentLocale.ai.suggestionLabel">{{ app.aiSuggestion }}</div>
				<EditorAiTools :app="app" @close="closeAiTools" />
				<div class="mobile-ai-metadata"><button class="text-action" type="button" :disabled="app.aiMetadataBusy" @click="app.generateAiMetadata">{{ app.aiMetadataBusy ? app.currentLocale.ai.metadataGenerating : app.currentLocale.ai.metadataAction }}</button><p v-if="app.aiMetadataError" class="form-error" role="alert">{{ app.aiMetadataError }}</p></div>
			</section>
		</div>
		<div v-if="app.uploadBusy" ref="uploadStatus" class="cover-upload-overlay" role="status" aria-live="polite" tabindex="-1"><span class="cover-upload-spinner" aria-hidden="true"></span><span>{{ app.site.uploadingLabel }}</span></div>
	</Teleport>
</template>