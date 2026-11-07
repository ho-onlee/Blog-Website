# Public Deployment

## Site Name and Favicon

Set `SITE_NAME` in `.env` or Portainer to choose the site name; the neutral fresh-install default is `website`. When `SITE_NAME` is set, it overrides any saved database name and the admin site-name field is locked. If it is empty, the saved site name is preserved. `FAVICON_URL` accepts `/favicon.svg` or an absolute image URL; the repository includes a generic book favicon.

## Signup Secret

Copy `.env.example` to `.env`, then set `SIGNUP_CODE` to a unique random value of at least 32 bytes. One way to generate a 64-character hexadecimal value is:

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Compose refuses to start without a value, and the production API refuses values shorter than 32 bytes. Keep `.env` private and never commit it. The first account registered against an empty database becomes the administrator, so bind the site to localhost or keep it behind a firewall until that account is created. Set `PUBLIC_URL` to the final HTTPS URL before enabling public traffic.

## AI Providers

Both Compose files build a separate CPU-only Ollama container. `AI_PROVIDER=ollama` and `AI_MODEL=qwen2.5:3b` are the defaults. On first startup, Ollama downloads the selected model into a persistent Docker volume; allow time, disk space, and RAM for the download and inference. Port `11434` is internal to the Compose network and is not published.

The admin AI settings can switch among Ollama, OpenAI, Anthropic, and Gemini when the selected provider is configured. Set paid-provider API keys only in `.env` for local Compose or in Portainer's stack environment. Keys stay in the API container and are never stored in the database or returned to the frontend. Set `AI_MODEL` to choose the initial model; the admin model field can override it. Provider-specific model defaults can be set with `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `GEMINI_MODEL`.

The public archive Q&A feature is disabled by default; enable it in AI settings only after checking its rate limit and possible inference costs. Writer AI requests are capped at 30 per account per hour. Public questions are capped at 10 per client IP per hour. Set `TRUST_PROXY` to your private proxy ranges if you use a reverse proxy, so the forwarded visitor IP is used for limits. Do not set it to `*` or `true` unless every request is guaranteed to pass through a trusted proxy.

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
2. On the Docker host, create three writable directories, for example `/opt/website/data`, `/opt/website/uploads`, and `/mnt/backups/website`.
3. If migrating an existing site, copy its SQLite database file and matching `uploads` contents into the persistent directories before deploying. Set `DB_NAME` to the copied SQLite filename. Leave the data directory empty for a fresh site; `site.sqlite` is the default filename.
4. In Portainer, choose **Stacks → Add stack → Git Repository**. Set the repository URL above and reference `refs/heads/main`. Use the default Compose path `docker-compose.yml` (or explicitly enter that filename).
5. Add these stack environment variables in Portainer:

	- `SIGNUP_CODE`: a unique random value of at least 32 characters.
	- `PUBLIC_URL`: the final public HTTPS URL, such as `https://blog.example.com`.
	- `DATA_HOST_PATH`: the absolute data directory on the Docker host.
	- `DB_NAME`: SQLite filename in the data directory; defaults to `site.sqlite`.
	- `UPLOADS_HOST_PATH`: the absolute uploads directory on the Docker host.
	- `BACKUP_HOST_PATH`: the absolute backup directory on the Docker host, preferably on separate storage.
	- `WEB_PORT`: optional host port for the HTTP web container; defaults to `8080`.
	- `SITE_NAME`: optional site-name override; the fresh-install fallback is `website`.
	- `FAVICON_URL`: optional favicon path or absolute URL; defaults to `/favicon.svg`.
	- `AI_PROVIDER`: optional default provider (`ollama`, `openai`, `anthropic`, or `gemini`); defaults to `ollama`.
	- `AI_MODEL`: optional default model; defaults to `qwen2.5:3b` and is also pulled by the local Ollama service.
	- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`: optional paid-provider secrets. Only configure providers you intend to use.
	- `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`: optional model defaults for those providers.
	- `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_INPUT_CHARS`: optional request timeout and input-length limits.
	- `TRUST_PROXY`: optional comma-separated trusted proxy ranges; keep it limited to the Docker/private proxy network.

6. Deploy the stack and configure your TLS reverse proxy to forward the domain to the Docker host on `WEB_PORT`. Keep the API port private; only the web service is published.
7. Enable GitOps polling in Portainer if you want commits to `main` to trigger stack updates. Keep the environment variables configured in Portainer; they are not read from a repository `.env` file.

For backups, run `docker exec <api-container-name> npm run backup`; verify a snapshot with `docker exec <api-container-name> npm run backup:verify -- /backups/<snapshot-name>`. Schedule the backup command on the Docker host. Portainer stack updates rebuild the frontend and backend from the selected Git commit.