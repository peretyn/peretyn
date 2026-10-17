# Releasing

Versioning is owned by [changesets](https://github.com/changesets/changesets); every artifact
(npm packages, GHCR containers, Go binaries) releases through
`.github/workflows/release.yaml`. Ship a user-visible change = add a changeset
(`pnpm changeset`) in your PR. No changeset, no release — that's the whole contract.

**Channels**

- `canary` (automatic): every green-CI push to `main` that has pending
  changesets publishes a snapshot — npm dist-tag `canary`, image tags
  `:canary`/`:<version>`/`:sha-<short>`, binaries on the rolling `canary`
  prerelease. Versions look like `0.3.0-canary-<sha>`; they never land in git.
- Named channels (manual): run the Release workflow via `workflow_dispatch`
  with a channel name (`alpha`, `rc`, a demo tag...) from any ref. Same
  machinery, different dist-tag.
- Stable: merge the "Version Packages" PR that the changesets action keeps
  open on `main`. That single merge publishes npm, pushes `pkg@version` git
  tags, creates per-package GitHub releases, and builds all artifacts.
  For an RC train before a big release, use `changeset pre enter <tag>`
  ([prereleases doc](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)) —
  deliberately not wired up yet.

**Artifacts are opt-in per package.json** (discovered by
`scripts/release/discover.mjs`, so no workflow edits ever):

```jsonc
"containerConfig": { "platforms": ["linux/amd64", "linux/arm64"] } // Dockerfile next to it
"binaryConfig": { "binaries": [{ "name": "peretyn", "path": ".", "platforms": [...] }] }
```

Private packages still get versions and git tags (`privatePackages` in
`.changeset/config.json`) — that's what versions the containers. The server stack
(`runtime`, `control`, `dashboard`) is a changesets `fixed` group: a change to any one
releases all three at one version, so one image tag names a matching trio.

**Registry knob**: npm publishes go to the Actions repo variable
`RELEASE_NPM_REGISTRY` (default GitHub Packages, `https://npm.pkg.github.com`).
To switch to npmjs: set that variable to `https://registry.npmjs.org` and add
an `NPM_TOKEN` secret. Nothing in the code changes. Containers always go to GHCR.

**Failures**: every step is re-run safe — `changeset publish` skips
already-published versions, image tags re-push idempotently, binary uploads
`--clobber`. Re-run the failed workflow until green. Yanking a bad snapshot:
delete the GH Packages version / move the dist-tag / delete the GHCR tag.

**Consuming pre-releases** (while on GitHub Packages): PAT with
`read:packages`, then

```ini
# ~/.npmrc
@peretyn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<PAT>
```

`pnpm add @peretyn/sdk@canary`. Containers: `docker login ghcr.io` with the
same PAT; deployable stack in `deploy/compose.yaml`.
