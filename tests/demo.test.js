'use strict';
const assert = require('node:assert/strict');

global.Piot = require('../piot.js');
global.window = {};
require('../demo.js');

(async () => {
  const initial = await window.PIOT_DEMO.call('apiGetData');
  assert.ok(Array.isArray(initial.records) && initial.records.length > 0);
  assert.ok(initial.ledger && initial.config && Array.isArray(initial.months));

  const month = initial.currentMonth;
  const savedMonth = await window.PIOT_DEMO.call('apiSaveMonth', {
    month,
    patch: { plan: 77, esp: 1234.5 },
    revision: initial.ledger[month].revision
  });
  assert.equal(savedMonth.value.plan, 77);
  assert.equal(savedMonth.value.esp, 1234.5);

  const savedConfig = await window.PIOT_DEMO.call('apiSaveConfig', {
    config: { ...initial.config, perPage: 10 },
    revision: initial.config.revision
  });
  assert.equal(savedConfig.perPage, 10);

  const reloaded = await window.PIOT_DEMO.call('apiGetData');
  assert.equal(reloaded.ledger[month].plan, 77);
  assert.equal(reloaded.ledger[month].esp, 1234.5);
  assert.equal(reloaded.config.perPage, 10);

  console.log('Demo API tests passed: 8 assertions (load, month save, settings save and persistence)');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
