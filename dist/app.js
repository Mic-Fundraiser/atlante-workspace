const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('it-IT').format(n||0);
function bytes(n=0){const units=['B','KB','MB','GB','TB'];let i=0;while(n>=1000 && i<4){n/=1000;i++;}return fmt(Math.round(n*10)/10)+' '+units[i];}
let data,view='overview';
const names={overview:'Panoramica',projects:'Progetti',storage:'Spazio su disco'};
const descriptions={overview:'La mappa dei tuoi progetti e dello spazio che occupano.',projects:'Apri una scheda per ritrovare percorsi, guide e note delle chat.',storage:'Esamina i file da 10 MB in su, ordinati dal più pesante.'};
function render(){
  const q=$('search').value.toLowerCase(),disk=view==='storage';
  $('title').textContent=names[view];$('crumb').textContent=names[view];$('subtitle').textContent=descriptions[view];
  $('workspace').textContent=data.date?'Indice locale · '+new Date(data.date).toLocaleString('it-IT'):'Indice locale';
  $('pick').disabled=!data.roots.length;
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const metrics=[['Spazio indicizzato',bytes(data.bytes),fmt(data.count)+' file censiti'],['Progetti',fmt(data.projects.length),fmt(data.roots.length)+' cartelle radice'],['Microfile',fmt(data.small),'File inferiori a 4 KiB']];
  $('stats').innerHTML=metrics.map(([k,v,h])=>'<div class="stat"><small>'+k.toUpperCase()+'</small><strong>'+v+'</strong><span>'+h+'</span></div>').join('');
  $('listTitle').textContent=disk?'File grandi':'Catalogo progetti';
  $('search').placeholder=disk?'Cerca file…':'Cerca progetti…';
  const items=disk?data.large:data.projects;
  const shown=items.map((item,i)=>({item,i})).filter(({item})=>[item.path||item.id,...item.types||[]].join(' ').toLowerCase().includes(q));
  const rows=shown.slice(0,limit).map(({item,i})=>{
    const name=disk?item.path.split(/[\\/]/).pop():item.name;
    const meta=disk?item.path:item.types.join(' · ')+'　/　'+fmt(item.count)+' file';
    return '<div class="row"><span class="badge">'+(disk?'▤':'▱')+'</span><div class="grow"><strong>'+esc(name)+'</strong><small>'+esc(meta)+'</small></div><span class="size">'+bytes(item.size)+'</span><button data-item="'+i+'">'+(disk?'Esamina':'Scheda')+'</button></div>';
  });
  $('list').innerHTML=rows.length?'<div class="rowhead"><span class="grow">'+(disk?'File':'Progetto')+'</span><span>Dimensione</span></div>'+rows.join('')+(shown.length>limit?'<div class="actions"><button id="more">Mostra altri</button></div>':''):'<div class="empty"><p>'+(!data.date?'Avvia la prima scansione dalla chat del tuo agente con il comando indicato nel README.':'Nessun risultato per questa vista.')+'</p></div>';
  if($('more')) $('more').onclick=()=>{limit+=60;render();};
}
let limit=60;
async function refresh(){const r=await fetch('/api/index',{cache:'no-store'});if(!r.ok) throw Error(await r.text());data=await r.json();render();$('status').textContent=data.skipped?data.skipped+' elementi inaccessibili.':'';}
async function action(url){const r=await fetch(url,{method:'POST',headers:{'X-Atlante':'local'}});if(!r.ok) throw Error(await r.text());await refresh();}
$('pick').onclick=async()=>{try{$('pick').disabled=true;$('status').textContent='Scansione in corso…';await action('/api/scan');}catch(e){$('status').textContent=e.message;}finally{$('pick').disabled=false;}};
$('search').oninput=()=>{limit=60;render();};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{view=b.dataset.view;$('search').value='';limit=60;render();});
$('list').onclick=e=>{
  const button=e.target.closest('[data-item]');if(!button)return;
  const disk=view==='storage',p=(disk?data.large:data.projects)[Number(button.dataset.item)];
  const text=disk?p.path+'\n'+bytes(p.size):[p.id,p.types.join(', '),'Guide: '+(p.guides.join(', ')||'—'),'Build e dipendenze: '+bytes(p.generated),...data.notes.filter(n=>n.id===p.id).slice(-5).map(n=>n.text)].join('\n');
  $('detail').innerHTML='<h2>'+esc(disk?'File selezionato':p.name)+'</h2><pre>'+esc(text)+'</pre><button id="detailAction">'+(disk?'Sposta nel Cestino…':'Copia contesto')+'</button>';
  $('detailAction').onclick=async()=>{try{if(disk){if(!confirm('Spostare nel Cestino questo file?\n'+p.path))return;$('detailAction').disabled=true;await action('/api/trash?file='+encodeURIComponent(p.path));$('modal').close();}else{await navigator.clipboard.writeText(text);$('detailAction').textContent='Copiato';}}catch(e){$('detailAction').disabled=false;$('detail').append(document.createTextNode(e.message));}};
  $('modal').showModal();
};
refresh().catch(e=>{$('status').textContent=e.message;});
