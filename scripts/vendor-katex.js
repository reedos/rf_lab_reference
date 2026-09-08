// Reproduce the committed static assets from the lockfile-pinned dev dependency.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules', 'katex');
const target = path.join(root, 'vendor', 'katex');
fs.mkdirSync(target, {recursive:true});
for (const file of ['katex.min.js', 'katex.min.css']) fs.copyFileSync(path.join(source, 'dist', file), path.join(target, file));
fs.cpSync(path.join(source, 'dist', 'fonts'), path.join(target, 'fonts'), {recursive:true});
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
