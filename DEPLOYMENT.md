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