# Contributing

## Development

Use Node.js 22.12 or newer, then run:

```sh
npm ci
npm run verify
```

Use `npm run format` before submitting changes. `npm run verify` checks formatting,
TypeScript, unit tests, and the desktop bundle. CI runs on Windows and Linux with
Node.js 22 and 24. CI does not require Codex authentication and never consumes reset credits.

For local desktop development, register the checkout in OpenCode's global plugin
configuration as described in the README, and run `npm run build -- --watch`.

## Guidelines

- Keep styles scoped to the `cu` classes; do not change host application styles.
- Keep icons consistent, with visible keyboard focus and reduced-motion support.
- Add user-facing strings to every supported locale in `src/gui.tsx`.
- Add tests for parsing, formatting, and error-handling changes.
- Treat unknown quota or reset data as unavailable, never as permission to reset.
- Do not consume real reset credits when testing a change. Mock destructive operations.
- Never submit credentials, auth files, private prompts, or account identifiers.

## License

This project is licensed under the [MIT License](LICENSE).
The package remains marked `private: true` to prevent accidental npm publication.
