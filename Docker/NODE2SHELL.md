# Node2Shell remediation

Source: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases

CVE-2026-111497 affects the native Brotli decoder bundled with Node.js.
Updating npm dependencies alone does not replace that decoder. Node 24.22.1
contains the official fix. Both API build stages pin that release and the
multi-platform image digest. The API remains at version 2.3.7.

## Checklist

- [x] Verify the fork and synchronize its references (already current).
- [x] Pin the patched Node runtime for build and execution.
- [x] Derive the metrics image from the patched API image.
- [x] Add regression tests and configure CI to execute them with patched Node.
- [x] Build both linux/amd64 images and verify Node 24.22.1 inside each image.
- [x] Validate the application build, Brotli and native sharp compatibility.
- [x] Configure GHCR publishing for linux/amd64 and linux/arm64 in the fork.
- [x] Validate the publishing workflow with actionlint.
- [x] Complete independent final review of the CI changes (no defects found).
- [ ] Owner pushes the commit; execute and verify the workflow on GitHub.
- [ ] Owner deploys the verified image on the VPS.

## Build on GitHub

`.github/workflows/publish_docker_image.yml` replaces the three upstream
publishing workflows with one workflow targeting the fork's own GHCR packages:

- `ghcr.io/vision-digital/evolution-api`
- `ghcr.io/vision-digital/evolution-api-metrics`

It runs on pushes to `main` (`latest`), `develop` (`homolog`) and version tags
(the exact Git tag). Every run also publishes `sha-<full-commit-hash>`. It can
be started manually from Actions: **Publish fork container images**.

Authentication uses `GITHUB_TOKEN` with `packages: write`; no Docker Hub secrets
are required. Both packages include linux/amd64 and linux/arm64. The metrics
build inherits the exact API manifest digest from the same run. Runtime smoke
checks execute for both published images on both architectures. Final digests
are recorded in the workflow summary.

The local workflow has passed actionlint and regression tests, but has not yet
run on GitHub: the owner must push the commit first. No git push is performed
by the agent. Local amd64 builds have passed TypeScript compilation and smoke
checks; ARM64 execution will be verified by the GitHub workflow.

## Build locally

Run from the repository root:

```powershell
node --test Docker/scripts/node-runtime.test.cjs
docker build --pull -t vision-digital/evolution-api:2.3.7-node24.22.1 .
docker build -f Dockerfile.metrics -t vision-digital/evolution-api:2.3.7-node24.22.1-metrics .
docker run --rm --entrypoint node vision-digital/evolution-api:2.3.7-node24.22.1 --version
docker run --rm --entrypoint node vision-digital/evolution-api:2.3.7-node24.22.1-metrics --version
Get-Content -Raw Docker/scripts/node-runtime-smoke.cjs | docker run --rm -i --entrypoint node vision-digital/evolution-api:2.3.7-node24.22.1
Get-Content -Raw Docker/scripts/node-runtime-smoke.cjs | docker run --rm -i --entrypoint node vision-digital/evolution-api:2.3.7-node24.22.1-metrics
```

Both images must report `v24.22.1`. Use the newly built tag in the target
deployment; the upstream `evoapicloud/evolution-api:latest` tag is a separate
artifact and is not updated by this build. The metrics variant uses the same
compiled application and dependencies, enabling `PROMETHEUS_METRICS=true`.
When overriding `EVOLUTION_IMAGE`, the caller must verify its actual Node version.

## Use on the VPS

After a successful GitHub run, copy the API digest from the workflow summary.
Use that digest in the VPS deployment for an immutable image reference:

```bash
export EVOLUTION_API_IMAGE='ghcr.io/vision-digital/evolution-api@sha256:<digest-from-successful-run>'
docker pull "$EVOLUTION_API_IMAGE"
docker run --rm --entrypoint node "$EVOLUTION_API_IMAGE" --version
```

Replace the placeholder before executing. The runtime must report `v24.22.1`.
Use the metrics package digest instead when metrics are wanted. Docker selects
the host architecture from the published multi-platform manifest.

GHCR packages are private when first published. The owner can make them public
in package settings for anonymous pulls, or authenticate the VPS with a PAT
classic scoped to `read:packages`. Never put a token in the repository.

The existing API entrypoint applies database migrations at startup. Deployment
must be performed by the owner against the intended database. Review the
existing VPS deployment's database, volumes, network and environment before
changing its image. The agent has not started a local application stack or
modified the VPS.

If using this repository's compose on the VPS, configure `.env`, the intended
database and the external `dokploy-network` used by the original compose file.
Then the owner can start the stack with the corrected image:

```bash
docker compose -f docker-compose.yaml -f docker-compose.node2shell.yaml up -d
```

The override changes only the API image; all existing volumes and environment
settings come from the original compose file. It reads `EVOLUTION_API_IMAGE`,
defaulting to `ghcr.io/vision-digital/evolution-api:latest` if unset. This command
starts services and the existing entrypoint applies migrations; it has not
been run by the agent.

The runtime smoke check verifies the actual Node version, a Brotli round trip,
rejection of truncated data and loading of the native `sharp` module. It does
not execute an exploit or replace an application integration test.

The repository's `npm test` references a missing `test/all.test.ts`; there is
no usable existing full e2e command. WhatsApp connection and messaging must be
validated by the owner after deployment with the intended instance.

## GitHub tracking

Issues are disabled on `vision-digital/evolution-api`, so a GitHub issue could
not be created for this task. This file records the remediation and validation.
