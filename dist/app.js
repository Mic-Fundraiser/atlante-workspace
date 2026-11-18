import {projectContext} from './context.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('it-IT').format(n||0);
function bytes(n=0){const units=['B','KB','MB','GB','TB'];let i=0;while(n>=1000 && i<4){n/=1000;i++;}return fmt(Math.round(n*10)/10)+' '+units[i];}
let data,view='overview',diskMode='files';
function generatedProjects(){return data.projects.filter(p=>p.generated>0).sort((a,b)=>b.generated-a.generated);}
const names={overview:'Atlante dei progetti',projects:'Progetti',folders:'Microfile',storage:'Spazio su disco'};
const descriptions={overview:'La mappa dei tuoi progetti e dello spazio che occupano.',projects:'Apri una scheda per ritrovare percorsi, guide e note delle chat.',folders:'Le prime 250 cartelle per numero di file sotto 4 KiB. Il conteggio riguarda i file direttamente nella cartella.',storage:'Esamina i file da 10 MB in su e lo spazio occupato da dipendenze e build.'};
let measurements;
function renderTokens(){
  if(!measurements) return;
  const full=measurements.rows.reduce((n,r)=>n+r.full,0);
  const compact=measurements.rows.reduce((n,r)=>n+r.compact,0);
  const ratio=full?compact/full:0;
  const u=measurements.usage;
  $('seeTokens').textContent='Risparmio token　'+fmt(full?Math.round((1-ratio)*100):0)+'%　↗';
  $('tokenReport').innerHTML='<div class="token-number">'+fmt(Math.round((1-ratio)*100)*(full?1:0))+'%<small> riduzione sul catalogo</small></div>'+
    '<div class="comparison"><span>Schede complete <b>'+fmt(full)+' token</b></span><meter min="0" max="1" value="1"></meter>'+
    '<span>Schede brevi <b>'+fmt(compact)+' token</b></span><meter min="0" max="1" value="'+ratio+'"></meter></div>'+
    '<p>Una lettura per progetto. Sugli utilizzi registrati: '+fmt(u.uses)+' schede brevi richieste o copiate, '+fmt(u.full-u.compact)+' token in meno rispetto alle rispettive schede complete. Il conteggio riguarda il testo delle schede.</p>';
}
async function loadTokens(){
  const r=await fetch('/api/tokens',{cache:'no-store'});
  if(!r.ok) throw Error(await r.text());
  measurements=await r.json();renderTokens();
}
$('seeTokens').onclick=async()=>{
  const panel=$('tokenPanel');panel.hidden=!panel.hidden;
  $('seeTokens').setAttribute('aria-expanded',String(!panel.hidden));
  if(!panel.hidden){panel.focus();try{await loadTokens();}catch(e){$('tokenReport').textContent=e.message;}}
};
function render(){
  const q=$('search').value.toLowerCase(),storage=view==='storage',disk=storage && diskMode==='files',deps=storage && diskMode==='generated',folders=view==='folders';
  $('diskMode').hidden=!storage;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===diskMode)));
  $('title').textContent=names[view];$('crumb').textContent=view==='overview'?'Panoramica':names[view];$('subtitle').textContent=descriptions[view];
  $('workspace').textContent=data.date?'Indice locale · '+new Date(data.date).toLocaleString('it-IT'):'Indice locale';
  $('pick').disabled=!data.roots.length;
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const metrics=[['Dimensione logica',bytes(data.bytes),fmt(data.count)+' file censiti'],['Progetti',fmt(data.projects.length),fmt(data.roots.length)+' cartelle radice'],['Microfile',fmt(data.small),'File inferiori a 4 KiB']];
  $('stats').innerHTML=metrics.map(([k,v,h])=>'<div class="stat"><small>'+k.toUpperCase()+'</small><strong>'+v+'</strong><span>'+h+'</span></div>').join('');
  $('listTitle').textContent=deps?'Spazio per progetto':folders?'Cartelle con microfile':disk?'File grandi':'Catalogo progetti';
  $('search').placeholder=folders?'Cerca cartelle…':disk?'Cerca file…':'Cerca progetti…';
  const items=deps?generatedProjects():folders?(data.folders||[]):disk?data.large:data.projects;
  const shown=items.map((item,i)=>({item,i})).filter(({item})=>[item.path||item.id,item.name,item.description,...item.types||[]].join(' ').toLowerCase().includes(q));
  const rows=shown.slice(0,limit).map(({item,i})=>{
    const name=disk||folders?item.path.split(/[\\/]/).pop():item.name;
    const meta=folders?fmt(item.small)+' microfile · '+item.path:disk?item.path:item.external?'Solo catalogo · '+item.id:item.types.join(' · ')+'　/　'+fmt(item.count)+' file';
    return '<div class="row"><span class="badge">'+(disk?'▤':'▱')+'</span><div class="grow"><strong>'+esc(name)+'</strong><small>'+esc(meta)+'</small></div><span class="size">'+(item.external?'—':bytes(deps?item.generated:item.size))+'</span><button data-item="'+i+'">'+(folders?'Percorso':disk?'Esamina':'Scheda')+'</button></div>';
  });
  $('list').innerHTML=rows.length?'<div class="rowhead"><span class="grow">'+(folders?'Cartella':disk?'File':'Progetto')+'</span><span>Dimensione</span></div>'+rows.join('')+(shown.length>limit?'<div class="actions"><button id="more">Mostra altri</button></div>':''):'<div class="empty"><p>'+(!data.date?'Avvia la prima scansione dalla chat del tuo agente con il comando indicato nel README.':'Nessun risultato per questa vista.')+'</p></div>';
  if($('more')) $('more').onclick=()=>{limit+=60;render();};
}
let limit=60;
async function refresh(){const r=await fetch('/api/index',{cache:'no-store'});if(!r.ok) throw Error(await r.text());data=await r.json();render();await loadTokens();$('status').textContent=data.skipped?data.skipped+' elementi inaccessibili.':'';}
async function action(url,body){const r=await fetch(url,{method:'POST',headers:{'X-Atlante':'local'},body});if(!r.ok) throw Error(await r.text());await refresh();}
$('pick').onclick=async()=>{try{$('pick').disabled=true;$('status').textContent='Scansione in corso…';await action('/api/scan');}catch(e){$('status').textContent=e.message;}finally{$('pick').disabled=false;}};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{diskMode=b.dataset.mode;limit=60;$('search').value='';render();});
$('search').oninput=()=>{limit=60;render();};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{view=b.dataset.view;$('search').value='';limit=60;render();});
$('list').onclick=e=>{
  const button=e.target.closest('[data-item]');if(!button)return;
  const deps=view==='storage'&&diskMode==='generated',disk=view==='storage'&&!deps,folders=view==='folders',p=(deps?generatedProjects():folders?data.folders:disk?data.large:data.projects)[Number(button.dataset.item)];
  const text=folders?p.path:disk?p.path+'\n'+bytes(p.size):projectContext(p,data.notes);
  const token=measurements?.rows.find(r=>r.id===p.id);
  const comparison=token?'<p class="token-detail"><b>'+fmt(token.full-token.compact)+' token in meno</b> · '+fmt(token.full)+' completa → '+fmt(token.compact)+' breve (o200k_base)</p>':'';
  const extra=disk||folders?'':comparison+'<p>'+fmt(text.length)+' caratteri di contesto · limite 1.800</p><p>'+ (p.external?'Scheda dal catalogo esterno.':fmt(p.small)+' microfile · '+bytes(p.generated)+' in cache, dipendenze e build.')+'</p>';
  $('detail').innerHTML='<h2>'+esc(folders?'Cartella':disk?'File selezionato':p.name)+'</h2><pre>'+esc(text)+'</pre>'+extra+'<button id="detailAction">'+(disk?'Sposta nel Cestino…':folders?'Copia percorso':'Copia contesto')+'</button>';
  $('detailAction').onclick=async()=>{try{if(disk){if(!confirm('Spostare nel Cestino questo file?\n'+p.path))return;$('detailAction').disabled=true;await action('/api/trash?file='+encodeURIComponent(p.path));$('modal').close();}else{await navigator.clipboard.writeText(text);$('detailAction').textContent='Copiato';if(!folders){const r=await fetch('/api/copied?id='+encodeURIComponent(p.id),{method:'POST',headers:{'X-Atlante':'local'}});if(!r.ok)throw Error(await r.text());await loadTokens();}}}catch(e){$('detailAction').disabled=false;$('detail').append(document.createTextNode(e.message));}};
  $('modal').showModal();
};
$('roots').onclick=()=>{
  $('detail').innerHTML='<h2>Cartelle indicizzate</h2><p id="sourceInfo"></p><label>Percorsi assoluti, uno per riga<textarea id="rootPaths" rows="7"></textarea></label><button id="applyRoots">Scansiona queste cartelle</button><p id="rootMsg" role="status"></p>';
  $('rootPaths').value=data.roots.join('\n');
  $('sourceInfo').textContent=data.source?'Sorgente attuale: Cervello. '+(data.unavailable||0)+' percorsi non disponibili. Modificando la selezione passerai a un indice manuale.':'Scegli le cartelle da includere nella scansione.';
  $('applyRoots').onclick=async()=>{
    const values=$('rootPaths').value.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!values.length){$('rootMsg').textContent='Inserisci almeno una cartella.';return;}
    if(data.source&&!confirm('Passare dal catalogo Cervello a una selezione manuale?'))return;
    try{$('applyRoots').disabled=true;$('rootMsg').textContent='Scansione in corso…';await action('/api/roots',JSON.stringify(values));$('modal').close();}
    catch(e){$('rootMsg').textContent=e.message;}finally{$('applyRoots').disabled=false;}
  };
  $('modal').showModal();
};
refresh().catch(e=>{$('status').textContent=e.message;});
