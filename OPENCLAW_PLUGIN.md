# Corev OpenClaw Plugin

This package now includes a native OpenClaw plugin entry.

## Files

- `openclaw.plugin.json`: OpenClaw manifest and plugin config schema
- `index.ts`: plugin entry (`definePluginEntry`) and tool registrations

## Exposed tools

Required:

- `corev_list`
- `corev_pull`
- `corev_diff`
- `corev_env`

Optional (enable via `tools.allow`):

- `corev_push`
- `corev_revert`
- `corev_checkout`
- `corev_init`
- `corev_host_status`
- `corev_host_start`
- `corev_host_stop`
- `corev_host_bootstrap`
- `corev_host_create_user`

## Example plugin config

```json
{
  "plugins": {
    "entries": {
      "corev": {
        "enabled": true,
        "config": {
          "workingDirectory": "/absolute/path/to/your/project",
          "defaultProject": "atlas",
          "defaultEnv": "staging",
          "hostApiUrl": "http://127.0.0.1:3000",
          "hostMongoUri": "mongodb://127.0.0.1:27017/corev",
          "hostStartCommand": "npm run dev"
        }
      }
    }
  }
}
```

If you want to use a custom Corev binary path instead of `corev` from PATH, set:

```json
{
  "corevBin": "/usr/local/bin/corev"
}
```

Local host source path:

- `src/host/server` (plugin host tools run in this directory)


Bootstrap command behavior:

- use local `src/host/server`
- write host `.env` from plugin config/tool params (`mongoUri`, `port`, `sessionSecret`, `jwtSecret`, `nodeEnv`)
- install dependencies in local host server when needed
- start host process
- create dashboard user automatically (`root@root.rs` / `root` by default) unless `createUser=false`
- wait for health endpoint
- initialize local Corev API target
