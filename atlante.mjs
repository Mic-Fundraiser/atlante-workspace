import {projectContext} from './dist/context.js';
import {readCervello} from './cervello.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const script = fileURLToPath(import.meta.url);
const state = process.env.ATLANTE_HOME || path.join(os.homedir(),'.atlante');
await fs.mkdir(state,{recursive:true,mode:0o700});
const db = path.join(state,'index.json');
const [command='brief', ...args] = process.argv.slice(2);
const markers = new Map(Object.entries({'package.json':'Node.js','pyproject.toml':'Python','requirements.txt':'Python','Cargo.toml':'Rust','go.mod':'Go','Package.swift':'Swift','composer.json':'PHP','pom.xml':'Java','.git':'Git'}));
const generated = new Set(['node_modules','.venv','.build','.next','__pycache__','target','dist','build']);
const guides = new Set(['README.md','CLAUDE.md','AGENTS.md','GEMINI.md']);
async function load() {
  try { return JSON.parse(await fs.readFile(db,'utf8')); }
  catch(e) { if(e.code === 'ENOENT') return {roots:[],projects:[],large:[],skipped:0}; throw e; }
}
async function atomic(file,value) {
  const tmp = file + '.' + randomUUID();
  await fs.writeFile(tmp,value,{mode:0o600});
  await fs.rename(tmp,file);
}
async function scan(inputs, catalog = null) {
  const seen = new Set();
  for(const input of inputs) {
    const root = await fs.realpath(input);
    if(!(await fs.stat(root)).isDirectory()) throw Error('Serve una cartella: '+root);
    seen.add(root);
  }
  const roots = [...seen].filter(r=>![...seen].some(s=>s!==r && !path.relative(s,r).startsWith('..'+path.sep) && path.relative(s,r)!=='..' && !path.isAbsolute(path.relative(s,r))));
  if(!roots.length && !catalog) throw Error('Indica una cartella: node atlante.mjs scan <cartella>');
  const known=new Map((catalog?.records || []).filter(p=>p.local).map(p=>[p.local,p]));
  const folders=[];
  const result={roots,source:catalog?.source,unavailable:catalog?.unavailable || 0,projects:[],large:[],skipped:0,bytes:0,small:0,count:0,date:new Date().toISOString()};
  for(const root of roots) {
    const pending=[[root,null,false]];
    while(pending.length) {
      const [dir,parent,isGenerated]=pending.pop();
      let entries;
      try { entries=await fs.readdir(dir,{withFileTypes:true}); }
      catch(e) {
        if(dir===root && !catalog) throw e;
        result.skipped++;
        if(dir===root) result.unavailable++;
        continue;
      }
      let owner=parent;
      const names=entries.filter(e=>e.isFile() || (e.name==='.git' && e.isDirectory())).map(e=>e.name);
      const types=[...new Set(names.filter(n=>markers.has(n)).map(n=>markers.get(n)))];
      const record=known.get(dir);
      if((record || types.length) && !isGenerated) {
        owner={id:dir,name:record?.name || path.basename(dir),description:record?.description,brainId:record?.key,types:types.length ? types : [record?.stack || 'Progetto'],guides:names.filter(n=>guides.has(n)||markers.has(n)&&n!=='.git'),size:0,small:0,count:0,generated:0};
        result.projects.push(owner);
      }
      const group={path:dir,small:0,size:0,generated:isGenerated};
      for(const entry of entries) {
        const file=path.join(dir,entry.name);
        if(entry.name.startsWith('.') && !generated.has(entry.name) || file===state || entry.isSymbolicLink()) continue;
        if(entry.isDirectory()) { pending.push([file,owner,isGenerated||generated.has(entry.name)]); continue; }
        if(!entry.isFile()) continue;
        let stat;
        try {stat=await fs.lstat(file);} catch {result.skipped++;continue;}
        if(!stat.isFile()) continue;
        result.bytes+=stat.size; result.count++;
        if(stat.size<4096) {result.small++;group.small++;group.size+=stat.size;}
        if(owner) {owner.size+=stat.size;owner.count++;if(stat.size<4096) owner.small++;if(isGenerated) owner.generated+=stat.size;}
        if(stat.size>=10_000_000) result.large.push({path:file,size:stat.size,modified:stat.mtimeMs,ino:stat.ino});
      }
      if(group.small) folders.push(group);
    }
  }
  result.folders=folders.sort((a,b)=>b.small-a.small || b.size-a.size).slice(0,250);
  const indexed=new Set(result.projects.map(p=>p.brainId));
  for(const r of catalog?.records || []) if(!indexed.has(r.key)) result.projects.push({id:'cervello:'+r.key,brainId:r.key,name:r.name,description:r.description,types:[r.stack || 'Progetto'],external:true,guides:[],size:0,small:0,count:0,generated:0});
  result.large.sort((a,b)=>b.size-a.size);
  result.projects.sort((a,b)=>a.id.localeCompare(b.id));
  await atomic(db,JSON.stringify(result));
  return result;
}
const notesFile=path.join(state,'notes.jsonl');
async function notes() {
  try{return (await fs.readFile(notesFile,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}
  catch(e){if(e.code==='ENOENT')return [];throw e;}
}
function brief(c) {return `Atlante · ${c.projects.length} progetti · ${c.date || 'indice vuoto'}\nRadici: ${c.roots.slice(0,4).join(', ')}\n${c.projects.slice(0,5).map(p=>p.name+' · '+p.types.join('/')).join('\n')}\nUsa find <parola>, poi pack <percorso> per la scheda breve.`;}
async function install() {
  const dir=os.homedir();
  const files=[path.join(process.env.CODEX_HOME||path.join(dir,'.codex'),'AGENTS.md'),path.join(process.env.CLAUDE_CONFIG_DIR||path.join(dir,'.claude'),'CLAUDE.md'),path.join(dir,'.gemini','GEMINI.md')];
  const begin='<!-- atlante:start -->',end='<!-- atlante:end -->';
  const quoted="'"+script.replaceAll("'","'\\''")+"'";
  const rule=[begin,'## Atlante — indice locale dei progetti', 'A ogni nuova chat esegui prima `node '+quoted+' brief`. Per un lavoro su un progetto usa `find <parola>` e poi `pack <percorso>` (massimo 1.800 caratteri, usa `ctx` per approfondire) con lo stesso comando. Consulta solo le guide pertinenti. Registra cambiamenti durevoli con `log <percorso> <nota>`; aggiorna la scansione se sono cambiati i progetti. Le note devono essere prive di segreti.',end].join('\n');
  for(const file of files) {
    await fs.mkdir(path.dirname(file),{recursive:true});
    let old='';
    try{old=await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    const start=old.indexOf(begin), stop=old.indexOf(end);
    if((start<0)!==(stop<0)||stop>=0 && stop<start) throw Error('Blocco incompleto in '+file);
    const next=start<0 ? old+'\n'+rule+'\n' : old.slice(0,start)+rule+old.slice(stop+end.length);
    if(next!==old) {if(old) await fs.copyFile(file,file+'.atlante-backup-'+randomUUID());await atomic(file,next);}
    console.log(file);
  }
}
const macTrashScript = `
  ObjC.import('Foundation');
  function run(argv) {
    const url = $.NSURL.fileURLWithPath(argv[0]);
    const error = Ref();
    if (!$.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError(url, null, error)) {
      throw Error(ObjC.unwrap(error[0].localizedDescription));
    }
  }
`;
async function serve() {
  const port=Number(process.env.PORT||4317);
  const server=http.createServer(async(req,res)=>{
    const host='127.0.0.1:'+port;
    if(req.headers.host!==host || req.headers.origin && req.headers.origin!=='http://'+host) {res.writeHead(403).end();return;}
    try {
      const url=new URL(req.url,'http://'+host);
      if(url.pathname==='/api/index' && req.method==='GET') {
        const c=await load(); res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...c,notes:await notes()}));return;
      }
      if(url.pathname==='/api/scan' && req.method==='POST' && req.headers['x-atlante']==='local') {
        const c=await load();const catalog=c.source ? await readCervello(c.source) : null; await scan(catalog?.roots || c.roots,catalog);res.end('ok');return;
      }
      if(url.pathname==='/api/trash' && req.method==='POST' && req.headers['x-atlante']==='local') {
        const c=await load(), file=url.searchParams.get('file');
        const item=c.large.find(f=>f.path===file);
        if(!item || await fs.realpath(file)!==file) throw Error('Aggiorna prima la scansione.');
        const st=await fs.lstat(file);
        if(!st.isFile() || st.ino!==item.ino || st.mtimeMs!==item.modified || st.size!==item.size) throw Error('File cambiato. Aggiorna la scansione.');
        if(process.platform==='darwin') await run('osascript',['-l','JavaScript','-e', macTrashScript,file]);
        else if(process.platform==='linux') await run('gio',['trash',file]);
        else throw Error('Cestino disponibile su macOS e Linux con gio.');
        const catalog=c.source ? await readCervello(c.source) : null; await scan(catalog?.roots || c.roots,catalog); res.end('ok');return;
      }
      if(url.pathname==='/api/roots' && req.method==='POST' && req.headers['x-atlante']==='local') {
        let body='';
        for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>1024*1024) throw Error('Troppi percorsi.');}
        const roots=JSON.parse(body);
        if(!Array.isArray(roots) || !roots.length || roots.some(r=>typeof r!=='string' || !path.isAbsolute(r))) throw Error('Inserisci un percorso assoluto per riga.');
        await scan(roots);res.end('ok');return;
      }
      const assets=new Map([['/',['index.html','text/html']],['/context.js',['context.js','text/javascript']],['/app.js',['app.js','text/javascript']],['/style.css',['style.css','text/css']]]);
      const asset=assets.get(url.pathname);
      if(!asset || req.method!=='GET'){res.writeHead(404).end();return;}
      res.setHeader('Content-Type',asset[1]+'; charset=utf-8');
      res.end(await fs.readFile(path.join(path.dirname(script),'dist',asset[0])));
    }catch(e){res.writeHead(400).end(e.message);}
  });
  server.listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port));
}
try {
  const c=await load();
  if(command==='cervello' || command==='scan' && !args.length && c.source) {
    const catalog=await readCervello(command==='cervello' ? (args[0] || path.join(os.homedir(),'cervello')) : c.source);
    console.log(brief(await scan(catalog.roots,catalog)));
  } else if(command==='scan') console.log(brief(await scan(args.length?args:c.roots)));
  else if(command==='brief') console.log(brief(c));
  else if(command==='find') {
    const q=args.join(' ').toLowerCase();
    const history=await notes();
    const ids=new Set(history.filter(n=>n.text.toLowerCase().includes(q)).map(n=>n.id));
    const hits=c.projects.filter(p=>[p.id,p.name,p.description,p.brainId,...p.types].join(' ').toLowerCase().includes(q)||ids.has(p.id));
    console.log(hits.length+' risultati\n'+hits.slice(0,15).map(p=>p.id+' | '+p.types.join(', ')).join('\n'));
  } else if(command==='ctx'||command==='pack'||command==='log') {
    const matches=c.projects.filter(p=>p.id===args[0]||p.name===args[0]);
    if(matches.length!==1) throw Error('Usa find e indica un percorso univoco.');
    const p=matches[0];
    if(command==='pack') console.log(projectContext(p,await notes()));
    else if(command==='ctx') console.log(JSON.stringify({...p,notes:(await notes()).filter(n=>n.id===p.id).slice(-5)},null,2));
    else {const text=args.slice(1).join(' ').trim();if(!text||text.length>500)throw Error('Nota da 1 a 500 caratteri.');await fs.appendFile(notesFile,JSON.stringify({id:p.id,date:new Date().toISOString(),text})+'\n',{mode:0o600});}
  } else if(command==='install') await install();
  else if(command==='serve') await serve();
  else throw Error('Comandi: scan, cervello, install, brief, find, pack, ctx, log, serve');
} catch(e){console.error(e.message);process.exitCode=1;}
