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

// Copy a directory tree while excluding specified top-level names (e.g., node_modules)
async function copyDirExcluding(src, dest, excludeNames = new Set()) {
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeNames.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirExcluding(srcPath, destPath, excludeNames);
    } else if (entry.isSymbolicLink()) {
      // Skip symlinks to avoid EPERM on Windows
      continue;
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
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
  // Preflight: detect and auto-remove any local file: dependencies (e.g. monorepo self-links)
  const backendPkgPath = path.join(root, 'backend', 'package.json');
  const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
  const deps = backendPkg.dependencies || {};
  const fileDeps = Object.entries(deps).filter(([, spec]) => typeof spec === 'string' && spec.startsWith('file:'));
  if (fileDeps.length > 0) {
    console.warn('Detected local file: dependencies in backend/package.json that can cause symlink/EPERM issues. Auto-removing for pack:');
    for (const [name, spec] of fileDeps) {
      console.warn(` - removing ${name}: ${spec}`);
      delete deps[name];
    }
    backendPkg.dependencies = deps;
    fs.writeFileSync(backendPkgPath, JSON.stringify(backendPkg, null, 2));
  }
  const outBase = path.join(root, 'build', 'server', platform);
  const distDir = path.join(root, 'build', 'dist');
  await ensureDir(outBase);
  await ensureDir(distDir);

  // 0) Build Node server binary for the target platform
  console.log('Building Node server binary with nexe for', platform);
  const serverBinDir = path.join(root, 'build', 'server');
  await ensureDir(serverBinDir);
  if (platform === 'win32') {
    sh('npm run build:server:win', { shell: true });
  } else if (platform === 'linux') {
    sh('npm run build:server:linux', { shell: true });
  } else {
    sh('npm run build:server:mac', { shell: true });
  }

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
  // Copy backend excluding node_modules to avoid Windows symlink EPERM
  await copyDirExcluding(path.join(root, 'backend'), path.join(outBase, 'backend'), new Set(['node_modules']));
  await cpRecursive(path.join(root, 'pythonCode'), path.join(outBase, 'pythonCode'));
  await cpRecursive(path.join(root, 'pythonEnv'), path.join(outBase, 'pythonEnv'));

  // Copy Go executable (platform-specific)
  await ensureDir(path.join(outBase, 'go_executables'));
  if (platform === 'win32') {
    await fsp.copyFile(path.join(goOutDir, 'server_go_win32.exe'), path.join(outBase, 'go_executables', 'server_go_win32.exe'));
  } else {
    await fsp.copyFile(path.join(goOutDir, 'server_go'), path.join(outBase, 'go_executables', 'server_go'));
  }

  // Copy Node server binary into bundle root
  if (platform === 'win32') {
    await fsp.copyFile(
      path.join(serverBinDir, 'medomics-server-win.exe'),
      path.join(outBase, 'medomics-server.exe')
    );
  } else if (platform === 'linux') {
    await fsp.copyFile(
      path.join(serverBinDir, 'medomics-server-linux'),
      path.join(outBase, 'medomics-server')
    );
    await fsp.chmod(path.join(outBase, 'medomics-server'), 0o755);
  } else {
    await fsp.copyFile(
      path.join(serverBinDir, 'medomics-server-mac'),
      path.join(outBase, 'medomics-server')
    );
    await fsp.chmod(path.join(outBase, 'medomics-server'), 0o755);
  }

  // 3) Create helper scripts
  // Install backend production dependencies into the staged backend
  console.log('Installing backend production dependencies...');
  // Ensure a clean node_modules in staging
  await fsp.rm(path.join(outBase, 'backend', 'node_modules'), { recursive: true, force: true }).catch(() => {});
  // Use npm with --prefix to install into the staged backend folder
  // Add --no-bin-links to avoid symlink creation on Windows (EPERM without admin/dev-mode)
  // Also disable lockfile to avoid reintroducing local file deps via package-lock
  sh(`npm install --omit=dev --no-bin-links --no-package-lock --prefix "${path.join(outBase, 'backend')}"`, { shell: true });

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
      'net session >nul 2>&1',
      'if %errorLevel% == 0 (',
      '  echo Running as admin.',
      '  goto :main',
      ') else (',
      '    powershell Start-Process "%~f0" -Verb RunAs',
      '    exit /b',
      ')',
      ':main',
      'set NODE_ENV=production',
      'medomics-server.exe ensure --json --go --mongo --jupyter',
      'medomics-server.exe start --json',
      ''
    ].join('\r\n'), 'utf8');
    await fsp.writeFile(path.join(outBase, 'stop.bat'), [
      '@echo off',
      'medomics-server.exe stop --json',
      ''
    ].join('\r\n'), 'utf8');
  } else {
    await fsp.writeFile(path.join(outBase, 'start.sh'), [
      '#!/usr/bin/env bash',
      'set -e',
      'export NODE_ENV=production',
      './medomics-server ensure --json --go --mongo --jupyter',
      './medomics-server start --json',
      ''
    ].join('\n'), 'utf8');
    await fsp.chmod(path.join(outBase, 'start.sh'), 0o755);
    await fsp.writeFile(path.join(outBase, 'stop.sh'), [
      '#!/usr/bin/env bash',
      'set -e',
      './medomics-server stop --json',
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
