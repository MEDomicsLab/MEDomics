const fs = require('fs');
const path = require('path');

function findFiles(dir, patterns, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      findFiles(full, patterns, results);
    } else {
      if (patterns.some(p => full.endsWith(p))) {
        results.push(full);
      }
    }
  }
  return results;
}

function patchFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const before = content;
  // Replace SpectreMitigation property to Disabled
  const patched = content.replace(/<SpectreMitigation>\s*Spectre\s*<\/SpectreMitigation>/g, '<SpectreMitigation>Disabled</SpectreMitigation>');
  if (patched !== before) {
    fs.writeFileSync(file, patched, 'utf8');
    console.log(`Patched: ${file}`);
    return true;
  }
  return false;
}

function run() {
  const root = process.cwd();
  const nodePtyDir = path.join(root, 'node_modules', 'node-pty');
  if (!fs.existsSync(nodePtyDir)) {
    console.error('node-pty is not installed in node_modules yet. Run npm install --ignore-scripts first.');
    process.exit(1);
  }
  const targets = findFiles(nodePtyDir, [
    path.join('build', 'conpty.vcxproj'),
    path.join('build', 'pty.vcxproj'),
    path.join('build', 'conpty_console_list.vcxproj'),
  ]);
  if (targets.length === 0) {
    console.error('No vcxproj files found. Ensure node-gyp generated project files (after npm rebuild or initial build).');
    process.exit(2);
  }
  let patchedCount = 0;
  for (const f of targets) {
    if (patchFile(f)) patchedCount++;
  }
  if (patchedCount === 0) {
    console.log('No SpectreMitigation settings found to patch.');
  } else {
    console.log(`Patched ${patchedCount} file(s).`);
  }
}

if (require.main === module) {
  run();
}
