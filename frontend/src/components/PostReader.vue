<script setup>
const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
</script>

<template>
	<article class="post-view">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<div class="post-heading">
			<div class="card-meta"><time :datetime="app.selectedPost.date">{{ app.formatDate(app.selectedPost.date) }}</time><button class="author-link" @click="app.readAuthor(app.selectedPost.authorId)">{{ app.selectedPost.authorName }}</button><span class="reading-time">{{ app.readingMinutes(app.selectedPost.content) }}{{ app.site.readingTimeSuffix }}</span><span v-if="app.selectedPost.status === 'draft'" class="private-badge">{{ app.site.draftLabel }}</span><span v-if="app.selectedPost.status === 'scheduled'" class="private-badge">{{ app.site.scheduledLabel }}</span><span v-if="app.selectedPost.visibility === 'private'" class="private-badge">{{ app.site.privateLabel }}</span></div>
			<h1>{{ app.selectedPost.title }}</h1>
			<div class="post-tags"><span v-for="tag in app.selectedPost.tags" :key="tag">{{ tag }}</span></div>
		</div>
		<img v-if="app.selectedPost.coverImage" class="post-cover" :src="app.selectedPost.coverImage" :alt="app.selectedPost.title" />
		<div class="markdown-content post-content" v-html="app.renderMarkdown(app.selectedPost.content)"></div>
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
</template>