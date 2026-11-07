const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const Database = require('better-sqlite3');

let database;

async function initializeDatabase(dataDir) {
	await fs.mkdir(dataDir, { recursive: true });
	const databasePath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(dataDir, 'seohakru.sqlite');
	database = new Database(databasePath);
	database.pragma('journal_mode = WAL');
	database.exec(`
		CREATE TABLE IF NOT EXISTS documents (
			collection TEXT NOT NULL,
			document_id TEXT NOT NULL,
			position INTEGER NOT NULL,
			body TEXT NOT NULL,
			PRIMARY KEY(collection, document_id),
			UNIQUE(collection, position)
		);
		CREATE INDEX IF NOT EXISTS documents_order ON documents(collection, position);
		CREATE TABLE IF NOT EXISTS sessions (
			token_hash TEXT PRIMARY KEY,
			account_id TEXT NOT NULL,
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
		CREATE TABLE IF NOT EXISTS comment_rate_limits (
			ip_hash TEXT NOT NULL,
			created_at TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS comment_rate_window ON comment_rate_limits(ip_hash, created_at);
		CREATE TABLE IF NOT EXISTS analytics_views (
			post_id TEXT NOT NULL,
			day TEXT NOT NULL,
			visitor_hash TEXT NOT NULL,
			PRIMARY KEY(post_id, day, visitor_hash)
		);
		CREATE INDEX IF NOT EXISTS analytics_day ON analytics_views(day, post_id);
	`);

	for (const collection of ['accounts', 'posts', 'site', 'revisions', 'comments']) {
		const count = database.prepare('SELECT COUNT(*) AS count FROM documents WHERE collection = ?').get(collection).count;
		if (count > 0) continue;
		const legacyFile = path.join(dataDir, `${collection}.json`);
		let value;
		try {
			const raw = await fs.readFile(legacyFile, 'utf8');
			value = raw.trim() ? JSON.parse(raw) : collection === 'site' ? {} : [];
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
			continue;
		}
		if (collection === 'site') {
			if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
			insertDocument(collection, 'singleton', 0, value);
		} else if (Array.isArray(value)) {
			const adminRow = collection === 'posts'
				? database.prepare('SELECT body FROM documents WHERE collection = ? ORDER BY position').all('accounts').map((row) => JSON.parse(row.body)).find((account) => account.role === 'admin')
				: null;
			const insertLegacy = database.transaction((rows) => {
				rows.forEach((row, index) => {
					let document = row;
					if (collection === 'accounts') {
						document = { ...row, displayName: row.displayName || row.username, bio: row.bio || '' };
					} else if (collection === 'posts') {
						document = { ...row, authorId: row.authorId || adminRow?.id || null, status: row.status || 'published', featured: Boolean(row.featured) };
					}
					insertDocument(collection, document.id || `legacy-${index}`, index, document);
				});
			});
			insertLegacy(value);
		}
	}

	const accountRows = database.prepare('SELECT document_id, body FROM documents WHERE collection = ? ORDER BY position').all('accounts');
	const accounts = accountRows.map((row) => JSON.parse(row.body));
	const adminAccount = accounts.find((account) => account.role === 'admin');
	const updateDocument = database.prepare('UPDATE documents SET body = ? WHERE collection = ? AND document_id = ?');
	for (let index = 0; index < accountRows.length; index += 1) {
		const account = accounts[index];
		if (!account.displayName || account.bio === undefined) {
			updateDocument.run(JSON.stringify({ ...account, displayName: account.displayName || account.username, bio: account.bio || '' }), 'accounts', accountRows[index].document_id);
		}
	}
	const postRows = database.prepare('SELECT document_id, body FROM documents WHERE collection = ? ORDER BY position').all('posts');
	for (const row of postRows) {
		const post = JSON.parse(row.body);
		if (!post.authorId || post.status === undefined || post.featured === undefined) {
			updateDocument.run(JSON.stringify({
				...post,
				authorId: post.authorId || adminAccount?.id || null,
				status: post.status || 'published',
				featured: Boolean(post.featured)
			}), 'posts', row.document_id);
		}
	}

	return database;
}

function insertDocument(collection, id, position, value) {
	database.prepare(`INSERT OR IGNORE INTO documents (collection, document_id, position, body)
		VALUES (?, ?, ?, ?)`).run(collection, String(id), position, JSON.stringify(value));
}

function collectionName(file) {
	return path.basename(file, '.json');
}

function readJson(file, fallback) {
	if (!database) throw new Error('Database has not been initialized.');
	const collection = collectionName(file);
	if (collection === 'site') {
		const row = database.prepare('SELECT body FROM documents WHERE collection = ? AND document_id = ?').get(collection, 'singleton');
		return row ? JSON.parse(row.body) : fallback;
	}
	const rows = database.prepare('SELECT body FROM documents WHERE collection = ? ORDER BY position').all(collection);
	return rows.length ? rows.map((row) => JSON.parse(row.body)) : fallback;
}

function writeJson(file, value) {
	if (!database) throw new Error('Database has not been initialized.');
	const collection = collectionName(file);
	if (collection === 'site') {
		database.prepare(`INSERT INTO documents (collection, document_id, position, body) VALUES (?, ?, 0, ?)
			ON CONFLICT(collection, document_id) DO UPDATE SET body = excluded.body`).run(collection, 'singleton', JSON.stringify(value));
		return;
	}
	if (!Array.isArray(value)) throw new TypeError(`${collection} data must be an array.`);
	const replaceCollection = database.transaction((items) => {
		database.prepare('DELETE FROM documents WHERE collection = ?').run(collection);
		items.forEach((item, index) => insertDocument(collection, item.id || `row-${index}`, index, item));
	});
	replaceCollection(value);
}

function tokenDigest(token) {
	return crypto.createHash('sha256').update(token).digest('hex');
}

function storeSession(token, accountId) {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
	database.prepare(`INSERT OR REPLACE INTO sessions (token_hash, account_id, created_at, expires_at)
		VALUES (?, ?, ?, ?)`).run(tokenDigest(token), accountId, now.toISOString(), expiresAt.toISOString());
}

function getSessionAccountId(token) {
	if (!token) return null;
	const digest = tokenDigest(token);
	const session = database.prepare('SELECT account_id, expires_at FROM sessions WHERE token_hash = ?').get(digest);
	if (!session) return null;
	if (Date.parse(session.expires_at) <= Date.now()) {
		database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest);
		return null;
	}
	return session.account_id;
}

function removeSession(token) {
	if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(token));
}

function allowComment(ipHash, now, limit = 5) {
	const check = database.transaction(() => {
		const cutoff = new Date(Date.parse(now) - 60 * 60 * 1000).toISOString();
		database.prepare('DELETE FROM comment_rate_limits WHERE created_at < ?').run(cutoff);
		const count = database.prepare('SELECT COUNT(*) AS count FROM comment_rate_limits WHERE ip_hash = ? AND created_at >= ?').get(ipHash, cutoff).count;
		if (count >= limit) return false;
		database.prepare('INSERT INTO comment_rate_limits (ip_hash, created_at) VALUES (?, ?)').run(ipHash, now);
		return true;
	});
	return check();
}

function recordView(postId, day, visitorHash) {
	return database.prepare('INSERT OR IGNORE INTO analytics_views (post_id, day, visitor_hash) VALUES (?, ?, ?)').run(postId, day, visitorHash).changes > 0;
}

function getAnalytics(sinceDay) {
	return database.prepare(`SELECT d.body AS post, COUNT(v.visitor_hash) AS views
		FROM analytics_views v JOIN documents d ON d.collection = 'posts' AND d.document_id = v.post_id
		WHERE v.day >= ? GROUP BY v.post_id ORDER BY views DESC LIMIT 20`).all(sinceDay).map((row) => ({
		post: JSON.parse(row.post),
		views: row.views
	}));
}

module.exports = { initializeDatabase, readJson, writeJson, storeSession, getSessionAccountId, removeSession, allowComment, recordView, getAnalytics };
