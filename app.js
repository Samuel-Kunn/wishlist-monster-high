(function(){
'use strict';
var PAGE=48,CATALOG=[],CATMAP={},ATLAS={cols:8,rows:6,per:48},HD=null,catState='loading',shown=PAGE;

var COLORS={'Frankie Stein':['#8fe3cf','#d9d9e8'],'Draculaura':['#ff5fa8','#f7c6dd'],'Clawdeen Wolf':['#b06cff','#f2c94c'],'Lagoona Blue':['#4cc9f0','#ff9ccf'],'Cleo de Nile':['#f2c94c','#19c5b5'],'Deuce Gorgon':['#6fdc6f','#ff8a5c'],'Ghoulia Yelps':['#ff6b7a','#8fe0f0'],'Abbey Bominable':['#bfe3ff','#c99bff'],'Spectra Vondergeist':['#c9a6ff','#f0f0ff'],'Skelita Calaveras':['#ff9f43','#ff5fa8'],'Toralei Stripe':['#ffa94d','#ff6b9d'],'Venus McFlytrap':['#7be07b','#ff5fa8'],'Twyla':['#a99bff','#7fe0c8']};
function colors(n){if(COLORS[n])return COLORS[n];var h=0;for(var i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))%360;return['hsl('+h+' 80% 70%)','hsl('+((h+70)%360)+' 80% 78%)']}
function initials(n){var p=n.replace(/[^A-Za-zÀ-ÿ ]/g,' ').trim().split(/\s+/);return((p[0]||'?')[0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function safeUrl(u){return /^https?:\/\//i.test(u||'')?u:''}

// conexão com o banco (Supabase). Sem config.js o site mostra só o catálogo.
var CFG=window.WISHLIST_CONFIG||{},sb=null;
try{if(window.supabase&&/^https:\/\//.test(CFG.supabaseUrl||'')&&CFG.supabaseAnonKey&&!/COLE/.test(CFG.supabaseAnonKey))sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey)}catch(e){sb=null}
var params=new URLSearchParams(location.search);
var SLUG=(params.get('l')||'').replace(/[^a-z0-9]/gi,'').slice(0,40);
var PR={alta:0,media:1,baixa:2},PRL={alta:'Alta',media:'Média',baixa:'Baixa'},STL={quero:'Quero',encomendada:'Encomendada',comprada:'Já tenho'};

var state={items:[],nao:[]};
// mode: 'own' (a lista de quem entrou) | 'view' (lista de outra pessoa, aberta pelo link)
var ui={mode:SLUG?'view':'own',tab:'lista',q:'',ano:'',status:'',prio:'',sort:'prio',dirty:0,saving:false,msg:''};
try{var t=sessionStorage.getItem('mh-tab');if(t==='lista'||t==='catalogo')ui.tab=t}catch(e){}
// listState: loading | ok | out (não entrou) | none (link não existe) | error | off (sem banco)
var sess=null,lista=null,listState=sb?'loading':'off',reservas={},reservando=false;// reservas: itemId -> 'eu' | 'outro'
var confirmId=null;

var app=document.getElementById('app');
app.innerHTML=
'<header class="hero"><div><h1>Wishlist <em>Monster High</em></h1><p class="sub" id="sub"></p><div class="acct" id="acct"></div></div><section class="stats" id="stats" aria-label="Resumo"></section></header>'+
'<div class="controls"><div class="tabs" role="tablist"><button class="tab" role="tab" id="tab-lista" data-tab="lista" aria-controls="grid">Minha lista</button><button class="tab" role="tab" id="tab-catalogo" data-tab="catalogo" aria-controls="grid">Catálogo</button></div>'+
'<div class="bar"><input type="search" id="q" placeholder="Buscar personagem ou linha" aria-label="Buscar">'+
'<select id="f-ano" aria-label="Ano"><option value="">Todos os anos</option></select>'+
'<select id="f-status" aria-label="Status"><option value="">Todos os status</option><option value="quero">Quero</option><option value="encomendada">Encomendada</option><option value="comprada">Já tenho</option></select>'+
'<select id="f-prio" aria-label="Prioridade"><option value="">Prioridade: todas</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select>'+
'<select id="f-sort" aria-label="Ordenar"><option value="prio">Ordenar por prioridade</option><option value="nome">Ordenar por nome</option><option value="preco">Ordenar por preço</option><option value="ano">Ordenar por ano</option></select>'+
'<button class="btn primary" id="add-manual" hidden>Adicionar à mão</button></div></div>'+
'<p class="note" id="note"></p>'+
'<section class="grid" id="grid" role="tabpanel" tabindex="-1"></section>'+
'<div class="savebar" id="savebar" hidden><span id="savemsg" role="status"></span><button class="btn primary" id="save">Salvar alterações</button></div>'+
'<dialog id="dlg"><h2 id="dlg-title">Boneca</h2><form id="frm">'+
'<label>Nome ou personagem<input id="i-nome" required maxlength="80"></label>'+
'<div class="row2"><label>Linha<input id="i-linha" maxlength="80"></label><label>Geração<select id="i-ger"><option value="">Não sei</option><option>G1</option><option>G2</option><option>G3</option><option>Colecionador</option><option>Outra</option></select></label></div>'+
'<div class="row2"><label>Prioridade<select id="i-prio"><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label><label>Status<select id="i-status"><option value="quero">Quero</option><option value="encomendada">Encomendada</option><option value="comprada">Já tenho</option></select></label></div>'+
'<div class="row2"><label>Preço-alvo (R$)<input id="i-preco" type="number" min="0" max="99999" step="0.01" inputmode="decimal"></label><label>Ano<input id="i-ano" type="number" min="2010" max="2100"></label></div>'+
'<label>Preço pago (R$)<input id="i-pago2" type="number" min="0" max="99999" step="0.01" inputmode="decimal"></label>'+
'<label>Link da loja<input id="i-link" type="text" inputmode="url" autocomplete="url" maxlength="500" placeholder="https://loja.com/produto"></label>'+
'<label>Foto (do seu aparelho)<input id="i-foto" type="file" accept="image/*"></label>'+
'<label>Observações<textarea id="i-obs" rows="2" maxlength="300"></textarea></label>'+
'<div class="dlgacts"><button type="button" class="btn ghost" id="dlg-cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form></dialog>'+
'<dialog id="dlg-pago"><h2>Quanto você pagou?</h2><form id="frm-pago"><p class="note" id="pago-sub"></p>'+
'<label>Preço pago (R$)<input id="i-pago" type="number" min="0" max="99999" step="0.01" inputmode="decimal" placeholder="0,00"></label>'+
'<p class="note">Ao guardar um valor, a boneca passa para “Já tenho”. Deixe em branco para apagar o preço pago.</p>'+
'<div class="dlgacts"><button type="button" class="btn ghost" id="pago-cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form></dialog>'+
'<dialog id="dlg-share"><h2>Compartilhar sua lista</h2><form id="frm-share">'+
'<label>Nome da lista<input id="i-titulo" required maxlength="60"></label>'+
'<label>Link para mandar aos amigos<span class="share-row"><input id="i-share" readonly><button type="button" class="btn" id="share-copy">Copiar</button></span></label>'+
'<p class="note">Quem abrir o link vê sua lista e pode reservar presentes. Você não vê as reservas, para não estragar a surpresa.</p>'+
'<div class="dlgacts"><button type="button" class="btn ghost" id="share-cancel">Fechar</button><button type="button" class="btn" id="share-send" hidden>Enviar…</button><button class="btn primary">Guardar nome</button></div></form></dialog>'+
'<dialog id="dlg-login"><h2>Entrar</h2><p class="note">Use sua conta Google para montar sua lista ou reservar um presente.</p><div id="gbtn" class="gbtn"></div>'+
'<div class="dlgacts"><button type="button" class="btn ghost" id="login-cancel">Cancelar</button></div></dialog>'+
'<dialog id="dlg-egg" class="egg" aria-labelledby="egg-title"><div class="egg-ico" aria-hidden="true">💀💖</div>'+
'<h2 id="egg-title">Para <em>Raissa Massaroli</em></h2>'+
'<p>Este site foi feito em sua homenagem, para a maior fã de Monster High que eu conheço.</p>'+
'<p>Que a sua coleção nunca pare de crescer, e que cada dia ao seu lado continue assustadoramente feliz.</p>'+
'<p class="note">Com todo o meu amor. 🖤</p>'+
'<div class="dlgacts"><button type="button" class="btn primary" id="egg-close">Fechar</button></div></dialog>'+
'<dialog id="zoom" aria-label="Foto ampliada"><div class="zph" id="zoom-ph"></div><div class="zcap"><b id="zoom-nome"></b><span id="zoom-sub"></span></div><button class="btn zclose" aria-label="Fechar">Fechar</button></dialog>';

function $(id){return document.getElementById(id)}
function editable(){return ui.mode==='own'&&listState==='ok'&&!!lista}
function hasPago(i){return i.pago!==''&&i.pago!=null&&!isNaN(Number(i.pago))}
function linhaDe(i){return i.linha||(i.cat&&CATMAP[i.cat]&&CATMAP[i.cat].orig)||''}
function findItem(key,val){for(var k=0;k<state.items.length;k++)if(state.items[k][key]===val)return state.items[k];return null}
function shareUrl(){return lista&&lista.slug?location.origin+location.pathname+'?l='+lista.slug:''}
// dados vindos do banco: só aceita o formato esperado
function clean(d){
  d=d&&typeof d==='object'?d:{};
  var items=Array.isArray(d.items)?d.items.filter(function(i){return i&&typeof i==='object'&&typeof i.id==='string'&&typeof i.nome==='string'}):[];
  items.forEach(function(i){if(!PR.hasOwnProperty(i.prio))i.prio='media';if(!STL.hasOwnProperty(i.status))i.status='quero'});
  return {items:items,nao:Array.isArray(d.nao)?d.nao.filter(function(x){return typeof x==='string'}):[]};
}
function setState(d){state=clean(d)}
// "base" = a lista como estava no banco da última vez que este aparelho carregou ou salvou.
// Serve para juntar mudanças quando a mesma lista foi salva em outro aparelho.
var base=null;
function snap(st){var m={};st.items.forEach(function(i){m[i.id]=JSON.stringify(i)});return {m:m,nao:st.nao.slice()}}
function mergeFrom(d){
  var s=clean(d),b=base||{m:{},nao:[]},sm={},lm={},out=[],seen={},cats={};
  s.items.forEach(function(i){sm[i.id]=i});state.items.forEach(function(i){lm[i.id]=i});
  function pick(id){// quem mudou ganha; se os dois mudaram, vale a mudança deste aparelho
    var bj=b.m[id],l=lm[id],sv=sm[id],lj=l?JSON.stringify(l):undefined,sj=sv?JSON.stringify(sv):undefined;
    if(lj===bj)return sv;if(sj===bj)return l;return l||sv;
  }
  s.items.concat(state.items).forEach(function(i){
    if(seen[i.id])return;seen[i.id]=1;var x=pick(i.id);
    if(!x||(x.cat&&cats[x.cat]))return;if(x.cat)cats[x.cat]=1;out.push(x);
  });
  var nao=[],seenN={};
  s.nao.concat(state.nao).forEach(function(x){
    if(seenN[x])return;seenN[x]=1;
    var inB=b.nao.indexOf(x)>=0,inL=state.nao.indexOf(x)>=0,inS=s.nao.indexOf(x)>=0;
    if(inL===inB?inS:inL)nao.push(x);
  });
  state={items:out,nao:nao};
}

function renderStats(){
  var it=state.items,falta=0,pago=0,comp=0;
  it.forEach(function(i){var p=Number(i.preco)||0;if(i.status==='comprada'){comp++;pago+=hasPago(i)?Number(i.pago):p}else falta+=p});
  $('stats').innerHTML='<div class="stat"><b>'+it.length+'</b><span>na lista</span></div><div class="stat"><b>'+comp+'</b><span>já tem</span></div><div class="stat"><b>'+BRL.format(falta)+'</b><span>falta comprar</span></div><div class="stat"><b>'+BRL.format(pago)+'</b><span>já gasto</span></div>';
}
function userName(){var m=sess&&sess.user&&sess.user.user_metadata||{};return m.full_name||m.name||(sess&&sess.user&&sess.user.email)||''}
function renderHead(){
  var view=ui.mode==='view';
  $('sub').textContent=view?(listState==='ok'&&lista?lista.titulo:listState==='none'?'Lista não encontrada':'Carregando a lista…'):'Monte sua wishlist e mande o link para os amigos.';
  document.title=view&&lista?lista.titulo+' · Wishlist Monster High':'Wishlist Monster High';
  $('tab-lista').textContent=view?'Wishlist':'Minha lista';
  var h='';
  if(sb){
    if(sess)h+='<span class="who">'+esc(userName())+'</span>';
    if(ui.mode==='own'&&lista)h+='<button class="btn primary" data-a="share">Compartilhar minha lista</button>';
    if(view)h+='<a class="btn" href="'+esc(location.pathname)+'">'+(sess?'Ver a minha lista':'Criar a minha lista')+'</a>';
    if(sess)h+='<button class="btn ghost" data-a="logout">Sair</button>';
    else if(view)h+='<button class="btn ghost" data-a="login">Entrar com Google</button>';
  }
  $('acct').innerHTML=h;
}
var ATLASOK={};// folha do atlas -> true (ok/carregando) | false (falhou)
function checkAtlas(a){
  if(!(a in ATLASOK)){ATLASOK[a]=true;var im=new Image();im.onerror=function(){ATLASOK[a]=false;render()};im.src='atlas/a'+(a<10?'0':'')+a+'.webp'}
  return ATLASOK[a];
}
function sprite(dir,pre,g,t){// estilo de uma célula de uma folha de fotos
  var a=Math.floor(t/g.per),i=t%g.per,col=i%g.cols,row=Math.floor(i/g.cols);
  return 'background-image:url('+dir+'/'+pre+(a<10?'0':'')+a+'.webp);background-size:'+(g.cols*100)+'% '+(g.rows*100)+'%;background-position:'+(g.cols>1?col/(g.cols-1)*100:0)+'% '+(g.rows>1?row/(g.rows-1)*100:0)+'%';
}
function avatar(x){
  var z=' data-act="zoom" data-z="'+esc(x.id?'i:'+x.id:'c:'+x.cat)+'" tabindex="0" title="Ampliar a foto"';
  if(x.foto&&/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(x.foto))return '<div class="ph"'+z+'><img alt="" src="'+esc(x.foto)+'"></div>';
  var c=x.cat?CATMAP[x.cat]:null,t=c?c.t:-1;
  var a=t>=0?Math.floor(t/ATLAS.per):-1;
  if(a>=0&&checkAtlas(a))return '<div class="ph" role="img" aria-label="Foto de '+esc(x.nome)+'"'+z+' style="'+sprite('atlas','a',ATLAS,t)+'"></div>';
  var cl=colors(x.nome);return '<div class="ph ini" style="background:linear-gradient(135deg,'+cl[0]+' 0 55%,'+cl[1]+' 55%)">'+esc(initials(x.nome))+'</div>'}
function match(x){
  var q=ui.q.trim().toLowerCase();
  if(q&&(x.nome+' '+(x.linha||'')+' '+(x.orig||'')+' '+(x.pers||'')).toLowerCase().indexOf(q)<0)return false;
  if(ui.ano&&String(x.ano)!==ui.ano)return false;
  return true;
}
function emptyBox(msg,btn){return '<div class="empty" style="grid-column:1/-1"><p>'+msg+'</p>'+(btn||'')+'</div>'}
var LOGINBTN='<button class="btn primary" data-act="login">Entrar com Google</button>';
function listMessage(){
  if(listState==='loading')return emptyBox('Carregando a lista…');
  if(listState==='off')return emptyBox('O site ainda não foi ligado ao banco de dados (falta preencher o config.js). O catálogo funciona normalmente.');
  if(listState==='out')return emptyBox('Entre com sua conta Google para montar sua wishlist. Depois é só mandar o link para os amigos.',LOGINBTN);
  if(listState==='none')return emptyBox('Essa lista não existe ou foi apagada. Confira se o link está completo.','<a class="btn" href="'+esc(location.pathname)+'">Criar a minha lista</a>');
  if(listState==='error')return emptyBox('Não deu para carregar a lista agora. Recarregue a página para tentar de novo.');
  return '';
}
function renderGrid(){
  var ed=editable(),view=ui.mode==='view',html='',list;
  ['lista','catalogo'].forEach(function(t){var b=$('tab-'+t);b.setAttribute('aria-selected',String(ui.tab===t));b.tabIndex=ui.tab===t?0:-1});
  $('grid').setAttribute('aria-labelledby','tab-'+ui.tab);
  $('f-status').hidden=$('f-prio').hidden=ui.tab!=='lista';
  $('add-manual').hidden=!ed;
  var so=$('f-sort').options,cat=ui.tab==='catalogo';
  so[0].textContent=cat?'Ordenar por lançamento':'Ordenar por prioridade';so[2].hidden=so[3].hidden=cat;
  $('f-sort').value=cat&&(ui.sort==='preco'||ui.sort==='ano')?'prio':ui.sort;
  if(ui.tab==='lista'){
    html=listMessage();
    if(!html){
      list=state.items.filter(function(i){return match(i)&&(!ui.status||i.status===ui.status)&&(!ui.prio||i.prio===ui.prio)});
      list.sort(function(a,b){
        if(ui.sort==='nome')return a.nome.localeCompare(b.nome);
        if(ui.sort==='preco')return(Number(b.preco)||0)-(Number(a.preco)||0);
        if(ui.sort==='ano')return(a.ano||9999)-(b.ano||9999);
        return(PR[a.prio]-PR[b.prio])||a.nome.localeCompare(b.nome)});
      if(!state.items.length)html=emptyBox(ed?'Sua lista ainda está vazia. Abra o Catálogo e toque em “Quero esta”, ou use “Adicionar à mão”.':'Esta lista ainda está vazia.');
      else if(!list.length)html=emptyBox('Nenhuma boneca com esses filtros.');
    }
    (html?[]:list).forEach(function(i){
      var res=view?reservas[i.id]:null,mine=res==='eu',link=safeUrl(i.link);
      html+='<article class="card '+esc(i.status)+'"'+(ed?' data-act="pago" data-id="'+esc(i.id)+'" tabindex="0" title="Registrar o preço pago"':'')+'>'+avatar(i)+'<div style="min-width:0"><div class="nome">'+esc(i.nome)+'</div><div class="linha">'+esc(linhaDe(i))+(i.ano?' · '+esc(i.ano):'')+'</div></div>'+
      '<div class="chips">'+(i.ger?'<span class="chip">'+esc(i.ger)+'</span>':'')+'<span class="chip '+(i.prio==='alta'?'alta':'')+'">Prioridade '+PRL[i.prio]+'</span><span class="chip '+(i.status==='comprada'?'ok':'')+'">'+(view&&i.status==='comprada'?'Já tem':STL[i.status])+'</span>'+(res?'<span class="chip gold">'+(mine?'Você vai dar':'Alguém vai dar')+'</span>':'')+'</div>'+
      (i.preco||hasPago(i)?'<div class="precos">'+(i.preco?'<div class="preco"><small>Preço-alvo</small>'+BRL.format(Number(i.preco))+'</div>':'')+(hasPago(i)?'<div class="preco pago"><small>Pago</small>'+BRL.format(Number(i.pago))+'</div>':'')+'</div>':'')+
      (i.obs?'<p class="obs">'+esc(i.obs)+'</p>':'')+
      (link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Ver na loja</a>':'')+
      '<div class="acts">'+
      (ed?'<button class="btn" data-act="edit" data-id="'+esc(i.id)+'">Editar</button>'+(i.status!=='comprada'?'<button class="btn" data-act="comprada" data-id="'+esc(i.id)+'">Já tenho</button>':'')+'<button class="btn danger" data-act="del" data-id="'+esc(i.id)+'">'+(confirmId===i.id?'Confirmar remoção':'Remover')+'</button>':'')+
      (view&&(mine||(i.status!=='comprada'&&!res))?'<button class="btn '+(mine?'':'primary')+'" data-act="reservar" data-id="'+esc(i.id)+'"'+(reservando?' disabled':'')+'>'+(mine?'Desistir de dar':'Vou dar esta')+'</button>':'')+
      '</div></article>';
    });
  }else{
    list=CATALOG.filter(match);
    if(ui.sort==='nome')list=list.slice().sort(function(a,b){return a.nome.localeCompare(b.nome)});
    if(catState==='loading')html=emptyBox('Carregando o catálogo…');
    else if(catState==='error')html=emptyBox('Não deu para carregar o catálogo agora. Recarregue a página para tentar de novo.');
    else if(!list.length)html=emptyBox('Nada no catálogo com essa busca.');
    var lim=ui.ano?list.length:shown,prev='',grouped=ui.sort!=='nome',cnt={};
    list.forEach(function(c){var k=c.ano+'|'+c.linha;cnt[k]=(cnt[k]||0)+1});
    list.slice(0,lim).forEach(function(c){
      var it=findItem('cat',c.id),nao=state.nao.indexOf(c.id)>=0,k=c.ano+'|'+c.linha;
      if(grouped&&k!==prev){prev=k;var n=cnt[k];
        html+='<h2 class="sec"><span>'+(ui.ano?'':'<b>'+c.ano+'</b> ')+esc(c.orig||c.linha)+(c.orig&&c.orig!==c.linha?' <i>'+esc(c.linha)+'</i>':'')+'</span><small>'+n+(n===1?' item':' itens')+'</small></h2>'}
      html+='<article class="card'+(nao?' nao':'')+'" data-cid="'+esc(c.id)+'" tabindex="-1">'+avatar({cat:c.id,nome:c.nome})+'<div style="min-width:0"><div class="nome">'+esc(c.nome)+'</div>'+(grouped?'':'<div class="linha">'+esc(c.orig||c.linha)+' · '+c.ano+'</div>')+'</div>'+(it?'<div class="chips"><span class="chip '+(it.status==='comprada'?'ok':'alta')+'">'+(view&&it.status==='comprada'?'Já tem':STL[it.status])+'</span></div>':nao?'<div class="chips"><span class="chip">Não quer</span></div>':'')+
      (ed&&!it&&!nao?'<div class="acts"><button class="btn primary" data-act="want" data-id="'+esc(c.id)+'">Quero esta</button><button class="btn" data-act="tenho" data-id="'+esc(c.id)+'">Já tenho</button><button class="btn void" data-act="nao" data-id="'+esc(c.id)+'">Não quero</button></div>':'')+
      (ed&&nao?'<div class="acts"><button class="btn" data-act="desnao" data-id="'+esc(c.id)+'">Desfazer</button></div>':'')+'</article>';
    });
    if(list.length>lim)html+='<div class="more"><button class="btn" data-act="more">Mostrar mais ('+(list.length-shown)+' restantes)</button></div>';
  }
  $('grid').innerHTML=html;
  var note='';
  if(ui.tab==='catalogo'){if(catState==='ok')note=CATALOG.length+' itens no catálogo, por ano e lançamento. '+(ed?'Não achou? Use “Adicionar à mão”.':ui.mode==='own'&&listState==='out'?'Entre com o Google para marcar as que você quer.':'')}
  else if(ed&&state.items.length)note='Toque numa boneca para registrar quanto você pagou.';
  else if(view&&listState==='ok')note=sess?'Toque em “Vou dar esta” para reservar um presente. Quem criou a lista não vê as reservas.':'Para reservar um presente, entre com sua conta Google. Quem criou a lista não vê as reservas.';
  $('note').textContent=note;
  $('savebar').hidden=!((ed&&ui.dirty)||ui.msg);
  $('savemsg').textContent=ui.msg||(ui.dirty===1?'1 alteração não salva':ui.dirty+' alterações não salvas');
  $('save').hidden=!(ed&&ui.dirty);
  $('save').disabled=ui.saving||!ui.dirty;
  $('save').textContent=ui.saving?'Salvando…':'Salvar alterações';
}
function fadeGrid(){var g=$('grid');if(g.animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches)g.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'})}
function render(){renderHead();renderStats();renderGrid()}
function changed(){ui.dirty++;ui.msg='';render()}
function newId(){return 'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

// eventos
document.querySelector('.tabs').addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(!b)return;ui.tab=b.dataset.tab;confirmId=null;try{sessionStorage.setItem('mh-tab',ui.tab)}catch(x){}renderGrid();fadeGrid()});
$('q').addEventListener('input',function(e){ui.q=e.target.value;shown=PAGE;confirmId=null;renderGrid()});
[['f-ano','ano'],['f-status','status'],['f-prio','prio'],['f-sort','sort']].forEach(function(p){$(p[0]).addEventListener('change',function(e){ui[p[1]]=e.target.value;shown=PAGE;confirmId=null;renderGrid()})});
function refocus(id,act){
  if(!id)return;var q='"'+id.replace(/["\\]/g,'\\$&')+'"',g=$('grid');
  var n=g.querySelector('[data-act="'+act+'"][data-id='+q+']')||g.querySelector('[data-id='+q+']')||g.querySelector('[data-cid='+q+']');
  if(n)n.focus();
}
$('grid').addEventListener('click',function(e){
  if(e.target.closest('a'))return;
  var b=e.target.closest('[data-act]');if(!b)return;var id=b.dataset.id,act=b.dataset.act;
  if(act!=='del')confirmId=null;
  if(act==='zoom'){openZoom(b.dataset.z,b);return}
  if(act==='login'){login();return}
  if(act==='more'){var from=shown;shown+=PAGE;renderGrid();var cs=$('grid').querySelectorAll('article');if(cs[from])cs[from].focus();return}
  if(act==='reservar'){toggleReserva(id);return}
  if(!editable())return;
  if(act==='nao'){if(state.nao.indexOf(id)<0)state.nao.push(id);changed();return refocus(id,'desnao')}
  if(act==='desnao'){state.nao=state.nao.filter(function(x){return x!==id});changed();return refocus(id,'want')}
  if(act==='want'||act==='tenho'){var c=CATMAP[id];if(!c||findItem('cat',id))return;state.items.push({id:newId(),cat:c.id,nome:c.nome,linha:c.orig||c.linha,ger:'',ano:c.ano,prio:'media',status:act==='tenho'?'comprada':'quero',preco:'',link:'',foto:'',obs:''});changed();return refocus(id)}
  var it=findItem('id',id);if(!it)return;
  if(act==='pago')return openPago(it);
  if(act==='comprada'){it.status='comprada';changed();return refocus(id,'edit')}
  if(act==='del'){if(confirmId!==id){confirmId=id;renderGrid();return refocus(id,'del')}confirmId=null;state.items=state.items.filter(function(x){return x.id!==id});changed();return $('grid').focus()}
  if(act==='edit')openDlg(it);
});
document.querySelector('.tabs').addEventListener('keydown',function(e){
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'&&e.key!=='Home'&&e.key!=='End')return;
  e.preventDefault();var t=ui.tab==='lista'?'catalogo':'lista';$('tab-'+t).click();$('tab-'+t).focus();
});
$('grid').addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.matches('article[data-act],.ph[data-act]')){e.preventDefault();e.stopPropagation();e.target.click()}});
$('acct').addEventListener('click',function(e){
  var b=e.target.closest('[data-a]');if(!b)return;var a=b.dataset.a;
  if(a==='login')login();
  else if(a==='logout')logout();
  else if(a==='share')openShare();
});
// foto ampliada: usa a folha em alta resolução quando existe, senão a foto do cartão
var zoomFrom=null;
function openZoom(key,from){
  var id=key.slice(2),it=key[0]==='i'?findItem('id',id):null,c=it?(it.cat?CATMAP[it.cat]:null):CATMAP[id];
  var nome=it?it.nome:c?c.nome:'',sub=it?[linhaDe(it),it.ano].filter(Boolean).join(' · '):c?(c.orig||c.linha)+' · '+c.ano:'';
  var box=$('zoom-ph');box.innerHTML='';box.removeAttribute('style');box.className='zph';
  if(it&&it.foto&&/^data:image\//.test(it.foto)){var im=document.createElement('img');im.alt='';im.src=it.foto;box.appendChild(im)}
  else if(c&&HD&&c.hd>=0)box.setAttribute('style',sprite('hd','h',HD,c.hd));
  else if(c&&c.t>=0)box.setAttribute('style',sprite('atlas','a',ATLAS,c.t));
  else return;
  $('zoom-nome').textContent=nome;$('zoom-sub').textContent=sub;
  zoomFrom=from||null;$('zoom').showModal();
}
$('zoom').addEventListener('click',function(){$('zoom').close()});
$('zoom').addEventListener('close',function(){if(zoomFrom&&zoomFrom.isConnected)zoomFrom.focus();zoomFrom=null});
var pagando=null;
function openPago(it){
  pagando=it;
  $('pago-sub').textContent=it.nome+' · '+linhaDe(it)+(it.ano?' · '+it.ano:'');
  $('i-pago').value=hasPago(it)?it.pago:'';
  $('dlg-pago').showModal();
}
$('pago-cancel').addEventListener('click',function(){$('dlg-pago').close()});
$('frm-pago').addEventListener('submit',function(e){
  e.preventDefault();if(!pagando)return;
  var v=parseFloat($('i-pago').value);
  if(isFinite(v)&&v>=0){pagando.pago=v;pagando.status='comprada'}else pagando.pago='';
  pagando=null;$('dlg-pago').close();changed();
});
var editing=null;
function openDlg(it){
  editing=it||null;$('dlg-title').textContent=it?'Editar boneca':'Adicionar boneca';
  $('i-nome').value=it?it.nome:'';$('i-linha').value=it?it.linha||'':'';$('i-ger').value=it?(['G1','G2','G3','Colecionador','Outra'].indexOf(it.ger)>=0?it.ger:''):'';
  $('i-prio').value=it?it.prio:'media';$('i-status').value=it?it.status:'quero';$('i-preco').value=it?it.preco:'';$('i-ano').value=it&&it.ano?it.ano:'';
  $('i-pago2').value=it&&hasPago(it)?it.pago:'';
  $('i-link').value=it?it.link||'':'';$('i-obs').value=it?it.obs||'':'';$('i-foto').value='';
  $('dlg').showModal();
}
$('add-manual').addEventListener('click',function(){if(editable())openDlg(null)});
$('dlg-cancel').addEventListener('click',function(){$('dlg').close()});
function shrink(file){return new Promise(function(res){
  if(!file)return res('');var r=new FileReader();r.onerror=function(){res('')};
  r.onload=function(){var im=new Image();im.onerror=function(){res('')};im.onload=function(){var s=Math.min(1,240/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));c.getContext('2d').drawImage(im,0,0,c.width,c.height);try{res(c.toDataURL('image/jpeg',.8))}catch(e){res('')}};im.src=r.result};
  r.readAsDataURL(file)})}
function invalid(id,msg){var f=$(id);f.setCustomValidity(msg);f.reportValidity();return false}
function normUrl(v){v=v.trim();if(v&&!/^[a-z][a-z0-9+.-]*:/i.test(v))v='https://'+v.replace(/^\/+/,'');return v}
$('frm').addEventListener('input',function(e){if(e.target.setCustomValidity)e.target.setCustomValidity('')});
$('frm').addEventListener('change',function(e){if(e.target.setCustomValidity)e.target.setCustomValidity('')});
$('frm').addEventListener('submit',function(e){
  e.preventDefault();var nome=$('i-nome').value.trim();if(!nome)return invalid('i-nome','Escreva o nome da boneca.');
  var link=normUrl($('i-link').value);
  if(link&&(!safeUrl(link)||/\s/.test(link)||!/^https?:\/\/[^\/?#]+\.[^\/?#]+/i.test(link)))return invalid('i-link','Esse link não parece válido. Use um endereço como https://loja.com/produto.');
  var preco=parseFloat($('i-preco').value),ano=parseInt($('i-ano').value,10),file=$('i-foto').files[0];
  shrink(file).then(function(foto){
    if(file&&!foto)return invalid('i-foto','Esse arquivo não é uma imagem. Escolha uma foto.');
    var it=editing||{id:newId(),cat:null,foto:''},antes=editing?editing.status:'quero',tinhaPago=!!editing&&hasPago(editing);
    it.nome=nome;it.linha=$('i-linha').value.trim();it.ger=$('i-ger').value;it.prio=$('i-prio').value;it.status=$('i-status').value;
    it.preco=isFinite(preco)&&preco>=0?preco:'';var pg=parseFloat($('i-pago2').value);it.pago=isFinite(pg)&&pg>=0?pg:'';if(it.pago!==''&&!tinhaPago&&it.status===antes)it.status='comprada';it.ano=isFinite(ano)?ano:'';it.link=link;it.obs=$('i-obs').value.trim();
    if(foto)it.foto=foto;
    if(!editing)state.items.push(it);
    $('dlg').close();changed();
  });
});

// compartilhar
function openShare(){
  if(!lista)return;
  $('i-titulo').value=lista.titulo;$('i-share').value=shareUrl();
  $('share-copy').textContent='Copiar';$('share-send').hidden=!navigator.share;
  $('dlg-share').showModal();
}
$('share-cancel').addEventListener('click',function(){$('dlg-share').close()});
$('share-copy').addEventListener('click',function(){
  var inp=$('i-share'),b=this;
  function ok(){b.textContent='Copiado ✓'}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(inp.value).then(ok,function(){inp.select()});
  else{inp.select();try{document.execCommand('copy');ok()}catch(x){}}
});
$('share-send').addEventListener('click',function(){
  if(navigator.share)navigator.share({title:lista.titulo,text:'Minha wishlist de Monster High',url:shareUrl()}).catch(function(){});
});
$('frm-share').addEventListener('submit',function(e){
  e.preventDefault();var t=$('i-titulo').value.trim().slice(0,60);
  if(!t)return invalid('i-titulo','Escreva um nome para a lista.');
  if(t===lista.titulo){$('dlg-share').close();return}
  sb.from('listas').update({titulo:t}).eq('id',lista.id).select('id').then(function(r){
    if(r.error||!r.data||!r.data.length)throw r.error||0;
    lista.titulo=t;$('dlg-share').close();ui.msg='Nome da lista guardado.';render();
  }).catch(function(){invalid('i-titulo','Não deu para guardar o nome agora. Tente de novo.')});
});
$('i-titulo').addEventListener('input',function(){this.setCustomValidity('')});

// salvar no banco
$('save').addEventListener('click',function(){
  if(!editable()||ui.saving||!ui.dirty)return;ui.saving=true;renderGrid();
  var sent=ui.dirty,merged=false;
  // Só grava se a lista no banco ainda for a mesma que este aparelho conhece.
  // Se outro aparelho salvou antes, busca a versão nova, junta as mudanças e tenta de novo.
  function attempt(n){
    var q=sb.from('listas').update({dados:{items:state.items,nao:state.nao},atualizada:new Date().toISOString()}).eq('id',lista.id);
    if(lista.atualizada)q=q.eq('atualizada',lista.atualizada);
    return q.select('id,atualizada').then(function(r){
      if(r.error)throw r.error;
      if(r.data&&r.data.length){lista.atualizada=r.data[0].atualizada;base=snap(state);return}
      if(n>=3)throw {code:'conflito'};
      return sb.from('listas').select('dados,atualizada').eq('id',lista.id).maybeSingle().then(function(r2){
        if(r2.error)throw r2.error;
        if(!r2.data)throw {code:'sessao'};
        mergeFrom(r2.data.dados);lista.atualizada=r2.data.atualizada;merged=true;
        return attempt(n+1);
      });
    });
  }
  attempt(0).then(function(){
    ui.dirty=Math.max(0,ui.dirty-sent);ui.saving=false;
    ui.msg=merged?'Salvo. Juntei com as mudanças feitas em outro aparelho.':ui.dirty?'':'Salvo.';
    if(merged)render();else renderGrid();
    var shown_=ui.msg;setTimeout(function(){if(shown_&&ui.msg===shown_){ui.msg='';renderGrid()}},merged?6000:2500);
  }).catch(function(err){
    ui.saving=false;var c=err&&err.code,m=String(err&&err.message||'');
    if(merged)render();
    if(c==='conflito')ui.msg='A lista está sendo mudada em outro aparelho agora. Espere um pouco e salve de novo.';
    else if(c==='sessao'||/jwt|token|auth/i.test(m))ui.msg='Sua sessão expirou. Entre de novo para salvar (copie o que for importante antes).';
    else if(c==='23514'||/too large|payload/i.test(m))ui.msg='A lista ficou grande demais. Remova algumas fotos e salve de novo.';
    else ui.msg='Não deu para salvar agora. Confira a internet e tente de novo.';
    renderGrid();
  });
});
window.addEventListener('beforeunload',function(e){if(editable()&&ui.dirty){e.preventDefault();e.returnValue=''}});

// entrar e sair
// Login pelo botão oficial do Google dentro do site: o Google mostra o endereço do site,
// não o do banco. Se o script do Google não carregar, cai no login antigo por redirecionamento.
function loginRedirect(){
  sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname+location.search}}).then(function(r){
    if(r&&r.error){ui.msg='Não deu para abrir o login do Google. Tente de novo.';render()}
  });
}
function hex(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return('0'+b.toString(16)).slice(-2)}).join('')}
function login(){
  if(!sb)return;
  if(editable()&&ui.dirty&&!confirm('Há alterações não salvas. Entrar mesmo assim?'))return;
  var gid=window.google&&google.accounts&&google.accounts.id;
  if(!gid||!CFG.googleClientId||!(window.crypto&&crypto.subtle))return loginRedirect();
  gisReady(gid).then(function(){
    var box=$('gbtn');box.innerHTML='';
    gid.renderButton(box,{theme:'filled_black',size:'large',shape:'pill',text:'signin_with',locale:'pt-BR',width:260});
    $('dlg-login').showModal();
  }).catch(loginRedirect);
}
// O Google é preparado uma vez por página, com um "nonce" que o Supabase confere no login.
var gisInit=null;
function gisReady(gid){
  if(gisInit)return gisInit;
  var raw=hex(crypto.getRandomValues(new Uint8Array(16)));
  gisInit=crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)).then(function(h){
    gid.initialize({client_id:CFG.googleClientId,nonce:hex(h),ux_mode:'popup',callback:function(resp){
      $('dlg-login').close();
      sb.auth.signInWithIdToken({provider:'google',token:resp.credential,nonce:raw}).then(function(r){
        if(r.error){ui.msg='Não deu para entrar com o Google. Tente de novo.';render()}
      });
    }});
  });
  gisInit.catch(function(){gisInit=null});
  return gisInit;
}
$('login-cancel').addEventListener('click',function(){$('dlg-login').close()});

// Easter egg: homenagem à Raissa. Abre ao digitar "raissa" (na página ou na busca) ou tocar 7 vezes em "Monster High".
function eggRain(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var box=document.createElement('div'),bits=['💀','🦇','💖','🖤','🕷️','💜'];
  box.className='egg-rain';box.setAttribute('aria-hidden','true');
  for(var i=0;i<36;i++){
    var s=document.createElement('span');s.textContent=bits[i%bits.length];
    s.style.left=Math.random()*100+'vw';s.style.fontSize=(16+Math.random()*22)+'px';
    s.style.animationDuration=(2.6+Math.random()*2.4)+'s';s.style.animationDelay=Math.random()*1.6+'s';
    box.appendChild(s);
  }
  document.body.appendChild(box);setTimeout(function(){box.remove()},7000);
}
function openEgg(){
  var d=$('dlg-egg');if(d.open)return;
  var top=document.querySelector('dialog[open]');if(top)top.close();
  d.showModal();eggRain();
}
$('egg-close').addEventListener('click',function(){$('dlg-egg').close()});
var eggTyped='';
document.addEventListener('keydown',function(e){
  if(e.ctrlKey||e.metaKey||e.altKey||e.key.length!==1)return;
  var t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
  eggTyped=(eggTyped+e.key.toLowerCase()).slice(-6);
  if(eggTyped==='raissa'){eggTyped='';openEgg()}
});
$('q').addEventListener('input',function(){
  var v=this.value.trim().toLowerCase();
  if(v==='raissa'||v==='raissa massaroli')openEgg();
});
var eggTaps=0,eggTimer=null;
document.querySelector('h1 em').addEventListener('click',function(){
  clearTimeout(eggTimer);eggTimer=setTimeout(function(){eggTaps=0},1500);
  if(++eggTaps>=7){eggTaps=0;openEgg()}
});
function logout(){
  if(editable()&&ui.dirty&&!confirm('Há alterações não salvas. Sair mesmo assim?'))return;
  sb.auth.signOut().catch(function(){});
}

// reservas de presente (só em listas de outras pessoas)
var RMSG='Não deu para guardar sua reserva agora. Tente de novo.';
function loadReservas(){
  if(ui.mode!=='view'||!lista)return;
  if(!sess){reservas={};renderGrid();return}// só quem entrou vê as reservas (a dona deslogada não espia)
  sb.rpc('reservas_da_lista',{p_lista:lista.id}).then(function(r){
    if(r.error)throw r.error;var m={};
    (r.data||[]).forEach(function(x){m[x.item]=x.minha?'eu':'outro'});
    reservas=m;renderGrid();
  }).catch(function(){ui.msg='Não deu para carregar as reservas agora. Recarregue a página.';renderGrid()});
}
function toggleReserva(itemId){
  if(ui.mode!=='view'||!lista||reservando)return;
  if(!sess){ui.msg='Entre com o Google para reservar um presente.';renderGrid();return login()}
  var mine=reservas[itemId]==='eu';reservando=true;renderGrid();
  var q=mine?sb.from('reservas').delete().eq('lista',lista.id).eq('item',itemId):sb.from('reservas').insert({lista:lista.id,item:itemId});
  q.then(function(r){
    reservando=false;
    if(r.error)ui.msg=r.error.code==='23505'?'Alguém acabou de reservar esta boneca.':RMSG;
    else ui.msg=mine?'Reserva desfeita.':'Reservado! Só você sabe que vai dar esta.';
    loadReservas();renderGrid();
  });
}

// carregar a lista certa para quem está vendo
function loadList(){
  var uid=sess&&sess.user?sess.user.id:null;
  ui.mode=SLUG?'view':'own';
  lista=null;reservas={};state={items:[],nao:[]};ui.dirty=0;listState='loading';render();
  if(ui.mode==='view'){
    sb.rpc('ver_lista',{p_slug:SLUG}).then(function(r){
      if(r.error)throw r.error;var row=r.data&&r.data[0];
      if(!row){listState='none';render();return}
      if(row.minha){ui.mode='own';return loadOwn(uid)}// a dona abriu o próprio link: pode editar
      lista={id:row.id,titulo:row.titulo};setState(row.dados);listState='ok';render();loadReservas();
    }).catch(function(){listState='error';render()});
    return;
  }
  if(!uid){listState='out';render();return}
  loadOwn(uid);
}
function loadOwn(uid){
  sb.from('listas').select('id,slug,titulo,dados,atualizada').eq('dono',uid).maybeSingle().then(function(r){
    if(r.error)throw r.error;
    if(r.data)return r.data;
    var nm=userName().split(/[\s@]/)[0];
    return sb.from('listas').insert({titulo:nm?('Wishlist de '+nm).slice(0,60):'Minha wishlist'}).select('id,slug,titulo,dados,atualizada').single().then(function(r2){if(r2.error)throw r2.error;return r2.data});
  }).then(function(row){lista=row;setState(row.dados);base=snap(state);listState='ok';render()}).catch(function(err){
    if(err&&err.code==='23505')return loadOwn(uid);// a lista foi criada em outra aba
    listState='error';render();
  });
}
function boot(){
  if(!sb){render();return}
  var hp=new URLSearchParams(location.hash.slice(1)),err=params.get('error_description')||hp.get('error_description');
  if(err)ui.msg='Não deu para entrar com o Google. Tente de novo.';
  var loadedFor;
  sb.auth.onAuthStateChange(function(ev,s){
    sess=s;var k=s&&s.user?s.user.id:'';
    if(k!==loadedFor){loadedFor=k;setTimeout(loadList,0)}else renderHead();
  });
}
function loadCatalog(){
  fetch('catalogo.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    ATLAS={cols:d.cols,rows:d.rows,per:d.per};var anos={};
    HD=d.hd||null;
    CATALOG=d.itens.map(function(r){var c={ano:r[0],linha:r[1],orig:r[2],nome:r[3],pers:r[4],t:r[5],id:r[6],hd:r[7]==null?-1:r[7]};CATMAP[c.id]=c;anos[c.ano]=1;return c});
    var gi={};CATALOG.forEach(function(c,i){var k=c.ano+'|'+c.linha;if(!(k in gi))gi[k]=i;c.i=i});
    CATALOG.sort(function(a,b){return a.ano-b.ano||gi[a.ano+'|'+a.linha]-gi[b.ano+'|'+b.linha]||a.i-b.i});
    var sel=$('f-ano');Object.keys(anos).sort().forEach(function(a){var o=document.createElement('option');o.textContent=a;sel.appendChild(o)});
    catState='ok';render();
  }).catch(function(){catState='error';render()});
}
render();boot();loadCatalog();
})();
