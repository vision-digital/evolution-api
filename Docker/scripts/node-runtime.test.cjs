const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');

const root = resolve(__dirname, '../..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const image = 'node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53';

test('both API build stages use the patched, immutable Node image', () => {
  const bases = [...read('Dockerfile').matchAll(/^FROM (\S+) AS (builder|final)$/gm)];
  assert.equal(bases.length, 2);
  for (const [, base] of bases) assert.equal(base, image);
});

test('metrics uses the locally built patched API instead of upstream latest', () => {
  const dockerfile = read('Dockerfile.metrics');
  assert.match(dockerfile, /^ARG EVOLUTION_IMAGE=vision-digital\/evolution-api:2\.3\.7-node24\.22\.1$/m);
  assert.match(dockerfile, /^FROM \$\{EVOLUTION_IMAGE\}$/m);
  assert.match(dockerfile, /^ENV PROMETHEUS_METRICS=true$/m);
  assert.doesNotMatch(dockerfile, /evoapicloud|:latest/);
});

test('CI uses the patched runtime and executes these regression tests', () => {
  const workflow = read('.github/workflows/check_code_quality.yml');
  assert.match(workflow, /node-version: 24\.22\.1/);
  assert.match(workflow, /run: node --test Docker\/scripts\/node-runtime\.test\.cjs/);
});

test('image publishing uses the fork GHCR credentials and only the VPS architecture', () => {
  const workflow = read('.github/workflows/publish_docker_image.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /registry: ghcr\.io/);
  assert.match(workflow, /password: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /images: ghcr\.io\/\$\{\{ github\.repository \}\}/);
  assert.equal([...workflow.matchAll(/^          platforms: linux\/amd64\r?$/gm)].length, 2);
  assert.match(workflow, /EVOLUTION_IMAGE=ghcr\.io\/\$\{\{ github\.repository \}\}@\$\{\{ steps\.api\.outputs\.digest \}\}/);
  assert.match(workflow, /--platform linux\/amd64 --entrypoint node/);
  assert.match(workflow, /node-runtime-smoke\.cjs/);
  assert.doesNotMatch(workflow, /DOCKER_USERNAME|DOCKER_PASSWORD|evoapicloud|arm64|setup-qemu/);
});
