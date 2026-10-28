import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
test('old scheduled task exits without creating a database or starting an export',()=>{const db=join(tmpdir(),`shikomi-disabled-${randomUUID()}.sqlite3`);execFileSync(process.execPath,[fileURLToPath(new URL('./runner.mjs',import.meta.url)),'--action','scheduled','--db',db],{timeout:10000,windowsHide:true});assert.equal(existsSync(db),false);});
