<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
const content = ref(null);
const imageDialog = ref(null);
const viewerImage = ref(null);
const touchImage = ref(null);
const zoom = ref(1);
const imageAspect = ref(1);
const imageOffset = ref({ x: 0, y: 0 });
const imageDrag = ref(null);
let touchPointer = null;
let suppressClickUntil = 0;
let imageTrigger = null;

function postImage(target) {
	if (!(target instanceof Element)) return null;
	const cover = target.closest('.post-cover');
	if (cover) return cover.querySelector('.cover-image-foreground');
	return target instanceof HTMLImageElement && target.closest('.post-content') ? target : null;
}

function imageDetails(image) {
	return { src: image.currentSrc || image.src, alt: image.alt };
}

async function openImage(image) {
	imageTrigger = image;
	viewerImage.value = imageDetails(image);
	imageAspect.value = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
	zoom.value = 1;
	imageOffset.value = { x: 0, y: 0 };
	imageDrag.value = null;
	await nextTick();
	if (imageDialog.value && !imageDialog.value.open) {
		imageDialog.value.showModal();
		imageDialog.value.querySelector('.image-viewer-close')?.focus();
	}
}

function handleImageClick(event) {
	const image = postImage(event.target);
	if (!image) return;
	event.preventDefault();
	if (Date.now() >= suppressClickUntil) openImage(image);
}

function handleImageKeydown(event) {
	const image = postImage(event.target);
	if (!image || (event.key !== 'Enter' && event.key !== ' ')) return;
	event.preventDefault();
	openImage(image);
}

function handleImagePointerDown(event) {
	const image = postImage(event.target);
	if (!image || event.pointerType !== 'touch' || touchPointer !== null) return;
	event.preventDefault();
	touchPointer = event.pointerId;
	suppressClickUntil = Date.now() + 1000;
	touchImage.value = imageDetails(image);
	image.setPointerCapture(event.pointerId);
}

function releaseImage(event) {
	if (event.pointerId !== touchPointer) return;
	touchPointer = null;
	touchImage.value = null;
	suppressClickUntil = Date.now() + 1000;
}

function zoomImage(event) {
	const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY;
	const nextZoom = Math.min(5, Math.max(1, zoom.value * Math.exp(-delta * 0.002)));
	const bounds = event.currentTarget.getBoundingClientRect();
	const cursorX = event.clientX - bounds.left - bounds.width / 2;
	const cursorY = event.clientY - bounds.top - bounds.height / 2;
	const ratio = nextZoom / zoom.value;
	imageOffset.value = {
		x: cursorX - (cursorX - imageOffset.value.x) * ratio,
		y: cursorY - (cursorY - imageOffset.value.y) * ratio
	};
	zoom.value = nextZoom;
}

function startImageDrag(event) {
	if (event.button !== 0 || imageDrag.value) return;
	event.preventDefault();
	imageDrag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: imageOffset.value.x, offsetY: imageOffset.value.y };
	event.currentTarget.setPointerCapture(event.pointerId);
}

function moveImageDrag(event) {
	if (event.pointerId !== imageDrag.value?.pointerId) return;
	imageOffset.value = {
		x: imageDrag.value.offsetX + event.clientX - imageDrag.value.x,
		y: imageDrag.value.offsetY + event.clientY - imageDrag.value.y
	};
}

function endImageDrag(event) {
	if (event.pointerId === imageDrag.value?.pointerId) imageDrag.value = null;
}

function closeImage() {
	imageDialog.value?.close();
}

function imageClosed() {
	viewerImage.value = null;
	imageDrag.value = null;
	imageTrigger?.focus();
	imageTrigger = null;
}

watch(() => [app.selectedPost?.id, app.selectedPost?.content, app.currentLocale.ui.viewImageLabel], async () => {
	closeImage();
	touchImage.value = null;
	touchPointer = null;
	await nextTick();
	content.value?.querySelectorAll('img').forEach((image) => {
		image.tabIndex = 0;
		image.setAttribute('role', 'button');
		image.setAttribute('aria-label', image.alt ? `${app.currentLocale.ui.viewImageLabel}: ${image.alt}` : app.currentLocale.ui.viewImageLabel);
	});
}, { immediate: true });

onMounted(() => {
	window.addEventListener('pointerup', releaseImage);
	window.addEventListener('pointercancel', releaseImage);
});

onBeforeUnmount(() => {
	window.removeEventListener('pointerup', releaseImage);
	window.removeEventListener('pointercancel', releaseImage);
});
</script>

<template>
	<article class="post-view" @click="handleImageClick" @keydown="handleImageKeydown" @pointerdown="handleImagePointerDown" @contextmenu="postImage($event.target) && $event.preventDefault()">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<div class="post-heading">
			<div class="card-meta"><time :datetime="app.selectedPost.date">{{ app.formatDate(app.selectedPost.date) }}</time><button class="author-link" @click="app.readAuthor(app.selectedPost.authorId)">{{ app.selectedPost.authorName }}</button><span class="reading-time">{{ app.readingMinutes(app.selectedPost.content) }}{{ app.site.readingTimeSuffix }}</span><span v-if="app.selectedPost.status === 'draft'" class="private-badge">{{ app.site.draftLabel }}</span><span v-if="app.selectedPost.status === 'scheduled'" class="private-badge">{{ app.site.scheduledLabel }}</span><span v-if="app.selectedPost.visibility === 'private'" class="private-badge">{{ app.site.privateLabel }}</span></div>
			<h1>{{ app.selectedPost.title }}</h1>
			<div class="post-tags"><span v-for="tag in app.selectedPost.tags" :key="tag">{{ tag }}</span></div>
		</div>
		<div v-if="app.selectedPost.coverImage" class="post-cover"><img class="cover-image-backdrop" :src="app.selectedPost.coverImage" alt="" aria-hidden="true" /><img class="cover-image-foreground" :src="app.selectedPost.coverImage" :alt="app.selectedPost.title" role="button" tabindex="0" :aria-label="`${app.currentLocale.ui.viewImageLabel}: ${app.selectedPost.title}`" /></div>
		<div ref="content" class="markdown-content post-content" v-html="app.renderMarkdown(app.selectedPost.content)"></div>
		<section v-if="app.relatedPosts.length" class="related-section"><h2>{{ app.site.relatedPostsLabel }}</h2><div class="related-list"><button v-for="post in app.relatedPosts" :key="post.id" @click="app.readPost(post)"><span>{{ post.title }}</span><small>{{ post.authorName }}</small></button></div></section>
		<div v-if="app.isPublicEntry(app.selectedPost)" class="post-share-row"><button class="outline-button" @click="app.sharePost">{{ app.site.shareLabel }} <span aria-hidden="true">↗</span></button><span v-if="app.shareStatus" class="share-status">{{ app.shareStatus }}</span></div>
		<section v-if="app.isPublicEntry(app.selectedPost)" class="comments-section" aria-labelledby="comments-title">
			<h2 id="comments-title">{{ app.site.commentsLabel }} <span>{{ app.comments.length }}</span></h2>
			<p v-if="!app.comments.length" class="no-comments">{{ app.site.noCommentsLabel }}</p>
			<ol v-else class="comment-list"><li v-for="comment in app.comments" :key="comment.id" :class="{ 'has-comment-delete': app.isAdmin }"><button v-if="app.isAdmin" class="comment-delete" type="button" :aria-label="app.site.deleteLabel" :title="app.site.deleteLabel" @click="app.deleteComment(comment)">×</button><div class="comment-meta"><strong>{{ comment.name }}</strong><time :datetime="comment.createdAt">{{ app.formatDate(comment.createdAt.slice(0, 10)) }}</time></div><p>{{ comment.content }}</p></li></ol>
			<form v-if="app.admin" class="comment-form" @submit.prevent="app.submitComment"><label>{{ app.site.commentContentLabel }}<textarea v-model="app.commentDraft.content" rows="3" maxlength="2000" required /></label><label class="honeypot-field" aria-hidden="true">{{ app.currentLocale.ui.honeypotLabel }}<input v-model="app.commentDraft.website" tabindex="-1" autocomplete="off" /></label><div class="comment-form-footer"><button class="primary-button" type="submit">{{ app.site.commentSubmitLabel }}</button></div><p v-if="app.commentNotice" class="form-note">{{ app.commentNotice }}</p></form>
			<div v-else class="comment-login-prompt"><p>{{ app.site.commentLoginPrompt }}</p><button class="outline-button" type="button" @click="app.openAuth('login')">{{ app.site.signInLabel }}</button></div>
		</section>
		<div v-if="app.canEditPost(app.selectedPost)" class="post-admin-actions"><button class="outline-button" @click="app.openEditor(app.selectedPost)">✎ {{ app.site.editPostLabel }}</button></div>
	</article>
	<Teleport to="body">
		<div v-if="touchImage" class="image-touch-preview" aria-hidden="true"><img :src="touchImage.src" alt="" /></div>
		<dialog ref="imageDialog" class="image-viewer" :aria-label="app.currentLocale.ui.viewImageLabel" @close="imageClosed" @keydown.esc.prevent="closeImage">
			<button class="image-viewer-close" type="button" :aria-label="app.currentLocale.ui.closeDialogLabel" :title="app.currentLocale.ui.closeDialogLabel" @click="closeImage">×</button>
			<div v-if="viewerImage" class="image-viewer-stage" :class="{ 'is-dragging': imageDrag }" @wheel.prevent="zoomImage" @pointerdown="startImageDrag" @pointermove="moveImageDrag" @pointerup="endImageDrag" @pointercancel="endImageDrag" @lostpointercapture="endImageDrag"><img :src="viewerImage.src" :alt="viewerImage.alt" draggable="false" :style="{ '--image-aspect': imageAspect, '--image-zoom': zoom, '--image-x': `${imageOffset.x}px`, '--image-y': `${imageOffset.y}px` }" @load="imageAspect = $event.target.naturalWidth / $event.target.naturalHeight || 1" /></div>
		</dialog>
	</Teleport>
</template>