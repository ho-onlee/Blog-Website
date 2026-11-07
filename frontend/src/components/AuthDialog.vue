<script setup>
const props = defineProps({ app: { type: Object, required: true } });
const app = props.app;
</script>

<template>
	<div v-if="app.authOpen" class="overlay" @click.self="app.authOpen = false">
		<section class="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
			<button class="dialog-close" :aria-label="app.currentLocale.ui.closeDialogLabel" @click="app.authOpen = false">×</button>
			<p class="eyebrow"><span class="eyebrow-rule"></span>{{ app.authMode === 'login' ? app.site.welcomeLabel : app.site.adminAccessLabel }}</p>
			<h2 id="auth-title">{{ app.authMode === 'login' ? app.site.signInLabel : app.site.signupLabel }}</h2>
			<p class="dialog-note">{{ app.authMode === 'login' ? app.site.loginNote : app.site.registrationNote }}</p>
			<form class="stack-form" @submit.prevent="app.submitAuth">
				<label>{{ app.site.accountLabel }}<input v-model="app.authDraft.username" autocomplete="username" required minlength="3" maxlength="32" /></label>
				<label>{{ app.site.passwordLabel }}<input v-model="app.authDraft.password" type="password" :autocomplete="app.authMode === 'login' ? 'current-password' : 'new-password'" required minlength="8" /></label>
				<label v-if="app.authMode === 'register'">{{ app.site.inviteLabel }}<input v-model="app.authDraft.inviteCode" type="password" autocomplete="off" required /></label>
				<p v-if="app.authError" class="form-error">{{ app.authError }}</p>
				<button class="primary-button form-submit" :disabled="app.busy">{{ app.busy ? app.site.waitingLabel : app.authMode === 'login' ? app.site.signInLabel : app.site.signupLabel }} <span aria-hidden="true">↗</span></button>
			</form>
			<button class="mode-switch" @click="app.authMode = app.authMode === 'login' ? 'register' : 'login'; app.authError = ''">{{ app.authMode === 'login' ? app.site.registerPrompt : app.site.loginPrompt }}</button>
		</section>
	</div>
</template>