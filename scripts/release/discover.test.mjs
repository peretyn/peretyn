import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discover } from './discover.mjs';

test('discovers all opted-in containers with per-platform builds', () => {
  const { containerBuilds, containerImages } = discover();
  const images = containerImages.map((i) => i.image).sort();
  assert.deepEqual(images, ['control', 'dashboard', 'docs', 'runtime']);
  for (const image of images) {
    const builds = containerBuilds.filter((b) => b.image === image);
    assert.deepEqual(builds.map((b) => b.platform).sort(), ['linux/amd64', 'linux/arm64']);
    for (const build of builds) {
      assert.ok(build.runner, `${image}/${build.platform} has a runner`);
      assert.ok(build.version, `${image} carries a version`);
      assert.match(build.dockerfile, /Dockerfile$/);
    }
  }
});

test('discovers go binaries with goos/goarch split', () => {
  const { binaries } = discover();
  assert.deepEqual(binaries.map((b) => b.asset).sort(), [
    'peretyn-darwin-arm64',
    'peretyn-linux-amd64',
    'peretyn-linux-arm64',
  ]);
  assert.ok(binaries.every((b) => b.pkg === '@peretyn/go-cli' && b.dir === 'packages/go-cli'));
});

test('--packages filter narrows the artifact set', () => {
  const { containerImages, binaries } = discover({ packages: ['@peretyn/control'] });
  assert.deepEqual(
    containerImages.map((i) => i.image),
    ['control'],
  );
  assert.equal(binaries.length, 0);
});
