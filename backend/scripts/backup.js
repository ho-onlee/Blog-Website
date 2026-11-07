const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const backendDir = path.resolve(__dirname, '..');
const projectDir = path.resolve(backendDir, '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(backendDir, 'data'));
const databasePath = path.resolve(process.env.DB_PATH || path.join(dataDir, 'seohakru.sqlite'));
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(backendDir, 'uploads'));
const backupRoot = path.resolve(process.argv[2] || process.env.BACKUP_DIR || path.join(os.homedir(), 'Seohakru Backups'));

function isWithin(parent, candidate) {
	const relativePath = path.relative(parent, candidate);
	return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}

async function createBackup() {
	if (isWithin(projectDir, backupRoot)) {
		throw new Error('Backup destination must be outside the project directory.');
	}
	await fs.access(databasePath);
	await fs.mkdir(uploadsDir, { recursive: true });
	await fs.mkdir(backupRoot, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupPath = path.join(backupRoot, `seohakru-${timestamp}`);
	const backupUploads = path.join(backupPath, 'uploads');
	await fs.mkdir(backupUploads, { recursive: true });

	const database = new Database(databasePath, { readonly: true, fileMustExist: true });
	try {
		await database.backup(path.join(backupPath, 'seohakru.sqlite'));
	} finally {
		database.close();
	}
	await fs.cp(uploadsDir, backupUploads, { recursive: true, force: true });
	console.log(`Backup created: ${backupPath}`);
}

createBackup().catch((error) => {
	console.error(`Backup failed: ${error.message}`);
	process.exitCode = 1;
});