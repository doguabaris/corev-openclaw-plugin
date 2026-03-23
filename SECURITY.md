# Security Policy

## Scope

This policy applies to the Corev OpenClaw Plugin package, including:

- plugin manifest (`openclaw.plugin.json`)
- plugin entrypoint (`index.ts`)
- wrapped Corev command execution and tool exposure

## Reporting a Vulnerability

Please report vulnerabilities privately to **abaris@null.net**.

Do not disclose publicly until a fix or mitigation is available.

## What to Include

1. Impact summary and affected component.
2. Reproduction steps.
3. Environment details (Node version, OpenClaw version, plugin config).
4. Proof-of-concept payload/logs where possible.

## Response Targets

- Acknowledgement: within 48 hours
- Initial triage: within 7 days
- Remediation target: within 30 days for high/critical issues

## Security Notes for Operators

- Keep optional mutating tools disabled unless required.
- Treat host lifecycle tools (`corev_host_start`, `corev_host_stop`, `corev_host_bootstrap`) as high-trust operations.
- Treat `corev_host_create_user` and `hostCreateUserCommand` as sensitive operations with secret handling requirements.
- Use strict allowlists for `corev_push`, `corev_revert`, `corev_checkout`, `corev_init`.
- Use least-privilege API tokens for `x-corev-secret`.
- Set a controlled `workingDirectory` and avoid broad filesystem exposure.
