<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { api, clearToken, getToken, saveToken } from './storage.js';
import englishLocale from './locales/en.json';
import koreanLocale from './locales/ko.json';
import SiteHeader from './components/SiteHeader.vue';
import HomeView from './components/HomeView.vue';
import ManagementViews from './components/ManagementViews.vue';
import PostReader from './components/PostReader.vue';
import AuthDialog from './components/AuthDialog.vue';
import SiteSettingsDialog from './components/SiteSettingsDialog.vue';
import { useAiFeatures } from './composables/useAiFeatures.js';

const WriterEditor = defineAsyncComponent(() => import('./components/WriterEditor.vue'));
const markdown = new MarkdownIt({ html: true, linkify: true, typographer: true });
// Keep interface translations in JSON so contributors can edit them without changing Vue code.
const locales = reactive({ en: englishLocale, ko: koreanLocale });
const localeNames = reactive({ en: 'English', ko: '한국어' });
const defaultSite = koreanLocale.site;

const languageStorageKey = 'seohakru_language';
// Prefer the browser's first system locale; an explicit saved choice takes priority.
const systemLocale = navigator.languages?.[0] || navigator.language || '';
const systemLanguage = systemLocale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
const savedLanguage = localStorage.getItem(languageStorageKey);
const language = ref(savedLanguage === 'ko' ? 'ko' : savedLanguage === 'en' ? 'en' : systemLanguage);
const currentLocale = computed(() => locales[language.value] || locales.en);
const availableLanguages = computed(() => Object.keys(locales).map((code) => ({
	code,
	name: code === 'en' ? currentLocale.value.ui.languageEnglishName : code === 'ko' ? currentLocale.value.ui.languageKoreanName : localeNames[code]
})));
const savedSite = ref({ ...defaultSite });
const siteReady = ref(false);
const siteNameManagedByEnv = computed(() => savedSite.value.siteNameManagedByEnv === true);
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
	document.documentElement.lang = value;
});
document.documentElement.lang = language.value;

function mergeTranslations(base, overrides) {
	return Object.fromEntries(Object.entries(base).map(([key, value]) => {
		const replacement = Object.hasOwn(overrides, key) ? overrides[key] : undefined;
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			return [key, mergeTranslations(value, replacement && typeof replacement === 'object' && !Array.isArray(replacement) ? replacement : {})];
		}
		return [key, typeof replacement === 'string' ? replacement : value];
	}));
}

async function loadLocales() {
	try {
		const customLocales = await api('/locales');
		for (const [code, translation] of Object.entries(customLocales)) {
			if (!translation || typeof translation !== 'object' || Array.isArray(translation)) continue;
			locales[code] = mergeTranslations(code === 'ko' ? koreanLocale : englishLocale, translation);
			localeNames[code] = typeof translation.name === 'string' && translation.name.trim() ? translation.name.trim() : code;
		}
		const preferred = (savedLanguage || systemLocale).toLowerCase();
		const preferredBase = preferred.split('-')[0];
		if (Object.hasOwn(locales, preferred)) language.value = preferred;
		else if (Object.hasOwn(locales, preferredBase)) language.value = preferredBase;
	} catch {}
}

const posts = ref([]);
const homePosts = ref([]);
const homeTotal = ref(0);
const homeHasMore = ref(false);
const homeLoading = ref(false);
const homeError = ref('');
const homeTags = ref([]);
const homeMonths = ref([]);
const admin = ref(null);
const authorPage = ref(null);
const members = ref([]);
const analytics = ref({ rangeStart: '', popularPosts: [] });
const view = ref('home');
const selectedPostId = ref(null);
const searchQuery = ref('');
const selectedTag = ref('');
const selectedMonth = ref('');
const authOpen = ref(false);
const authMode = ref('login');
const authError = ref('');
const notification = ref('');
const busy = ref(false);
const settingsOpen = ref(false);
const editorError = ref('');
const uploadBusy = ref(false);
const autosaveStatus = ref('');
const revisions = ref([]);
const comments = ref([]);
const commentNotice = ref('');
const shareStatus = ref('');
const commentDraft = reactive({ content: '', website: '' });
const profileDraft = reactive({ displayName: '', bio: '' });
const authDraft = reactive({ username: '', password: '', inviteCode: '' });
const siteDraft = reactive({ ...defaultSite });
const draft = reactive({ title: '', coverImage: '', tags: '', content: '', visibility: 'public', status: 'published', scheduledAt: '', seoTitle: '', seoDescription: '' });
const editingId = ref(null);
const editorReturnView = ref('home');
const theme = ref(localStorage.getItem('seohakru_theme') === 'dark' ? 'dark' : 'light');
let autosaveTimer;
let notificationTimer;

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
		heading: 'brand',
		keys: ['blogName', 'tagline', 'footerText']
	},
	{
		heading: 'menu',
		keys: ['homeLabel', 'signInLabel', 'adminLabel', 'createLabel', 'settingsLabel', 'logoutLabel', 'backLabel']
	},
	{
		heading: 'posts',
		keys: ['heroEyebrow', 'issueLabel', 'issueNumber', 'volumeLabel', 'establishedLabel', 'journalLabel', 'allNotesLabel', 'latestLabel', 'searchPlaceholder', 'emptyLabel', 'noResultsLabel', 'readMoreLabel', 'privateLabel']
	},
	{
		heading: 'writing',
		keys: ['titleLabel', 'coverLabel', 'tagsLabel', 'visibilityLabel', 'publicLabel', 'privateOptionLabel', 'saveLabel', 'cancelLabel', 'deleteLabel', 'accountLabel', 'passwordLabel', 'inviteLabel', 'signupLabel', 'welcomeLabel', 'adminAccessLabel', 'loginNote', 'registrationNote', 'registerPrompt', 'loginPrompt', 'uploadingLabel', 'uploadHint', 'chooseImageLabel', 'removeImageLabel', 'titlePlaceholder', 'tagsPlaceholder', 'markdownPlaceholder', 'settingsNote', 'deleteConfirm', 'savingLabel', 'waitingLabel', 'copyrightLabel', 'editPostLabel', 'newPostLabel', 'draftLabel', 'scheduledLabel', 'publishedLabel', 'statusLabel', 'scheduleLabel', 'seoTitleLabel', 'seoDescriptionLabel', 'seoPreviewLabel', 'autoSaveLabel', 'autoSavedLabel', 'revisionsLabel', 'restoreLabel', 'restoreConfirm', 'noRevisionsLabel', 'archiveLabel', 'allMonthsLabel', 'loadMoreLabel', 'rssLabel', 'shareLabel', 'copyLinkLabel', 'copiedLabel', 'readingTimeSuffix', 'commentsLabel', 'commentLoginPrompt', 'commentContentLabel', 'commentSubmitLabel', 'commentDeleteConfirm', 'commentDeletedLabel', 'noCommentsLabel', 'commentReceivedLabel', 'draftRestoredLabel', 'loadErrorLabel']
	},
	{
		heading: 'authors',
		keys: ['profileLabel', 'profileHeading', 'displayNameLabel', 'bioLabel', 'profileSaveLabel', 'managePostsLabel', 'membersLabel', 'analyticsLabel', 'memberRoleLabel', 'adminRoleLabel', 'authorRoleLabel', 'postCountLabel', 'memberJoinedLabel', 'manageHeading', 'featuredLabel', 'featurePostLabel', 'unfeaturePostLabel', 'relatedPostsLabel', 'viewsLabel', 'popularPostsLabel', 'noAnalyticsLabel', 'authorPostsLabel', 'memberUpdatedLabel', 'profileUpdatedLabel']
	}
];

const selectedPost = computed(() => posts.value.find((post) => post.id === selectedPostId.value));
const isAdmin = computed(() => admin.value?.role === 'admin');
const aiFeatures = useAiFeatures({ currentLocale, language, savedSite, draft });
const {
	aiConfig, aiStatus, aiSettingsError, aiSettingsNotice, aiSettingsBusy,
	aiAction, aiTargetLanguage, aiSuggestion, aiAssistantError, aiAssistantBusy, aiMetadataBusy, aiMetadataError,
	archiveQuestion, archiveAnswer, archiveCitations, archiveBusy,
	loadAiSettings, changeAiProvider, checkAiStatus, saveAiSettings, runAiAction,
	useAiSuggestion, dismissAiSuggestion, resetAiWriting, generateAiMetadata, askPublicArchive
} = aiFeatures;
const authoredPostCount = computed(() => posts.value.filter((post) => post.authorId === admin.value?.id).length);
const relatedPosts = computed(() => {
	if (!selectedPost.value) return [];
	const tags = new Set(selectedPost.value.tags || []);
	return [...posts.value, ...homePosts.value].filter((post, index, list) => list.findIndex((item) => item.id === post.id) === index && post.id !== selectedPost.value.id && isPublicEntry(post) && (post.tags || []).some((tag) => tags.has(tag))).slice(0, 3);
});
const allTags = computed(() => [...new Set([...homeTags.value, ...posts.value.filter((post) => admin.value || post.visibility === 'public').flatMap((post) => post.tags || [])])]);
const matchingPosts = computed(() => homePosts.value);
const visiblePosts = computed(() => homePosts.value);
const archiveMonths = computed(() => homeMonths.value);
let homeSearchTimer;
let homeRequestId = 0;

watch([searchQuery, selectedTag, selectedMonth], ([query, tag, month], [previousQuery, previousTag, previousMonth]) => {
	clearTimeout(homeSearchTimer);
	const delay = query !== previousQuery && tag === previousTag && month === previousMonth ? 250 : 0;
	homeSearchTimer = setTimeout(() => loadHomePosts(true), delay);
});

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
	return String(value || '').replace(/```[\s\S]*?```/g, '').replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, '[image]').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_~`-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 130);
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
	let favicon = document.head.querySelector('link[rel="icon"]');
	if (!favicon) {
		favicon = document.createElement('link');
		favicon.rel = 'icon';
		document.head.append(favicon);
	}
	favicon.href = site.value.faviconUrl || '/favicon.svg';
}

async function loadSite() {
	try {
		savedSite.value = { ...defaultSite, ...(await api('/site')) };
		if (['이미지 파일 · 최대 5MB', 'Image file · up to 5 MB'].includes(savedSite.value.uploadHint)) savedSite.value.uploadHint = defaultSite.uploadHint;
	}
	catch { savedSite.value = { ...defaultSite }; }
}

async function loadPosts() {
	try { posts.value = await api('/posts'); }
	catch { posts.value = []; }
}

async function loadHomePosts(reset = false) {
	if (homeLoading.value && !reset) return;
	const requestId = ++homeRequestId;
	const offset = reset ? 0 : homePosts.value.length;
	if (reset) {
		homePosts.value = [];
		homeHasMore.value = false;
	}
	homeLoading.value = true;
	homeError.value = '';
	const params = new URLSearchParams({ limit: '9', offset: String(offset) });
	if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim());
	if (selectedTag.value) params.set('tag', selectedTag.value);
	if (selectedMonth.value) params.set('month', selectedMonth.value);
	try {
		const result = await api(`/home?${params}`);
		if (requestId !== homeRequestId) return;
		homePosts.value = reset ? result.posts : [...homePosts.value, ...result.posts];
		homeTotal.value = result.total;
		homeHasMore.value = result.hasMore;
		homeTags.value = result.tags;
		homeMonths.value = result.months;
	} catch (error) {
		if (requestId === homeRequestId) homeError.value = error.message;
	} finally {
		if (requestId === homeRequestId) homeLoading.value = false;
	}
}

function loadMoreHomePosts() {
	if (homeError.value) return loadHomePosts(true);
	if (homeHasMore.value && !homeLoading.value) loadHomePosts();
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

async function deleteProfile() {
	if (!window.confirm(site.value.deleteAccountConfirm)) return;
	try {
		await api('/profile', { method: 'DELETE' });
		clearToken();
		admin.value = null;
		view.value = 'home';
		await Promise.all([loadPosts(), loadHomePosts(true)]);
		window.scrollTo({ top: 0 });
	} catch (error) {
		window.alert(error.message);
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

async function deleteMember(member) {
	const confirmation = site.value.memberDeleteConfirm.replace('{name}', member.displayName || member.username);
	if (!window.confirm(confirmation)) return;
	try {
		await api(`/members/${member.id}`, { method: 'DELETE' });
		if (member.id === admin.value.id) {
			clearToken();
			admin.value = null;
			view.value = 'home';
			await Promise.all([loadPosts(), loadHomePosts(true)]);
			window.scrollTo({ top: 0 });
		} else {
			await loadMembers();
		}
	} catch (error) {
		window.alert(error.message);
	}
}

async function toggleFeatured(post) {
	try {
		await api(`/posts/${post.id}/featured`, { method: 'PATCH', body: JSON.stringify({ featured: !post.featured }) });
		await Promise.all([loadPosts(), loadHomePosts(true)]);
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
	await Promise.all([loadSite(), loadLocales(), loadHomePosts(true)]);
	setPageMeta(site.value.blogName, site.value.tagline);
	siteReady.value = true;
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
	window.addEventListener('popstate', syncLocation);
	syncLocation();
});

onBeforeUnmount(() => {
	window.removeEventListener('popstate', syncLocation);
	clearTimeout(autosaveTimer);
	clearTimeout(notificationTimer);
});

function openAuth(mode = 'login') {
	authMode.value = mode;
	authError.value = '';
	authOpen.value = true;
}

function showErrorNotification(message) {
	notification.value = message;
	clearTimeout(notificationTimer);
	notificationTimer = window.setTimeout(() => {
		notification.value = '';
	}, 7000);
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
		await Promise.all([loadPosts(), loadHomePosts(true)]);
	} catch (error) {
		authError.value = error.message;
		showErrorNotification(error.message);
	} finally {
		busy.value = false;
	}
}

async function logout() {
	try { await api('/auth/logout', { method: 'POST' }); } catch { /* Local sign-out still works offline. */ }
	clearToken();
	view.value = 'home';
	admin.value = null;
	await Promise.all([loadPosts(), loadHomePosts(true)]);
}

function openEditor(post = null) {
	resetAiWriting();
	editorReturnView.value = view.value === 'entry' ? 'entry' : view.value === 'editor' ? editorReturnView.value : view.value;
	editingId.value = post?.id || null;
	const initialDraft = post ? {
		title: post.title,
		coverImage: post.coverImage,
		coverThumbnail: post.coverThumbnail || '',
		tags: (post.tags || []).join(', '),
		content: post.content,
		visibility: post.visibility || 'public',
		status: post.status || 'published',
		scheduledAt: toLocalDateTime(post.scheduledAt),
		seoTitle: post.seoTitle || '',
		seoDescription: post.seoDescription || ''
	} : { title: '', coverImage: '', coverThumbnail: '', tags: '', content: '', visibility: 'public', status: 'published', scheduledAt: '', seoTitle: '', seoDescription: '' };
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
	resetAiWriting();
	view.value = editorReturnView.value;
	window.scrollTo({ top: 0 });
}

async function savePost(statusOverride = null) {
	if (busy.value || uploadBusy.value) return;
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
		await Promise.all([loadPosts(), loadHomePosts(true)]);
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
			coverThumbnail: post.coverThumbnail || '',
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
		await api(`/posts/${selectedPost.value.id}/comments`, {
			method: 'POST',
			body: JSON.stringify({ content: commentDraft.content, website: commentDraft.website })
		});
		commentNotice.value = site.value.commentReceivedLabel;
		commentDraft.content = '';
		commentDraft.website = '';
		await loadComments(selectedPost.value.id);
	} catch (error) {
		commentNotice.value = error.message;
	}
}

async function deleteComment(comment) {
	if (!window.confirm(site.value.commentDeleteConfirm)) return;
	try {
		await api(`/comments/${comment.id}`, { method: 'DELETE' });
		if (selectedPost.value) await loadComments(selectedPost.value.id);
		commentNotice.value = site.value.commentDeletedLabel;
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
		await Promise.all([loadPosts(), loadHomePosts(true)]);
	} catch (error) {
		editorError.value = error.message;
	} finally {
		busy.value = false;
	}
}

async function uploadCover(event) {
	const file = event.target.files?.[0];
	if (!file) return;
	if (uploadBusy.value || busy.value) {
		event.target.value = '';
		return;
	}
	uploadBusy.value = true;
	editorError.value = '';
	const form = new FormData();
	form.append('image', file);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 120000);
	try {
		const result = await api('/uploads', { method: 'POST', body: form, signal: controller.signal });
		draft.coverImage = result.url;
		draft.coverThumbnail = result.thumbnailUrl || result.url;
	} catch (error) {
		editorError.value = error.name === 'AbortError' ? currentLocale.value.mdx['uploadImage.uploadError'] : error.message;
	} finally {
		clearTimeout(timeout);
		uploadBusy.value = false;
		event.target.value = '';
	}
}

function openSettings() {
	Object.assign(siteDraft, savedSite.value);
	aiSettingsError.value = '';
	aiSettingsNotice.value = '';
	settingsOpen.value = true;
	if (isAdmin.value) loadAiSettings();
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

async function readPost(post, updateHistory = true) {
	if (!Object.hasOwn(post, 'content')) {
		try {
			post = await api(`/posts/${post.id}`);
			const existingIndex = posts.value.findIndex((item) => item.id === post.id);
			if (existingIndex < 0) posts.value.push(post);
			else posts.value[existingIndex] = post;
		} catch (error) {
			showErrorNotification(error.message);
			return;
		}
	}
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

async function syncLocation() {
	if (view.value === 'editor') return;
	const search = new URLSearchParams(window.location.search);
	const postId = search.get('post');
	let post = postId && posts.value.find((item) => item.id === postId);
	if (postId && !post) {
		try {
			post = await api(`/posts/${postId}`);
		} catch {
			post = null;
		}
	}
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
	loadHomePosts(true);
	const url = new URL(window.location.href);
	url.searchParams.delete('post');
	url.searchParams.delete('author');
	window.history.pushState({}, '', url);
	setPageMeta(site.value.blogName, site.value.tagline);
}

function formatDate(value) {
	const locale = Intl.DateTimeFormat.supportedLocalesOf([language.value])[0] || 'en-US';
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
	if (!value) return '';
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
	const locale = Intl.DateTimeFormat.supportedLocalesOf([language.value])[0] || 'en-US';
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}

function formatMonth(value) {
	const [year, month] = value.split('-').map(Number);
	const locale = Intl.DateTimeFormat.supportedLocalesOf([language.value])[0] || 'en-US';
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, month - 1, 1));
}

const app = reactive({
	site, currentLocale, language, availableLanguages, theme, themeToggleLabel, admin, isAdmin, authoredPostCount,
	view, posts, homePosts, homeTotal, homeHasMore, homeLoading, homeError, authorPage, members, analytics, selectedPost, relatedPosts, allTags, matchingPosts, visiblePosts, archiveMonths,
	searchQuery, selectedTag, selectedMonth, selectedPostId, comments, commentNotice, commentDraft, shareStatus,
	profileDraft, siteDraft, siteFields, localizedFieldLabels, fieldGroupHeading, busy, siteNameManagedByEnv,
	settingsOpen, authOpen, authMode, authError, authDraft, editorError, uploadBusy, autosaveStatus, revisions, editingId, draft,
	aiConfig, aiStatus, aiSettingsError, aiSettingsNotice, aiSettingsBusy, aiAction, aiTargetLanguage, aiSuggestion,
	aiAssistantError, aiAssistantBusy, aiMetadataBusy, aiMetadataError, archiveQuestion, archiveAnswer, archiveCitations, archiveBusy,
	goHome, toggleTheme, openProfile, openPostManager, openMembers, openAnalytics, openSettings, logout, openEditor, openAuth, submitAuth, loadMoreHomePosts,
	readPost, readAuthor: openAuthor, renderMarkdown, formatDate, formatDateTime, formatMonth, readingMinutes, postSummary, canEditPost, toggleFeatured,
	saveProfile, deleteProfile, updateMemberRole, deleteMember, savePost, cancelEditor, deletePost, uploadCover, restoreRevision, sharePost, submitComment,
	deleteComment, saveSettings, loadAiSettings, checkAiStatus, changeAiProvider, saveAiSettings, runAiAction,
	useAiSuggestion, dismissAiSuggestion, generateAiMetadata, askPublicArchive, isPublicEntry
});
</script>

<template>
	<div v-if="siteReady" class="site-shell" :inert="uploadBusy">
		<SiteHeader :app="app" />
		<div v-if="notification" class="top-notification" role="alert" aria-live="assertive">
			<span>{{ notification }}</span>
			<button type="button" :aria-label="currentLocale.ui.closeDialogLabel" @click="notification = ''; clearTimeout(notificationTimer)">×</button>
		</div>

		<main>
			<HomeView v-if="view === 'home'" :app="app" />

			<ManagementViews v-else-if="['profile', 'author', 'members', 'manage-posts', 'analytics'].includes(view)" :app="app" />

			<PostReader v-else-if="view === 'entry' && selectedPost" :app="app" />
			<section v-else-if="view !== 'editor'" class="empty-state lost-state"><p>{{ site.noResultsLabel }}</p><button class="text-action" @click="goHome">{{ site.backLabel }} <span aria-hidden="true">↗</span></button></section>
			<div id="editor-page"></div>
		</main>

		<footer class="site-footer"><a class="footer-mark" href="#home" @click.prevent="goHome">{{ site.blogName }}<span>.</span></a><p>{{ site.footerText }}</p><a class="rss-link" href="/feed.xml">{{ site.rssLabel }}</a><span class="footer-year">{{ site.copyrightLabel }}</span></footer>

		<AuthDialog :app="app" />

		<WriterEditor :app="app" />
		<SiteSettingsDialog :app="app" />
	</div>
	<div v-else class="site-loading" role="status">{{ currentLocale.site.waitingLabel }}</div>
</template>
