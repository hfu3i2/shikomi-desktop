import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalizeSettings,inheritedTables,validateTables} from './domain.ts';
test('legacy settings inherit three demo tables without replacing dishes',()=>{const s=normalizeSettings(structuredClone(defaults));assert.deepEqual(s.tables,inheritedTables);assert.equal(s.tables?.length,3);assert.deepEqual(s.courses.map(c=>c.id),defaults.courses.map(c=>c.id));s.tables![0].capacity=99;assert.equal(inheritedTables[0].capacity,4);});
test('edited and intentionally empty tables survive normalization and JSON',()=>{for(const tables of [[],[{number:'Counter',capacity:7}]]){const s=normalizeSettings({...structuredClone(defaults),tables});assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(s))).tables,tables);}});
test('table names and capacities validate before save',()=>{assert.equal(validateTables([{number:'11',capacity:4}]),undefined);for(const tables of [[{number:' ',capacity:4}],[{number:'11',capacity:0}],[{number:'11',capacity:1.5}],[{number:'11',capacity:4},{number:' 11 ',capacity:2}]])assert.ok(validateTables(tables));});

