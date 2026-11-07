# SeoHakRu

SeoHakRu is a Korean-first personal publishing site with a bilingual English/Korean interface, author accounts, public and private posts, and a full-page MDX editor.

## Features

- Responsive editorial-style post list and reader
- English and Korean interface; the initial language follows the browser's first preferred language
- Author profiles, admin/member management, and post scheduling
- MDX writing, revisions, cover images, SEO fields, comments, RSS, and sitemap
- SQLite storage with persistent sessions
- Light and dark themes

Post text, author names, tags, and administrator-customized site copy are content, not UI translations. Switching languages does not rewrite them.

## Local Development

Requirements: Node.js 22 or later.

Start the API in one terminal:

```sh
cd backend
npm ci
npm run dev
```

Start the frontend in another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`. The frontend proxies API and media requests to `http://localhost:3001`.

## Translation Files

Translations are JSON, so contributors can edit interface wording without changing Vue or React code:

- `frontend/src/locales/en.json`: English
- `frontend/src/locales/ko.json`: Korean

Each file contains these sections:

- `site`: interface copy and default site copy
- `fieldLabels`: labels for admin-editable copy settings
- `fieldGroups`: headings for those settings groups
- `ui`: accessibility labels and small interface-only strings
- `mdx`: MDXEditor toolbar, dialog, and accessibility text

Keep the key structure in both files aligned. Existing customized site copy is preserved when a user changes language. For a new locale, create another file with the same sections, import it in `frontend/src/App.vue` and `frontend/src/components/MdxEditor.vue`, add it to the locale lookup and selector, and map its language code in the system-language detector.

After editing translations, validate with:

```sh
node -e "for (const file of ['frontend/src/locales/en.json','frontend/src/locales/ko.json']) JSON.parse(require('node:fs').readFileSync(file, 'utf8'))"
cd frontend
npm run build
```

## Deployment

For Portainer Git stacks, use [`compose.portainer.yaml`](compose.portainer.yaml) and follow [DEPLOYMENT.md](DEPLOYMENT.md). Configure environment variables and persistent host directories in Portainer. Keep `.env`, SQLite data, uploads, and backups out of Git.

The configured GitHub repository has private account and post data in its earlier Git history. Keep it private unless that history is scrubbed before publication.