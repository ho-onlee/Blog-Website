# Blog-Website

Blog-Website is a personal publishing site with author accounts, public and private posts, and a full-page MDX editor.

## Features

- Responsive editorial-style post list and reader
- English and Korean interface; the initial language follows the browser's first preferred language
- Author profiles, admin/member management, and post scheduling
- MDX writing, revisions, cover images, SEO fields, comments, RSS, and sitemap
- SQLite storage with persistent sessions
- Light and dark themes
- Optional local Ollama writing, metadata, translation, public archive Q&A, and comment-review assistance

Post text, author names, tags, and administrator-customized site copy are content, not UI translations. Switching languages does not rewrite them.

## Local Development

Requirements: Node.js 22 or later.

Copy `.env.example` to `.env` before starting the API. `DB_NAME` selects the SQLite filename inside `backend/data` (`site.sqlite` for a fresh install); for an existing database, set it to that file's name. `DB_PATH`, if set, takes precedence.

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

## AI Setup

The Docker Compose stacks include a separate CPU-only Ollama image in `ai/`. Set `AI_MODEL` in `.env` to choose a model (default: `qwen2.5:3b`). On first startup, Ollama downloads that model into a persistent Docker volume. This can take time and disk space; the API does not publish Ollama's port.

The admin AI settings can select local Ollama or a configured paid provider: OpenAI, Anthropic, or Google Gemini. Put paid API keys in the server `.env` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`) or Portainer stack environment. Keys are never sent to the browser or stored in SQLite. Provider-specific model defaults are set by `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `GEMINI_MODEL`; the admin model field can override them. `AI_PROVIDER` and `AI_MODEL` set the initial defaults.

Available tools include draft outlining/continuation/rewrite/proofreading, translation, SEO metadata suggestions, public-post Q&A, and comment triage. AI suggestions are previews; they do not publish posts, and comment decisions remain manual. Writer AI calls are limited to 30 per account per hour. Public archive Q&A is off by default, limited to 10 requests per IP per hour, and uses only published public posts when enabled. Do not send sensitive drafts to hosted providers unless you accept their data handling terms.

In Portainer, configure API keys as stack environment variables. Set `TRUST_PROXY` to the private proxy ranges used by the deployment (Compose defaults to loopback/link-local/unique-local ranges) so IP-based Q&A limits use the visitor address forwarded by Nginx.

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

Set `SITE_NAME` in `.env` or Portainer to choose the deployed site's name. Its generic default is `website`; an explicit value overrides the saved database name and locks that field in admin settings. If it is unset, existing saved site branding is preserved. Set `FAVICON_URL` to `/favicon.svg` or an absolute image URL; a generic book favicon is included.

The configured GitHub repository has private account and post data in its earlier Git history. Keep it private unless that history is scrubbed before publication.
