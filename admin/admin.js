'use strict';
(function(){
var REPO='EnderSsh/shpilka',API='https://api.github.com/repos/'+REPO;
var projects=(window.SHPILKA_PROJECTS||[]).map(function(p){return JSON.parse(JSON.stringify(p))});
var token='', connected=false, changed=false, busy=false, importMode=false, importedZip=null;
var DRAFTKEY='shpilka-admin-local-draft-v1',draftRestored=false;
try{var saved=JSON.parse(localStorage.getItem(DRAFTKEY)||'null');if(saved&&Array.isArray(saved.projects)){projects=saved.projects;changed=true;draftRestored=true}}catch(e){console.warn('Unable to restore local draft',e)}
function saveLocalDraft(){try{if(pending.size){localStorage.removeItem(DRAFTKEY);return false}localStorage.setItem(DRAFTKEY,JSON.stringify({projects:projects,storedAt:Date.now()}));return true}catch(e){console.warn('Local draft storage failed',e);return false}}
var pending=new Map(), previews=new Map(), uploadedCache=new Map(), editIndex=-1, editPhotos=[], editCover='', showAllPhotos=false;
var remoteBaseSha=null, photosProcessing=false, editorSubmitting=false;
var $=function(id){return document.getElementById(id)};
function msg(s){$('message').textContent=s; if($('listStatus'))$('listStatus').textContent=s}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]})}
function slug(s){return String(s||'projekt').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'projekt'}
function uniqueID(t){var base=slug(t), id=base, i=2;while(projects.some(function(p){return p.id===id})){id=base+'-'+i++}return id}
function render(){
 $('list').innerHTML='';
 projects.forEach(function(p,i){
  var box=document.createElement('div');box.className='item';
  var im=document.createElement('img');im.alt='';im.loading='lazy';im.src=previewFor(p.cover)||p.cover||'/favicon.png';box.appendChild(im);thumb(p.cover,im);
  var info=document.createElement('div');info.className='itemmain';info.innerHTML='<strong>'+esc(p.title)+'</strong><small>'+esc(p.location)+' · '+esc(p.area)+' · '+(p.images||[]).length+' fotografií</small>';box.appendChild(info);
  var actions=document.createElement('div');actions.className='controls';
  var b=document.createElement('button');b.className='admbtn';b.textContent='Upraviť';b.onclick=function(){openEdit(i)};actions.appendChild(b);
  var d=document.createElement('button');d.className='admbtn warn';d.textContent=connected?'Odstrániť z webu':'Odstrániť (koncept)';d.disabled=busy;d.onclick=function(){if(busy)return;var prompt=connected?'Naozaj odstrániť „'+p.title+'“ zo živého webu shpilka.sk?':'Odstrániť „'+p.title+'“ iba z miestneho konceptu? Bez pripojenia GitHub sa web nezmení.';if(!confirm(prompt))return;projects.splice(i,1);changed=true;saveLocalDraft();render();msg(connected?'Odstraňujem realizáciu zo živého webu…':'Odstránené len z konceptu. Po pripojení GitHub kliknite na „Publikovať na webe“.');if(connected)publish(true)};actions.appendChild(d);
  box.appendChild(actions);$('list').appendChild(box);
 });
 if(!projects.length)$('list').innerHTML='<p>Žiadne realizácie.</p>';
 summary();
}
function summary(){
 var images=projects.reduce(function(n,p){return n+(p.images||[]).length},0);
 $('summary').textContent=projects.length+' realizácií · '+images+' fotografií. '+(changed?'Máte neprenesené zmeny.':'Zatiaľ bez zmien.');
 $('publishBtn').disabled=!connected||!changed||busy;
 $('newBtn').disabled=busy;$('zipInput').disabled=busy;
 $('refreshBtn').disabled=busy;$('disconnect').disabled=busy||!connected;$('connect').disabled=busy||connected;
 $('saveBtn').disabled=busy||photosProcessing;$('savePublishBtn').disabled=busy||photosProcessing;
}
function previewFor(src){return previews.get((src||'').replace(/^\//,''))||''}
async function thumb(src,img){
 var key=(src||'').replace(/^\//,'');
 if(previews.has(key)){img.src=previews.get(key);return}
 var f=pending.get(key);
 if(!f)return;
 try{var blob=(f&&typeof f.async==='function')?await f.async('blob'):f;
 var u=URL.createObjectURL(blob);previews.set(key,u);if(img.isConnected)img.src=u}catch(e){console.error(e)}
}
function renderThumbs(){
 var root=$('photoGrid');root.innerHTML='';
 var list=showAllPhotos?editPhotos:editPhotos.slice(0,36);
 list.forEach(function(p,i){
  var div=document.createElement('div');div.className='photoTile';
  var im=document.createElement('img');im.loading='lazy';im.alt='Fotografia '+(i+1);im.src=previewFor(p.src)||p.src||'/favicon.png';div.appendChild(im);thumb(p.src,im);
  var c=document.createElement('div');c.style.fontSize='11px';c.textContent=(i+1)+' / '+editPhotos.length;div.appendChild(c);
  var sel=document.createElement('select');['Pred rekonštrukciou','Priebeh rekonštrukcie','Výsledok','Galéria'].forEach(function(s){var o=document.createElement('option');o.text=s;o.value=s;sel.add(o)});sel.value=p.stage||'Galéria';sel.onchange=function(){p.stage=sel.value};div.appendChild(sel);
  var buttons=document.createElement('div');buttons.className='mini';
  function but(label,fn){var b=document.createElement('button');b.className='admbtn tiny';b.textContent=label;b.onclick=fn;buttons.appendChild(b)}
  but(editCover===p.src?'★':'☆',function(){editCover=p.src;renderThumbs()});
  but('←',function(){if(i>0){var t=editPhotos[i-1];editPhotos[i-1]=editPhotos[i];editPhotos[i]=t;renderThumbs()}});
  but('→',function(){if(i+1<editPhotos.length){var t=editPhotos[i+1];editPhotos[i+1]=editPhotos[i];editPhotos[i]=t;renderThumbs()}});
  but('×',function(){editPhotos=editPhotos.filter(function(x){return x!==p});if(editCover===p.src)editCover=editPhotos[0]?editPhotos[0].src:'';renderThumbs()});
  div.appendChild(buttons);root.appendChild(div)
 });
 if(!showAllPhotos&&editPhotos.length>36){var b=document.createElement('button');b.className='admbtn';b.textContent='Zobraziť ďalších '+(editPhotos.length-36)+' fotografií';b.onclick=function(){showAllPhotos=true;renderThumbs()};root.appendChild(b)}
}
function field(id,v){$(id).value=v||''}
function openEdit(i){
 if(busy){msg('Práve prebieha publikovanie. Počkajte na jeho dokončenie.');return}
 editIndex=i;var p=i<0?{title:'',location:'',area:'',duration:'',description:'',result:'',note:'',services:[],images:[],type:'Rekonštrukcia bytu'}:projects[i];
 field('fTitle',p.title);field('fLocation',p.location);field('fType',p.type);field('fArea',p.area);field('fDuration',p.duration);
 field('fDescription',p.description);field('fResult',p.result);field('fNote',p.note);field('fServices',(p.services||[]).join(', '));
 editPhotos=(p.images||[]).map(function(img){return typeof img==='string'?{src:img,stage:'Galéria'}:Object.assign({},img)});
 editCover=p.cover||(editPhotos[0]&&editPhotos[0].src)||'';showAllPhotos=false;
 $('editorTitle').textContent=i<0?'Nová realizácia':'Upraviť realizáciu';$('editor').classList.remove('hide');renderThumbs();$('editor').scrollIntoView({behavior:'smooth'})
}
function closeEdit(){$('editor').classList.add('hide');$('photosInput').value='';editIndex=-1}
function saveEdit(publishNow){
 if(editorSubmitting||busy)return;
 if(photosProcessing){msg('Počkajte na dokončenie spracovania fotografií.');return}
 if(publishNow&&!connected){msg('Najprv vložte GitHub token a kliknite na Pripojiť. Projekt zatiaľ nie je publikovaný.');return}
 editorSubmitting=true;
 var title=$('fTitle').value.trim();if(!title){editorSubmitting=false;alert('Zadajte názov realizácie.');return}
 var p=editIndex<0?{id:uniqueID(title)}:Object.assign({},projects[editIndex]);
 p.title=title;p.location=$('fLocation').value.trim();p.type=$('fType').value;p.area=$('fArea').value.trim();p.duration=$('fDuration').value.trim();
 p.description=$('fDescription').value.trim();p.result=$('fResult').value.trim();p.note=$('fNote').value.trim();
 p.services=$('fServices').value.split(',').map(function(x){return x.trim()}).filter(Boolean);
 p.images=editPhotos.slice();p.cover=editCover||(p.images[0]&&p.images[0].src)||'';
 if(editIndex<0)projects.push(p);else projects[editIndex]=p;
 changed=true;var offlineSaved=saveLocalDraft();closeEdit();render();editorSubmitting=false;
 if(publishNow){msg('Publikujem zmeny na shpilka.sk…');publish(true);return}
 msg(offlineSaved?'Koncept uložený v tomto prehliadači. Na webe ešte NIE JE zverejnený.':'Koncept pripravený len v otvorenej karte. Nové fotografie sa po jej zatvorení stratia. Publikujte zmeny pred zatvorením.')
}
async function resize(file){
 return new Promise(function(resolve,reject){var u=URL.createObjectURL(file),im=new Image();
 im.onload=function(){try{var k=Math.min(1,1800/Math.max(im.width,im.height));var can=document.createElement('canvas');can.width=Math.max(1,Math.round(im.width*k));can.height=Math.max(1,Math.round(im.height*k));
 can.getContext('2d').drawImage(im,0,0,can.width,can.height);URL.revokeObjectURL(u);can.toBlob(function(b){b?resolve(b):reject(new Error('Konverzia fotografie zlyhala'))},'image/jpeg',.8)}catch(e){URL.revokeObjectURL(u);reject(e)}};
 im.onerror=function(){URL.revokeObjectURL(u);reject(new Error('Fotografia sa nedá otvoriť'))};im.src=u})
}
async function onPhotos(ev){
 if(photosProcessing)return;
 var files=Array.from(ev.target.files||[]);ev.target.value='';if(!files.length)return;
 photosProcessing=true;$('saveBtn').disabled=true;$('savePublishBtn').disabled=true;
 var p=editIndex<0?null:projects[editIndex],id=p?p.id:uniqueID($('fTitle').value||'nova-realizacia');
 for(var i=0;i<files.length;i++){
  if(!files[i].type.startsWith('image/'))continue;
  msg('Spracovanie fotiek '+(i+1)+' / '+files.length);
  try{var blob=await resize(files[i]),path='realizacie/foto/'+id+'/'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,7)+'.jpg';
  pending.set(path,blob);editPhotos.push({src:'/'+path,stage:'Galéria',original:files[i].name});if(!editCover)editCover='/'+path}
  catch(e){msg('Fotografia '+files[i].name+': '+e.message)}
 }
 renderThumbs();photosProcessing=false;$('saveBtn').disabled=false;$('savePublishBtn').disabled=false;msg('Pridaných fotografií: '+files.length+'. Zmeny ešte nie sú publikované.')
}
function decodeGithubText(file){
 if(!file||file.encoding!=='base64'||!file.content)throw new Error('GitHub nevrátil obsah zoznamu projektov');
 var binary=atob(file.content.replace(/\s/g,'')),bytes=new Uint8Array(binary.length);
 for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new TextDecoder().decode(bytes)
}
async function fetchRemoteProjects(){
 if(connected){
  var result=await api('/contents/realizacie/projects.js');
  remoteBaseSha=result.sha;
  return parseProjects(decodeGithubText(result))
 }
 var result=await fetch('/realizacie/projects.js?admin_refresh='+Date.now(),{cache:'no-store'});
 if(!result.ok)throw new Error('Nepodarilo sa načítať web: HTTP '+result.status);
 return parseProjects(await result.text())
}
async function refreshProjects(){
 if(busy){msg('Práve prebieha publikovanie. Počkajte na jeho dokončenie.');return}
 if(changed&&!confirm('Zahodiť miestne nepublikované zmeny a načítať skutočný stav zo stránky?'))return;
 try{
  msg('Načítavam aktuálny zoznam…');
  var actual=await fetchRemoteProjects();
  projects=actual;changed=false;pending.clear();uploadedCache.clear();importMode=false;
  localStorage.removeItem(DRAFTKEY);
  previews.forEach(function(u){URL.revokeObjectURL(u)});previews.clear();closeEdit();render();
  msg('Načítaný aktuálny zoznam: '+projects.length+' realizácií. Staré miestne koncepty boli odstránené.');
 }catch(e){console.error(e);msg('Obnovenie sa nepodarilo: '+e.message+'. Miestny koncept nebol vymazaný.')}
}
function parseProjects(s){
 var clean=s.replace(/^\uFEFF/,'').trim().replace(/^window\.SHPILKA_PROJECTS\s*=\s*/,'').replace(/;\s*$/,'');
 var p=JSON.parse(clean);if(!Array.isArray(p)||p.some(function(x){return !x.id||!x.title}))throw new Error('Neplatný zoznam projektov');
 return p
}
async function onZip(ev){
 var file=ev.target.files&&ev.target.files[0];ev.target.value='';if(!file)return;
 if(!window.JSZip){msg('Knižnica ZIP sa nenačítala. Skontrolujte internetové pripojenie.');return}
 try{
 msg('Načítavam ZIP…');var zip=await window.JSZip.loadAsync(file),pf=zip.file('realizacie/projects.js');
 if(!pf)throw new Error('V ZIP chýba realizacie/projects.js');
 var newProjects=parseProjects(await pf.async('string')),assets=new Map();
 zip.forEach(function(path,entry){if(!entry.dir&&/^realizacie\/foto\/.+\.(jpg|jpeg|png|webp)$/i.test(path))assets.set(path,entry)});
 var refs=new Set();
 newProjects.forEach(function(p){(p.images||[]).forEach(function(img){refs.add((typeof img==='string'?img:img.src).replace(/^\//,''))});if(p.cover)refs.add(p.cover.replace(/^\//,''))});
 for(var path of refs){if(path.startsWith('realizacie/foto/')&&!assets.has(path)&&!projects.some(function(p){return (p.images||[]).some(function(x){return (typeof x==='string'?x:x.src).replace(/^\//,'')===path})})){throw new Error('Chýba fotografia v ZIP: '+path)}}
 if(!confirm('Nahradiť pracovný zoznam '+projects.length+' realizácií novým balíkom ('+newProjects.length+' realizácií, '+assets.size+' fotografií)? Na živom webe sa ešte nič nezmení.'))return;
 previews.forEach(function(u){URL.revokeObjectURL(u)});previews.clear();pending=assets;uploadedCache.clear();importedZip=zip;projects=newProjects;changed=true;importMode=true;localStorage.removeItem(DRAFTKEY);closeEdit();render();
 msg('ZIP pripravený: '+projects.length+' realizácií a '+assets.size+' fotografií. Po pripojení GitHub kliknite na „Publikovať na webe“.');
 }catch(e){console.error(e);msg('Import zlyhal: '+e.message)}
}
function toB64(buffer){var bytes=new Uint8Array(buffer),result='',chunk=0x8000;for(var i=0;i<bytes.length;i+=chunk)result+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));return btoa(result)}
async function api(path,opts){
 opts=opts||{};var res=await fetch(API+path,{method:opts.method||'GET',headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:opts.body?JSON.stringify(opts.body):undefined});
 var body=await res.text(),data;try{data=JSON.parse(body)}catch(e){data={message:body.slice(0,150)}}
 if(!res.ok){var err=new Error('GitHub '+res.status+': '+(data.message||'Neznáma chyba'));err.status=res.status;err.retryAfter=Number(res.headers.get('retry-after')||0);throw err}
 return data
}
async function connect(){
 var t=$('token').value.trim();if(!t)return msg('Vložte GitHub token.');
 token=t;msg('Overujem prístup…');
 try{var live=await api('/contents/realizacie/projects.js');remoteBaseSha=live.sha;connected=true;$('token').value='';$('connect').disabled=true;$('disconnect').disabled=false;if(!changed){projects=parseProjects(decodeGithubText(live));render()}msg(changed?'GitHub pripojený. POZOR: máte miestny koncept, ktorý sa ešte líši od webu. Skontrolujte ho pred publikovaním, alebo kliknite na „Načítať aktuálny web“.':'GitHub pripojený. Zobrazuje sa skutočný stav z GitHubu: '+projects.length+' realizácií.')}catch(e){token='';connected=false;msg('Pripojenie sa nepodarilo: '+e.message+'. Skontrolujte oprávnenie Contents: Read and write.')}summary()
}
async function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
async function makeBlob(entry){
 var base64=typeof entry.async==='function'?await entry.async('base64'):toB64(await entry.arrayBuffer());
 return await api('/git/blobs',{method:'POST',body:{content:base64,encoding:'base64'}})
}
async function uploadRetry(path,entry,n){
 if(uploadedCache.has(path))return {sha:uploadedCache.get(path)};
 for(var k=0;k<6;k++){
  try{var result=await makeBlob(entry);uploadedCache.set(path,result.sha);return result}
  catch(e){if(!(e.status===429||e.status===403||e.status===502||e.status===503)||k===5)throw e;
   msg('GitHub obmedzil nahrávanie. Opakujem fotografiu '+n+' (pokus '+(k+2)+').');await sleep(Math.max(e.retryAfter*1000,10000*(k+1)))}
 }
}
async function publish(skipConfirm){
 if(!connected||!changed||busy)return;
 if(photosProcessing){msg('Počkajte na dokončenie spracovania fotografií.');return}
 if(!skipConfirm&&!confirm('Publikovať '+projects.length+' realizácií na živom shpilka.sk? Tento krok zmení verejné portfólio.'))return;
 busy=true;summary();
 try{
  msg('Kontrolujem aktuálnu verziu GitHub…');
  var currentFile=await api('/contents/realizacie/projects.js');
  if(remoteBaseSha&&currentFile.sha!==remoteBaseSha)throw new Error('Zoznam realizácií sa zmenil v inom okne alebo zariadení. Neprepísal som ho. Pred opakovaním načítajte aktuálny web.');
  var remoteList=parseProjects(decodeGithubText(currentFile));
  var uploadedOnWeb=new Set();
  remoteList.forEach(function(p){(p.images||[]).forEach(function(im){uploadedOnWeb.add((typeof im==='string'?im:im.src).replace(/^\//,''))});if(p.cover)uploadedOnWeb.add(p.cover.replace(/^\//,''))});
  var missing=[];
  projects.forEach(function(p){(p.images||[]).forEach(function(im){var path=(typeof im==='string'?im:im.src).replace(/^\//,'');if(path.startsWith('realizacie/foto/')&&!pending.has(path)&&!uploadedOnWeb.has(path))missing.push(path)})});
  if(missing.length)throw new Error('Chýbajú nové fotografie ('+missing.length+'). Súbory sa po obnovení karty nenačítajú z miestneho konceptu. Znovu ich pridajte alebo obnovte zoznam zo stránky.');
  var ref=await api('/git/ref/heads/main'),head=ref.object.sha,commit=await api('/git/commits/'+head),tree=[];
  var referenced=new Set();
  projects.forEach(function(p){(p.images||[]).forEach(function(im){referenced.add((typeof im==='string'?im:im.src).replace(/^\//,''))});if(p.cover)referenced.add(p.cover.replace(/^\//,''))});
  var queue=Array.from(pending.entries()).filter(function(kv){return referenced.has(kv[0])}),total=queue.length,done=0,next=0,uploaded=[];
  msg('Nahrávam '+total+' nových fotografií…');
  async function worker(){
   while(next<queue.length){var ix=next++,pair=queue[ix],r=await uploadRetry(pair[0],pair[1],ix+1);
    uploaded.push({path:pair[0],mode:'100644',type:'blob',sha:r.sha});done++;msg('Nahrávam fotografie: '+done+' / '+total+'. Nezatvárajte túto kartu.');await sleep(900)}
  }
  await Promise.all([worker(),worker()]);
  tree=uploaded;tree.push({path:'realizacie/projects.js',mode:'100644',type:'blob',content:'window.SHPILKA_PROJECTS = '+JSON.stringify(projects,null,2)+';\n'});
  msg('Zapisujem zmeny do GitHub…');
  var newTree=await api('/git/trees',{method:'POST',body:{base_tree:commit.tree.sha,tree:tree}});
  var newCommit=await api('/git/commits',{method:'POST',body:{message:'Update Shpilka portfolio via online admin ('+projects.length+' projects)',tree:newTree.sha,parents:[head]}});
  await api('/git/refs/heads/main',{method:'PATCH',body:{sha:newCommit.sha,force:false}});
  changed=false;remoteBaseSha=null;importMode=false;pending.clear();uploadedCache.clear();importedZip=null;localStorage.removeItem(DRAFTKEY);
  msg('Hotovo. GitHub prijal '+projects.length+' realizácií a '+total+' nových fotografií. Po aktualizácii GitHub Pages budú viditeľné na /realizacie/.');
 }catch(e){console.error(e);msg('Publikovanie nebolo dokončené: '+e.message+'. Pripravené zmeny zostali v tejto karte. Skúste to znova.')}
 finally{busy=false;summary()}
}
$('connect').onclick=connect;$('disconnect').onclick=function(){token='';connected=false;$('connect').disabled=false;$('disconnect').disabled=true;msg('Odpojené.');summary()};
$('newBtn').onclick=function(){openEdit(-1)};
$('cancelBtn').onclick=closeEdit;$('cancelBtn2').onclick=closeEdit;
$('saveBtn').onclick=function(){saveEdit(false)};$('savePublishBtn').onclick=function(){saveEdit(true)};$('photosInput').onchange=onPhotos;
$('zipInput').onchange=onZip;$('publishBtn').onclick=publish;
$('refreshBtn').onclick=refreshProjects;
window.addEventListener('beforeunload',function(e){if(changed){e.preventDefault();e.returnValue=''}});
render();if(draftRestored)msg('Načítaný starší miestny koncept. Môže sa líšiť od publikovaných realizácií. Ak vidíte už zmazaný testovací projekt, kliknite na „Načítať aktuálny web (zahodiť koncept)“.');else fetchRemoteProjects().then(function(actual){if(!changed){projects=actual;render();msg('Zoznam aktuálny: '+projects.length+' realizácií.')}}).catch(function(e){console.warn('Live site refresh failed',e)});
})();