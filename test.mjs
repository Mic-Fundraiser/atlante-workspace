import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('indice condiviso tra sessioni, note e installazione ripetibile',async t=>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'atlante-'));
  t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
  const root=path.join(tmp,'work'), nested=path.join(root,'mobile');
  await fs.mkdir(nested,{recursive:true});
  await fs.writeFile(path.join(root,'package.json'),'{}');
  await fs.writeFile(path.join(nested,'Package.swift'),'');
  const deps=path.join(root,'node_modules','lib');
  await fs.mkdir(deps,{recursive:true});await fs.writeFile(path.join(deps,'package.json'),'{}');
  const env={...process.env,HOME:tmp,USERPROFILE:tmp,CODEX_HOME:path.join(tmp,'.codex'),CLAUDE_CONFIG_DIR:path.join(tmp,'.claude'),ATLANTE_HOME:path.join(tmp,'data')};
  const run=(...args)=>execFileSync(process.execPath,[fileURLToPath(new URL('./atlante.mjs',import.meta.url)),...args],{env,encoding:'utf8'});
  assert.match(run('scan',root),/2 progetti/);
  assert.equal(JSON.parse(run('ctx','work')).generated,2);
  run('log','mobile','Fatture elettroniche');run('scan');
  assert.match(run('find','fatture'),/mobile/);
  assert.equal(JSON.parse(run('ctx','mobile')).notes.length,1);
  await fs.mkdir(env.CLAUDE_CONFIG_DIR);const rules=path.join(env.CLAUDE_CONFIG_DIR,'CLAUDE.md');
  await fs.writeFile(rules,'Regola esistente');run('install');
  const first=await fs.readFile(rules,'utf8');run('install');
  assert.equal(await fs.readFile(rules,'utf8'),first);
  assert.match(first,/Regola esistente/);assert.match(first,/brief/);
});

test('importa progetti locali e remoti, classifica microfile e limita il contesto',async t=>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'atlante-import-'));
  t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
  const data=path.join(tmp,'cervello','dati');
  const work=path.join(tmp,'documenti');
  await fs.mkdir(data,{recursive:true});await fs.mkdir(work);
  await fs.writeFile(path.join(work,'bozza.txt'),'bozza');
  await fs.writeFile(path.join(data,'progetti.json'),JSON.stringify([
    {id:'locale',nome:'Quaderno',locale:{percorso:work}},
    {id:'remoto',nome:'Archivio',descrizione:'Raccolta storica'}
  ]));
  const env={...process.env,ATLANTE_HOME:path.join(tmp,'state')};
  const run=(...args)=>execFileSync(process.execPath,[fileURLToPath(new URL('./atlante.mjs',import.meta.url)),...args],{env,encoding:'utf8'});
  run('cervello',path.dirname(data));run('scan');
  const index=JSON.parse(await fs.readFile(path.join(env.ATLANTE_HOME,'index.json')));
  assert.equal(index.projects.length,2);
  assert.equal(index.folders[0].small,1);
  assert.match(run('find','storica'),/cervello:remoto/);
  for(let i=0;i<5;i++) run('log','Quaderno','x'.repeat(500));
  assert.ok(run('pack','Quaderno').trimEnd().length<=1800);
  assert.match(run('pack','cervello:remoto'),/Raccolta storica/);
});

test('estratti mirati riusati solo nella stessa chat e invalidati dopo una modifica',async t=>{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'atlante-compact-'));
  t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
  const root=path.join(tmp,'quaderno');await fs.mkdir(root);
  await fs.writeFile(path.join(root,'package.json'),'{}');
  const file=path.join(root,'manuale.md');
  await fs.writeFile(file,'documentazione del servizio\n'.repeat(120)+'ricerca: fatture\n');
  const env={...process.env,ATLANTE_HOME:path.join(tmp,'state')};
  const run=(...args)=>execFileSync(process.execPath,[fileURLToPath(new URL('./atlante.mjs',import.meta.url)),...args],{env,encoding:'utf8'});
  run('scan',root);
  assert.match(run('focus','quaderno'),/quaderno/);
  const read=id=>run('excerpt','quaderno','manuale.md','fatture',id);
  assert.match(read('a'),/121 \| ricerca/);
  assert.match(read('a'),/invariato/);
  assert.match(read('b'),/121 \| ricerca/);
  await fs.appendFile(file,'fatture aggiornate\n');assert.match(read('a'),/fatture aggiornate/);
  const events=(await fs.readFile(path.join(env.ATLANTE_HOME,'token-use.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.every(e=>e.compact<=e.full && e.day));assert.equal(events.filter(e=>e.kind==='reuse').length,1);
});
