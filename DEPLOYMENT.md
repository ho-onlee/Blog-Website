# Public Deployment

## Site Name and Favicon

Set `SITE_NAME` in `.env` or Portainer to choose the site name; the neutral fresh-install default is `website`. When `SITE_NAME` is set, it overrides any saved database name and the admin site-name field is locked. If it is empty, the saved site name is preserved.

## Settings Folder

Compose mounts `SETTINGS_HOST_PATH` read-only into the API. It defaults to `./settings` with `compose.yaml` and `/opt/website/settings` with the Portainer stack files. Local development also reads the project `settings` folder. Create the directory on the Docker host and ensure the container can read it. Changes take effect after a browser refresh; no image rebuild is required.

- Place `favicon.png`, `favicon.ico`, or `favicon.svg` in the folder to replace the bundled favicon. If more than one exists, PNG takes priority, followed by ICO and SVG. Leave `FAVICON_URL` empty to use this file; an explicitly set `FAVICON_URL` takes precedence. Remove an existing `/favicon.svg` value from `.env` or Portainer to enable the mounted favicon.
- Place translation overrides in `locales/en.json` or `locales/ko.json`. Files may contain only the keys to change; unspecified keys use the bundled language. Content customized in the admin site settings remains unchanged.
- Add a language with a lowercase BCP 47 filename such as `locales/fr.json` or `locales/pt-br.json`. Add a top-level `name` for the language selector and the same translation sections as the English file. Missing keys fall back to English. For example:

```json
{
	"name": "Francais",
	"site": { "signInLabel": "Connexion" },
	"mdx": { "toolbar.image": "Inserer une image" }
}
```

The bundled translation files in `frontend/src/locales` provide the full list of keys. Locale files and the favicon are public: do not put credentials or private content in them. Back up the settings folder separately from the database and uploads.

## Signup Secret

Copy `.env.example` to `.env`, then set `SIGNUP_CODE` to a private, non-empty invitation code. Production requires it to be set but does not impose a minimum length. For a stronger random value, you can generate one with:

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Compose refuses to start without a value, and the production API refuses an empty code. Keep `.env` private and never commit it. The first account registered against an empty database becomes the administrator, so bind the site to localhost or keep it behind a firewall until that account is created. Set `PUBLIC_URL` to the final HTTPS URL for canonical RSS/sitemap links; when unset, they use the forwarded request host and protocol.

## AI Providers

The Compose files build a separate CPU-only Ollama container. `AI_PROVIDER=ollama` and `AI_MODEL=qwen2.5:3b` are the defaults. On first startup, Ollama downloads the selected model into a persistent Docker volume, or into `OLLAMA_HOST_PATH` when set; allow time, disk space, and RAM for the download and inference. Port `11434` is internal to the Compose network and is not published.

The admin AI settings can switch among Ollama, OpenAI, Anthropic, and Gemini when the selected provider is configured. Set paid-provider API keys only in `.env` for local Compose or in Portainer's stack environment. Keys stay in the API container and are never stored in the database or returned to the frontend. Set `AI_MODEL` to choose the initial model; the admin model field can override it. Provider-specific model defaults can be set with `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `GEMINI_MODEL`.

The public archive Q&A feature is disabled by default; enable it in AI settings only after checking its rate limit and possible inference costs. Writer AI requests are capped at 30 per account per hour. Public questions are capped at 10 per client IP per hour. Set `TRUST_PROXY` to your private proxy ranges if you use a reverse proxy, so the forwarded visitor IP is used for limits. Do not set it to `*` or `true` unless every request is guaranteed to pass through a trusted proxy.

## Move Data and Models to a Mounted Drive

Set `DATA_HOST_PATH` and `OLLAMA_HOST_PATH` to absolute directories on the Docker host, for example `/mnt/storage/website/data` and `/mnt/storage/website/ollama`. These must be on the actual mounted filesystem, not merely an empty directory on the system disk; on Linux, check with `findmnt -T /mnt/storage`. Ensure the drive is mounted before starting the stack and that Docker can write to both directories. SQLite uses WAL, so keep its data on a local filesystem with working locking and shared memory (such as ext4 or XFS), not an NFS or SMB share.

Changing a path does not move existing data. To migrate an existing deployment:

1. Make and verify a backup using the commands below. Keep the existing data and Docker volume until the new deployment is verified.
2. On the Docker host, create empty target directories. Stop the API and AI containers, then copy their existing contents, including SQLite sidecar files. For a local Compose deployment, from the project directory:

	```sh
	mkdir -p /mnt/storage/website/data /mnt/storage/website/ollama
	docker compose stop api ai
	docker cp "$(docker compose ps -aq api):/app/data/." /mnt/storage/website/data/
	docker cp "$(docker compose ps -aq ai):/root/.ollama/." /mnt/storage/website/ollama/
	```

	For Portainer, stop the API and AI containers, then use `docker cp <api-container-name>:/app/data/. /mnt/storage/website/data/` and `docker cp <ai-container-name>:/root/.ollama/. /mnt/storage/website/ollama/` on the Docker host. Leave the containers stopped until the paths are updated. Do not copy into the existing source directories.
3. Set `DATA_HOST_PATH` and `OLLAMA_HOST_PATH` in `.env` for local Compose, or in the Portainer stack environment. Keep `DB_NAME` set to the existing database filename. Redeploy the stack (`docker compose up -d` for local Compose).
4. Confirm the site shows its existing content, the model works, and both containers use the new mounts. Verify backups still work. The old Docker volume still consumes space; only remove it after verification and after confirming no other container uses it. Do not use `docker volume prune`.

Uploads and backups use separate paths; changing the database path does not move them. Keep backups on separate storage where possible.

## Backups

Compose mounts `HOST_BACKUP_DIR` outside the project into `/backups`; by default it uses a sibling `blog-backups` directory. Choose a durable host path in `.env` if needed. Run regular backups from the project directory:

```sh
docker compose exec -T api npm run backup
```

Each backup contains a SQLite online-backup snapshot and a copy of uploaded images. The command prints its timestamped backup directory. To test restoration without changing the live database or uploads:

```sh
docker compose exec -T api npm run backup:verify -- /backups/site-backup-<timestamp>
```

The verification command copies the snapshot to a temporary directory, runs SQLite `integrity_check`, and checks that all upload files copied. It also accepts legacy snapshots containing `seohakru.sqlite`. Schedule the backup command daily with the host's scheduler, and periodically copy the backup directory to a separate device or storage provider. For recovery, stop the API, restore `database.sqlite` to the data directory using the filename configured by `DB_NAME`, restore the matching `uploads` directory, then restart the API.

## Portainer Git Stack

This stack targets a Portainer **Docker Standalone** environment. It uses absolute host directories for persistent SQLite data, uploads, and backups; it does not depend on Portainer Business Edition relative-path volumes.

The configured remote is `https://github.com/ho-onlee/Seohakru.website.git`, branch `main`. Keep this repository private: the initial commit contains `backend/data` account, post, and SQLite files. Ignore rules and current deletions do not remove data from Git history. Portainer can deploy from a private repository; do not make it public unless the history is scrubbed first.

1. Commit and push the Portainer stack file and these instructions to `main`. For a private repository, configure Git credentials in Portainer; do not put a GitHub token in this repository.
2. On the Docker host, create writable directories, for example `/opt/website/data`, `/opt/website/uploads`, and `/mnt/backups/website`, plus a readable `/opt/website/settings` directory. Create a model directory too if setting `OLLAMA_HOST_PATH`.
3. If migrating an existing site, copy its SQLite database file and matching `uploads` contents into the persistent directories before deploying. Set `DB_NAME` to the copied SQLite filename. Leave the data directory empty for a fresh site; `site.sqlite` is the default filename.
4. In Portainer, choose **Stacks → Add stack → Git Repository**. Set the repository URL above and reference `refs/heads/main`. Use the default Compose path `docker-compose.yml` (or explicitly enter that filename).
5. Add these stack environment variables in Portainer:

	- `SIGNUP_CODE`: a private, non-empty invitation code; no minimum length is enforced.
	- `PUBLIC_URL`: optional canonical public HTTPS URL, such as `https://blog.example.com`; if unset, RSS and sitemap use forwarded request host/protocol.
	- `DATA_HOST_PATH`: optional absolute data directory; defaults to `/opt/website/data`.
	- `SETTINGS_HOST_PATH`: optional absolute settings directory; defaults to `/opt/website/settings`.
	- `OLLAMA_HOST_PATH`: optional absolute model directory; defaults to the existing Docker volume.
	- `DB_NAME`: SQLite filename in the data directory; defaults to `site.sqlite`.
	- `UPLOADS_HOST_PATH`: optional absolute uploads directory; defaults to `/opt/website/uploads`.
	- `BACKUP_HOST_PATH`: optional absolute backup directory; defaults to `/opt/website/backups`, preferably on separate storage.
	- `WEB_PORT`: optional host port for the HTTP web container; defaults to `8080`.
	- `SITE_NAME`: optional site-name override; the fresh-install fallback is `website`.
	- `FAVICON_URL`: optional favicon path or absolute URL; overrides the settings folder favicon when set.
	- `AI_PROVIDER`: optional default provider (`ollama`, `openai`, `anthropic`, or `gemini`); defaults to `ollama`.
	- `AI_MODEL`: optional default model; defaults to `qwen2.5:3b` and is also pulled by the local Ollama service.
	- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`: optional paid-provider secrets. Only configure providers you intend to use.
	- `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`: optional model defaults for those providers.
	- `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_INPUT_CHARS`: optional request timeout and input-length limits.
	- `TRUST_PROXY`: optional comma-separated trusted proxy ranges; keep it limited to the Docker/private proxy network.

6. Deploy the stack and configure your TLS reverse proxy to forward the domain to the Docker host on `WEB_PORT`. Keep the API port private; only the web service is published.
7. Enable GitOps polling in Portainer if you want commits to `main` to trigger stack updates. Keep the environment variables configured in Portainer; they are not read from a repository `.env` file.

For backups, run `docker exec <api-container-name> npm run backup`; verify a snapshot with `docker exec <api-container-name> npm run backup:verify -- /backups/<snapshot-name>`. Schedule the backup command on the Docker host. Portainer stack updates rebuild the frontend and backend from the selected Git commit.