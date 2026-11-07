# Public Deployment

## Signup Secret

Copy `.env.example` to `.env`, then set `SIGNUP_CODE` to a unique random value of at least 32 bytes. One way to generate a 64-character hexadecimal value is:

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Compose refuses to start without a value, and the production API refuses values shorter than 32 bytes. Keep `.env` private and never commit it. The first account registered against an empty database becomes the administrator, so bind the site to localhost or keep it behind a firewall until that account is created. Set `PUBLIC_URL` to the final HTTPS URL before enabling public traffic.

## Backups

Compose mounts `HOST_BACKUP_DIR` outside the project into `/backups`; by default it uses a sibling `seohakru-backups` directory. Choose a durable host path in `.env` if needed. Run regular backups from the project directory:

```sh
docker compose exec -T api npm run backup
```

Each backup contains a SQLite online-backup snapshot and a copy of uploaded images. The command prints its timestamped backup directory. To test restoration without changing the live database or uploads:

```sh
docker compose exec -T api npm run backup:verify -- /backups/seohakru-<timestamp>
```

The verification command copies the snapshot to a temporary directory, runs SQLite `integrity_check`, and checks that all upload files copied. Schedule the backup command daily with the host's scheduler, and periodically copy the backup directory to a separate device or storage provider. For an actual recovery, stop the API, restore `seohakru.sqlite` and the `uploads` directory from one snapshot to the mounted data locations, then restart the API.

## Portainer Git Stack

This stack targets a Portainer **Docker Standalone** environment. It uses absolute host directories for persistent SQLite data, uploads, and backups; it does not depend on Portainer Business Edition relative-path volumes.

The configured remote is `https://github.com/ho-onlee/Seohakru.website.git`, branch `main`. Keep this repository private: the initial commit contains `backend/data` account, post, and SQLite files. Ignore rules and current deletions do not remove data from Git history. Portainer can deploy from a private repository; do not make it public unless the history is scrubbed first.

1. Commit and push the Portainer stack file and these instructions to `main`. For a private repository, configure Git credentials in Portainer; do not put a GitHub token in this repository.
2. On the Docker host, create three writable directories, for example `/opt/seohakru/data`, `/opt/seohakru/uploads`, and `/mnt/backups/seohakru`.
3. If migrating the existing site, copy `seohakru.sqlite` from a verified backup into the data directory and copy the backup's `uploads` contents into the uploads directory before deploying. Leave the data directory empty for a fresh site.
4. In Portainer, choose **Stacks → Add stack → Git Repository**. Set the repository URL above, reference `refs/heads/main`, and Compose path `compose.portainer.yaml`.
5. Add these stack environment variables in Portainer:

	- `SIGNUP_CODE`: a unique random value of at least 32 characters.
	- `PUBLIC_URL`: the final public HTTPS URL, such as `https://blog.example.com`.
	- `DATA_HOST_PATH`: the absolute data directory on the Docker host.
	- `UPLOADS_HOST_PATH`: the absolute uploads directory on the Docker host.
	- `BACKUP_HOST_PATH`: the absolute backup directory on the Docker host, preferably on separate storage.
	- `WEB_PORT`: optional host port for the HTTP web container; defaults to `8080`.

6. Deploy the stack and configure your TLS reverse proxy to forward the domain to the Docker host on `WEB_PORT`. Keep the API port private; only the web service is published.
7. Enable GitOps polling in Portainer if you want commits to `main` to trigger stack updates. Keep the environment variables configured in Portainer; they are not read from a repository `.env` file.

For backups, run `docker exec <api-container-name> npm run backup`; verify a snapshot with `docker exec <api-container-name> npm run backup:verify -- /backups/<snapshot-name>`. Schedule the backup command on the Docker host. Portainer stack updates rebuild the frontend and backend from the selected Git commit.