# Security

Do not include credentials, Codex auth files, account identifiers, or private
conversation content in public issues. For a vulnerability involving secrets or
unauthorized reset-credit consumption, use GitHub's private vulnerability reporting
if the repository owner has enabled it; otherwise contact the owner privately.

## Data handling

- Credentials remain owned by Codex CLI. This plugin does not read or copy auth files.
- The plugin uses a local `codex app-server` process to request quota data.
- Codex itself may contact OpenAI and refresh its managed authentication.
- Usage snapshots are kept in memory, not written to a plugin history file.
- Reset consumes an earned account credit and requires explicit UI confirmation.
- Ambiguous reset attempts reuse an idempotency key while the plugin remains loaded.
  That key does not survive a desktop restart or plugin reload; inspect refreshed
  account data before trying again after either.

## Dependencies

Run `npm audit` when changing dependencies. The current OpenCode SDK dependency
tree includes moderate advisories in transitive packages, including `glob` and
`minimatch`. Some have no compatible upstream fix. Do not use forced dependency
overrides without testing SDK compatibility. The plugin bundle uses the host's
shared OpenCode, Solid, and Effect modules rather than bundling their runtimes.
