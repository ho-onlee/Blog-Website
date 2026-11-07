<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { api, clearToken, getToken, saveToken } from './storage.js';

const MdxEditor = defineAsyncComponent(() => import('./components/MdxEditor.vue'));
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
const defaultSite = {
	blogName: 'SeoHakRu', tagline: '생각과 기록을 차분히 쌓아가는 공간입니다.',
	homeLabel: '글 모음', aboutLabel: '소개', signInLabel: '로그인', searchPlaceholder: '글 검색',
	heroEyebrow: '생각과 기록을 담습니다.', issueLabel: '호', issueNumber: '제1호', volumeLabel: '권', establishedLabel: '2026년 시작',
	journalLabel: '기록', allNotesLabel: '전체 글', aboutKicker: 'SEOHAKRU / 소개',
	welcomeLabel: '다시 오셨네요', adminAccessLabel: '관리자 로그인', loginNote: '계정에 로그인해 글을 관리하세요.',
	registrationNote: '초대 코드가 있어야 작가 계정을 만들 수 있습니다.',
	registerPrompt: '계정이 없나요? 초대 코드로 가입하세요.', loginPrompt: '이미 계정이 있나요? 로그인하세요.',
	deleteConfirm: '이 글을 삭제할까요? 삭제하면 되돌릴 수 없습니다.', uploadingLabel: '이미지 업로드 중…', uploadHint: '이미지 파일 · 최대 5MB', chooseImageLabel: '이미지 선택', removeImageLabel: '이미지 제거',
	titlePlaceholder: '글 제목을 입력하세요',
	tagsPlaceholder: '기록, 책, 일상', markdownPlaceholder: '여기에 글을 작성하세요…',
	visibilityHint: '공개가 기본 설정입니다. 비공개 글은 관리자만 볼 수 있습니다.',
	settingsNote: '홈, 소개, 메뉴와 편집 화면에 표시되는 문구를 바꿉니다.', copyrightLabel: '© 2026',
	latestLabel: '최근 글', emptyLabel: '아직 글이 없습니다. 첫 글을 기다리고 있어요.',
	editPostLabel: '글 수정', newPostLabel: '새 글 작성', aboutHeading: '이곳에 대하여',
	aboutBody: 'SeoHakRu는 오래 남기고 싶은 생각과 작은 발견을 기록하는 공간입니다.\n\n이 페이지의 문구도 관리자 설정에서 바꿀 수 있습니다.',
	footerText: '천천히, 정성껏 기록합니다.', readMoreLabel: '글 읽기', privateLabel: '비공개', adminLabel: '관리자',
	createLabel: '새 글', saveLabel: '저장', cancelLabel: '취소', deleteLabel: '삭제',
	titleLabel: '제목', coverLabel: '대표 이미지', tagsLabel: '주제', contentLabel: '본문',
	visibilityLabel: '공개 설정', publicLabel: '공개', privateOptionLabel: '비공개',
	accountLabel: '이메일 또는 계정 이름', passwordLabel: '비밀번호', inviteLabel: '초대 코드',
	signupLabel: '작가 계정 만들기', logoutLabel: '로그아웃', settingsLabel: '사이트 문구 편집',
	backLabel: '목록으로', noResultsLabel: '검색 결과가 없습니다.', savingLabel: '저장 중…', waitingLabel: '잠시만요…',
	draftLabel: '초안', scheduledLabel: '예약 게시', publishedLabel: '게시', statusLabel: '게시 상태',
	scheduleLabel: '게시 예약 시각', seoTitleLabel: '검색 결과 제목', seoDescriptionLabel: '검색 결과 설명', seoPreviewLabel: '검색 및 공유 미리보기',
	autoSaveLabel: '자동 저장', autoSavedLabel: '임시 저장됨', revisionsLabel: '수정 이력', restoreLabel: '이 버전 복원',
	restoreConfirm: '이전 버전으로 복원할까요?', noRevisionsLabel: '저장된 수정 이력이 없습니다.',
	archiveLabel: '월별 아카이브', allMonthsLabel: '전체 기간', loadMoreLabel: '더 보기', rssLabel: 'RSS 구독',
	shareLabel: '공유', copyLinkLabel: '링크 복사', copiedLabel: '링크를 복사했습니다.', readingTimeSuffix: '분 읽기',
	commentsLabel: '댓글', commentNameLabel: '이름', commentContentLabel: '댓글 내용', commentSubmitLabel: '댓글 등록',
	commentReviewNote: '댓글은 관리자 승인 후 공개됩니다.', noCommentsLabel: '첫 댓글을 남겨보세요.',
	commentPendingLabel: '승인 대기', approveLabel: '승인', rejectLabel: '반려',
	commentReceivedLabel: '댓글이 등록되었습니다. 승인 후 표시됩니다.', draftRestoredLabel: '작성 중이던 내용을 복원했습니다.',
	loadErrorLabel: '내용을 불러오지 못했습니다.',
	profileLabel: '프로필', profileHeading: '작가 프로필', displayNameLabel: '표시 이름', bioLabel: '작가 소개', profileSaveLabel: '프로필 저장',
	managePostsLabel: '게시물 관리', membersLabel: '회원 관리', analyticsLabel: '방문 통계', memberRoleLabel: '권한',
	adminRoleLabel: '관리자', authorRoleLabel: '작가', postCountLabel: '작성 글', memberJoinedLabel: '가입일',
	manageHeading: '게시물 관리', featuredLabel: '추천 글', featurePostLabel: '추천 글로 설정', unfeaturePostLabel: '추천 해제',
	relatedPostsLabel: '관련 글', viewsLabel: '조회', popularPostsLabel: '인기 글', noAnalyticsLabel: '아직 조회 데이터가 없습니다.',
	authorPostsLabel: '작성한 글', memberUpdatedLabel: '회원 권한을 변경했습니다.', profileUpdatedLabel: '프로필을 저장했습니다.'
};

const site = ref({ ...defaultSite });
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
let autosaveTimer;

const siteFields = [
	{ heading: '브랜드와 소개', keys: ['blogName', 'tagline', 'footerText'] },
	{ heading: '메뉴와 동작', keys: ['homeLabel', 'aboutLabel', 'signInLabel', 'adminLabel', 'createLabel', 'settingsLabel', 'logoutLabel', 'backLabel'] },
	{ heading: '글 목록', keys: ['heroEyebrow', 'issueLabel', 'issueNumber', 'volumeLabel', 'establishedLabel', 'journalLabel', 'allNotesLabel', 'latestLabel', 'searchPlaceholder', 'emptyLabel', 'noResultsLabel', 'readMoreLabel', 'privateLabel'] },
	{ heading: '소개 페이지', keys: ['aboutKicker', 'aboutHeading', 'aboutBody'] },
				{ heading: '글 편집과 계정', keys: ['titleLabel', 'coverLabel', 'tagsLabel', 'contentLabel', 'visibilityLabel', 'publicLabel', 'privateOptionLabel', 'saveLabel', 'cancelLabel', 'deleteLabel', 'accountLabel', 'passwordLabel', 'inviteLabel', 'signupLabel', 'welcomeLabel', 'adminAccessLabel', 'loginNote', 'registrationNote', 'registerPrompt', 'loginPrompt', 'uploadingLabel', 'uploadHint', 'chooseImageLabel', 'removeImageLabel', 'titlePlaceholder', 'tagsPlaceholder', 'markdownPlaceholder', 'visibilityHint', 'settingsNote', 'deleteConfirm', 'savingLabel', 'waitingLabel', 'copyrightLabel', 'editPostLabel', 'newPostLabel', 'draftLabel', 'scheduledLabel', 'publishedLabel', 'statusLabel', 'scheduleLabel', 'seoTitleLabel', 'seoDescriptionLabel', 'seoPreviewLabel', 'autoSaveLabel', 'autoSavedLabel', 'revisionsLabel', 'restoreLabel', 'restoreConfirm', 'noRevisionsLabel', 'archiveLabel', 'allMonthsLabel', 'loadMoreLabel', 'rssLabel', 'shareLabel', 'copyLinkLabel', 'copiedLabel', 'readingTimeSuffix', 'commentsLabel', 'commentNameLabel', 'commentContentLabel', 'commentSubmitLabel', 'commentReviewNote', 'noCommentsLabel', 'commentPendingLabel', 'approveLabel', 'rejectLabel', 'commentReceivedLabel', 'draftRestoredLabel', 'loadErrorLabel'] },
				{ heading: '작가와 관리자', keys: ['profileLabel', 'profileHeading', 'displayNameLabel', 'bioLabel', 'profileSaveLabel', 'managePostsLabel', 'membersLabel', 'analyticsLabel', 'memberRoleLabel', 'adminRoleLabel', 'authorRoleLabel', 'postCountLabel', 'memberJoinedLabel', 'manageHeading', 'featuredLabel', 'featurePostLabel', 'unfeaturePostLabel', 'relatedPostsLabel', 'viewsLabel', 'popularPostsLabel', 'noAnalyticsLabel', 'authorPostsLabel', 'memberUpdatedLabel', 'profileUpdatedLabel'] }
];

const siteFieldLabels = {
	blogName: '블로그 이름', tagline: '소개 문구', footerText: '하단 문구', homeLabel: '글 메뉴', aboutLabel: '소개 메뉴',
	signInLabel: '로그인 버튼', adminLabel: '관리자 표시', createLabel: '새 글 버튼', settingsLabel: '설정 버튼', logoutLabel: '로그아웃 버튼', backLabel: '목록으로 버튼',
	heroEyebrow: '첫 화면 작은 문구', issueLabel: '호수 표시', issueNumber: '호수', volumeLabel: '권 표시', establishedLabel: '연도 표시',
	journalLabel: '글 목록 표시', allNotesLabel: '전체 주제 버튼', latestLabel: '글 목록 제목', searchPlaceholder: '검색 안내',
	emptyLabel: '빈 목록 문구', noResultsLabel: '검색 결과 없음 문구', readMoreLabel: '글 열기 버튼', privateLabel: '비공개 표시',
	aboutKicker: '소개 페이지 작은 문구', aboutHeading: '소개 제목', aboutBody: '소개 내용', titleLabel: '제목 입력 이름',
	coverLabel: '이미지 입력 이름', tagsLabel: '주제 입력 이름', contentLabel: '본문 입력 이름', visibilityLabel: '공개 설정 이름',
	publicLabel: '공개 옵션', privateOptionLabel: '비공개 옵션', saveLabel: '저장 버튼', cancelLabel: '취소 버튼', deleteLabel: '삭제 버튼',
	accountLabel: '계정 입력 이름', passwordLabel: '비밀번호 입력 이름', inviteLabel: '초대 코드 입력 이름', signupLabel: '가입 버튼',
	welcomeLabel: '로그인 작은 문구', adminAccessLabel: '가입 작은 문구', loginNote: '로그인 안내', registrationNote: '가입 안내',
	registerPrompt: '가입 전환 버튼', loginPrompt: '로그인 전환 버튼', uploadingLabel: '업로드 중 문구', uploadHint: '업로드 안내',
	titlePlaceholder: '제목 입력 안내', tagsPlaceholder: '주제 입력 안내', markdownPlaceholder: '본문 입력 안내',
	visibilityHint: '공개 설정 안내', settingsNote: '설정 안내', deleteConfirm: '삭제 확인 문구', savingLabel: '저장 중 문구',
	waitingLabel: '대기 중 문구', copyrightLabel: '저작권 표시', editPostLabel: '글 수정 표시', newPostLabel: '새 글 작성 표시', chooseImageLabel: '이미지 선택 버튼', removeImageLabel: '이미지 제거 버튼',
	draftLabel: '초안 옵션', scheduledLabel: '예약 옵션', publishedLabel: '게시 옵션', statusLabel: '게시 상태 입력명', scheduleLabel: '예약 시간 입력명',
	seoTitleLabel: '검색 제목 입력명', seoDescriptionLabel: '검색 설명 입력명', seoPreviewLabel: '검색 미리보기 제목', autoSaveLabel: '자동 저장 중 문구', autoSavedLabel: '자동 저장 완료 문구',
	revisionsLabel: '수정 이력 제목', restoreLabel: '이력 복원 버튼', restoreConfirm: '복원 확인 문구', noRevisionsLabel: '이력 없음 문구',
	archiveLabel: '아카이브 입력명', allMonthsLabel: '전체 기간 옵션', loadMoreLabel: '더 보기 버튼', rssLabel: 'RSS 링크 이름', shareLabel: '공유 버튼',
	copyLinkLabel: '링크 복사 버튼', copiedLabel: '복사 완료 문구', readingTimeSuffix: '읽기 시간 단위', commentsLabel: '댓글 제목',
	commentNameLabel: '댓글 이름 입력명', commentContentLabel: '댓글 내용 입력명', commentSubmitLabel: '댓글 등록 버튼', commentReviewNote: '댓글 검토 안내',
	noCommentsLabel: '댓글 없음 문구', commentPendingLabel: '승인 대기 표시', approveLabel: '댓글 승인 버튼', rejectLabel: '댓글 반려 버튼',
	commentReceivedLabel: '댓글 등록 완료 문구', draftRestoredLabel: '자동 저장 복원 문구', loadErrorLabel: '불러오기 오류 문구',
	profileLabel: '프로필 메뉴', profileHeading: '프로필 제목', displayNameLabel: '표시 이름 입력명', bioLabel: '작가 소개 입력명',
	profileSaveLabel: '프로필 저장 버튼', managePostsLabel: '게시물 관리 메뉴', membersLabel: '회원 관리 메뉴', analyticsLabel: '방문 통계 메뉴',
	memberRoleLabel: '회원 권한 표시', adminRoleLabel: '관리자 권한', authorRoleLabel: '작가 권한', postCountLabel: '작성 글 수',
	memberJoinedLabel: '가입 날짜', manageHeading: '게시물 관리 제목', featuredLabel: '추천 글 표시', featurePostLabel: '추천 설정 버튼',
	unfeaturePostLabel: '추천 해제 버튼', relatedPostsLabel: '관련 글 제목', viewsLabel: '조회 수 표시', popularPostsLabel: '인기 글 제목',
	noAnalyticsLabel: '통계 없음 문구', authorPostsLabel: '작가 글 목록 제목', memberUpdatedLabel: '권한 변경 완료 문구', profileUpdatedLabel: '프로필 저장 완료 문구'
};

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
		site.value = { ...defaultSite, ...(await api('/site')) };
		setPageMeta(site.value.blogName, site.value.tagline);
	}
	catch { site.value = { ...defaultSite }; }
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
	Object.assign(siteDraft, site.value);
	settingsOpen.value = true;
}

async function saveSettings() {
	busy.value = true;
	try {
		site.value = await api('/site', { method: 'PUT', body: JSON.stringify(siteDraft) });
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
	return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatMonth(value) {
	const [year, month] = value.split('-').map(Number);
	return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(new Date(year, month - 1, 1));
}
</script>

<template>
	<div class="site-shell">
		<header class="topbar">
			<a class="wordmark" href="#home" @click.prevent="goHome">{{ site.blogName }}<span class="wordmark-dot">.</span></a>
			<nav class="main-nav" aria-label="주 메뉴">
				<button class="nav-link" :class="{ active: view === 'home' }" @click="goHome">{{ site.homeLabel }}</button>
				<button class="nav-link" :class="{ active: view === 'about' }" @click="view = 'about'">{{ site.aboutLabel }}</button>
			</nav>
			<div class="top-actions">
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
							<input v-model="searchQuery" :placeholder="site.searchPlaceholder" aria-label="글 검색" />
							<kbd>/</kbd>
						</label>
						<label class="archive-filter"><span>{{ site.archiveLabel }}</span><select v-model="selectedMonth"><option value="">{{ site.allMonthsLabel }}</option><option v-for="month in archiveMonths" :key="month" :value="month">{{ formatMonth(month) }}</option></select></label>
					</div>
					<div v-if="allTags.length" class="topic-row" aria-label="주제별 글 필터">
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
							<div v-if="admin" class="card-admin-actions"><button v-if="isAdmin" class="card-feature" :aria-label="post.featured ? site.unfeaturePostLabel : site.featurePostLabel" :title="post.featured ? site.unfeaturePostLabel : site.featurePostLabel" @click.stop="toggleFeatured(post)">{{ post.featured ? '★' : '☆' }}</button><button v-if="canEditPost(post)" class="card-edit" :aria-label="`${post.title} 수정`" title="글 수정" @click.stop="openEditor(post)">✎</button></div>
						</article>
					</div>
					<div v-else class="empty-state"><span class="empty-mark">✳</span><p>{{ searchQuery || selectedTag || selectedMonth ? site.noResultsLabel : site.emptyLabel }}</p><button v-if="admin && !searchQuery && !selectedTag && !selectedMonth" class="text-action" @click="openEditor()">{{ site.createLabel }} <span aria-hidden="true">↗</span></button></div>
					<button v-if="matchingPosts.length > visiblePosts.length" class="load-more-button" @click="postLimit += 9">{{ site.loadMoreLabel }} <span aria-hidden="true">＋</span></button>
				</section>
			</section>

			<section v-else-if="view === 'about'" class="about-view">
				<p class="eyebrow"><span class="eyebrow-rule"></span>{{ site.aboutKicker }}</p>
				<h1>{{ site.aboutHeading }}</h1>
				<div class="about-layout"><div class="about-ornament" aria-hidden="true"><span>SHR</span><i></i></div><div class="markdown-content about-copy" v-html="renderMarkdown(site.aboutBody)"></div></div>
				<button v-if="isAdmin" class="text-action about-edit" @click="openSettings">{{ site.settingsLabel }} <span aria-hidden="true">↗</span></button>
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
				<p class="analytics-range">최근 30일</p>
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
				<button class="dialog-close" aria-label="닫기" @click="authOpen = false">×</button>
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
						<header class="mdx-editor-heading"><div><span>{{ site.contentLabel }}</span><small>{{ site.visibilityHint }}</small></div><p class="autosave-status" aria-live="polite">{{ autosaveStatus }}</p></header>
						<MdxEditor v-model="draft.content" :placeholder="site.markdownPlaceholder" />
					</section>
				</div>
				<p v-if="editorError" class="form-error">{{ editorError }}</p>
				<div class="full-editor-actions"><button v-if="editingId" class="delete-button" type="button" @click="deletePost">{{ site.deleteLabel }}</button><button class="outline-button" type="button" :disabled="busy" @click="savePost('draft')">{{ site.draftLabel }}</button><span class="editor-action-spacer"></span><button class="quiet-button" type="button" @click="cancelEditor">{{ site.cancelLabel }}</button><button class="primary-button" :disabled="busy">{{ busy ? site.savingLabel : draft.status === 'scheduled' ? site.scheduledLabel : site.saveLabel }} <span aria-hidden="true">↗</span></button></div>
			</form>
		</Teleport>

		<div v-if="settingsOpen" class="overlay" @click.self="settingsOpen = false">
			<section class="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
				<header class="editor-header"><div><p class="eyebrow"><span class="eyebrow-rule"></span>사이트 설정</p><h2 id="settings-title">{{ site.settingsLabel }}</h2></div><button class="dialog-close" aria-label="설정 닫기" @click="settingsOpen = false">×</button></header>
				<p class="dialog-note settings-note">{{ site.settingsNote }}</p>
				<form @submit.prevent="saveSettings">
					<section v-for="group in siteFields" :key="group.heading" class="settings-group"><h3>{{ group.heading }}</h3><div class="settings-grid"><label v-for="key in group.keys" :key="key">{{ siteFieldLabels[key] }}<textarea v-if="key === 'aboutBody'" v-model="siteDraft[key]" rows="5" /><input v-else v-model="siteDraft[key]" /></label></div></section>
					<div class="editor-actions settings-actions"><button type="button" class="quiet-button" @click="settingsOpen = false">{{ site.cancelLabel }}</button><button class="primary-button" :disabled="busy">{{ busy ? site.savingLabel : site.saveLabel }} <span aria-hidden="true">↗</span></button></div>
				</form>
			</section>
		</div>
	</div>
</template>
