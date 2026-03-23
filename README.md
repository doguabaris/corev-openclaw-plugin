## Corev OpenClaw Plugin

This plugin helps you do versioned configuration management from OpenClaw. It does [Corev CLI](https://corev.dev/) and corev-host orchestration so that you can manage config lifecycle (pull, diff, push, revert, checkout, environment setup) without leaving your agent workflow.

Project status: actively maintained (alpha)

### Basic functionality

Corev OpenClaw Plugin is intended for use by OpenClaw operators, DevOps engineers, backend developers, and platform teams. It is meant to help these users do day-to-day config operations and bootstrap a self-hosted Corev backend from the same plugin.

Corev OpenClaw Plugin uses OpenClaw plugin SDK registration to expose Corev workflows as structured agent plugins. It takes plugin parameters (project, version, env, file, host settings) from OpenClaw and uses them to execute [Corev CLI](https://corev.dev/) commands and local host management actions. For more details about the technical implementation, see [the developer documentation](#developer-documentation).

### What Corev OpenClaw Plugin does not do

This plugin cannot replace your infrastructure provisioning pipeline. It does not have built-in cloud deployment for MongoDB or managed hosting for `corev-host`; you still provide runtime environment and access.

This plugin also does not automatically enable all mutating plugins in every OpenClaw setup. Side-effecting plugins are optional and should be allowlisted intentionally.

## Prerequisites

Before using this plugin, you should be familiar with:

- The basics of OpenClaw plugins and plugin allowlists.
- The basics of Corev config workflows (pull, push, revert, checkout, env).
- Basic terminal usage and JSON configuration editing.

You should have:

- OpenClaw runtime installed and running.
- Node.js 22+ and npm.
- A working directory where this plugin runs.
- `corev-host` source available at `src/host/server` (for host operations).
- A MongoDB URI reachable by `corev-host`.
- Permissions to install dependencies and run local processes.

## How to use Corev OpenClaw Plugin

### Install and enable the plugin

1. Install the package:
    1. `openclaw plugins install @corev/openclaw-plugin`
2. Enable plugin entry in your OpenClaw config:
    1. Add plugin id `corev` under `plugins.entries`.
    2. Set `enabled: true`.
3. Add minimum plugin config:
    1. `workingDirectory`
    2. Optional defaults like `defaultProject`, `defaultEnv`

Example:

```json
{
  "plugins": {
    "entries": {
      "corev": {
        "enabled": true,
        "config": {
          "workingDirectory": "/Applications/MAMP/htdocs/corev/openclaw-plugin",
          "defaultProject": "atlas",
          "defaultEnv": "staging"
        }
      }
    }
  }
}
```

### Bootstrap local corev-host and initialize Corev

1. Configure host settings in plugin config:
    1. `hostApiUrl` (for example `http://127.0.0.1:3000`)
    2. `hostMongoUri`
    3. Optional: `hostHealthPath`, `hostStartCommand`
2. Call `corev_host_bootstrap` from OpenClaw.
3. Confirm output includes:
    1. local host source detected
    2. host `.env` configured
    3. host started and healthy
    4. dashboard user created
    5. `corev init` succeeded

Example plugin params:

```json
{
  "apiUrl": "http://127.0.0.1:3000",
  "mongoUri": "mongodb://127.0.0.1:27017/corev",
  "createUserEmail": "root@root.rs",
  "createUserPassword": "root"
}
```

### Run read-focused config workflows

1. List local versions:
    1. Call `corev_list`.
2. Pull latest config:
    1. Call `corev_pull` with `project`.
    2. Optionally pass `env`.
3. Compare versions/files:
    1. Call `corev_diff` with `fileA` and `fileB`.
4. Prepare environment folders:
    1. Call `corev_env` with `project` and `env`.

### Run mutating workflows safely

1. Enable optional plugins in OpenClaw allowlist:
    1. `corev_push`
    2. `corev_revert`
    3. `corev_checkout`
    4. `corev_init`
2. Execute write operations with explicit parameters.
3. Validate results by re-running `corev_list`/`corev_diff` and checking backend state.

## Troubleshooting

`corev-host server was not found at .../src/host/server`

- Ensure `workingDirectory` points to the repository that contains `src/host/server/package.json`.

`Missing MongoDB URI. provide "mongoUri" ...`

- Set `hostMongoUri` in plugin config or pass `mongoUri` to `corev_host_bootstrap`/`corev_host_start`.

`health NOT READY at http://.../health`

- Check port conflicts, validate `hostApiUrl` + `hostHealthPath`, and inspect host logs.

Optional plugin is not available in OpenClaw

- Add the plugin name (or plugin id) to your OpenClaw plugins allowlist.

## How to get help and report issues

- Report issues at https://github.com/doguabaris/corev-openclaw-plugin/issues.
- Ask questions or get help at https://github.com/doguabaris/corev-openclaw-plugin/discussions. You can expect a best-effort response, usually within 3-5 business days.

## Developer documentation

### Technical implementation

This plugin uses `openclaw/plugin-sdk` (`definePluginEntry`) to register Corev plugins and host management plugins. It depends on `@sinclair/typebox` for plugin schemas, Node.js `child_process` for command execution, and local `corev-host` source under `src/host/server` for backend bootstrap/start/stop flows.

### Code structure

The `index.ts` module does plugin registration, plugin action definitions, host process management, `.env` generation, health checks, and response formatting.

The `src/commands` directory contains [Corev CLI](https://corev.dev/) command modules (`init`, `pull`, `push`, `diff`, `list`, `revert`, `checkout`, `env`).

The `src/services` directory contains CLI support services such as `.corevrc` handling and API settings.

The `src/host/server` directory contains embedded `corev-host` backend source used by host operations.

The `tests` directory contains smoke, CLI integration, plugin E2E, and live host E2E scenarios.

### Local development

#### Set up

How to set up development environment:

1. Clone the repository and move into it.
    1. `git clone https://github.com/doguabaris/corev-openclaw-plugin.git`
    2. `cd corev-openclaw-plugin`
2. Verify Node version.
    1. `node -v`
    2. Confirm it is 22+.

#### Install

How to install:

1. Install root dependencies.
    1. `npm install`
    2. Wait for completion without errors.
2. Install host dependencies (if you will use host operations).
    1. `npm run install-corev-host`
    2. Confirm `src/host/server/node_modules` exists.

#### Configure

How to configure:

1. Define OpenClaw plugin config (`workingDirectory`, host settings as needed).
2. If testing host bootstrap, ensure a reachable MongoDB URI is available.

#### Build and test

How to build and run locally:

1. Build TypeScript output.
    1. `npm run build`
    2. Verify generated artifacts under `dist/`.

How to run tests:

1. Run full test suite.
    1. `npm test`
    2. Optional live host flow: `npm run test:e2e:live`

#### Debugging

- `Type compatibility error from OpenClaw SDK`
    - Ensure plugin responses include required fields expected by current OpenClaw SDK types.

- `health NOT READY at ...`
    - Validate `hostApiUrl`, `hostHealthPath`, `.env` values, and host process logs under `.corev-openclaw-plugin/`.

- `Missing MongoDB URI...`
    - Provide `hostMongoUri` in plugin config or pass `mongoUri` directly in host plugin params.

## How to contribute

The Corev OpenClaw Plugin maintainers welcome contributions.

- Bug fixes
- New tests and reliability improvements
- Documentation improvements
- Safe plugin enhancements for OpenClaw/Corev workflows

### Contribution process

Before contributing, read the [Code of Conduct](CODE_OF_CONDUCT.md) that outlines community guidelines and expectations. We follow TypeScript + ESLint conventions used in this repository.

1. Open an issue describing the proposed change.
    1. Clarify expected behavior.
    2. Include logs or reproduction steps when relevant.
2. Submit a focused pull request.
    1. Keep scope limited to one concern.
    2. Run `npm run build`, `npm test`, and attach results.

## Credits

- Doğu Abaris (author and maintainer)
- Contributors in this repository’s pull requests and issue reports

## License

This project is licensed under the [MIT License](LICENSE).
