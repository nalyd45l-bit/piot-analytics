'use strict';
const assert = require('node:assert/strict');
const Piot = require('../piot.js');

const config = Piot.defaults();

// Date, month and amount normalization.
assert.equal(Piot.validMonth('2026-11'), true);
assert.equal(Piot.validMonth('2026-13'), false);
assert.equal(Piot.date('29.02.2024'), '2024-02-29');
assert.equal(Piot.date('29.02.24'), '2024-02-29');
assert.equal(Piot.date('29.02.2024x'), '');
assert.equal(Piot.date('31.02.2024'), '');
assert.equal(Piot.amount('12 345,67 ₽'), 12345.67);
assert.equal(Piot.amount('not-a-number'), null);

// Manual ledger input validation.
assert.deepEqual(Piot.validatePatch({ plan: 12, esp: 1500.25 }), { plan: 12, esp: 1500.25 });
assert.throws(() => Piot.validatePatch({ plan: -1 }), /неотрицательное/);
assert.throws(() => Piot.validatePatch({ plan: 1.5 }), /целым/);
assert.throws(() => Piot.validatePatch({ unknown: 1 }), /Неизвестное поле/);
assert.deepEqual(Piot.validateConfig(config).perPage, 25);
assert.throws(() => Piot.validateConfig({ ...config, perPage: 17 }), /размер страницы/);

const records = [
  { numero: '1', partner: 'LIFE PAY', client: 'Клиент А.А.', status: 'Выполнена', taskStatus: 'Клиент настроен с нашей помощью', amount: 1000, responsible: 'Иванов', priority: 'Высокий', date: '2026-11-01', dateStatus: '2026-11-02', customer: 'ВТБ', legalEntity: 'ВТБ', source: 'main' },
  { numero: '2', partner: 'Авт Биз', client: 'Клиент Б.Б.', status: 'В работе', taskStatus: 'Задача выполнена: клиент оплатил СП', amount: 2000, responsible: 'Петрова', priority: 'Средний', date: '2026-11-03', dateStatus: '2026-11-04', customer: 'Альфа-Банк', legalEntity: 'Альфа-Банк', source: 'main' },
  { numero: '3', partner: 'LIFE PAY', client: 'Клиент В.В.', status: 'Новая заявка', taskStatus: 'Счет отправил', amount: 5000, responsible: 'Сидоров', priority: 'Низкий', date: '2026-11-05', dateStatus: '', customer: 'Точка', legalEntity: 'Точка', source: 'main' },
  { numero: '4', partner: 'LIFE PAY', client: 'Без задачи ЕСП', status: '', taskStatus: '', amount: 15000, responsible: '', priority: '', date: '2026-11-06', dateStatus: '', customer: '', legalEntity: '', source: 'noesp' }
];

const summary = Piot.summary(records, config);
assert.equal(summary.total, 3); // records from source "noesp" are not applications
assert.equal(summary.done, 2);
assert.equal(summary.revenue, 18000);
assert.equal(summary.invoice, 5000);
assert.equal(summary.lp, 16000);
assert.equal(summary.sp, 2000);

const filtered = Piot.filter(records, { month: '2026-11', partner: 'LIFE PAY', status: '', task: '', responsible: '', priority: '', bank: '', q: 'Клиент А' }, config);
assert.equal(filtered.length, 1);
assert.equal(filtered[0].numero, '1');

const events = Piot.eventSummary(records, config, '2026-11');
assert.equal(events.done, 2);
assert.equal(events.open, 1);

const income = Piot.income(records, { '2026-11': { esp: 500 } }, '2026-11', config);
assert.equal(income.esp, 500);
assert.equal(income.total, 18500);

const csv = Piot.csv([{ value: '=1+1', label: 'A"B' }], [['value', 'Value'], ['label', 'Label']]);
assert.match(csv, /'=1\+1/);
assert.match(csv, /A""B/);

console.log('PIOT core tests passed: 28 assertions');
