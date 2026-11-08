<script setup>
import React, { createElement, createRef } from 'react';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoot } from 'react-dom/client';
import { useCellValues, usePublisher } from '@mdxeditor/gurx';
import * as Dialog from '@radix-ui/react-dialog';
import {
	BlockTypeSelect,
	BoldItalicUnderlineToggles,
	CreateLink,
	InsertCodeBlock,
	InsertImage,
	InsertTable,
	InsertThematicBreak,
	ListsToggle,
	MDXEditor,
	UndoRedo,
	codeBlockPlugin,
	closeImageDialog$,
	editorRootElementRef$,
	headingsPlugin,
	imageDialogState$,
	imagePlugin,
	imageUploadState$,
	insertImage$,
	linkDialogPlugin,
	linkPlugin,
	listsPlugin,
	markdownShortcutPlugin,
	quotePlugin,
	readOnly$,
	saveImage$,
	tablePlugin,
	thematicBreakPlugin,
	toolbarPlugin
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { api } from '../storage.js';
import englishLocale from '../locales/en.json';
import koreanLocale from '../locales/ko.json';

const props = defineProps({
	modelValue: { type: String, default: '' },
	placeholder: { type: String, default: '' },
	locale: { type: String, default: 'ko' },
	translations: { type: Object, default: null }
});
const emit = defineEmits(['update:modelValue']);
const host = ref(null);
const editorRef = createRef();
const locales = { en: englishLocale, ko: koreanLocale };
const pasteUploadError = ref(false);
const pasteUploadCount = ref(0);
const pastedFiles = new WeakSet();
let reactRoot;

function translateEditor(key, defaultValue, interpolations = {}) {
	// Editor toolbar labels come from the same editable JSON files as the rest of the UI.
	const translations = props.translations || locales[props.locale]?.mdx || locales.en.mdx;
	const translated = translations[key] || translations[defaultValue] || defaultValue;
	return translated.replace(/\{\{(\w+)\}\}/g, (match, name) => String(interpolations[name] ?? match));
}

async function uploadImage(file) {
	const isPasted = pastedFiles.has(file);
	if (isPasted) {
		pasteUploadError.value = false;
		pasteUploadCount.value += 1;
	}
	const form = new FormData();
	form.append('image', file);
	try {
		const result = await api('/uploads', { method: 'POST', body: form });
		return result.url;
	} catch (error) {
		if (isPasted) pasteUploadError.value = true;
		throw error;
	} finally {
		if (isPasted) {
			pasteUploadCount.value -= 1;
			pastedFiles.delete(file);
		}
	}
}

function ImageClipboardBridge() {
	const insertImage = usePublisher(insertImage$);
	React.useEffect(() => {
		const editorHost = host.value;
		if (!editorHost) return;
		function handlePaste(event) {
			if (!(event.target instanceof Element) || !event.target.closest('[contenteditable="true"]')) return;
			const files = Array.from(event.clipboardData?.items || [])
				.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
				.map((item) => item.getAsFile()).filter(Boolean);
			if (!files.length) return;
			event.preventDefault();
			event.stopPropagation();
			for (const file of files) {
				pastedFiles.add(file);
				insertImage({ file });
			}
		}
		editorHost.addEventListener('paste', handlePaste, true);
		return () => editorHost.removeEventListener('paste', handlePaste, true);
	}, [insertImage]);
	return null;
}

function FileImageDialog() {
	const [state, uploadState, root, readOnly] = useCellValues(imageDialogState$, imageUploadState$, editorRootElementRef$, readOnly$);
	const saveImage = usePublisher(saveImage$);
	const closeDialog = usePublisher(closeImageDialog$);
	const fileInput = React.useRef(null);
	const inputId = React.useId();
	if (state.type === 'inactive') return null;
	const uploading = uploadState === 'uploading';
	function handlePaste(event) {
		if (uploading || readOnly) return;
		const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'));
		const file = item?.getAsFile();
		if (!file) return;
		event.preventDefault();
		event.stopPropagation();
		const files = new DataTransfer();
		files.items.add(file);
		saveImage({ ...(state.type === 'editing' ? state.initialValues : {}), file: files.files });
	}
	return createElement(Dialog.Root, { open: true, onOpenChange: (open) => { if (!open) closeDialog(); } },
		createElement(Dialog.Portal, { container: root?.current },
			createElement(Dialog.Overlay, { className: 'mdx-image-dialog-overlay' }),
			createElement(Dialog.Content, { className: 'mdx-image-dialog', onPaste: handlePaste },
				createElement(Dialog.Title, null, translateEditor('uploadImage.dialogTitle', 'Insert image')),
				createElement(Dialog.Description, { className: 'mdx-image-dialog-description' }, translateEditor('uploadImage.uploadInstructions', 'Choose an image file from your device:')),
				createElement('form', {
					'aria-busy': uploading,
					onSubmit: (event) => {
						event.preventDefault();
						event.stopPropagation();
						if (fileInput.current?.files?.length) saveImage({ ...(state.type === 'editing' ? state.initialValues : {}), file: fileInput.current.files });
					}
				},
					createElement('label', { htmlFor: inputId }, translateEditor('uploadImage.uploadInstructions', 'Choose an image file from your device:')),
					createElement('input', { ref: fileInput, id: inputId, type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', required: true, disabled: uploading || readOnly }),
					uploading && createElement('p', { role: 'status' }, translateEditor('uploadImage.uploading', 'Uploading image...')),
					uploadState === 'error' && createElement('p', { role: 'alert', className: 'form-error' }, translateEditor('uploadImage.uploadError', 'Image upload failed. Please try again.')),
					createElement('div', { className: 'mdx-image-dialog-actions' },
						createElement('button', { type: 'submit', className: 'primary-button', disabled: uploading || readOnly }, translateEditor('dialogControls.save', 'Save')),
						createElement(Dialog.Close, { asChild: true }, createElement('button', { type: 'button', className: 'outline-button' }, translateEditor('dialogControls.cancel', 'Cancel')))
					)
				)
			)
		)
	);
}

const editorPlugins = [
	headingsPlugin(),
	listsPlugin(),
	quotePlugin(),
	linkPlugin(),
	linkDialogPlugin(),
	imagePlugin({ imageUploadHandler: uploadImage, ImageDialog: FileImageDialog }),
	tablePlugin(),
	codeBlockPlugin(),
	thematicBreakPlugin(),
	markdownShortcutPlugin(),
	toolbarPlugin({
		toolbarContents: () => createElement(React.Fragment, null,
			createElement(ImageClipboardBridge),
			createElement('div', { className: 'seohakru-toolbar-row' },
				createElement(UndoRedo),
				createElement(BlockTypeSelect),
				createElement(BoldItalicUnderlineToggles, { options: ['Bold', 'Italic', 'Underline'] })
			),
			createElement('div', { className: 'seohakru-toolbar-row' },
				createElement(ListsToggle, { options: ['bullet', 'number', 'check'] }),
				createElement(CreateLink),
				createElement(InsertImage),
				createElement(InsertTable),
				createElement(InsertCodeBlock),
				createElement(InsertThematicBreak)
			)
		)
	})
];

function renderEditor() {
	if (!reactRoot) return;
	reactRoot.render(createElement(MDXEditor, {
		ref: editorRef,
		markdown: props.modelValue,
		onChange: (value) => emit('update:modelValue', value),
		plugins: editorPlugins,
		translation: translateEditor,
		placeholder: props.placeholder || locales[props.locale]?.site.markdownPlaceholder || locales.en.site.markdownPlaceholder,
		className: 'seohakru-mdx',
		contentEditableClassName: 'seohakru-mdx-content'
	}));
}

onMounted(() => {
	reactRoot = createRoot(host.value);
	renderEditor();
});

watch(() => props.modelValue, (value) => {
	if (editorRef.current && editorRef.current.getMarkdown() !== value) {
		editorRef.current.setMarkdown(value || '');
	}
});

watch(() => props.locale, renderEditor);
watch(() => props.translations, renderEditor);

onBeforeUnmount(() => reactRoot?.unmount());
</script>

<template>
	<div class="mdx-editor-wrapper">
		<div ref="host" class="mdx-editor-host"></div>
		<p v-if="pasteUploadCount" role="status">{{ translateEditor('uploadImage.uploading', 'Uploading image...') }}</p>
		<p v-if="pasteUploadError" class="form-error" role="alert">{{ translateEditor('uploadImage.uploadError', 'Image upload failed. Please try again.') }}</p>
	</div>
</template>