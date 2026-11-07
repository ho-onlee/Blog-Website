<script setup>
import React, { createElement, createRef } from 'react';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoot } from 'react-dom/client';
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
	headingsPlugin,
	imagePlugin,
	linkDialogPlugin,
	linkPlugin,
	listsPlugin,
	markdownShortcutPlugin,
	quotePlugin,
	tablePlugin,
	thematicBreakPlugin,
	toolbarPlugin
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import englishLocale from '../locales/en.json';
import koreanLocale from '../locales/ko.json';

const props = defineProps({
	modelValue: { type: String, default: '' },
	placeholder: { type: String, default: '본문을 입력하세요' },
	locale: { type: String, default: 'ko' }
});
const emit = defineEmits(['update:modelValue']);
const host = ref(null);
const editorRef = createRef();
const locales = { en: englishLocale, ko: koreanLocale };
let reactRoot;

function translateEditor(key, defaultValue, interpolations = {}) {
	// Editor toolbar labels come from the same editable JSON files as the rest of the UI.
	const translations = locales[props.locale]?.mdx || locales.en.mdx;
	const translated = translations[key] || translations[defaultValue] || defaultValue;
	return translated.replace(/\{\{(\w+)\}\}/g, (match, name) => String(interpolations[name] ?? match));
}

const editorPlugins = [
	headingsPlugin(),
	listsPlugin(),
	quotePlugin(),
	linkPlugin(),
	linkDialogPlugin(),
	imagePlugin(),
	tablePlugin(),
	codeBlockPlugin(),
	thematicBreakPlugin(),
	markdownShortcutPlugin(),
	toolbarPlugin({
		toolbarContents: () => createElement(React.Fragment, null,
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
		placeholder: props.placeholder,
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

onBeforeUnmount(() => reactRoot?.unmount());
</script>

<template>
	<div ref="host" class="mdx-editor-host"></div>
</template>