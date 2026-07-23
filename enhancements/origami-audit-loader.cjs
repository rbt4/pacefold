'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const source = path.join(__dirname, 'origami-source');
const prefix = 'origami-audit.impl.cjs.gz.b64.part-';
const parts = fs.readdirSync(source).filter(file => file.startsWith(prefix)).sort();
if (!parts.length) throw new Error('Missing compressed Pacefold Origami audit source');
const encoded = parts.map(file => fs.readFileSync(path.join(source, file), 'utf8')).join('');
const target = path.join('/tmp', `pacefold-origami-audit-${process.pid}.cjs`);
fs.writeFileSync(target, zlib.gunzipSync(Buffer.from(encoded, 'base64')));
require(target);
