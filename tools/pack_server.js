/*
  Packs the standalone Node server distribution with backend (Express),
  Go binary, Python code, and PythonEnv helpers. Produces a ZIP per platform.
*/
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cp = require('child_process');
const zipLocal = require('zip-local');

function sh(cmd, opts = {}) {
  cp.execSync(cmd, { stdio: 'inherit', ...opts });
}

async function removeRecursiveSymlink(candidatePath) {
  try {
    const stats = await fsp.lstat(candidatePath);
    if (!stats.isSymbolicLink()) {
      return;
    }
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return;
    }
    throw err;
  }

  // Remove the symlink target to avoid infinite recursion while zipping
  await fsp.rm(candidatePath, { recursive: true, force: true });
}

async function cpRecursive(src, dest) {
  await fsp.cp(src, dest, { recursive: true, force: true });
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(a => a.startsWith('--platform='));
  const platform = platformArg ? platformArg.split('=')[1] : process.platform;
  if (!['win32','linux','darwin'].includes(platform)) {
    console.error('Unsupported or missing --platform. Use win32 | linux | darwin');
    process.exit(1);
  }

  const root = process.cwd();
  const version = require(path.join(root, 'package.json')).version;
  const outBase = path.join(root, 'build', 'server', platform);
  const distDir = path.join(root, 'build', 'dist');
  await ensureDir(outBase);
  await ensureDir(distDir);

  // 1) Build Go server for the target platform
  console.log('Building Go server for', platform);
  const goServerDir = path.join(root, 'go_server');
  const goOutDir = path.join(root, 'go_executables');
  await ensureDir(goOutDir);
  if (platform === 'win32') {
    sh(`go build -o "${path.join(goOutDir, 'server_go_win32.exe')}" main.go`, { cwd: goServerDir, shell: true });
  } else if (platform === 'linux') {
    sh(`CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "${path.join(goOutDir, 'server_go')}" main.go`, { cwd: goServerDir, shell: true });
  } else {
    sh(`go build -o "${path.join(goOutDir, 'server_go')}" main.go`, { cwd: goServerDir, shell: true });
  }

  // 2) Stage files
  console.log('Staging files...');
  // Clean staging dir
  const entries = await fsp.readdir(outBase).catch(() => []);
  for (const e of entries) {
    await fsp.rm(path.join(outBase, e), { recursive: true, force: true });
  }

  // Copy backend, pythonCode, pythonEnv
  await cpRecursive(path.join(root, 'backend'), path.join(outBase, 'backend'));
  await cpRecursive(path.join(root, 'pythonCode'), path.join(outBase, 'pythonCode'));
  await cpRecursive(path.join(root, 'pythonEnv'), path.join(outBase, 'pythonEnv'));

  // Copy Go executable (platform-specific)
  await ensureDir(path.join(outBase, 'go_executables'));
  if (platform === 'win32') {
    await fsp.copyFile(path.join(goOutDir, 'server_go_win32.exe'), path.join(outBase, 'go_executables', 'server_go_win32.exe'));
  } else {
    await fsp.copyFile(path.join(goOutDir, 'server_go'), path.join(outBase, 'go_executables', 'server_go'));
  }

  // 3) Create helper scripts
  // Install backend production dependencies into the staged backend
  console.log('Installing backend production dependencies...');
  // Ensure a clean node_modules in staging
  await fsp.rm(path.join(outBase, 'backend', 'node_modules'), { recursive: true, force: true }).catch(() => {});
  // Use npm with --prefix to install into the staged backend folder
  sh(`npm install --omit=dev --prefix "${path.join(outBase, 'backend')}"`, { shell: true });

  // npm creates a self-referencing symlink (package name matches repo) which causes
  // infinite recursion when zip-local traverses the directory. Remove it proactively.
  await removeRecursiveSymlink(path.join(outBase, 'backend', 'node_modules', 'medomicslab-application'));

  const readme = `MEDomicsLab Server Bundle (v${version})\n\n` +
`Quick start:\n` +
`- Ensure Node.js 18+ is installed and on PATH.\n` +
`- Run the appropriate start script for your OS.\n\n` +
`Scripts:\n` +
`- Windows: start.bat, stop.bat\n` +
`- Linux/mac: start.sh, stop.sh (chmod +x *.sh)\n\n` +
`Start script runs:\n` +
`node ./backend/cli/medomics-server.mjs ensure --json --go --mongo --jupyter\n` +
`node ./backend/cli/medomics-server.mjs start --json\n`;
  await fsp.writeFile(path.join(outBase, 'README.txt'), readme, 'utf8');

  if (platform === 'win32') {
    await fsp.writeFile(path.join(outBase, 'start.bat'), [
      '@echo off',
      'node .\backend\cli\medomics-server.mjs ensure --json --go --mongo --jupyter',
      'node .\backend\cli\medomics-server.mjs start --json',
      ''
    ].join('\r\n'), 'utf8');
    await fsp.writeFile(path.join(outBase, 'stop.bat'), [
      '@echo off',
      'node .\backend\cli\medomics-server.mjs stop --json',
      ''
    ].join('\r\n'), 'utf8');
  } else {
    await fsp.writeFile(path.join(outBase, 'start.sh'), [
      '#!/usr/bin/env bash',
      'set -e',
      'node ./backend/cli/medomics-server.mjs ensure --json --go --mongo --jupyter',
      'node ./backend/cli/medomics-server.mjs start --json',
      ''
    ].join('\n'), 'utf8');
    await fsp.chmod(path.join(outBase, 'start.sh'), 0o755);
    await fsp.writeFile(path.join(outBase, 'stop.sh'), [
      '#!/usr/bin/env bash',
      'set -e',
      'node ./backend/cli/medomics-server.mjs stop --json',
      ''
    ].join('\n'), 'utf8');
    await fsp.chmod(path.join(outBase, 'stop.sh'), 0o755);
  }

  // 4) Zip
  const zipName = `MEDomicsLab-Server-${version}-${platform}.zip`;
  const zipPath = path.join(distDir, zipName);
  console.log('Creating zip:', zipPath);
  zipLocal.sync.zip(outBase).compress().save(zipPath);

  console.log('Server package created at', zipPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
