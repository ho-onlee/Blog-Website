<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { api, clearToken, getToken, saveToken } from './storage.js';
import englishLocale from './locales/en.json';
import koreanLocale from './locales/ko.json';

const MdxEditor = defineAsyncComponent(() => import('./components/MdxEditor.vue'));
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
// Keep interface translations in JSON so contributors can edit them without changing Vue code.
const locales = { en: englishLocale, ko: koreanLocale };
const defaultSite = koreanLocale.site;

const languageStorageKey = 'seohakru_language';
// Prefer the browser's first system locale; an explicit saved choice takes priority.
const systemLocale = navigator.languages?.[0] || navigator.language || '';
const systemLanguage = systemLocale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
const savedLanguage = localStorage.getItem(languageStorageKey);
const language = ref(savedLanguage === 'ko' ? 'ko' : savedLanguage === 'en' ? 'en' : systemLanguage);
const currentLocale = computed(() => locales[language.value] || locales.en);
const savedSite = ref({ ...defaultSite });
const site = computed(() => {
	const translatedSite = currentLocale.value.site;
	// Translate defaults only; preserve any copy customized by the site owner.
	return Object.fromEntries(Object.entries(savedSite.value).map(([key, value]) => [
		key,
		value === defaultSite[key] ? translatedSite[key] ?? value : value
	]));
});
const localizedFieldLabels = computed(() => currentLocale.value.fieldLabels);

function fieldGroupHeading(heading) {
	return currentLocale.value.fieldGroups[heading] || heading;
}

watch(language, (value) => {
	localStorage.setItem(languageStorageKey, value);
	document.documentElement.lang = value === 'ko' ? 'ko' : 'en';
});
document.documentElement.lang = language.value === 'ko' ? 'ko' : 'en';

const posts = ref([]);
const admin = ref(null);
const authorPage = ref(null);
const members = ref([]);
const analytics = ref({ rangeStart: '', popularPosts: [] });
const view = ref('home');
const selectedPostId = ref(null);
const searchQuery = ref('');
const selectedTag = ref('');
const selectedMonth = ref('');
const postLimit = ref(9);
const authOpen = ref(false);
const authMode = ref('login');
const authError = ref('');
const busy = ref(false);
const settingsOpen = ref(false);
const editorError = ref('');
const uploadBusy = ref(false);
const autosaveStatus = ref('');
const revisions = ref([]);
const comments = ref([]);
const commentNotice = ref('');
const shareStatus = ref('');
const commentDraft = reactive({ name: '', content: '', website: '' });
const profileDraft = reactive({ displayName: '', bio: '' });
const authDraft = reactive({ username: '', password: '', inviteCode: '' });
const siteDraft = reactive({ ...defaultSite });
const draft = reactive({ title: '', coverImage: '', tags: '', content: '', visibility: 'public', status: 'published', scheduledAt: '', seoTitle: '', seoDescription: '' });
const editingId = ref(null);
const editorReturnView = ref('home');
const theme = ref(localStorage.getItem('seohakru_theme') === 'dark' ? 'dark' : 'light');
let autosaveTimer;

function applyTheme() {
	document.documentElement.dataset.theme = theme.value;
	document.documentElement.style.colorScheme = theme.value;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.value === 'dark' ? '#171c19' : '#f6f5f0');
}

function toggleTheme() {
	theme.value = theme.value === 'dark' ? 'light' : 'dark';
	localStorage.setItem('seohakru_theme', theme.value);
	applyTheme();
}

const themeToggleLabel = computed(() => {
	return theme.value === 'dark' ? currentLocale.value.ui.lightModeLabel : currentLocale.value.ui.darkModeLabel;
});

applyTheme();

const siteFields = [
	{
		heading: '브랜드와 소개',
		keys: ['blogName', 'tagline', 'footerText']
	},
	{
		heading: '메뉴와 동작',
		keys: ['homeLabel', 'signInLabel', 'adminLabel', 'createLabel', 'settingsLabel', 'logoutLabel', 'backLabel']
	},
	{
		heading: '글 목록',
		keys: ['heroEyebrow', 'issueLabel', 'issueNumber', 'volumeLabel', 'establishedLabel', 'journalLabel', 'allNotesLabel', 'latestLabel', 'searchPlaceholder', 'emptyLabel', 'noResultsLabel', 'readMoreLabel', 'privateLabel']
	},
	{
		heading: '글 편집과 계정',
		keys: ['titleLabel', 'coverLabel', 'tagsLabel', 'visibilityLabel', 'publicLabel', 'privateOptionLabel', 'saveLabel', 'cancelLabel', 'deleteLabel', 'accountLabel', 'passwordLabel', 'inviteLabel', 'signupLabel', 'welcomeLabel', 'adminAccessLabel', 'loginNote', 'registrationNote', 'registerPrompt', 'loginPrompt', 'uploadingLabel', 'uploadHint', 'chooseImageLabel', 'removeImageLabel', 'titlePlaceholder', 'tagsPlaceholder', 'markdownPlaceholder', 'settingsNote', 'deleteConfirm', 'savingLabel', 'waitingLabel', 'copyrightLabel', 'editPostLabel', 'newPostLabel', 'draftLabel', 'scheduledLabel', 'publishedLabel', 'statusLabel', 'scheduleLabel', 'seoTitleLabel', 'seoDescriptionLabel', 'seoPreviewLabel', 'autoSaveLabel', 'autoSavedLabel', 'revisionsLabel', 'restoreLabel', 'restoreConfirm', 'noRevisionsLabel', 'archiveLabel', 'allMonthsLabel', 'loadMoreLabel', 'rssLabel', 'shareLabel', 'copyLinkLabel', 'copiedLabel', 'readingTimeSuffix', 'commentsLabel', 'commentNameLabel', 'commentContentLabel', 'commentSubmitLabel', 'commentReviewNote', 'noCommentsLabel', 'commentPendingLabel', 'approveLabel', 'rejectLabel', 'commentReceivedLabel', 'draftRestoredLabel', 'loadErrorLabel']
	},
	{
		heading: '작가와 관리자',
		keys: ['profileLabel', 'profileHeading', 'displayNameLabel', 'bioLabel', 'profileSaveLabel', 'managePostsLabel', 'membersLabel', 'analyticsLabel', 'memberRoleLabel', 'adminRoleLabel', 'authorRoleLabel', 'postCountLabel', 'memberJoinedLabel', 'manageHeading', 'featuredLabel', 'featurePostLabel', 'unfeaturePostLabel', 'relatedPostsLabel', 'viewsLabel', 'popularPostsLabel', 'noAnalyticsLabel', 'authorPostsLabel', 'memberUpdatedLabel', 'profileUpdatedLabel']
	}
];

const selectedPost = computed(() => posts.value.find((post) => post.id === selectedPostId.value));
const isAdmin = computed(() => admin.value?.role === 'admin');
const authoredPostCount = computed(() => posts.value.filter((post) => post.authorId === admin.value?.id).length);
const relatedPosts = computed(() => {
	if (!selectedPost.value) return [];
	const tags = new Set(selectedPost.value.tags || []);
	return posts.value.filter((post) => post.id !== selectedPost.value.id && isPublicEntry(post) && (post.tags || []).some((tag) => tags.has(tag))).slice(0, 3);
});
const allTags = computed(() => [...new Set(posts.value.filter((post) => admin.value || post.visibility === 'public').flatMap((post) => post.tags || []))]);
const matchingPosts = computed(() => {
	const query = searchQuery.value.trim().toLowerCase();
	const month = selectedMonth.value;
	return posts.value.filter((post) => {
		if (!admin.value && (post.visibility !== 'public' || (post.status || 'published') !== 'published')) return false;
		const matchesText = !query || [post.title, post.content, ...(post.tags || [])].join(' ').toLowerCase().includes(query);
		const matchesTag = !selectedTag.value || (post.tags || []).includes(selectedTag.value);
		const matchesMonth = !month || String(post.date || '').slice(0, 7) === month;
		return matchesText && matchesTag && matchesMonth;
	});
});
const visiblePosts = computed(() => matchingPosts.value.slice(0, postLimit.value));
const archiveMonths = computed(() => [...new Set(posts.value.filter((post) => admin.value || (post.visibility === 'public' && (post.status || 'published') === 'published')).map((post) => String(post.date || '').slice(0, 7)).filter(Boolean))].sort().reverse());

watch([searchQuery, selectedTag, selectedMonth], () => { postLimit.value = 9; });

watch(draft, () => {
	if (view.value !== 'editor' || !admin.value) return;
	autosaveStatus.value = site.value.autoSaveLabel;
	clearTimeout(autosaveTimer);
	autosaveTimer = setTimeout(() => {
		const key = `seohakru_autosave_${editingId.value || 'new'}`;
		localStorage.setItem(key, JSON.stringify({ postId: editingId.value, draft: { ...draft }, savedAt: new Date().toISOString() }));
		autosaveStatus.value = site.value.autoSavedLabel;
	}, 700);
}, { deep: true });

function renderMarkdown(value) {
	return DOMPurify.sanitize(markdown.render(value || ''));
}

function postSummary(value) {
	return String(value || '').replace(/```[\s\S]*?```/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_~`-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 130);
}

function readingMinutes(value) {
	const plainText = String(value || '').replace(/```[\s\S]*?```/g, '').replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, '$1').replace(/[#>*_~`-]/g, '').replace(/\s+/g, ' ').trim();
	return Math.max(1, Math.ceil(plainText.length / 500));
}

function isPublicEntry(post) {
	return post?.visibility === 'public' && (post.status || 'published') === 'published';
}

function toLocalDateTime(value) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function setMeta(name, value, attribute = 'name') {
	let tag = document.head.querySelector(`meta[${attribute}="${name}"]`);
	if (!tag) {
		tag = document.createElement('meta');
		tag.setAttribute(attribute, name);
		document.head.append(tag);
	}
	tag.setAttribute('content', value || '');
}

function setPageMeta(title, description, image = '') {
	document.title = title;
	setMeta('description', description);
	setMeta('og:title', title, 'property');
	setMeta('og:description', description, 'property');
	setMeta('og:image', image, 'property');
}

async function loadSite() {
	try {
		savedSite.value = { ...defaultSite, ...(await api('/site')) };
		setPageMeta(site.value.blogName, site.value.tagline);
	}
	catch { savedSite.value = { ...defaultSite }; }
}

async function loadPosts() {
	try { posts.value = await api('/posts'); }
	catch { posts.value = []; }
}

async function loadComments(postId) {
	try { comments.value = await api(`/posts/${postId}/comments`); }
	catch { comments.value = []; }
}

async function loadRevisions(postId) {
	if (!postId) {
		revisions.value = [];
		return;
	}
	try { revisions.value = await api(`/posts/${postId}/revisions`); }
	catch { revisions.value = []; }
}

async function loadMembers() {
	members.value = await api('/members');
}

async function loadAnalytics() {
	analytics.value = await api('/analytics');
}

async function openProfile() {
	try {
		const result = await api('/profile');
		Object.assign(profileDraft, { displayName: result.user.displayName || '', bio: result.user.bio || '' });
		view.value = 'profile';
		window.scrollTo({ top: 0 });
	} catch (error) {
		window.alert(error.message);
	}
}

async function saveProfile() {
	busy.value = true;
	try {
		const result = await api('/profile', { method: 'PUT', body: JSON.stringify(profileDraft) });
		admin.value = result.user;
		await loadPosts();
		window.alert(site.value.profileUpdatedLabel);
	} catch (error) {
		window.alert(error.message);
	} finally {
		busy.value = false;
	}
}

async function openMembers() {
	try {
		members.value = await api('/members');
		view.value = 'members';
		window.scrollTo({ top: 0 });
	} catch (error) {
		window.alert(error.message);
	}
}

async function openPostManager() {
	await loadPosts();
	view.value = 'manage-posts';
	window.scrollTo({ top: 0 });
}

async function openAnalytics() {
	try {
		analytics.value = await api('/analytics');
		view.value = 'analytics';
		window.scrollTo({ top: 0 });
	} catch (error) {
		window.alert(error.message);
	}
}

async function updateMemberRole(member, role) {
	try {
		await api(`/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
		await loadMembers();
	} catch (error) {
		window.alert(error.message);
	}
}

async function toggleFeatured(post) {
	try {
		await api(`/posts/${post.id}/featured`, { method: 'PATCH', body: JSON.stringify({ featured: !post.featured }) });
		await loadPosts();
	} catch (error) {
		window.alert(error.message);
	}
}

async function openAuthor(authorId, updateHistory = true) {
	try {
		authorPage.value = await api(`/authors/${authorId}`);
		view.value = 'author';
		if (updateHistory) {
			const url = new URL(window.location.href);
			url.searchParams.delete('post');
			url.searchParams.set('author', authorId);
			window.history.pushState({}, '', url);
		}
		setPageMeta(authorPage.value.author.displayName, authorPage.value.author.bio);
		window.scrollTo({ top: 0 });
	} catch (error) {
		window.alert(error.message);
	}
}

async function refreshContent() {
	await Promise.all([loadSite(), loadPosts()]);
}

onMounted(async () => {
	await refreshContent();
	if (getToken()) {
		try {
			const result = await api('/auth/me');
			admin.value = result.user;
		} catch {
			clearToken();
		}
	}
	await loadPosts();
	window.addEventListener('popstate', syncLocation);
	syncLocation();
});

onBeforeUnmount(() => {
	window.removeEventListener('popstate', syncLocation);
	clearTimeout(autosaveTimer);
});

function openAuth(mode = 'login') {
	authMode.value = mode;
	authError.value = '';
	authOpen.value = true;
}

async function submitAuth() {
	busy.value = true;
	authError.value = '';
	try {
		const path = authMode.value === 'register' ? '/auth/register' : '/auth/login';
		const result = await api(path, { method: 'POST', body: JSON.stringify(authDraft) });
		saveToken(result.token);
		admin.value = result.user;
		authOpen.value = false;
		authDraft.password = '';
		await loadPosts();
	} catch (error) {
		authError.value = error.message;
	} finally {
		busy.value = false;
	}
}

async function logout() {
	try { await api('/auth/logout', { method: 'POST' }); } catch { /* Local sign-out still works offline. */ }
	clearToken();
	view.value = 'home';
	admin.value = null;
	await loadPosts();
}

function openEditor(post = null) {
	editorReturnView.value = view.value === 'entry' ? 'entry' : view.value === 'editor' ? editorReturnView.value : view.value;
	editingId.value = post?.id || null;
	const initialDraft = post ? {
		title: post.title,
		coverImage: post.coverImage,
		tags: (post.tags || []).join(', '),
		content: post.content,
		visibility: post.visibility || 'public',
		status: post.status || 'published',
		scheduledAt: toLocalDateTime(post.scheduledAt),
		seoTitle: post.seoTitle || '',
		seoDescription: post.seoDescription || ''
	} : { title: '', coverImage: '', tags: '', content: '', visibility: 'public', status: 'published', scheduledAt: '', seoTitle: '', seoDescription: '' };
	const storageKey = `seohakru_autosave_${editingId.value || 'new'}`;
	let restored = false;
	try {
		const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
		if (saved?.postId === editingId.value && saved.draft) {
			Object.assign(initialDraft, saved.draft);
			restored = true;
		}
	} catch { localStorage.removeItem(storageKey); }
	Object.assign(draft, initialDraft);
	editorError.value = '';
	autosaveStatus.value = restored ? site.value.draftRestoredLabel : '';
	view.value = 'editor';
	window.scrollTo({ top: 0 });
	loadRevisions(editingId.value);
}

function cancelEditor() {
	view.value = editorReturnView.value;
	window.scrollTo({ top: 0 });
}

async function savePost(statusOverride = null) {
	busy.value = true;
	editorError.value = '';
	if (typeof statusOverride === 'string') draft.status = statusOverride;
	if (draft.status === 'scheduled' && !draft.scheduledAt) {
		editorError.value = site.value.scheduleLabel;
		busy.value = false;
		return;
	}
	const payload = {
		...draft,
		scheduledAt: draft.status === 'scheduled' ? new Date(draft.scheduledAt).toISOString() : null,
		tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
	};
	try {
		const post = await api(editingId.value ? `/posts/${editingId.value}` : '/posts', {
			method: editingId.value ? 'PUT' : 'POST',
			body: JSON.stringify(payload)
		});
		clearTimeout(autosaveTimer);
		localStorage.removeItem(`seohakru_autosave_${editingId.value || 'new'}`);
		autosaveStatus.value = '';
		await loadPosts();
		readPost(post);
	} catch (error) {
		editorError.value = error.message;
	} finally {
		busy.value = false;
	}
}

async function restoreRevision(revision) {
	if (!editingId.value || !window.confirm(site.value.restoreConfirm)) return;
	busy.value = true;
	try {
		const post = await api(`/posts/${editingId.value}/revisions/${revision.id}/restore`, { method: 'POST' });
		Object.assign(draft, {
			title: post.title,
			coverImage: post.coverImage,
			tags: (post.tags || []).join(', '),
			content: post.content,
			visibility: post.visibility,
			status: post.status,
			scheduledAt: toLocalDateTime(post.scheduledAt),
			seoTitle: post.seoTitle || '',
			seoDescription: post.seoDescription || ''
		});
		await Promise.all([loadPosts(), loadRevisions(editingId.value)]);
	} catch (error) {
		editorError.value = error.message;
	} finally {
		busy.value = false;
	}
}

async function submitComment() {
	if (!selectedPost.value) return;
	commentNotice.value = '';
	try {
		const result = await api(`/posts/${selectedPost.value.id}/comments`, {
			method: 'POST',
			body: JSON.stringify(commentDraft)
		});
		commentNotice.value = result.message || site.value.commentReceivedLabel;
		commentDraft.content = '';
		commentDraft.website = '';
		if (admin.value) await loadComments(selectedPost.value.id);
	} catch (error) {
		commentNotice.value = error.message;
	}
}

async function moderateComment(comment, status) {
	try {
		await api(`/comments/${comment.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
		if (selectedPost.value) await loadComments(selectedPost.value.id);
	} catch (error) {
		commentNotice.value = error.message;
	}
}

async function sharePost() {
	if (!selectedPost.value) return;
	const url = new URL(window.location.href);
	url.searchParams.set('post', selectedPost.value.id);
	try {
		if (navigator.share) await navigator.share({ title: selectedPost.value.title, url: url.toString() });
		else {
			await navigator.clipboard.writeText(url.toString());
			shareStatus.value = site.value.copiedLabel;
			setTimeout(() => { shareStatus.value = ''; }, 2500);
		}
	} catch (error) {
		if (error.name !== 'AbortError') shareStatus.value = error.message;
	}
}

async function deletePost() {
	if (!editingId.value || !window.confirm(site.value.deleteConfirm)) return;
	busy.value = true;
	try {
		await api(`/posts/${editingId.value}`, { method: 'DELETE' });
		selectedPostId.value = null;
		view.value = 'home';
		await loadPosts();
	} catch (error) {
		editorError.value = error.message;
	} finally {
		busy.value = false;
	}
}

async function uploadCover(event) {
	const file = event.target.files?.[0];
	if (!file) return;
	uploadBusy.value = true;
	editorError.value = '';
	const form = new FormData();
	form.append('image', file);
	try {
		const result = await api('/uploads', { method: 'POST', body: form });
		draft.coverImage = result.url;
	} catch (error) {
		editorError.value = error.message;
	} finally {
		uploadBusy.value = false;
		event.target.value = '';
	}
}

function openSettings() {
	Object.assign(siteDraft, savedSite.value);
	settingsOpen.value = true;
}

async function saveSettings() {
	busy.value = true;
	try {
		savedSite.value = await api('/site', { method: 'PUT', body: JSON.stringify(siteDraft) });
		setPageMeta(site.value.blogName, site.value.tagline);
		settingsOpen.value = false;
	} catch (error) {
		window.alert(error.message);
	} finally {
		busy.value = false;
	}
}

function readPost(post, updateHistory = true) {
	selectedPostId.value = post.id;
	view.value = 'entry';
	if (updateHistory) {
		const url = new URL(window.location.href);
		url.searchParams.delete('author');
		url.searchParams.set('post', post.id);
		window.history.pushState({}, '', url);
	}
	setPageMeta(post.seoTitle || post.title, post.seoDescription || postSummary(post.content), post.coverImage ? new URL(post.coverImage, window.location.origin).href : '');
	commentNotice.value = '';
	loadComments(post.id);
	if (!admin.value) api(`/posts/${post.id}/views`, { method: 'POST' }).catch(() => {});
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncLocation() {
	if (view.value === 'editor') return;
	const search = new URLSearchParams(window.location.search);
	const postId = search.get('post');
	const post = postId && posts.value.find((item) => item.id === postId);
	if (post) readPost(post, false);
	else if (search.get('author')) openAuthor(search.get('author'), false);
	else {
		view.value = 'home';
		selectedPostId.value = null;
		setPageMeta(site.value.blogName, site.value.tagline);
	}
}

function canEditPost(post) {
	return Boolean(admin.value && (isAdmin.value || post.authorId === admin.value.id));
}

function goHome() {
	view.value = 'home';
	selectedPostId.value = null;
	selectedTag.value = '';
	selectedMonth.value = '';
	postLimit.value = 9;
	const url = new URL(window.location.href);
	url.searchParams.delete('post');
	url.searchParams.delete('author');
	window.history.pushState({}, '', url);
	setPageMeta(site.value.blogName, site.value.tagline);
}

function formatDate(value) {
	const locale = language.value === 'ko' ? 'ko-KR' : 'en-US';
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatMonth(value) {
	const [year, month] = value.split('-').map(Number);
	const locale = language.value === 'ko' ? 'ko-KR' : 'en-US';
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, month - 1, 1));
}
</script>

<template>
	<div class="site-shell">
		<header class="topbar">
			<a class="wordmark" href="#home" @click.prevent="goHome">{{ site.blogName }}<span class="wordmark-dot">.</span></a>
			<div class="top-actions">
				<select v-model="language" class="language-select" :aria-label="currentLocale.ui.languageLabel"><option value="en">English</option><option value="ko">한국어</option></select>
				<button class="theme-toggle" type="button" :aria-label="themeToggleLabel" :title="themeToggleLabel" :aria-pressed="theme === 'dark'" @click="toggleTheme"><span aria-hidden="true">{{ theme === 'dark' ? '☀' : '☾' }}</span></button>
				<template v-if="admin">
					<button class="profile-button" @click="openProfile">{{ admin.displayName || admin.username }}</button>
					<details v-if="isAdmin" class="admin-menu"><summary>{{ site.manageHeading }}</summary><div class="admin-menu-panel"><button @click="openPostManager(); $event.currentTarget.closest('details').open = false">{{ site.managePostsLabel }}</button><button @click="openMembers(); $event.currentTarget.closest('details').open = false">{{ site.membersLabel }}</button><button @click="openAnalytics(); $event.currentTarget.closest('details').open = false">{{ site.analyticsLabel }}</button><button @click="openSettings(); $event.currentTarget.closest('details').open = false">{{ site.settingsLabel }}</button></div></details>
					<button class="quiet-button" @click="logout">{{ site.logoutLabel }}</button>
					<button class="primary-button compact" @click="openEditor()"><span aria-hidden="true">＋</span> {{ site.createLabel }}</button>
				</template>
				<button v-else class="quiet-button login-trigger" @click="openAuth('login')">{{ site.signInLabel }} <span aria-hidden="true">↗</span></button>
			</div>
			<div v-if="admin" class="admin-indicator"><span></span>{{ site.postCountLabel }} {{ authoredPostCount }} · {{ isAdmin ? site.adminLabel : site.authorRoleLabel }}</div>
		</header>

		<main>
			<section v-if="view === 'home'" class="home-view">
				<div class="intro-band">
					<div class="intro-copy">
						<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.heroEyebrow }}</p>
						<h1>{{ site.blogName }}<span class="hero-period">.</span></h1>
						<p class="intro-tagline">{{ site.tagline }}</p>
					</div>
					<div class="intro-index" aria-hidden="true"><span>{{ site.volumeLabel }}</span><strong>{{ site.issueNumber }}</strong><i></i><span>{{ site.establishedLabel }}</span></div>
					<div class="intro-stamp" aria-hidden="true">{{ site.issueLabel }}<br /><b>{{ site.issueNumber }}</b></div>
				</div>

				<section class="journal-section" aria-labelledby="latest-heading">
					<div class="section-heading">
						<div>
							<p class="eyebrow section-eyebrow">{{ site.journalLabel }} <span class="heading-dash"></span> {{ String(matchingPosts.length).padStart(2, '0') }}</p>
							<h2 id="latest-heading">{{ site.latestLabel }}</h2>
						</div>
						<label class="search-box">
							<span class="search-icon" aria-hidden="true">⌕</span>
							<input v-model="searchQuery" :placeholder="site.searchPlaceholder" :aria-label="currentLocale.ui.searchAriaLabel" />
							<kbd>/</kbd>
						</label>
						<label class="archive-filter"><span>{{ site.archiveLabel }}</span><select v-model="selectedMonth"><option value="">{{ site.allMonthsLabel }}</option><option v-for="month in archiveMonths" :key="month" :value="month">{{ formatMonth(month) }}</option></select></label>
					</div>
					<div v-if="allTags.length" class="topic-row" :aria-label="currentLocale.ui.topicFilterAriaLabel">
						<button class="topic-chip" :class="{ selected: !selectedTag }" @click="selectedTag = ''">{{ site.allNotesLabel }}</button>
						<button v-for="tag in allTags" :key="tag" class="topic-chip" :class="{ selected: selectedTag === tag }" @click="selectedTag = selectedTag === tag ? '' : tag">{{ tag }}</button>
					</div>

					<div v-if="visiblePosts.length" class="entry-grid">
						<article v-for="(post, index) in visiblePosts" :key="post.id" class="entry-card" :class="{ 'entry-card-featured': index === 0 && !searchQuery && !selectedTag && !selectedMonth }">
							<button class="card-open" :aria-label="`${site.readMoreLabel}: ${post.title}`" @click="readPost(post)">
								<div v-if="post.coverImage" class="card-image-wrap"><img class="card-image" :src="post.coverImage" :alt="post.title" loading="lazy" /><span class="image-arrow" aria-hidden="true">↗</span></div>
								<div v-else class="card-image-wrap card-image-placeholder"><span>{{ site.blogName }}</span><i></i></div>
								<div class="card-body">
									<div class="card-meta"><time :datetime="post.date">{{ formatDate(post.date) }}</time><span class="card-author">{{ post.authorName }}</span><span class="reading-time">{{ readingMinutes(post.content) }}{{ site.readingTimeSuffix }}</span><span v-if="admin && post.status === 'draft'" class="private-badge">{{ site.draftLabel }}</span><span v-if="admin && post.status === 'scheduled'" class="private-badge">{{ site.scheduledLabel }}</span><span v-if="post.visibility === 'private'" class="private-badge">{{ site.privateLabel }}</span></div>
									<h3>{{ post.title }}</h3>
									<p class="card-excerpt">{{ postSummary(post.content) }}</p>
									<div class="card-bottom"><span class="card-topics"><span v-for="tag in (post.tags || []).slice(0, 2)" :key="tag">{{ tag }}</span></span><span class="read-link">{{ site.readMoreLabel }} <b aria-hidden="true">↗</b></span></div>
								</div>
							</button>
							<div v-if="admin" class="card-admin-actions"><button v-if="isAdmin" class="card-feature" :aria-label="post.featured ? site.unfeaturePostLabel : site.featurePostLabel" :title="post.featured ? site.unfeaturePostLabel : site.featurePostLabel" @click.stop="toggleFeatured(post)">{{ post.featured ? '★' : '☆' }}</button><button v-if="canEditPost(post)" class="card-edit" :aria-label="`${site.editPostLabel}: ${post.title}`" :title="site.editPostLabel" @click.stop="openEditor(post)">✎</button></div>
						</article>
					</div>
					<div v-else class="empty-state"><span class="empty-mark">✳</span><p>{{ searchQuery || selectedTag || selectedMonth ? site.noResultsLabel : site.emptyLabel }}</p><button v-if="admin && !searchQuery && !selectedTag && !selectedMonth" class="text-action" @click="openEditor()">{{ site.createLabel }} <span aria-hidden="true">↗</span></button></div>
					<button v-if="matchingPosts.length > visiblePosts.length" class="load-more-button" @click="postLimit += 9">{{ site.loadMoreLabel }} <span aria-hidden="true">＋</span></button>
				</section>
			</section>

			<section v-else-if="view === 'profile' && admin" class="profile-view">
				<button class="back-link" @click="goHome"><span aria-hidden="true">←</span> {{ site.backLabel }}</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.profileHeading }}</p>
				<h1>{{ admin.displayName || admin.username }}</h1>
				<form class="profile-form" @submit.prevent="saveProfile">
					<label>{{ site.displayNameLabel }}<input v-model="profileDraft.displayName" maxlength="60" required /></label>
					<label>{{ site.bioLabel }}<textarea v-model="profileDraft.bio" rows="4" maxlength="500" /></label>
					<p class="profile-username">{{ admin.username }} · {{ admin.role === 'admin' ? site.adminRoleLabel : site.authorRoleLabel }}</p>
					<button class="primary-button" :disabled="busy">{{ busy ? site.savingLabel : site.profileSaveLabel }}</button>
				</form>
			</section>

			<section v-else-if="view === 'author' && authorPage" class="author-view">
				<button class="back-link" @click="goHome"><span aria-hidden="true">←</span> {{ site.backLabel }}</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.authorPostsLabel }}</p>
				<h1>{{ authorPage.author.displayName }}</h1>
				<p v-if="authorPage.author.bio" class="author-bio">{{ authorPage.author.bio }}</p>
				<div class="entry-grid author-entry-grid"><article v-for="post in authorPage.posts" :key="post.id" class="entry-card"><button class="card-open" @click="readPost(post)"><div v-if="post.coverImage" class="card-image-wrap"><img class="card-image" :src="post.coverImage" :alt="post.title" loading="lazy" /></div><div class="card-body"><div class="card-meta"><time :datetime="post.date">{{ formatDate(post.date) }}</time><span class="reading-time">{{ readingMinutes(post.content) }}{{ site.readingTimeSuffix }}</span></div><h3>{{ post.title }}</h3><p class="card-excerpt">{{ postSummary(post.content) }}</p></div></button></article></div>
				<p v-if="!authorPage.posts.length" class="no-comments">{{ site.emptyLabel }}</p>
			</section>

			<section v-else-if="view === 'members' && isAdmin" class="management-view">
				<button class="back-link" @click="goHome"><span aria-hidden="true">←</span> {{ site.backLabel }}</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.membersLabel }}</p><h1>{{ site.membersLabel }}</h1>
				<div class="member-list"><article v-for="member in members" :key="member.id" class="member-row"><div class="member-identity"><strong>{{ member.displayName }}</strong><span>{{ member.username }}</span></div><span class="member-post-count">{{ site.postCountLabel }} · {{ member.postsCount }}</span><time :datetime="member.createdAt">{{ formatDate(member.createdAt.slice(0, 10)) }}</time><select :value="member.role" :aria-label="`${member.displayName} ${site.memberRoleLabel}`" @change="updateMemberRole(member, $event.target.value)"><option value="author">{{ site.authorRoleLabel }}</option><option value="admin">{{ site.adminRoleLabel }}</option></select></article></div>
			</section>

			<section v-else-if="view === 'manage-posts' && isAdmin" class="management-view">
				<button class="back-link" @click="goHome"><span aria-hidden="true">←</span> {{ site.backLabel }}</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.managePostsLabel }}</p><h1>{{ site.manageHeading }}</h1>
				<div class="managed-post-list"><article v-for="post in posts" :key="post.id" class="managed-post-row"><div class="managed-post-copy"><strong>{{ post.title }}</strong><span>{{ post.authorName }} · {{ formatDate(post.date) }}</span></div><span class="private-badge" v-if="post.status === 'draft'">{{ site.draftLabel }}</span><span class="private-badge" v-else-if="post.status === 'scheduled'">{{ site.scheduledLabel }}</span><span v-else class="managed-status">{{ post.visibility === 'private' ? site.privateLabel : site.publishedLabel }}</span><button class="card-feature" :aria-label="post.featured ? site.unfeaturePostLabel : site.featurePostLabel" @click="toggleFeatured(post)">{{ post.featured ? '★' : '☆' }}</button><button class="outline-button compact-action" @click="openEditor(post)">{{ site.editPostLabel }}</button><button class="text-action" @click="readPost(post)">{{ site.readMoreLabel }} <span aria-hidden="true">↗</span></button></article></div>
			</section>

			<section v-else-if="view === 'analytics' && isAdmin" class="management-view">
				<button class="back-link" @click="goHome"><span aria-hidden="true">←</span> {{ site.backLabel }}</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.analyticsLabel }}</p><h1>{{ site.popularPostsLabel }}</h1>
				<p class="analytics-range">{{ currentLocale.ui.recentDaysLabel }}</p>
				<ol v-if="analytics.popularPosts.length" class="analytics-list"><li v-for="(item, index) in analytics.popularPosts" :key="item.post.id"><span class="analytics-rank">{{ String(index + 1).padStart(2, '0') }}</span><button class="text-action" @click="readPost(item.post)">{{ item.post.title }}</button><strong>{{ item.views }} {{ site.viewsLabel }}</strong></li></ol>
				<p v-else class="no-comments">{{ site.noAnalyticsLabel }}</p>
			</section>

			<article v-else-if="view === 'entry' && selectedPost" class="post-view">
				<button class="back-link" @click="goHome"><span aria-hidden="true">←</span> {{ site.backLabel }}</button>
				<div class="post-heading">
					<div class="card-meta"><time :datetime="selectedPost.date">{{ formatDate(selectedPost.date) }}</time><button class="author-link" @click="openAuthor(selectedPost.authorId)">{{ selectedPost.authorName }}</button><span class="reading-time">{{ readingMinutes(selectedPost.content) }}{{ site.readingTimeSuffix }}</span><span v-if="selectedPost.status === 'draft'" class="private-badge">{{ site.draftLabel }}</span><span v-if="selectedPost.status === 'scheduled'" class="private-badge">{{ site.scheduledLabel }}</span><span v-if="selectedPost.visibility === 'private'" class="private-badge">{{ site.privateLabel }}</span></div>
					<h1>{{ selectedPost.title }}</h1>
					<div class="post-tags"><span v-for="tag in selectedPost.tags" :key="tag">{{ tag }}</span></div>
				</div>
				<img v-if="selectedPost.coverImage" class="post-cover" :src="selectedPost.coverImage" :alt="selectedPost.title" />
				<div class="markdown-content post-content" v-html="renderMarkdown(selectedPost.content)"></div>
				<section v-if="relatedPosts.length" class="related-section"><h2>{{ site.relatedPostsLabel }}</h2><div class="related-list"><button v-for="post in relatedPosts" :key="post.id" @click="readPost(post)"><span>{{ post.title }}</span><small>{{ post.authorName }}</small></button></div></section>
				<div v-if="isPublicEntry(selectedPost)" class="post-share-row"><button class="outline-button" @click="sharePost">{{ site.shareLabel }} <span aria-hidden="true">↗</span></button><span v-if="shareStatus" class="share-status">{{ shareStatus }}</span></div>
				<section v-if="isPublicEntry(selectedPost)" class="comments-section" aria-labelledby="comments-title">
					<h2 id="comments-title">{{ site.commentsLabel }} <span>{{ comments.filter((comment) => comment.status === 'approved' || isAdmin).length }}</span></h2>
					<p v-if="!comments.length" class="no-comments">{{ site.noCommentsLabel }}</p>
					<ol v-else class="comment-list"><li v-for="comment in comments" :key="comment.id"><div class="comment-meta"><strong>{{ comment.name }}</strong><time :datetime="comment.createdAt">{{ formatDate(comment.createdAt.slice(0, 10)) }}</time><span v-if="comment.status === 'pending'" class="private-badge">{{ site.commentPendingLabel }}</span></div><p>{{ comment.content }}</p><div v-if="isAdmin && comment.status === 'pending'" class="comment-moderation"><button class="text-action" @click="moderateComment(comment, 'approved')">{{ site.approveLabel }}</button><button class="delete-button" @click="moderateComment(comment, 'rejected')">{{ site.rejectLabel }}</button></div></li></ol>
					<form class="comment-form" @submit.prevent="submitComment"><label>{{ site.commentNameLabel }}<input v-model="commentDraft.name" maxlength="60" required /></label><label>{{ site.commentContentLabel }}<textarea v-model="commentDraft.content" rows="3" maxlength="2000" required /></label><label class="honeypot-field" aria-hidden="true">Website<input v-model="commentDraft.website" tabindex="-1" autocomplete="off" /></label><div class="comment-form-footer"><small>{{ site.commentReviewNote }}</small><button class="primary-button" type="submit">{{ site.commentSubmitLabel }}</button></div><p v-if="commentNotice" class="form-note">{{ commentNotice }}</p></form>
				</section>
				<div v-if="canEditPost(selectedPost)" class="post-admin-actions"><button class="outline-button" @click="openEditor(selectedPost)">✎ {{ site.editPostLabel }}</button></div>
			</article>
			<section v-else-if="view !== 'editor'" class="empty-state lost-state"><p>{{ site.noResultsLabel }}</p><button class="text-action" @click="goHome">{{ site.backLabel }} <span aria-hidden="true">↗</span></button></section>
			<div id="editor-page"></div>
		</main>

		<footer class="site-footer"><a class="footer-mark" href="#home" @click.prevent="goHome">{{ site.blogName }}<span>.</span></a><p>{{ site.footerText }}</p><a class="rss-link" href="/feed.xml">{{ site.rssLabel }}</a><span class="footer-year">{{ site.copyrightLabel }}</span></footer>

		<div v-if="authOpen" class="overlay" @click.self="authOpen = false">
			<section class="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
				<button class="dialog-close" :aria-label="currentLocale.ui.closeDialogLabel" @click="authOpen = false">×</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ authMode === 'login' ? site.welcomeLabel : site.adminAccessLabel }}</p>
				<h2 id="auth-title">{{ authMode === 'login' ? site.signInLabel : site.signupLabel }}</h2>
				<p class="dialog-note">{{ authMode === 'login' ? site.loginNote : site.registrationNote }}</p>
				<form class="stack-form" @submit.prevent="submitAuth">
					<label>{{ site.accountLabel }}<input v-model="authDraft.username" autocomplete="username" required minlength="3" maxlength="32" /></label>
					<label>{{ site.passwordLabel }}<input v-model="authDraft.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" required minlength="8" /></label>
					<label v-if="authMode === 'register'">{{ site.inviteLabel }}<input v-model="authDraft.inviteCode" type="password" autocomplete="off" required /></label>
					<p v-if="authError" class="form-error">{{ authError }}</p>
					<button class="primary-button form-submit" :disabled="busy">{{ busy ? site.waitingLabel : authMode === 'login' ? site.signInLabel : site.signupLabel }} <span aria-hidden="true">↗</span></button>
				</form>
				<button class="mode-switch" @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''">{{ authMode === 'login' ? site.registerPrompt : site.loginPrompt }}</button>
			</section>
		</div>

		<Teleport to="#editor-page" v-if="view === 'editor'">
			<div class="full-editor-heading">
				<button class="back-link" type="button" @click="cancelEditor"><span aria-hidden="true">←</span> {{ site.cancelLabel }}</button>
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ editingId ? site.editPostLabel : site.newPostLabel }}</p>
			</div>
			<form class="full-editor-form" @submit.prevent="savePost()">
				<label class="editor-title-field">{{ site.titleLabel }}<input class="editor-title-input" v-model="draft.title" required maxlength="180" :placeholder="site.titlePlaceholder" /></label>
				<div class="editor-workspace">
					<aside class="editor-settings-rail">
						<div class="editor-rail-heading"><span>SEOHAKRU / {{ editingId ? site.editPostLabel : site.newPostLabel }}</span><strong>{{ site.statusLabel }}</strong></div>
						<label>{{ site.tagsLabel }}<input v-model="draft.tags" :placeholder="site.tagsPlaceholder" /></label>
						<div class="editor-select-row">
							<label>{{ site.visibilityLabel }}<select v-model="draft.visibility"><option value="public">{{ site.publicLabel }}</option><option value="private">{{ site.privateOptionLabel }}</option></select></label>
							<label>{{ site.statusLabel }}<select v-model="draft.status"><option value="published">{{ site.publishedLabel }}</option><option value="draft">{{ site.draftLabel }}</option><option value="scheduled">{{ site.scheduledLabel }}</option></select></label>
						</div>
						<label v-if="draft.status === 'scheduled'">{{ site.scheduleLabel }}<input v-model="draft.scheduledAt" type="datetime-local" required /></label>
						<div class="full-editor-cover"><label>{{ site.coverLabel }}</label><div v-if="draft.coverImage" class="cover-preview"><img :src="draft.coverImage" :alt="draft.title || site.coverLabel" /><button class="text-action" type="button" @click="draft.coverImage = ''">{{ site.removeImageLabel }}</button></div><p v-else class="cover-empty">{{ site.uploadHint }}</p><div class="upload-row"><label class="upload-button">{{ site.chooseImageLabel }}<input class="file-input-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadCover" /></label></div></div>
						<details class="seo-editor"><summary>{{ site.seoPreviewLabel }}</summary><label>{{ site.seoTitleLabel }}<input v-model="draft.seoTitle" maxlength="180" :placeholder="draft.title || site.titlePlaceholder" /></label><label>{{ site.seoDescriptionLabel }}<textarea v-model="draft.seoDescription" rows="2" maxlength="300" :placeholder="postSummary(draft.content)" /></label></details>
						<details v-if="editingId" class="revision-panel"><summary>{{ site.revisionsLabel }} · {{ revisions.length }}</summary><p v-if="!revisions.length">{{ site.noRevisionsLabel }}</p><ol v-else><li v-for="revision in revisions" :key="revision.id"><time :datetime="revision.createdAt">{{ formatDate(revision.createdAt.slice(0, 10)) }}</time><span>{{ revision.title }}</span><button type="button" class="text-action" @click="restoreRevision(revision)">{{ site.restoreLabel }}</button></li></ol></details>
					</aside>
					<section class="editor-writing-area">
						<MdxEditor v-model="draft.content" :placeholder="site.markdownPlaceholder" :locale="language" />
					</section>
				</div>
				<p v-if="editorError" class="form-error">{{ editorError }}</p>
				<div class="full-editor-actions"><button v-if="editingId" class="delete-button" type="button" @click="deletePost">{{ site.deleteLabel }}</button><button class="outline-button" type="button" :disabled="busy" @click="savePost('draft')">{{ site.draftLabel }}</button><p v-if="autosaveStatus" class="autosave-status" aria-live="polite">{{ autosaveStatus }}</p><span class="editor-action-spacer"></span><button class="quiet-button" type="button" @click="cancelEditor">{{ site.cancelLabel }}</button><button class="primary-button" :disabled="busy">{{ busy ? site.savingLabel : draft.status === 'scheduled' ? site.scheduledLabel : site.saveLabel }} <span aria-hidden="true">↗</span></button></div>
			</form>
		</Teleport>

		<div v-if="settingsOpen" class="overlay" @click.self="settingsOpen = false">
			<section class="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
				<header class="editor-header"><div><p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.settingsLabel }}</p><h2 id="settings-title">{{ site.settingsLabel }}</h2></div><button class="dialog-close" :aria-label="currentLocale.ui.closeSettingsLabel" @click="settingsOpen = false">×</button></header>
				<p class="dialog-note settings-note">{{ site.settingsNote }}</p>
				<form @submit.prevent="saveSettings">
					<section v-for="group in siteFields" :key="group.heading" class="settings-group"><h3>{{ fieldGroupHeading(group.heading) }}</h3><div class="settings-grid"><label v-for="key in group.keys" :key="key">{{ localizedFieldLabels[key] }}<input v-model="siteDraft[key]" /></label></div></section>
					<div class="editor-actions settings-actions"><button type="button" class="quiet-button" @click="settingsOpen = false">{{ site.cancelLabel }}</button><button class="primary-button" :disabled="busy">{{ busy ? site.savingLabel : site.saveLabel }} <span aria-hidden="true">↗</span></button></div>
				</form>
			</section>
		</div>
	</div>
</template>
