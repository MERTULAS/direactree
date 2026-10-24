const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, 'react17');
const reactPackage = path.join(root, 'node_modules', 'react', 'package.json');

if (!fs.existsSync(reactPackage)) {
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
}

const version = JSON.parse(fs.readFileSync(reactPackage, 'utf8')).version;
if (!version.startsWith('17.')) {
  throw new Error(`React 17 tests resolved React ${version}`);
}
