# Custom Languages

Place public locale JSON files in this directory. Use `en.json` or `ko.json` to override built-in text, or add a new lowercase language code such as `fr.json`.

New languages need a top-level `name` for the selector. Missing translation keys fall back to English; English and Korean overrides fall back to their bundled translations. Copy keys from `frontend/src/locales/en.json` or `frontend/src/locales/ko.json`.

Place `favicon.png`, `favicon.ico`, or `favicon.svg` in the parent settings directory. See `DEPLOYMENT.md` for mount paths and configuration details.