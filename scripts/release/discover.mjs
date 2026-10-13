#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const RUNNERS = {
  'linux/amd64': 'ubuntu-latest',
  'linux/arm64': 'ubuntu-24.04-arm',
};

export function discover({ packages } = {}) {
  const projects = JSON.parse(execSync('pnpm m ls --json --depth -1', { encoding: 'utf8' }));
  const root = process.cwd();
  const selected = projects.filter((p) => p.name && (!packages || packages.includes(p.name)));

  const containerBuilds = [];
  const containerImages = [];
  const binaries = [];

  for (const project of selected) {
    const manifest = JSON.parse(readFileSync(join(project.path, 'package.json'), 'utf8'));
    const dir = relative(root, project.path);

    const container = manifest.containerConfig;
    if (container) {
      const image = container.image ?? basename(project.path);
      const dockerfile = container.dockerfile ?? join(dir, 'Dockerfile');
      const platforms = container.platforms ?? ['linux/amd64'];
      for (const platform of platforms) {
        const runner = RUNNERS[platform];
        if (!runner) throw new Error(`${manifest.name}: no runner for ${platform}`);
        containerBuilds.push({
          pkg: manifest.name,
          version: manifest.version,
          image,
          dockerfile,
          platform,
          runner,
        });
      }
      containerImages.push({ pkg: manifest.name, version: manifest.version, image, platforms });
    }

    for (const binary of manifest.binaryConfig?.binaries ?? []) {
      for (const platform of binary.platforms ?? ['linux/amd64']) {
        const [goos, goarch] = platform.split('/');
        binaries.push({
          pkg: manifest.name,
          version: manifest.version,
          name: binary.name,
          path: binary.path,
          dir,
          goos,
          goarch,
          asset: `${binary.name}-${goos}-${goarch}`,
        });
      }
    }
  }

  return { containerBuilds, containerImages, binaries };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const flag = process.argv.indexOf('--packages');
  const packages = flag === -1 ? undefined : process.argv[flag + 1].split(',');
  process.stdout.write(JSON.stringify(discover({ packages })));
}
