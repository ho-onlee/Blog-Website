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

const props = defineProps({
	modelValue: { type: String, default: '' },
	placeholder: { type: String, default: '본문을 입력하세요' }
});
const emit = defineEmits(['update:modelValue']);
const host = ref(null);
const editorRef = createRef();
let reactRoot;

const toolbarTranslations = {
	'toolbar.undo': '실행 취소 {{shortcut}}',
	'toolbar.redo': '다시 실행 {{shortcut}}',
	'toolbar.blockTypes.paragraph': '본문',
	'toolbar.blockTypes.quote': '인용',
	'toolbar.blockTypes.heading': '제목 {{level}}',
	'toolbar.blockTypeSelect.selectBlockTypeTooltip': '문단 형식 선택',
	'toolbar.bold': '굵게', 'toolbar.removeBold': '굵게 해제',
	'toolbar.italic': '기울임', 'toolbar.removeItalic': '기울임 해제',
	'toolbar.underline': '밑줄', 'toolbar.removeUnderline': '밑줄 해제',
	'toolbar.bulletedList': '글머리 기호 목록',
	'toolbar.numberedList': '번호 목록',
	'toolbar.checkList': '체크 목록',
	'toolbar.link': '링크 삽입', 'toolbar.image': '이미지 삽입',
	'toolbar.table': '표 삽입', 'toolbar.codeBlock': '코드 블록 삽입',
	'toolbar.thematicBreak': '구분선 삽입',
		'contentArea.editableMarkdown': '마크다운 편집 영역',
	'createLink.url': '링크 주소', 'createLink.urlPlaceholder': '링크 주소를 입력하세요',
	'createLink.text': '링크에 표시할 글자', 'createLink.textTooltip': '링크에 표시할 글자',
	'createLink.title': '링크 제목', 'createLink.titleTooltip': '마우스를 올렸을 때 표시할 제목',
	'createLink.saveTooltip': '링크 적용', 'createLink.cancelTooltip': '변경 취소',
	'dialogControls.save': '저장', 'dialogControls.cancel': '취소',
	'uploadImage.dialogTitle': '이미지 삽입',
	'uploadImage.dialogDescription': '이미지 주소를 입력하거나 기기에서 파일을 선택하세요.',
	'uploadImage.dialogDescriptionNoUpload': '이미지 주소를 입력하세요.',
	'uploadImage.autoCompletePlaceholder': '이미지 주소를 입력하세요',
		'uploadImage.uploadInstructions': '기기에서 이미지 파일 선택:',
	'uploadImage.uploading': '이미지 업로드 중…',
	'codeBlock.selectLanguage': '코드 언어 선택',
	'codeBlock.language': '코드 언어',
	Undo: '실행 취소', Redo: '다시 실행',
	'Block type': '문단 형식', Paragraph: '본문', Quote: '인용',
	'Heading {{level}}': '제목 {{level}}',
	Bold: '굵게', Italic: '기울임', Underline: '밑줄',
	'Bullet list': '글머리 기호 목록', 'Numbered list': '번호 목록', 'Check list': '체크 목록',
	'Create link': '링크 삽입', 'Insert image': '이미지 삽입', 'Insert Table': '표 삽입',
	'Insert Code Block': '코드 블록 삽입', 'Insert thematic break': '구분선 삽입',
	'URL': '주소', 'Anchor text': '링크에 표시할 글자', 'Link title': '링크 제목',
	'Upload an image': '이미지 삽입', 'Select code block language': '코드 언어 선택'
};

function translateEditor(key, defaultValue, interpolations = {}) {
	const translated = toolbarTranslations[key] || toolbarTranslations[defaultValue] || defaultValue;
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

onMounted(() => {
	reactRoot = createRoot(host.value);
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
});

watch(() => props.modelValue, (value) => {
	if (editorRef.current && editorRef.current.getMarkdown() !== value) {
		editorRef.current.setMarkdown(value || '');
	}
});

onBeforeUnmount(() => reactRoot?.unmount());
</script>

<template>
	<div ref="host" class="mdx-editor-host"></div>
</template>