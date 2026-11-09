'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Piot = require('../piot.js');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

const expected = ['tochka', 'vtb', 'alfa', 'psb'];
assert.deepEqual(Piot.BANKS.map(bank => bank.id).sort(), [...expected].sort());
const logoBlock = app.match(/const BANK_LOGOS=\{([\s\S]*?)\};/);
assert.ok(logoBlock, 'BANK_LOGOS mapping exists');
const logoIds = [...logoBlock[1].matchAll(/^\s*(\w+):/gm)].map(match => match[1]);
assert.deepEqual(logoIds.sort(), [...expected].sort());
assert.match(css, /\.bank-logo-image\{[^}]*width:120px[^}]*height:34px/s);
assert.match(css, /@media\(max-width:1100px\)[\s\S]*?\.bank-logo-image\{[^}]*width:108px[^}]*height:32px/s);
console.log('Bank logo tests passed: 4 banks, shared compact sizing (desktop 120×34 px; mobile 108×32 px)');
