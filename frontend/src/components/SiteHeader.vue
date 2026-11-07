<script setup>
const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
</script>

<template>
	<header class="topbar">
		<a class="wordmark" href="#home" @click.prevent="app.goHome">{{ app.site.blogName }}<span class="wordmark-dot">.</span></a>
		<div class="top-actions">
			<select v-model="app.language" class="language-select" :aria-label="app.currentLocale.ui.languageLabel"><option value="en">{{ app.currentLocale.ui.languageEnglishName }}</option><option value="ko">{{ app.currentLocale.ui.languageKoreanName }}</option></select>
			<button class="theme-toggle" type="button" :aria-label="app.themeToggleLabel" :title="app.themeToggleLabel" :aria-pressed="app.theme === 'dark'" @click="app.toggleTheme"><span aria-hidden="true">{{ app.theme === 'dark' ? '☀' : '☾' }}</span></button>
			<template v-if="app.admin">
				<button class="profile-button" @click="app.openProfile">{{ app.admin.displayName || app.admin.username }}</button>
				<details v-if="app.isAdmin" class="admin-menu"><summary>{{ app.site.manageHeading }}</summary><div class="admin-menu-panel"><button @click="app.openPostManager(); $event.currentTarget.closest('details').open = false">{{ app.site.managePostsLabel }}</button><button @click="app.openMembers(); $event.currentTarget.closest('details').open = false">{{ app.site.membersLabel }}</button><button @click="app.openAnalytics(); $event.currentTarget.closest('details').open = false">{{ app.site.analyticsLabel }}</button><button @click="app.openSettings(); $event.currentTarget.closest('details').open = false">{{ app.site.settingsLabel }}</button></div></details>
				<button class="quiet-button" @click="app.logout">{{ app.site.logoutLabel }}</button>
				<button class="primary-button compact" @click="app.openEditor()"><span aria-hidden="true">＋</span> {{ app.site.createLabel }}</button>
			</template>
			<button v-else class="quiet-button login-trigger" @click="app.openAuth('login')">{{ app.site.signInLabel }} <span aria-hidden="true">↗</span></button>
		</div>
	</header>
</template>