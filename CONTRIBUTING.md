# Contributing

Thank you for contributing to **Corev OpenClaw Plugin**.

## How to Contribute

- Open an issue describing the bug, feature request, or documentation gap.
- Fork the repository, create a focused branch, and open a PR.
- Keep changes small and scoped (one concern per PR when possible).

## Development Checklist

Before opening a PR, run:

```bash
npm install
npm run build
npm test
npx eslint index.ts
```

## Plugin-Specific Guidelines

- Preserve tool names unless you intentionally introduce a breaking change.
- Treat mutating tools (`corev_push`, `corev_revert`, `corev_checkout`, `corev_init`) as sensitive.
- Keep optional tools optional unless there is a strong security reason otherwise.
- Validate tool inputs (`project`, `env`, `version`, file paths) and return explicit errors.

## Documentation Expectations

If you change tool behavior, update these files in the same PR:

- `README.md`
- `OPENCLAW_PLUGIN.md`
- `ROADMAP.md` (if it affects direction)
- `CHANGELOG.md`

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
