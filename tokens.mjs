import fs from 'node:fs/promises';
import path from 'node:path';
import {countTokens} from 'gpt-tokenizer/encoding/o200k_base';
import {projectContext} from './dist/context.js';

export function fullContext(project, notes) {
  return JSON.stringify({...project, notes:notes.filter(n=>n.id===project.id).slice(-5)},null,2);
}
export function compare(project, notes) {
  return {full:countTokens(fullContext(project,notes)), compact:countTokens(projectContext(project,notes))};
}
export async function recordUse(state, measurement) {
  await fs.appendFile(path.join(state,'token-use.jsonl'),JSON.stringify(measurement)+'\n',{mode:0o600});
}
export async function usage(state) {
  const total={uses:0,full:0,compact:0};
  try {
    const raw=await fs.readFile(path.join(state,'token-use.jsonl'),'utf8');
    for(const line of raw.trim().split('\n').filter(Boolean)) {
      const item=JSON.parse(line);
      total.uses++;total.full+=item.full;total.compact+=item.compact;
    }
  } catch(e) { if(e.code!=='ENOENT') throw e; }
  return total;
}
