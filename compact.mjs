import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {countTokens} from 'gpt-tokenizer/encoding/o200k_base';
import {recordUse} from './tokens.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export async function emitCompact(state, raw, candidate, kind) {
  const full=countTokens(raw), short=countTokens(candidate);
  const output=short<full ? candidate : raw;
  process.stdout.write(output);
  await recordUse(state,{full,compact:Math.min(full,short),kind});
}
export async function excerpt(state, project, relative, term, session) {
  if(project.external || !relative || !term) throw Error('Uso: excerpt PROGETTO FILE PAROLA [ID_CHAT]');
  const file=await fs.realpath(path.resolve(project.id,relative));
  const rel=path.relative(project.id,file);
  if(!rel || rel.startsWith('..'+path.sep) || rel==='..' || path.isAbsolute(rel)) throw Error('File esterno al progetto.');
  const stat=await fs.stat(file);
  if(!stat.isFile() || stat.size>2_000_000) throw Error('Serve un file testuale fino a 2 MB.');
  const raw=await fs.readFile(file,'utf8');
  if(raw.includes('\0')) throw Error('File binario.');
  const lines=raw.split(/\r?\n/), wanted=term.toLowerCase();
  const picked=new Set();let hits=0;
  for(let i=0;i<lines.length;i++) if(lines[i].toLowerCase().includes(wanted)){
    hits++;
    if(hits<=12) for(let j=Math.max(0,i-1);j<=Math.min(i+1,lines.length-1);j++) picked.add(j);
  }
  let text=hits+' corrispondenze · '+rel+'\n';
  for(const i of picked) text+=(i+1)+' | '+(lines[i].length>400?lines[i].slice(0,400)+'…':lines[i])+'\n';
  if(hits>12) text+='Mostrate le prime 12. Restringi la ricerca.\n';
  let marker, digest, kind='excerpt';
  if(session && hits) {
    const dir=path.join(state,'read-cache');await fs.mkdir(dir,{recursive:true,mode:0o700});
    marker=path.join(dir,hash(JSON.stringify([session,file,term])));
    digest=hash(raw);
    let previous;
    try{previous=await fs.readFile(marker,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(previous===digest){text='Estratto invariato in questa chat: '+rel+' · '+term+'\n';kind='reuse';}
  }
  await emitCompact(state,raw,text,kind);
  if(marker) await fs.writeFile(marker,digest,{mode:0o600});
}
export async function filterInput(state){
  const chunks=[];let size=0;
  for await(const chunk of process.stdin){size+=chunk.length;if(size>4_000_000)throw Error('Input oltre 4 MB.');chunks.push(chunk);}
  const raw=Buffer.concat(chunks).toString();
  const lines=raw.split('\n'),out=[];
  for(let i=0;i<lines.length;){
    let end=i+1;
    while(end<lines.length && lines[end]===lines[i])end++;
    out.push(lines[i]);if(end-i>1)out.push('↳ ×'+(end-i)+' righe identiche in totale');
    i=end;
  }
  await emitCompact(state,raw,out.join('\n'),'filter');
}
