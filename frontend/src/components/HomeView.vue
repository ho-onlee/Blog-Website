<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
const loadMoreSentinel = ref(null);
let observer;

async function observeLoadMore() {
	await nextTick();
	observer?.disconnect();
	if (loadMoreSentinel.value && app.homeHasMore && !app.homeLoading && !app.homeError) observer?.observe(loadMoreSentinel.value);
}

onMounted(() => {
	observer = new IntersectionObserver((entries) => {
		if (entries.some((entry) => entry.isIntersecting)) app.loadMoreHomePosts();
	}, { rootMargin: '500px 0px' });
	observeLoadMore();
});

watch(() => [app.homePosts.length, app.homeHasMore, app.homeLoading], observeLoadMore, { flush: 'post' });
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
	<section class="home-view">
		<div class="intro-band">
			<div class="intro-copy">
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.heroEyebrow }}</p>
				<h1>{{ app.site.blogName }}<span class="hero-period">.</span></h1>
				<p class="intro-tagline">{{ app.site.tagline }}</p>
			</div>
			<div class="intro-index" aria-hidden="true"><span>{{ app.site.volumeLabel }}</span><strong>{{ app.site.issueNumber }}</strong><i></i><span>{{ app.site.establishedLabel }}</span></div>
			<div class="intro-stamp" aria-hidden="true">{{ app.site.issueLabel }}<br /><b>{{ app.site.issueNumber }}</b></div>
		</div>

		<section class="journal-section" aria-labelledby="latest-heading">
			<div class="section-heading">
				<div>
					<p class="eyebrow section-eyebrow">{{ app.site.journalLabel }} <span class="heading-dash"></span> {{ String(app.homeTotal).padStart(2, '0') }}</p>
					<h2 id="latest-heading">{{ app.site.latestLabel }}</h2>
				</div>
				<label class="search-box">
					<span class="search-icon" aria-hidden="true">⌕</span>
					<input v-model="app.searchQuery" :placeholder="app.site.searchPlaceholder" :aria-label="app.currentLocale.ui.searchAriaLabel" />
					<kbd>/</kbd>
				</label>
				<label class="archive-filter"><span>{{ app.site.archiveLabel }}</span><select v-model="app.selectedMonth"><option value="">{{ app.site.allMonthsLabel }}</option><option v-for="month in app.archiveMonths" :key="month" :value="month">{{ app.formatMonth(month) }}</option></select></label>
			</div>
			<div v-if="app.allTags.length" class="topic-row" :aria-label="app.currentLocale.ui.topicFilterAriaLabel">
				<button class="topic-chip" :class="{ selected: !app.selectedTag }" @click="app.selectedTag = ''">{{ app.site.allNotesLabel }}</button>
				<button v-for="tag in app.allTags" :key="tag" class="topic-chip" :class="{ selected: app.selectedTag === tag }" @click="app.selectedTag = app.selectedTag === tag ? '' : tag">{{ tag }}</button>
			</div>
			<form v-if="app.site.aiArchiveEnabled" class="archive-ai-panel" @submit.prevent="app.askPublicArchive">
				<label>{{ app.currentLocale.ai.askHeading }}<span class="archive-ai-input"><input v-model="app.archiveQuestion" :placeholder="app.currentLocale.ai.askPlaceholder" maxlength="500" required /><button class="outline-button compact-action" :disabled="app.archiveBusy">{{ app.archiveBusy ? app.currentLocale.ai.generating : app.currentLocale.ai.askAction }}</button></span></label>
				<div v-if="app.archiveAnswer" class="archive-ai-answer"><strong>{{ app.currentLocale.ai.answerHeading }}</strong><p>{{ app.archiveAnswer }}</p><div v-if="app.archiveCitations.length" class="archive-ai-citations"><button v-for="citation in app.archiveCitations" :key="citation.id" type="button" class="text-action" @click="app.readPost(app.posts.find((post) => post.id === citation.id) || app.homePosts.find((post) => post.id === citation.id) || { id: citation.id })">{{ citation.title }} ↗</button></div></div>
			</form>

			<div v-if="app.visiblePosts.length" class="entry-grid">
				<article v-for="(post, index) in app.visiblePosts" :key="post.id" class="entry-card" :class="{ 'entry-card-featured': index === 0 && !app.searchQuery && !app.selectedTag && !app.selectedMonth }">
					<button class="card-open" :aria-label="`${app.site.readMoreLabel}: ${post.title}`" @click="app.readPost(post)">
						<div v-if="post.coverImage" class="card-image-wrap"><img class="cover-image-backdrop" :src="post.coverThumbnail || post.coverImage" alt="" aria-hidden="true" loading="lazy" /><img class="card-image" :src="post.coverThumbnail || post.coverImage" :alt="post.title" loading="lazy" /><span class="image-arrow" aria-hidden="true">↗</span></div>
						<div v-else class="card-image-wrap card-image-placeholder"><span>{{ app.site.blogName }}</span><i></i></div>
						<div class="card-body">
							<div class="card-meta"><time :datetime="post.date">{{ app.formatDate(post.date) }}</time><span class="card-author">{{ post.authorName }}</span><span class="reading-time">{{ post.readingMinutes }}{{ app.site.readingTimeSuffix }}</span><span v-if="app.admin && post.status === 'draft'" class="private-badge">{{ app.site.draftLabel }}</span><span v-if="app.admin && post.status === 'scheduled'" class="private-badge">{{ app.site.scheduledLabel }}</span><span v-if="post.visibility === 'private'" class="private-badge">{{ app.site.privateLabel }}</span></div>
							<h3>{{ post.title }}</h3>
							<p class="card-excerpt">{{ post.contentSummary }}</p>
							<div class="card-bottom"><span class="card-topics"><span v-for="tag in (post.tags || []).slice(0, 2)" :key="tag">{{ tag }}</span></span><span class="read-link">{{ app.site.readMoreLabel }} <b aria-hidden="true">↗</b></span></div>
						</div>
					</button>
					<div v-if="app.admin" class="card-admin-actions"><button v-if="app.isAdmin" class="card-feature" :aria-label="post.featured ? app.site.unfeaturePostLabel : app.site.featurePostLabel" :title="post.featured ? app.site.unfeaturePostLabel : app.site.featurePostLabel" @click.stop="app.toggleFeatured(post)">{{ post.featured ? '★' : '☆' }}</button><button v-if="app.canEditPost(post)" class="card-edit" :aria-label="`${app.site.editPostLabel}: ${post.title}`" :title="app.site.editPostLabel" @click.stop="app.openEditor(post)">✎</button></div>
				</article>
			</div>
			<div v-else-if="app.homeError" class="empty-state"><p>{{ app.site.loadErrorLabel }}</p><button class="text-action" @click="app.loadMoreHomePosts">{{ app.site.loadMoreLabel }} <span aria-hidden="true">↻</span></button></div>
			<div v-else-if="!app.homeLoading" class="empty-state"><span class="empty-mark">✳</span><p>{{ app.searchQuery || app.selectedTag || app.selectedMonth ? app.site.noResultsLabel : app.site.emptyLabel }}</p><button v-if="app.admin && !app.searchQuery && !app.selectedTag && !app.selectedMonth" class="text-action" @click="app.openEditor()">{{ app.site.createLabel }} <span aria-hidden="true">↗</span></button></div>
			<p v-if="app.homePosts.length && app.homeError" class="home-load-error" role="alert">{{ app.site.loadErrorLabel }} <button class="text-action" @click="app.loadMoreHomePosts">{{ app.site.loadMoreLabel }}</button></p>
			<div v-if="app.homeHasMore && !app.homeError" ref="loadMoreSentinel" class="home-load-sentinel" :aria-busy="app.homeLoading" role="status"><span v-if="app.homeLoading" class="home-load-spinner" aria-hidden="true"></span><span class="visually-hidden">{{ app.site.waitingLabel }}</span></div>
		</section>
	</section>
</template>