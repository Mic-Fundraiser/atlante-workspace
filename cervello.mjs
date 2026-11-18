import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function readCervello(folder) {
  const source = await fs.realpath(folder);
  async function list(name, optional = false) {
    try {
      const rows = JSON.parse(await fs.readFile(path.join(source,'dati',name+'.json'),'utf8'));
      if (!Array.isArray(rows)) throw Error('Elenco non valido: '+name);
      return rows;
    } catch (error) {
      if (optional && error.code === 'ENOENT') return [];
      throw error;
    }
  }
  const paths = new Map();
  async function locate(value) {
    if (typeof value !== 'string') return null;
    const file = value.startsWith('~/') ? path.join(os.homedir(),value.slice(2)) : value;
    if (!path.isAbsolute(file)) return null;
    if (!paths.has(file)) {
      let location = null;
      try { if ((await fs.stat(file)).isDirectory()) location = await fs.realpath(file); } catch {}
      paths.set(file,location);
    }
    return paths.get(file);
  }
  const records = [];
  for (const row of await list('progetti')) {
    records.push({key:String(row.id), name:row.nome || String(row.id), description:String(row.descrizione || '').slice(0,700), local:await locate(row.locale?.percorso || row.locale), stack:typeof row.stack==='string'?row.stack.slice(0,160):''});
  }
  for (const group of ['cartelle','archivi']) {
    for (const row of await list(group,true)) {
      // Some catalogues record the home directory as a placeholder for excluded items.
      if (group === 'archivi' && /esclus[io].*censimento/i.test(String(row.id)+' '+String(row.titolo))) continue;
      await locate(row.percorso);
    }
  }
  return {source,records,roots:[...new Set([...paths.values()].filter(Boolean))],unavailable:[...paths.values()].filter(v=>!v).length};
}
