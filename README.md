# Codex Usage for OpenCode Desktop

A compact subscription-usage monitor for **OpenCode Desktop**. Keep an eye on
your Codex quota without leaving your editor.

> Experimental, unofficial plugin. Not affiliated with OpenAI or OpenCode.
> It uses OpenCode's experimental GUI plugin API and the Codex app-server protocol.

## Features

- Compact footer with colored usage bars, percentages, and reset countdowns.
- Click to open a detail panel with quota windows and the last update time.
- View available earned reset credits and their next known expiration date.
- Reset eligible usage limits after explicit confirmation.
- Refresh manually or automatically every five minutes; countdowns update every 30 seconds.
- Follows OpenCode's UI language: English, Catalan, Spanish, French, and German.
  Other languages fall back to English.
- Keyboard-accessible controls, Escape/outside-click dismissal, and reduced-motion support.

The displayed account is the one signed in to **Codex CLI**. It may differ from
the account used by OpenCode. Subscription quota is not the same as session tokens
or API spending. Only windows actually returned by Codex are displayed; a plan
may not have both five-hour and weekly limits.

## Requirements

- OpenCode **Desktop 2.2.5** or a compatible version. Terminal-only OpenCode does not load this GUI.
- Codex CLI on the desktop app's `PATH`, signed in with ChatGPT.
  The protocol was checked against Codex CLI **0.164.0**.
- Node.js **22.12 or newer** and npm to build from source.

Live usage has been tested on Windows. Automated checks also target Linux;
macOS desktop behavior has not been verified.

## Install from source

Clone or download this repository, open a terminal in its root, and run:

```sh
git clone https://github.com/YerayAlonso/opencode-codex-usage.git
cd opencode-codex-usage
npm ci
npm run build
codex login status
```

If Codex is not signed in, run `codex login` and complete the ChatGPT sign-in flow.
API-key authentication does not provide ChatGPT subscription quota.

Add the checkout's **absolute path** to `plugins` in your global
`~/.config/opencode/opencode.jsonc` (or `opencode.json`). Preserve existing settings
and plugin entries:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/opencode-codex-usage-plugin"],
}
```

On Windows, use forward slashes, for example
`C:/Projects/opencode-codex-usage-plugin`. Do not put GUI plugins in `cli.json`.
The plugin should appear in **Settings → Extensions → Plugins** and load in each
desktop window. Local bundle rebuilds are watched by OpenCode Desktop.

There is no npm release yet. This project is currently intended for local installation.

## Usage

The footer shows each quota window, its used percentage, and the time until its
next reset. Click **Codex** to open the details. The header button refreshes
the data. Press Escape or click outside to close the panel.

### Reset credits

**Reset now consumes a real earned reset credit.** It is not a local counter reset
and cannot be undone. Codex decides which limits are eligible.

- The button is disabled if credit availability is unknown, no credits are available,
  a request is running, or usage data could not be refreshed.
- A confirmation is required before sending the reset request.
- The plugin checks availability again before submitting and refreshes usage afterward.
- Concurrent reset requests are deduplicated. Ambiguous retries reuse the same key
  while the plugin remains loaded. Keys do not survive a restart or plugin reload.
- Do not repeatedly retry an uncertain reset after restarting; inspect account usage first.

No reset credits are consumed by automated tests.

## Development

```sh
npm ci
npm run verify
npm run build -- --watch
```

| Command             | Purpose                           |
| ------------------- | --------------------------------- |
| `npm run build`     | Build `dist/gui-experimental.cjs` |
| `npm run typecheck` | Check TypeScript                  |
| `npm test`          | Run offline unit tests            |
| `npm run format`    | Format source and documentation   |
| `npm run verify`    | Run all checks and build          |

The package exports a GUI-only bundle. Node-only code runs in the desktop main
process; Solid components run in the window. The app supplies the shared SDK runtimes.

## Troubleshooting

- **Plugin is missing:** verify the Desktop version, global plugin path, enabled
  state, and that `dist/gui-experimental.cjs` exists after building.
- **Codex CLI not found:** ensure the executable is available to the desktop app,
  not just to a shell with a different `PATH`.
- **Cannot read usage:** check `codex login status` and verify ChatGPT authentication.
- **Reset is unavailable:** your account may have no earned credits or may not expose
  reset availability. The plugin never infers credits from usage percentages.
- **An error appears with previous data:** values are stale, not a live quota snapshot.

## Privacy and security

The plugin does not read or copy credentials. Codex CLI owns authentication and
contacts OpenAI as needed. Quota data stays in memory; there is no telemetry or
third-party analytics in the plugin. See [SECURITY.md](SECURITY.md) for reset and
dependency caveats, and never attach auth files to bug reports.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). GitHub CI runs formatting, TypeScript,
offline tests, and builds on Windows and Linux with Node.js 22 and 24.

## License

Licensed under the [MIT License](LICENSE).
The package remains marked `private: true` to prevent accidental npm publication.
