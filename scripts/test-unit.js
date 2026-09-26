// Keep browser checks in their own command; discover every numerical/controller suite.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.js') && name !== 'browser.test.js')
  .sort().map(name => path.join('tests', name));
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
