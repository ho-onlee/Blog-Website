const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

async function countFiles(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	let count = 0;
	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		count += entry.isDirectory() ? await countFiles(entryPath) : 1;
	}
	return count;
}

async function findBackupDatabase(backupPath) {
	for (const name of ['database.sqlite', 'seohakru.sqlite']) {
		const candidate = path.join(backupPath, name);
		try {
			await fs.access(candidate);
			return candidate;
		} catch {}
	}
	throw new Error('Backup is missing its SQLite database file.');
}

async function verifyBackup() {
	const backupPath = process.argv[2] && path.resolve(process.argv[2]);
	if (!backupPath) throw new Error('Usage: npm run backup:verify -- <backup-directory>');

	const backupDatabase = await findBackupDatabase(backupPath);
	const backupUploads = path.join(backupPath, 'uploads');
	await fs.access(backupUploads);
	const temporaryRestore = await fs.mkdtemp(path.join(os.tmpdir(), 'site-restore-'));
	let database;
	try {
		const restoredDatabase = path.join(temporaryRestore, 'database.sqlite');
		const restoredUploads = path.join(temporaryRestore, 'uploads');
		await fs.copyFile(backupDatabase, restoredDatabase);
		await fs.cp(backupUploads, restoredUploads, { recursive: true });

		database = new Database(restoredDatabase, { readonly: true, fileMustExist: true });
		const integrity = database.pragma('integrity_check');
		if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
			throw new Error('Restored database failed SQLite integrity_check.');
		}
		const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
		if (!tables.includes('documents')) throw new Error('Restored database is missing the documents table.');
		database.close();
		database = null;

		const [backupFileCount, restoredFileCount] = await Promise.all([
			countFiles(backupUploads),
			countFiles(restoredUploads)
		]);
		if (backupFileCount !== restoredFileCount) throw new Error('Restored uploads file count does not match the backup.');
		console.log(`Restore test passed: database integrity is ok; ${restoredFileCount} upload file(s) copied.`);
	} finally {
		database?.close();
		await fs.rm(temporaryRestore, { recursive: true, force: true });
	}
}

verifyBackup().catch((error) => {
	console.error(`Restore test failed: ${error.message}`);
	process.exitCode = 1;
});