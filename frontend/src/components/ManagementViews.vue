<script setup>
const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
</script>

<template>
	<section v-if="app.view === 'profile' && app.admin" class="profile-view">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.profileHeading }}</p>
		<h1>{{ app.admin.displayName || app.admin.username }}</h1>
		<form class="profile-form" @submit.prevent="app.saveProfile">
			<label>{{ app.site.displayNameLabel }}<input v-model="app.profileDraft.displayName" maxlength="60" required /></label>
			<label>{{ app.site.bioLabel }}<textarea v-model="app.profileDraft.bio" rows="4" maxlength="500" /></label>
			<p class="profile-username">{{ app.admin.username }} · {{ app.admin.role === 'admin' ? app.site.adminRoleLabel : app.site.authorRoleLabel }}</p>
			<button class="primary-button" :disabled="app.busy">{{ app.busy ? app.site.savingLabel : app.site.profileSaveLabel }}</button>
		</form>
		<div class="profile-danger-zone"><p>{{ app.site.accountRemovalNote }}</p><button class="delete-button" type="button" @click="app.deleteProfile">{{ app.site.deleteAccountLabel }}</button></div>
	</section>

	<section v-else-if="app.view === 'author' && app.authorPage" class="author-view">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.authorPostsLabel }}</p>
		<h1>{{ app.authorPage.author.displayName }}</h1>
		<p v-if="app.authorPage.author.bio" class="author-bio">{{ app.authorPage.author.bio }}</p>
		<div class="entry-grid author-entry-grid"><article v-for="post in app.authorPage.posts" :key="post.id" class="entry-card"><button class="card-open" @click="app.readPost(post)"><div v-if="post.coverImage" class="card-image-wrap"><img class="cover-image-backdrop" :src="post.coverImage" alt="" aria-hidden="true" loading="lazy" /><img class="card-image" :src="post.coverImage" :alt="post.title" loading="lazy" /></div><div class="card-body"><div class="card-meta"><time :datetime="post.date">{{ app.formatDate(post.date) }}</time><span class="reading-time">{{ app.readingMinutes(post.content) }}{{ app.site.readingTimeSuffix }}</span></div><h3>{{ post.title }}</h3><p class="card-excerpt">{{ app.postSummary(post.content) }}</p></div></button></article></div>
		<p v-if="!app.authorPage.posts.length" class="no-comments">{{ app.site.emptyLabel }}</p>
	</section>

	<section v-else-if="app.view === 'members' && app.isAdmin" class="management-view">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.membersLabel }}</p><h1>{{ app.site.membersLabel }}</h1>
		<div class="member-list"><article v-for="member in app.members" :key="member.id" class="member-row"><div class="member-identity"><strong>{{ member.displayName }}</strong><span>{{ member.username }}</span></div><span class="member-post-count">{{ app.site.postCountLabel }} · {{ member.postsCount }}</span><time :datetime="member.createdAt">{{ app.formatDate(member.createdAt.slice(0, 10)) }}</time><select :value="member.role" :aria-label="`${member.displayName} ${app.site.memberRoleLabel}`" @change="app.updateMemberRole(member, $event.target.value)"><option value="author">{{ app.site.authorRoleLabel }}</option><option value="admin">{{ app.site.adminRoleLabel }}</option></select><button class="delete-button member-remove" type="button" @click="app.deleteMember(member)">{{ app.site.removeMemberLabel }}</button></article></div>
	</section>

	<section v-else-if="app.view === 'manage-posts' && app.isAdmin" class="management-view">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.managePostsLabel }}</p><h1>{{ app.site.manageHeading }}</h1>
		<div class="managed-post-list"><article v-for="post in app.posts" :key="post.id" class="managed-post-row"><div class="managed-post-copy"><strong>{{ post.title }}</strong><span>{{ post.authorName }} · {{ app.formatDate(post.date) }}</span></div><span class="private-badge" v-if="post.status === 'draft'">{{ app.site.draftLabel }}</span><span class="private-badge" v-else-if="post.status === 'scheduled'">{{ app.site.scheduledLabel }}</span><span v-else class="managed-status">{{ post.visibility === 'private' ? app.site.privateLabel : app.site.publishedLabel }}</span><button class="card-feature" :aria-label="post.featured ? app.site.unfeaturePostLabel : app.site.featurePostLabel" @click="app.toggleFeatured(post)">{{ post.featured ? '★' : '☆' }}</button><button class="outline-button compact-action" @click="app.openEditor(post)">{{ app.site.editPostLabel }}</button><button class="text-action" @click="app.readPost(post)">{{ app.site.readMoreLabel }} <span aria-hidden="true">↗</span></button></article></div>
	</section>

	<section v-else-if="app.view === 'analytics' && app.isAdmin" class="management-view">
		<button class="back-link" @click="app.goHome"><span aria-hidden="true">←</span> {{ app.site.backLabel }}</button>
		<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.site.analyticsLabel }}</p><h1>{{ app.site.popularPostsLabel }}</h1>
		<p class="analytics-range">{{ app.currentLocale.ui.recentDaysLabel }}</p>
		<ol v-if="app.analytics.popularPosts.length" class="analytics-list"><li v-for="(item, index) in app.analytics.popularPosts" :key="item.post.id"><span class="analytics-rank">{{ String(index + 1).padStart(2, '0') }}</span><button class="text-action" @click="app.readPost(item.post)">{{ item.post.title }}</button><strong>{{ item.views }} {{ app.site.viewsLabel }}</strong></li></ol>
		<p v-else class="no-comments">{{ app.site.noAnalyticsLabel }}</p>
	</section>
</template>