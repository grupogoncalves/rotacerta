import { firebaseConfig } from './firebase-config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const DEMO_KEY = 'rotacerta_demo_v1';
const BASE = location.protocol==='file:'?'https://seu-dominio.example/index.html':`${location.origin}${location.pathname}`;
const S = { cloud:configured, role:null, user:null, view:'overview', deliveries:[], drivers:[], unsub:[], modal:null, maps:{}, watch:null, gpsBusy:false, gpsLast:0, gpsPoint:null, photos:[], signed:false, rating:null, filter:'todos', term:'', currentTracking:null, trackStop:null, setupView:false, bootstrapInProgress:false, registering:false, pendingUsers:[], inactiveDrivers:[], dataUnsub:[] };
let F = null, auth = null, db = null, functions = null;
let localChannel = null, timerToast = null, memoryDemo = null;

function e(str=''){ return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function qs(obj){return new URLSearchParams(obj).toString();}
function token(){const a = new Uint8Array(20);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}
function id(){return crypto.randomUUID?.() || token();}
function stamp(){return new Date().toISOString();}
function formatDate(v){if(!v)return '—';try{const d=v?.toDate?v.toDate():new Date(v);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);}catch{return '—';}}
function phoneDigits(x){let p=String(x||'').replace(/\D/g,'');if(p.startsWith('55') && p.length>11)return p;return '55'+p;}
function validPhone(x){return /^55\d{10,11}$/.test(phoneDigits(x)) && !/^(55)(\d)\2{9,10}$/.test(phoneDigits(x));}
function cpfValid(value){const s=String(value).replace(/\D/g,'');if(!/^\d{11}$/.test(s)||/^(\d)\1{10}$/.test(s))return false;for(let d=9;d<11;d++){let sum=0;for(let i=0;i<d;i++)sum+=Number(s[i])*(d+1-i);let n=(sum*10)%11;if(n===10)n=0;if(n!==Number(s[d]))return false;}return true;}
function maskCPF(v){const x=String(v||'').replace(/\D/g,'');return x.length===11?`${x.slice(0,3)}.***.***-${x.slice(-2)}`:'—';}
function statusLabel(st){return ({pendente:'Aguardando',em_rota:'Em rota',entregue:'Entregue'})[st]||st;}
function badge(st){return `<span class="status status-${e(st)}">${statusLabel(st)}</span>`;}
function trackLink(d){return `${BASE}?${qs({track:d.trackingToken})}`;}
function npsLink(d){return `${BASE}?${qs({nps:d.npsToken})}`;}
function messageText(d,kind){return kind==='start' ? `Olá, ${d.customerName}! 🚚\n\nSua entrega *${d.code}* saiu para entrega e já está a caminho.\n\n📍 *Acompanhe a entrega em tempo real:*\n${trackLink(d)}\n\nAté breve!\nEquipe RotaCerta` : `Olá, ${d.customerName}! 💚\n\nSua entrega *${d.code}* foi concluída. Gostaríamos de ouvir sua opinião sobre o atendimento.\n\n⭐ *Avalie a entrega de 0 a 10:*\n${npsLink(d)}\n\nObrigado!\nEquipe RotaCerta`;}
function whatsappLink(d,text){return validPhone(d.customerPhone)?`https://wa.me/${phoneDigits(d.customerPhone)}?text=${encodeURIComponent(text)}`:null;}
function publicLinkWarning(){if(location.protocol==='file:')return 'Esta demonstração foi aberta como arquivo local. O link só poderá ser acessado por outro aparelho após a publicação em um site HTTPS com Firebase configurado.';if(['localhost','127.0.0.1'].includes(location.hostname))return 'Link local de teste: ele não abre no celular do cliente. Publique o aplicativo em HTTPS com Firebase para compartilhar o rastreamento.';if(!configured)return 'Modo demonstração: o link não terá dados sincronizados com o celular do cliente. Configure o Firebase antes de usar de verdade.';return '';}
function messageModal(d,kind){
 if(!d)return;
 if(kind==='nps'&&d.status!=='entregue')throw Error('Finalize a entrega antes de preparar a avaliação.');
 const title=kind==='start'?'Mensagem de início de entrega':'Mensagem de avaliação NPS';
 const url=kind==='start'?trackLink(d):npsLink(d),text=messageText(d,kind),warning=publicLinkWarning();
 const content=`<div class="message-preview-intro"><strong>${kind==='start'?'🚚 Aviso de saída para entrega':'⭐ Pesquisa de satisfação'}</strong><p>A mensagem abaixo já contém o link. Você pode editar antes de abrir o WhatsApp. <b>Nada será enviado automaticamente.</b></p></div><div class="field"><label>Mensagem pronta para ${e(d.customerName)}</label><textarea id="readyMessage" class="message-preview-text" rows="10" maxlength="2500">${e(text)}</textarea></div><div class="field" style="margin-top:12px"><label>${kind==='start'?'Link de acompanhamento':'Link da avaliação'}</label><div class="copy-input"><input id="messageLink" readonly value="${e(url)}" aria-label="Link da entrega">${btn('copy-message-link','Copiar link','btn-outline btn-sm')}</div></div>${warning?`<div class="callout warn" style="margin-top:15px">⚠ ${e(warning)}</div>`:''}${d.whatsappOptIn===false?`<div class="callout warn" style="margin-top:14px">O cliente não tem autorização para contato pelo WhatsApp registrada nesta entrega. Confirme antes de enviar.</div>`:''}<div class="callout" style="margin-top:14px">O envio só acontece quando você confirmar no WhatsApp. O aplicativo não consegue saber se a mensagem foi enviada.</div>`;
 modal(title,content,btn('close-modal','Voltar')+btn('copy-message','📋 Copiar mensagem','btn-outline')+btn('share-whatsapp','↗ Abrir WhatsApp','btn-green'));
 S.modal.dataset.deliveryId=d.id;S.modal.dataset.messageKind=kind;
}
function openPreparedWhatsapp(){const d=findDelivery(S.modal?.dataset.deliveryId);if(!d)throw Error('Entrega indisponível.');const message=$('#readyMessage')?.value?.trim();if(!message)throw Error('Escreva uma mensagem antes de abrir o WhatsApp.');const link=whatsappLink(d,message);if(!link)throw Error('Cadastre um WhatsApp válido para o cliente.');window.open(link,'_blank','noopener,noreferrer');toast('Mensagem aberta no WhatsApp. Confirme o envio manualmente.');}

function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(timerToast);timerToast=setTimeout(()=>el.classList.remove('show'),4000);}
function problem(err){console.error(err);toast(err?.message || 'Ocorreu um erro. Verifique os dados e tente novamente.');}
function btn(action,text,cls='btn-outline',extra=''){return `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;}
function demoDefaults(){return {drivers:[{uid:'driver-demo',name:'Motorista demonstração',email:'motorista@exemplo.test'}],pendingUsers:[],inactiveDrivers:[],deliveries:[{id:'demo-entrega-01',code:'ENT-1027',customerName:'Cliente demonstração',customerPhone:'00000000000',address:'Endereço de demonstração',city:'Jaraguá do Sul / SC',notes:'Entrega para teste. Cadastre uma nova entrega com dados reais para usar o WhatsApp.',reference:'',orderNumber:'OP-1027',driverId:'driver-demo',driverName:'Motorista demonstração',status:'pendente',trackingToken:token(),npsToken:token(),createdAt:stamp(),routePoints:[],orderFile:null}]};}
function readDemo(){try{const v=JSON.parse(localStorage.getItem(DEMO_KEY));if(v?.drivers && Array.isArray(v.deliveries))return v;}catch{}if(memoryDemo)return memoryDemo;const start=demoDefaults();try{localStorage.setItem(DEMO_KEY,JSON.stringify(start));}catch{memoryDemo=start;}return start;}
function writeDemo(){const data={drivers:S.drivers,pendingUsers:S.pendingUsers,inactiveDrivers:S.inactiveDrivers,deliveries:S.deliveries};try{localStorage.setItem(DEMO_KEY,JSON.stringify(data));}catch{memoryDemo=data;}localChannel?.postMessage('updated');}
function reloadDemo(){const x=readDemo();S.deliveries=x.deliveries;S.drivers=x.drivers;S.pendingUsers=x.pendingUsers||[];S.inactiveDrivers=x.inactiveDrivers||[]; if(location.search.includes('track='))renderTrackingDemo();else if(location.search.includes('nps='))renderNpsDemo();else if(S.role)render();}
function findDelivery(key){return S.deliveries.find(d=>d.id===key);}
function own(d){return S.role==='admin'||d.driverId===S.user?.uid;}
function setUnsub(fn){if(fn)S.unsub.push(fn);}
function clearDataUnsubs(){for(const fn of S.dataUnsub){try{fn();}catch{}}S.dataUnsub=[];}
function setDataUnsub(fn){if(fn)S.dataUnsub.push(fn);}
function clearUnsubs(){clearDataUnsubs();for(const fn of S.unsub){try{fn();}catch{}}S.unsub=[];}
function clearMap(key){if(S.maps[key]){S.maps[key].remove();delete S.maps[key];}}
function showMap(key,locationData){const node=document.getElementById(key);if(!node)return;clearMap(key);const coords=locationData?.lastLocation;const points=locationData?.routePoints||[];if(!window.L){node.innerHTML='<div class="map-missing">Mapa indisponível sem acesso à internet.</div>';return;}if(!coords?.lat){node.innerHTML='<div class="map-missing">📍 A localização aparecerá assim que o motorista iniciar o GPS.</div>';return;}const map=L.map(node,{zoomControl:true}).setView([coords.lat,coords.lng],14);S.maps[key]=map;L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);const marker=L.divIcon({html:'<div style="width:19px;height:19px;border:4px solid white;border-radius:50%;background:#27d6a3;box-shadow:0 0 0 5px #27d6a344"></div>',iconSize:[27,27],className:''});L.marker([coords.lat,coords.lng],{icon:marker}).addTo(map).bindPopup('Última posição do motorista');const valid=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).map(p=>[p.lat,p.lng]);if(valid.length>1){const line=L.polyline(valid,{color:'#3977de',weight:5,opacity:.85}).addTo(map);map.fitBounds(line.getBounds(),{padding:[28,28],maxZoom:15});}setTimeout(()=>map.invalidateSize(),90);}

async function initCloud(){
  if(!configured)return;
  const v='12.19.0', root=`https://www.gstatic.com/firebasejs/${v}/`;
  const [appMod,a,f,fun] = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js','firebase-functions.js'].map(file=>import(root+file)));
  F={...appMod,...a,...f,...fun};const instance=F.initializeApp(firebaseConfig);
  auth=F.getAuth(instance);db=F.getFirestore(instance);functions=F.getFunctions(instance,'southamerica-east1');
}
// Inscrição pessoal: Authentication cria a conta; Firestore registra SOMENTE perfil pendente.
// Apenas alguém com acesso administrativo ao Console Firebase pode alterar active para true.
async function savePendingProfile(name){
 const u=auth?.currentUser;if(!u?.email)throw Error('É preciso estar autenticado para solicitar acesso.');
 name=String(name||'').trim();if(name.length<3||name.length>100)throw Error('Informe seu nome completo.');
 const ref=F.doc(db,'users',u.uid),snap=await F.getDoc(ref);
 if(snap.exists())throw Error('Sua solicitação já está registrada. Aguarde a aprovação.');
 await F.setDoc(ref,{name,email:u.email.toLowerCase(),role:'driver',active:false,createdAt:F.serverTimestamp()});
}
function watchUserProfile(u){
 clearUnsubs();stopGps();S.role=null;
 S.user={uid:u.uid,email:u.email,name:u.displayName||u.email};
 const uid=u.uid;
 setUnsub(F.onSnapshot(F.doc(db,'users',uid),snap=>{
   if(auth?.currentUser?.uid!==uid)return;
   if(!snap.exists()){
     clearDataUnsubs();S.role=null;
     if(S.registering)renderWaitForRegistration();else renderMissingProfile();
     return;
   }
   const profile=snap.data();
   if(profile.active!==true || !['admin','driver'].includes(profile.role)){
     if(S.role){clearDataUnsubs();stopGps();}
     S.role=null;S.user={uid,email:u.email,name:profile.name||u.email};
     renderAwaitingApproval(profile);return;
   }
   const changed=S.role!==profile.role;
   S.user={uid,email:u.email,name:profile.name||u.email};
   
   if(changed){clearDataUnsubs();S.role=profile.role;S.view=profile.role==='admin'?'overview':'driver';attachData();}
   else render();
 },err=>{problem(err);app.innerHTML='<div class="error-page"><h2>Não foi possível consultar seu perfil</h2><p>Confira as regras do Firestore e tente novamente.</p><button class="btn btn-outline" data-action="logout">Sair</button></div>';}));
}
function authFrame(title,subtitle,fields,actionText,formId){
 app.innerHTML=`<div class="auth-page"><section class="auth-art"><div class="logo"><span class="brand-mark">↗</span><span>RotaCerta<small>CONTROLE DE ACESSO</small></span></div><div><span class="eyebrow">EQUIPE DE ENTREGAS</span><h1>${title}</h1><p>Cadastre-se para solicitar acesso. O sistema só será liberado após aprovação no Firebase.</p></div><div class="auth-illustration">🔐</div></section><section class="auth-side"><div class="auth-form"><div class="brand-mark" style="margin-bottom:20px">↗</div><h2>${subtitle}</h2>${fields?`<form id="${formId}">${fields}<button type="submit" class="btn btn-primary btn-block">${actionText}</button></form>`:''}<div style="margin-top:16px">${btn('signup-back','← Voltar para login','btn-outline btn-block')}</div></div></section></div>`;
}
function renderSignup(){
 const fields=`<p class="sub" style="margin-bottom:18px">Sua conta será criada como <b>Motorista · aguardando aprovação</b>. O administrador poderá mudar seu perfil diretamente no Firebase.</p><div class="field"><label>Nome completo</label><input class="auth-input" name="name" type="text" required minlength="3" maxlength="100" autocomplete="name" placeholder="Seu nome"></div><div class="field"><label>E-mail</label><input class="auth-input" type="email" name="email" required autocomplete="email" placeholder="voce@empresa.com"></div><div class="field"><label>Senha</label><input class="auth-input" type="password" name="password" required minlength="12" autocomplete="new-password" placeholder="Mínimo de 12 caracteres"></div><div class="field"><label>Confirmar senha</label><input class="auth-input" type="password" name="confirmPassword" required minlength="12" autocomplete="new-password" placeholder="Digite novamente a senha"></div>`;
 authFrame('Seu acesso começa <em>aqui.</em>','Solicitar cadastro',fields,'Criar conta e solicitar aprovação →','signupForm');
}
function renderWaitForRegistration(){
 app.innerHTML=`<div class="auth-page"><section class="auth-side" style="flex:1"><div class="auth-form"><h2>Registrando sua solicitação...</h2><p>Aguarde a confirmação do cadastro.</p></div></section></div>`;
}
function renderMissingProfile(){

 app.innerHTML=`<div class="auth-page"><section class="auth-art"><div class="logo"><span class="brand-mark">↗</span><span>RotaCerta<small>CADASTRO</small></span></div><div><h1>Complete sua <em>solicitação.</em></h1><p>Encontramos seu login, mas ainda falta o registro de autorização no Firestore.</p></div><div class="auth-illustration">👤</div></section><section class="auth-side"><div class="auth-form"><h2>Solicitar aprovação</h2><p>Conta: <b>${e(auth?.currentUser?.email||'')}</b></p><form id="requestAccessForm"><div class="field"><label>Nome completo</label><input class="auth-input" name="name" value="${e(auth?.currentUser?.displayName||'')}" required minlength="3" maxlength="100" placeholder="Seu nome completo"></div><button type="submit" class="btn btn-primary btn-block">Solicitar aprovação</button></form><div class="callout" style="margin-top:16px">Você receberá acesso somente depois que o responsável alterar <b>active = true</b> no Firestore.</div>${btn('logout','Sair da conta','btn-outline btn-block')}</div></section></div>`;
}
function renderAwaitingApproval(profile){

 app.innerHTML=`<div class="auth-page"><section class="auth-art"><div class="logo"><span class="brand-mark">↗</span><span>RotaCerta<small>AGUARDANDO LIBERAÇÃO</small></span></div><div><span class="eyebrow">CADASTRO RECEBIDO</span><h1>Seu acesso está <em>pendente.</em></h1><p>O aplicativo liberará seu perfil automaticamente quando o administrador aprovar no Firebase.</p></div><div class="auth-illustration">⏳</div></section><section class="auth-side"><div class="auth-form"><div class="brand-mark" style="margin-bottom:20px">↗</div><h2>Solicitação registrada ✓</h2><p>Olá, <strong>${e(profile.name||S.user?.name||'')}</strong>. Seu usuário foi criado, mas ainda não está autorizado a entrar.</p><div class="callout warn" style="margin:18px 0"><b>Aguardando aprovação</b><p style="margin:7px 0 0">O responsável deverá abrir Firebase → Firestore → users → seu UID e alterar <code>active</code> para <code>true</code>.</p></div><div class="field"><label>UID da sua conta</label><div class="copy-input"><input readonly value="${e(S.user?.uid||'')}">${btn('copy-own-uid','Copiar UID','btn-outline btn-sm')}</div></div><p class="sub" style="font-size:12px;margin-top:12px">O status é acompanhado em tempo real. Não é necessário se cadastrar novamente.</p>${btn('logout','Sair da conta','btn-outline btn-block')}</div></section></div>`;
}
async function registerAccount(form){
 const data=new FormData(form),name=String(data.get('name')||'').trim(),email=String(data.get('email')||'').trim().toLowerCase(),password=String(data.get('password')||''),confirm=String(data.get('confirmPassword')||'');
 if(name.length<3||name.length>100)throw Error('Informe seu nome completo.');
 if(password.length<12)throw Error('A senha precisa de pelo menos 12 caracteres.');
 if(password!==confirm)throw Error('As senhas não coincidem.');
 S.registering=true;
 try{
   const result=await F.createUserWithEmailAndPassword(auth,email,password);
   await F.updateProfile(result.user,{displayName:name});
   await savePendingProfile(name);
   toast('Cadastro enviado. Aguarde aprovação no Firebase.');
 }finally{
   S.registering=false;
   if(auth?.currentUser)watchUserProfile(auth.currentUser);
 }
}
async function requestAccess(form){await savePendingProfile(new FormData(form).get('name'));watchUserProfile(auth.currentUser);toast('Solicitação enviada. Aguarde aprovação.');}

async function boot(){
  try{if('serviceWorker'in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
    if(!configured){const d=readDemo();S.deliveries=d.deliveries;S.drivers=d.drivers;S.pendingUsers=d.pendingUsers||[];S.inactiveDrivers=d.inactiveDrivers||[];localChannel='BroadcastChannel'in window?new BroadcastChannel('rotacerta-demo'):null;if(localChannel)localChannel.onmessage=reloadDemo;window.addEventListener('storage',ev=>{if(ev.key===DEMO_KEY)reloadDemo();});const publicRoute=new URLSearchParams(location.search);if(publicRoute.has('track'))return renderTrackingDemo();if(publicRoute.has('nps'))return renderNpsDemo();renderLogin();}
    else{await initCloud();const p=new URLSearchParams(location.search);if(p.has('track'))return cloudTracking(p.get('track'));if(p.has('nps'))return cloudNps(p.get('nps'));F.onAuthStateChanged(auth,u=>{if(!u){clearUnsubs();stopGps();S.role=null;S.user=null;S.registering=false;renderLogin();return;}if(S.bootstrapInProgress||S.registering)return;watchUserProfile(u);});}
  }catch(err){console.error(err);app.innerHTML=`<div class="error-page"><h2>Falha ao iniciar o aplicativo</h2><p>${e(err.message)}</p><p>Confira sua conexão e o arquivo firebase-config.js.</p></div>`;}
}
function renderLogin(){

 app.innerHTML=`<div class="auth-page"><section class="auth-art"><div class="logo" style="margin:0"><span class="brand-mark">↗</span><span>RotaCerta<small>LOGÍSTICA INTELIGENTE</small></span></div><div><span class="eyebrow">DO PEDIDO À ENTREGA</span><h1>Sua operação em <em>movimento.</em></h1><p>Controle cada entrega, acompanhe o motorista ao vivo e registre a satisfação de cada cliente.</p></div><div class="auth-illustration">🚚</div></section><section class="auth-side"><div class="auth-form"><div class="brand-mark" style="margin-bottom:23px">↗</div><h2>Bem-vindo de volta</h2><p>Entre para acessar suas entregas.</p>${configured?`<form id="loginForm"><div class="field"><label>E-mail</label><input name="email" class="auth-input" type="email" autocomplete="username" required placeholder="voce@empresa.com"></div><div class="field"><label>Senha</label><input name="password" class="auth-input" type="password" autocomplete="current-password" required placeholder="••••••••"></div><button class="btn btn-primary btn-block" type="submit">Entrar no sistema →</button></form><button type="button" data-action="signup" class="btn btn-outline btn-block" style="margin-top:13px">＋ Criar usuário / Solicitar cadastro</button><div class="callout" style="margin-top:16px">Novos cadastros ficam pendentes até aprovação pelo administrador no aplicativo. O primeiro administrador é autorizado pelo Console Firebase, com <code>role: admin</code> e <code>active: true</code>.</div>`:`<div class="demo-box"><strong>✨ Demonstração interativa</strong><small>Teste todas as telas sem cadastrar uma conta. Dados ficam somente neste navegador.</small><div class="demo-buttons"><button data-action="login-admin" class="btn btn-primary btn-block">Entrar como administrador →</button><button data-action="login-driver" class="btn btn-outline btn-block">Entrar como motorista 🚚</button></div></div><div class="callout warn" style="margin-top:18px">Modo demonstração: o WhatsApp abre com uma mensagem pronta, sem envio automático. Para rastreamento entre celulares, configure o Firebase.</div>`}</div></section></div>`;
}

function attachData(){
  if(!configured)return;
  if(S.role==='admin'){setDataUnsub(F.onSnapshot(F.collection(db,'deliveries'),snap=>{S.deliveries=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));render();},problem));setDataUnsub(F.onSnapshot(F.collection(db,'users'),snap=>{const users=snap.docs.map(x=>({uid:x.id,...x.data()}));S.drivers=users.filter(x=>x.role==='driver'&&x.active===true);S.pendingUsers=users.filter(x=>x.role==='driver'&&x.active!==true&&!x.approvedAt);S.inactiveDrivers=users.filter(x=>x.role==='driver'&&x.active!==true&&!!x.approvedAt);render();},problem));}
  else{setDataUnsub(F.onSnapshot(F.query(F.collection(db,'deliveries'),F.where('driverId','==',S.user.uid)),snap=>{S.deliveries=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));render();},problem));}
  render();
}
function enterDemo(role){S.role=role;S.user=role==='admin'?{uid:'admin-demo',name:'Administrador',email:'admin@demo.test'}:{uid:'driver-demo',name:'Motorista demonstração',email:'motorista@demo.test'};S.view=role==='admin'?'overview':'driver';render();}
function navigation(){const links=S.role==='admin'?[['overview','▦','Visão geral'],['deliveries','▤','Entregas'],['drivers','♙','Motoristas']]:[['driver','▥','Minhas entregas']];return links;}
function shellMain(){const nav=navigation(),selected=S.view,title={overview:['Painel de operações','Acompanhe tudo em um só lugar'],deliveries:['Gestão de entregas','Organize os pedidos e despachos'],drivers:['Equipe de motoristas','Controle de acessos e atribuições'],driver:['Minhas entregas','Sua rota de trabalho de hoje']}[selected]||['RotaCerta','Operação'];return `<div class="app-layout"><aside class="side"><div class="logo"><span class="brand-mark">↗</span><span>RotaCerta<small>GESTÃO DE ENTREGAS</small></span></div><div class="nav-label">PAINEL</div><div class="nav-links">${nav.map(x=>`<button data-action="view" data-view="${x[0]}" class="nav-link ${selected===x[0]?'active':''}"><span class="nav-ico">${x[1]}</span>${x[2]}</button>`).join('')}</div><div class="side-foot"><div style="display:flex;gap:9px;align-items:center"><div class="avatar">${e((S.user.name||'?').slice(0,1).toUpperCase())}</div><div style="font-size:12px;font-weight:800">${e(S.user.name)}<small>${S.role==='admin'?'Administrador':'Motorista'}</small></div></div><button data-action="logout">⇦ &nbsp; Sair da conta</button></div></aside><main class="content"><div class="topbar"><div><div class="eyebrow">OPERAÇÃO / ${S.role==='admin'?'ADMINISTRATIVO':'MOTORISTA'}</div><h1 class="page-title">${title[0]}</h1><div class="sub" style="font-size:13px">${title[1]}</div></div><div class="top-actions"><span class="small-tag ${!configured?'demo-tag':''}">${configured?'● Conectado':'● Modo demo'}</span><div class="userchip"><span class="avatar">${e(S.user.name.slice(0,1).toUpperCase())}</span>${e(S.user.name)}</div><button class="top-logout" data-action="logout">Sair</button></div></div>${mainSection()}<div style="height:24px"></div></main><nav class="mobile-nav">${nav.map(x=>`<button data-action="view" data-view="${x[0]}" class="${selected===x[0]?'active':''}"><span>${x[1]}</span>${x[2]}</button>`).join('')}</nav></div>`;}
function mainSection(){if(S.view==='overview')return overview();if(S.view==='deliveries')return deliveryPanel();if(S.view==='drivers')return driversPanel();return driverPanel();}
function stats(){const all=S.deliveries;const pending=all.filter(d=>d.status==='pendente').length,onroute=all.filter(d=>d.status==='em_rota').length,done=all.filter(d=>d.status==='entregue').length;const scores=all.map(d=>d.nps?.score).filter(x=>Number.isInteger(x));const nps=scores.length?Math.round(100*(scores.filter(x=>x>=9).length-scores.filter(x=>x<=6).length)/scores.length):'—';return `<div class="stats-grid">${[['▤','Total de entregas',all.length,'Pedidos registrados'],['◷','Aguardando',pending,'Prontas para despachar'],['↗','Em rota',onroute,'Acompanhamento ao vivo'],['★','NPS da operação',nps,`${scores.length} avaliações · −100 a +100`]].map(x=>`<div class="stat-card"><div class="stat-top"><span>${x[1]}</span><span class="stat-icon">${x[0]}</span></div><div class="stat-number">${x[2]}</div><div class="stat-note">${x[3]}</div></div>`).join('')}</div>`;}
function filtered(){return S.deliveries.filter(d=>(S.filter==='todos'||d.status===S.filter)&&(!S.term||[d.customerName,d.code,d.orderNumber,d.driverName,d.city].join(' ').toLowerCase().includes(S.term.toLowerCase())));}
function rows(items){if(!items.length)return `<div class="empty"><div class="empty-big">📦</div><strong>Nenhuma entrega encontrada</strong><p>Cadastre uma entrega ou ajuste os filtros.</p></div>`;return items.map(d=>`<article class="delivery-row"><div><div class="row-code">${e(d.code)} · ${e(d.orderNumber||'Sem OP')}</div><div class="row-name">${e(d.customerName)}</div><div class="row-muted">📍 ${e(d.city||d.address)} · ${formatDate(d.createdAt)}</div></div><div class="row-driver"><div style="font-size:12px;font-weight:700">🚚 ${e(d.driverName||'Não atribuído')}</div><div class="row-muted">${d.status==='entregue'?(d.nps?.score!==undefined?'⭐ Avaliação '+d.nps.score+'/10':'Aguardando NPS'):d.status==='em_rota'?'Acompanhe a localização':'Ordem pendente'}</div></div><div class="row-last">${badge(d.status)}${btn('detail','Ver detalhes →','btn-soft btn-sm',`data-id="${e(d.id)}"`)}</div></article>`).join('');}
function filtersHTML(){return `<div class="filters"><div class="search"><input id="searchDeliveries" value="${e(S.term)}" type="search" placeholder="Buscar cliente, entrega ou OP..."></div><select id="filterStatus" class="filter-select"><option value="todos" ${S.filter==='todos'?'selected':''}>Todos os status</option><option value="pendente" ${S.filter==='pendente'?'selected':''}>Aguardando</option><option value="em_rota" ${S.filter==='em_rota'?'selected':''}>Em rota</option><option value="entregue" ${S.filter==='entregue'?'selected':''}>Entregue</option></select></div>`;}
function overview(){const recent=S.deliveries.filter(d=>d.status==='entregue').slice(0,4);return `${stats()}<div class="split"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Entregas recentes</h2><p class="panel-sub">Visão rápida dos pedidos cadastrados</p></div>${btn('new-delivery','＋ Nova entrega','btn-primary')}</div><div class="delivery-list">${rows(S.deliveries.slice(0,7))}</div><div style="margin-top:17px;text-align:center">${btn('view','Ver todas as entregas →','btn-outline btn-sm','data-view="deliveries"')}</div></section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Atividade da operação</h2><p class="panel-sub">Últimos eventos</p></div></div>${recent.length?recent.map(d=>`<div class="activity-item"><strong>${e(d.customerName)}</strong><small>Entrega concluída · ${formatDate(d.deliveredAt)}</small></div>`).join(''):'<p class="sub" style="font-size:13px">As entregas finalizadas aparecerão aqui.</p>'}<div class="info-box" style="margin-top:26px"><div class="num">${S.deliveries.filter(d=>d.status==='entregue').length}</div><p>Entregas finalizadas no histórico</p></div></section></div>`;}
function deliveryPanel(){return `<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Todos os pedidos</h2><p class="panel-sub">${S.deliveries.length} entrega(s) cadastrada(s)</p></div>${btn('new-delivery','＋ Nova entrega','btn-primary')}</div>${filtersHTML()}<div id="deliveryResults" class="delivery-list">${rows(filtered())}</div></section>`;}
function driversPanel(){
 const activeCards=S.drivers.map(d=>{const enroute=S.deliveries.filter(x=>x.driverId===d.uid&&x.status==='em_rota').length;return `<div class="driver-card"><div class="driver-card-top"><div class="driver-icon">🚚</div><span class="small-tag">● Ativo</span></div><strong>${e(d.name)}</strong><p>✉ ${e(d.email||'Sem e-mail')}</p>${d.phone?`<p>📞 ${e(d.phone)}</p>`:''}<p>${enroute} em rota · ${S.deliveries.filter(x=>x.driverId===d.uid&&x.status==='pendente').length} entregas pendentes</p><div class="driver-card-actions">${btn('driver-access','⏸ Desativar','btn-outline btn-sm',`data-uid="${e(d.uid)}" data-enabled="false" ${enroute?'disabled title="Há entrega em rota"':''}`)}</div></div>`;}).join('');
 const pending=S.pendingUsers.map(x=>`<div class="driver-list-row"><div class="driver-list-person"><strong>${e(x.name||'Usuário')}</strong><small>${e(x.email||'')} ${x.phone?'· '+e(x.phone):''}</small><small class="driver-uid">UID: ${e(x.uid)}</small></div><div class="driver-actions"><span class="status status-pendente">Pendente</span>${btn('driver-access','✓ Aprovar','btn-green btn-sm',`data-uid="${e(x.uid)}" data-enabled="true"`)}</div></div>`).join('');
 const inactive=S.inactiveDrivers.map(x=>`<div class="driver-list-row"><div class="driver-list-person"><strong>${e(x.name||'Motorista')}</strong><small>${e(x.email||'')}${x.phone?' · '+e(x.phone):''}</small></div><div class="driver-actions"><span class="status status-pendente">Desativado</span>${btn('driver-access','Reativar','btn-outline btn-sm',`data-uid="${e(x.uid)}" data-enabled="true"`)}</div></div>`).join('');
 return `<section class="panel"><div class="panel-head driver-header"><div><h2 class="panel-title">Motoristas cadastrados</h2><p class="panel-sub">Cadastre um motorista diretamente neste painel. Ele receberá acesso à área de entregas com login próprio.</p></div>${btn('new-driver','＋ Cadastrar motorista','btn-primary')}</div><div class="driver-stat-strip"><span>🚚 <strong>${S.drivers.length}</strong> ativos</span><span>⏳ <strong>${S.pendingUsers.length}</strong> aguardando</span><span>⏸ <strong>${S.inactiveDrivers.length}</strong> desativados</span></div><div class="driver-cards">${activeCards||'<div class="empty-driver"><strong>Nenhum motorista ativo</strong><p>Comece usando o botão Cadastrar motorista. A conta será criada no Firebase Authentication.</p></div>'}</div></section><section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2 class="panel-title">Aprovação de cadastros</h2><p class="panel-sub">${S.pendingUsers.length} solicitações. Você pode aprovar pelo próprio painel, sem abrir o Console Firebase.</p></div></div>${pending||'<p class="sub">Não há usuários aguardando aprovação.</p>'}</section>${S.inactiveDrivers.length?`<section class="panel" style="margin-top:18px"><div class="panel-head"><h2 class="panel-title">Motoristas desativados</h2></div>${inactive}</section>`:''}<div class="callout" style="margin-top:18px">🔒 Somente administradores ativos podem cadastrar, aprovar ou desativar motoristas. Senhas são gerenciadas no Firebase Authentication e não ficam salvas no Firestore. ${configured?'Cadastros e liberações funcionam sem Cloud Functions, com regras de segurança do Firestore.':'Nesta demonstração os registros são apenas locais.'}</div>`;
}
function driverPanel(){const tasks=S.deliveries.filter(d=>own(d));return `<div class="driver-hero"><div><span style="font-weight:800;color:#54e1b6;font-size:12px">🚚 ÁREA DO MOTORISTA</span><h2>Boas entregas,<br>${e(S.user.name.split(' ')[0])}!</h2><p>Você tem ${tasks.filter(d=>d.status!=='entregue').length} entrega(s) em aberto.</p></div><div class="hero-art">📦</div></div>${tasks.filter(d=>d.status==='em_rota').length?`<div class="callout" style="margin-bottom:16px"><span class="onroute-indicator"></span> Entrega em andamento. Deixe o aplicativo aberto e permita acesso à localização.</div>`:''}<div class="panel-head"><div><h2 class="panel-title">Minha lista de entregas</h2><p class="panel-sub">Confira o pedido antes de iniciar a viagem</p></div></div>${tasks.length?tasks.map(d=>`<div class="delivery-mobile"><div class="dm-head"><div><div class="row-code">${e(d.code)} · ${e(d.orderNumber||'Sem OP')}</div><h3 style="font-size:21px;margin:6px 0">${e(d.customerName)}</h3></div>${badge(d.status)}</div><div class="dm-body"><div style="font-size:13px;color:#5d6f86;margin:5px 0 12px">📍 ${e(d.address)}, ${e(d.city)}</div><div style="font-size:12px;color:#8594a9">${d.notes?e(d.notes):'Sem observações adicionais.'}</div>${d.status==='em_rota'?'<div class="timeline"><div class="complete"></div><div class="complete"></div><div></div></div>':''}</div><div class="dm-foot">${btn('detail','Detalhes','btn-outline btn-sm',`data-id="${e(d.id)}"`)}${d.status==='pendente'?btn('start','▶ Iniciar entrega','btn-green',`data-id="${e(d.id)}"`):''}${d.status==='em_rota'?`${btn('finish-open','✓ Concluir entrega','btn-green',`data-id="${e(d.id)}"`)}${btn('activate-gps','📍 Ativar GPS','btn-outline btn-sm',`data-id="${e(d.id)}"`)}${btn('wa-start','✉ Mensagem pronta','btn-outline btn-sm',`data-id="${e(d.id)}"`)}${!configured?btn('simulate','Simular rota','btn-soft btn-sm',`data-id="${e(d.id)}"`):''}`:''}${d.status==='entregue'?'<span class="sub" style="font-size:12px;align-self:center">✓ Comprovante registrado</span>':''}</div></div>`).join(''):`<div class="empty"><div class="empty-big">🛣️</div><strong>Sem entregas atribuídas</strong><p>O administrativo deve selecionar você como motorista.</p></div>`}`;}
function render(){if(!S.role)return renderLogin();const active=document.activeElement;const focusingSearch=active?.id==='searchDeliveries';const pos=focusingSearch?active.selectionStart:null;app.innerHTML=shellMain();const detailMap=document.getElementById('detail-map');if(detailMap && S.modal?.dataset.deliveryId){const fresh=findDelivery(S.modal.dataset.deliveryId);if(fresh?.status==='em_rota')showMap('detail-map',fresh);}if(focusingSearch){const n=$('#searchDeliveries');n.focus();n.setSelectionRange(pos,pos);}const activeD=S.deliveries.find(d=>d.status==='em_rota'&&d.driverId===S.user?.uid);if(S.role==='driver' && activeD && S.watch===null && !S.gpsPaused){/* GPS starts only after explicit user click/permission, not on page render */}}

function modal(title,content,footer=''){closeModal();const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.id='modalHost';wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${e(title)}"><div class="modal-head"><h2>${e(title)}</h2><button data-action="close-modal" class="close" aria-label="Fechar">×</button></div><div class="modal-content">${content}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div>`;wrap.addEventListener('click',ev=>{if(ev.target===wrap)closeModal();});document.body.append(wrap);S.modal=wrap;}
function closeModal(){clearMap('detail-map');S.modal?.remove();S.modal=null;S.photos=[];S.signed=false;}
function deliveryForm(){if(!S.drivers.length){toast('Cadastre um motorista primeiro.');S.view='drivers';return render();}const content=`<form id="newDeliveryForm"><div class="fields"><div class="field"><label>Nome do cliente *</label><input name="customerName" maxlength="100" required placeholder="Nome ou razão social"></div><div class="field"><label>WhatsApp do cliente *</label><input name="customerPhone" inputmode="tel" required placeholder="(47) 99999-9999"></div><div class="field full"><label>Endereço completo *</label><input name="address" required maxlength="220" placeholder="Rua, número, bairro e complemento"></div><div class="field"><label>Cidade / UF *</label><input name="city" required maxlength="100" placeholder="Jaraguá do Sul / SC"></div><div class="field"><label>Número da ordem de produção *</label><input name="orderNumber" required maxlength="80" placeholder="OP-1234"></div><div class="field"><label>Motorista *</label><select name="driverId" required><option value="">Selecione</option>${S.drivers.map(d=>`<option value="${e(d.uid)}">${e(d.name)}</option>`).join('')}</select></div><div class="field"><label>Referência para entrega</label><input name="reference" maxlength="100" placeholder="Portaria, galpão..."></div><div class="field full"><label>Orientações ao motorista</label><textarea name="notes" maxlength="1000" placeholder="Cuidados com os produtos, horário de recebimento..."></textarea></div><div class="field full"><label>Ordem de produção (PDF ou imagem)</label><div class="drop-zone">📄 &nbsp; <input name="orderFile" type="file" accept="application/pdf,image/*"><div class="field-note" style="margin-top:9px">Até 5 MB. O arquivo será salvo no Google Drive privado da empresa e poderá ser aberto pelo motorista.</div></div><div class="field full"><label style="display:flex;gap:9px;align-items:flex-start"><input type="checkbox" name="whatsappOptIn" style="width:18px;height:18px;flex-shrink:0;margin-top:2px"> O cliente concorda em receber contato manual pelo WhatsApp para acompanhamento da entrega e avaliação.</label><div class="field-note">Este aplicativo apenas prepara a mensagem, sem disparos automáticos. O operador decide se e quando enviá-la.</div></div></div><button type="submit" class="hidden" id="submitDelivery"></button></form>`;modal('Cadastrar nova entrega',content,btn('close-modal','Cancelar')+`<button type="submit" form="newDeliveryForm" class="btn btn-green">✓ Cadastrar entrega</button>`);}
function newDriverForm(){
 if(S.role!=='admin')throw Error('Somente o administrador pode cadastrar motoristas.');
 const content=`<form id="newDriverForm"><div class="fields"><div class="field full"><label>Nome completo do motorista *</label><input name="name" required minlength="3" maxlength="100" autocomplete="off" placeholder="Ex.: João da Silva"></div><div class="field"><label>E-mail de acesso *</label><input type="email" name="email" required autocomplete="off" placeholder="motorista@empresa.com"></div><div class="field"><label>Telefone com DDD (opcional)</label><input name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="(47) 99999-9999"></div>${configured?`<div class="field"><label>Senha inicial *</label><input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="Mínimo de 12 caracteres"></div><div class="field"><label>Confirmar senha *</label><input type="password" name="confirmPassword" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="Repita a senha inicial"></div>`:''}<div class="field full"><label class="driver-check"><input type="checkbox" name="activateNow" checked><span><strong>Liberar acesso imediatamente</strong><small>O motorista já poderá entrar com o e-mail e a senha. Se desmarcar, ficará pendente até você aprovar.</small></span></label></div><div class="field full"><div class="callout">A conta será criada no <b>Firebase Authentication</b> e o perfil <code>driver</code> no Firestore. O motorista verá apenas as entregas atribuídas a ele. A senha não será armazenada nem enviada pelo WhatsApp automaticamente.</div></div></div></form>`;
 modal('Cadastrar motorista',content,btn('close-modal','Cancelar')+`<button form="newDriverForm" type="submit" class="btn btn-green">✓ Criar motorista</button>`);
}
function detail(d){if(!d)return;const proof=d.proof||{},photoFiles=proof.photos||[],driver=S.role==='driver';let photoText='Nenhuma foto anexada';if(photoFiles.length)photoText=`<div class="photo-grid">${photoFiles.map((p,i)=>p.dataUrl?`<img loading="lazy" src="${p.dataUrl}" alt="Foto ${i+1}">`:`<button type="button" class="btn btn-soft btn-sm" data-action="file-open" data-drive-id="${e(p.driveFileId||'')}">📷 Foto ${i+1}</button>`).join('')}</div>`;const p=`<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:18px"><div><div class="row-code">${e(d.code)} · ${e(d.orderNumber||'Sem OP')}</div><h3 style="font-size:21px;margin:4px 0">${e(d.customerName)}</h3></div>${badge(d.status)}</div><div class="detail-grid"><div class="detail-cell"><small>Endereço</small><strong>${e(d.address)}, ${e(d.city)}</strong></div><div class="detail-cell"><small>Motorista</small><strong>${e(d.driverName)}</strong></div><div class="detail-cell"><small>Telefone</small><strong>${e(d.customerPhone)}</strong></div><div class="detail-cell"><small>Ordem de produção</small><strong>${e(d.orderNumber||'—')}</strong></div><div class="detail-cell"><small>Início da entrega</small><strong>${formatDate(d.startedAt)}</strong></div><div class="detail-cell"><small>Finalização</small><strong>${formatDate(d.deliveredAt)}</strong></div></div>${d.reference||d.notes?`<div class="callout warn" style="margin-top:13px">${d.reference?`<strong>Referência:</strong> ${e(d.reference)}<br>`:''}${d.notes?`<strong>Observações:</strong> ${e(d.notes)}`:''}</div>`:''}<div class="mini-actions">${d.orderFile?btn('file-open','📄 Abrir ordem de produção','btn-outline btn-sm',`data-drive-id="${e(d.orderFile.driveFileId||'')}" data-url="${e(d.orderFile.dataUrl||'')}"`):'<span class="sub" style="font-size:12px">Nenhum arquivo OP anexado</span>'}${btn('navigate','🧭 Abrir no Maps','btn-outline btn-sm',`data-id="${e(d.id)}"`)}${d.status!=='pendente'?btn('copy-track','🔗 Copiar rastreamento','btn-outline btn-sm',`data-id="${e(d.id)}"`):''}</div>${d.status==='em_rota'?`<h3 style="margin:22px 0 3px">📍 Rota ao vivo</h3><div class="map-box" id="detail-map"></div><div class="field-note" style="margin-top:9px">Posição atualizada enquanto o app do motorista permanece aberto com GPS permitido.</div>`:''}${d.status==='entregue'?`<h3 style="margin:23px 0 11px">Comprovante de entrega</h3><div class="detail-grid"><div class="detail-cell"><small>Recebido por</small><strong>${e(proof.recipientName||'—')}</strong></div><div class="detail-cell"><small>CPF do recebedor</small><strong>${maskCPF(proof.cpf)}</strong></div></div><div style="margin-top:13px"><strong style="font-size:12px">Fotos da entrega</strong>${photoText}</div>${proof.signatureDataUrl?`<h4 style="margin:20px 0 7px">Assinatura</h4><img class="sign-photo" src="${proof.signatureDataUrl}" alt="Assinatura">`:proof.signatureDriveId?`<div class="mini-actions">${btn('file-open','✍ Visualizar assinatura','btn-outline btn-sm',`data-drive-id="${e(proof.signatureDriveId)}"`)}</div>`:''}<div class="info-box" style="margin-top:16px">${d.nps?.score!==undefined?`⭐ <strong>Nota do cliente: ${d.nps.score}/10</strong><p>${e(d.nps.comment||'Sem comentário')}</p>`:`⭐ <strong>Avaliação ainda não recebida</strong><p>Envie a pesquisa NPS pelo painel.</p>`}</div>`:''}`;
let actions=btn('close-modal','Fechar');if(driver&&d.status==='pendente')actions+=btn('start','▶ Iniciar entrega','btn-green',`data-id="${e(d.id)}"`);if(driver&&d.status==='em_rota')actions+=btn('finish-open','✓ Registrar entrega','btn-green',`data-id="${e(d.id)}"`);if(S.role==='admin'&&d.status==='entregue'){actions+=btn('nps-send','⭐ Preparar mensagem NPS','btn-green',`data-id="${e(d.id)}"`);}if(d.status==='em_rota'&&S.role==='admin')actions+=btn('wa-start','✉ Preparar aviso','btn-outline',`data-id="${e(d.id)}"`);
modal('Detalhes da entrega',p,actions);S.modal.dataset.deliveryId=d.id;if(d.status==='em_rota')setTimeout(()=>showMap('detail-map',d),50);}
function openFinish(d){if(d.status!=='em_rota')return toast('Esta entrega não está em rota.');S.photos=[];S.signed=false;modal('Comprovante de entrega',`<div class="callout" style="margin-bottom:18px">📋 ${e(d.code)} · ${e(d.customerName)}<br>Registre o recebimento antes de finalizar a entrega.</div><form id="finishForm" data-id="${e(d.id)}"><div class="fields"><div class="field"><label>Nome de quem recebeu *</label><input name="recipientName" required maxlength="100" placeholder="Nome completo"></div><div class="field"><label>CPF de quem recebeu *</label><input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div><div class="field full"><label>Fotos da entrega (1 a 4) *</label><input id="proofFiles" type="file" accept="image/*" capture="environment" multiple><div class="field-note">Faça fotos dos produtos entregues. Máximo de 4 fotos.</div><div id="photoPreview" class="photo-grid"></div></div><div class="field full"><label>Assinatura digital do recebedor *</label><div class="sign-box"><canvas id="signatureCanvas" aria-label="Área para assinar com o dedo"></canvas></div><div class="mini-actions">${btn('clear-signature','↺ Limpar assinatura','btn-outline btn-sm')}</div></div><div class="field full"><label style="display:flex;gap:9px;align-items:flex-start"><input type="checkbox" name="consent" required style="width:18px;height:18px;flex-shrink:0;margin:2px 0"> Confirmo que o recebedor foi informado sobre a coleta de CPF, assinatura e fotos exclusivamente para comprovação da entrega.</label></div></div></form>`,btn('close-modal','Cancelar')+`<button form="finishForm" type="submit" class="btn btn-green">✓ Finalizar entrega</button>`);initSignature();}
function initSignature(){const canvas=$('#signatureCanvas');if(!canvas)return;canvas.width=900;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#14223d';ctx.lineWidth=3.7;ctx.lineJoin='round';ctx.lineCap='round';let isDown=false;const coords=ev=>{const r=canvas.getBoundingClientRect();return {x:(ev.clientX-r.left)*canvas.width/r.width,y:(ev.clientY-r.top)*canvas.height/r.height};};canvas.onpointerdown=ev=>{isDown=true;canvas.setPointerCapture(ev.pointerId);const p=coords(ev);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.05,p.y+.05);ctx.stroke();S.signed=true;};canvas.onpointermove=ev=>{if(!isDown)return;const p=coords(ev);ctx.lineTo(p.x,p.y);ctx.stroke();};canvas.onpointerup=canvas.onpointercancel=()=>isDown=false;}
async function imageData(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const max=1000,ratio=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*ratio);c.height=Math.round(img.height*ratio);c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.66);URL.revokeObjectURL(url);resolve(data);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível ler a foto.'));};img.src=url;});}
function setupPhotoPreview(files){if(files.length>4)return toast('Selecione até 4 fotos.');Promise.all(files.map(imageData)).then(arr=>{S.photos=arr;const root=$('#photoPreview');if(root)root.innerHTML=arr.map(x=>`<img alt="Foto selecionada" src="${x}">`).join('');}).catch(problem);}

async function createDelivery(form){const data=new FormData(form),customerPhone=String(data.get('customerPhone')||'').trim();if(!validPhone(customerPhone))throw Error('Informe um número de WhatsApp válido com DDD.');const driver=S.drivers.find(x=>x.uid===data.get('driverId'));if(!driver)throw Error('Selecione um motorista cadastrado.');const file=data.get('orderFile');if(file?.size>5*1024*1024)throw Error('A ordem de produção deve ter até 5 MB para envio ao Drive.');if(file?.size&&!['application/pdf'].includes(file.type)&&!file.type.startsWith('image/'))throw Error('Envie um PDF ou imagem da ordem de produção.');
 const record={id:id(),code:`ENT-${Date.now().toString().slice(-7)}`,customerName:String(data.get('customerName')).trim(),customerPhone,address:String(data.get('address')).trim(),city:String(data.get('city')).trim(),orderNumber:String(data.get('orderNumber')).trim(),driverId:driver.uid,driverName:driver.name,reference:String(data.get('reference')).trim(),notes:String(data.get('notes')).trim(),createdAt:stamp(),status:'pendente',whatsappOptIn:data.get('whatsappOptIn')==='on',trackingToken:token(),npsToken:token(),routePoints:[],orderFile:null};
 if(configured){if(file?.size){const uploaded=await uploadDrive(record.id,'order',file.name,file.type||'application/pdf',await fileAsDataUrl(file));record.orderFile={driveFileId:uploaded.fileId,name:uploaded.name};}const batch=F.writeBatch(db);batch.set(F.doc(db,'deliveries',record.id),Object.fromEntries(Object.entries(record).filter(([k])=>k!=='id')));batch.set(F.doc(db,'tracking',record.trackingToken),{deliveryId:record.id,code:record.code,status:'pendente',routePoints:[],createdAt:record.createdAt});await batch.commit();}
 else{if(file?.size){record.orderFile={name:file.name};if(file.size<=600*1024)record.orderFile.dataUrl=await fileAsDataUrl(file);}S.deliveries.unshift(record);writeDemo();}closeModal();render();toast('Entrega cadastrada e atribuída ao motorista.');}
function fileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
// Cadastro pelo painel sem Cloud Functions. Um Auth secundário em memória
// cria o motorista sem substituir a sessão de quem está administrando.
async function createDriver(form){
 if(S.role!=='admin' || !auth?.currentUser)throw Error('Somente o administrador autenticado pode cadastrar motoristas.');
 const v=Object.fromEntries(new FormData(form));
 const name=String(v.name||'').trim(),email=String(v.email||'').trim().toLowerCase(),phone=String(v.phone||'').replace(/\D/g,''),password=String(v.password||'');
 const active=new FormData(form).has('activateNow');
 if(name.length<3||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Informe nome e e-mail válidos.');
 if(phone && (phone.length<10||phone.length>15))throw Error('Informe o telefone com DDD, ou deixe em branco.');
 if(configured){
   if(password.length<12||password.length>128)throw Error('A senha deve ter entre 12 e 128 caracteres.');
   if(password!==String(v.confirmPassword||''))throw Error('As senhas não coincidem.');
   const adminUid=auth.currentUser.uid;
   const adminProfile=await F.getDoc(F.doc(db,'users',adminUid));
   if(adminProfile.data()?.role!=='admin'||adminProfile.data()?.active!==true)throw Error('Seu perfil não possui permissão de administrador ativo.');
   const secondApp=F.getApps().find(a=>a.name==='rotacerta-provisioning')||F.initializeApp(firebaseConfig,'rotacerta-provisioning');
   const secondAuth=F.getAuth(secondApp);
   await F.setPersistence(secondAuth,F.inMemoryPersistence);
   if(secondAuth.currentUser)await F.signOut(secondAuth);
   let user=null;
   try{
     const credentials=await F.createUserWithEmailAndPassword(secondAuth,email,password);
     user=credentials.user;
     await F.updateProfile(user,{displayName:name});
     const created={name,email,phone,role:'driver',active,createdAt:F.serverTimestamp(),createdBy:adminUid};
     if(active){created.approvedBy=adminUid;created.approvedAt=F.serverTimestamp();}
     await F.setDoc(F.doc(db,'users',user.uid),created);
   }catch(err){
     if(user){
       try{await F.deleteUser(user);}catch(rollback){
         console.error('Motorista criado no Authentication, mas o cadastro no Firestore falhou e não foi possível desfazer:',user.uid,rollback);
         throw Error(`A conta ${email} foi criada no Authentication (UID: ${user.uid}), mas não foi possível salvar o perfil no Firestore. Confira as regras e corrija o cadastro no Console.`);
       }
     }
     if(err?.code==='auth/email-already-in-use')throw Error('Este e-mail já existe no Firebase Authentication. Verifique se já há cadastro pendente.');
     if(err?.code==='permission-denied')throw Error('Permissão negada no Firestore. Publique as regras do pacote e confirme role = admin e active = true.');
     if(err?.code==='auth/operation-not-allowed')throw Error('Ative E-mail/Senha em Authentication → Método de login no Firebase.');
     if(err?.code==='auth/unauthorized-domain')throw Error('Inclua o domínio do seu site nos domínios autorizados do Firebase Authentication.');
     throw err;
   }finally{
     if(secondAuth.currentUser){try{await F.signOut(secondAuth);}catch(err){console.warn('Não foi possível encerrar a sessão temporária:',err);}}
   }
   if(auth.currentUser?.uid!==adminUid)throw Error('A sessão do administrador mudou durante o cadastro. Entre novamente.');
   toast(active?'Motorista cadastrado e liberado para entrar.':'Motorista cadastrado e aguardando aprovação.');
 }else{
   if(S.drivers.some(d=>d.email===email)||S.pendingUsers.some(d=>d.email===email))throw Error('Já existe motorista com este e-mail.');
   const record={uid:'demo-'+token().slice(0,9),name,email,phone,role:'driver',active};
   if(active)S.drivers.push(record);else S.pendingUsers.push(record);
   writeDemo();toast('Motorista de demonstração cadastrado.');
 }
 closeModal();S.view='drivers';render();
}
async function setDriverAccess(uid,active){
 if(S.role!=='admin'||(configured&&!auth?.currentUser))throw Error('Somente o administrador pode liberar acessos.');
 if(!uid||uid===S.user?.uid)throw Error('Não é permitido modificar seu próprio perfil.');
 const driver=[...S.drivers,...S.pendingUsers,...S.inactiveDrivers].find(u=>u.uid===uid);
 if(!driver)throw Error('Motorista não encontrado. Atualize a lista.');
 if(!active && S.deliveries.some(d=>d.driverId===uid&&d.status==='em_rota'))throw Error('Este motorista possui uma entrega em rota. Finalize a viagem antes de desativar.');
 if(!confirm(`${active?'Liberar':'Desativar'} acesso de ${driver.name||driver.email}?`))return;
 if(configured){
   const updated={active,accessUpdatedBy:auth.currentUser.uid,accessUpdatedAt:F.serverTimestamp()};
   if(active){updated.approvedBy=auth.currentUser.uid;updated.approvedAt=F.serverTimestamp();}
   try{await F.updateDoc(F.doc(db,'users',uid),updated);}
   catch(err){if(err?.code==='permission-denied')throw Error('Permissão negada. Publique as regras atualizadas do Firestore para liberar aprovação pelo painel.');throw err;}
 }else{
   for(const arr of [S.drivers,S.pendingUsers,S.inactiveDrivers]){const pos=arr.findIndex(x=>x.uid===uid);if(pos!==-1)arr.splice(pos,1);}
   driver.active=active;driver.approvedAt=stamp();
   if(active)S.drivers.push(driver);else S.inactiveDrivers.push(driver);
   writeDemo();
 }
 toast(active?'Acesso do motorista liberado.':'Acesso do motorista desativado.');render();
}
async function updateDelivery(d,patch,trackingPatch=null,npsCreate=null){if(configured){const batch=F.writeBatch(db);batch.update(F.doc(db,'deliveries',d.id),patch);if(trackingPatch)batch.set(F.doc(db,'tracking',d.trackingToken),trackingPatch,{merge:true});if(npsCreate)batch.set(F.doc(db,'nps',d.npsToken),npsCreate);await batch.commit();}else{Object.assign(d,patch);writeDemo();} }
async function start(d){if(S.role!=='driver')throw Error('Somente o motorista responsável pode iniciar a entrega.');if(!own(d))throw Error('Entrega não atribuída a este usuário.');if(d.status!=='pendente')throw Error('A entrega já foi iniciada.');const now=stamp();await updateDelivery(d,{status:'em_rota',startedAt:now},{status:'em_rota',startedAt:now});closeModal();render();if(S.role==='driver')startGps(d.id);messageModal(d,'start');}
function distanceMeters(a,b){const rad=Math.PI/180,lat=(b.lat-a.lat)*rad,lon=(b.lng-a.lng)*rad,x=Math.sin(lat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(lon/2)**2;return 2*6371000*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function stopGps(){if(S.watch!==null){navigator.geolocation.clearWatch(S.watch);S.watch=null;}}
function startGps(deliveryId){if(!navigator.geolocation){toast('GPS não disponível neste aparelho.');return;}stopGps();S.gpsLast=0;S.gpsPoint=null;S.gpsPaused=false;S.watch=navigator.geolocation.watchPosition(p=>{const point={lat:+p.coords.latitude.toFixed(6),lng:+p.coords.longitude.toFixed(6),ts:Date.now(),accuracy:Math.round(p.coords.accuracy)};if(point.accuracy>250){return;}if(Date.now()-S.gpsLast<9000)return;if(S.gpsPoint && distanceMeters(point,S.gpsPoint)<15 && Date.now()-S.gpsLast<45000)return;void recordGps(deliveryId,point);},err=>toast('GPS: '+(err.code===1?'Permissão negada':err.message)),{enableHighAccuracy:true,maximumAge:3000,timeout:20000});toast('Localização ativa. Mantenha o app aberto durante a viagem.');}
async function recordGps(deliveryId,point){if(S.gpsBusy)return;const d=findDelivery(deliveryId);if(!d||d.status!=='em_rota'){stopGps();return;}S.gpsBusy=true;try{const route=[...(d.routePoints||[]),{lat:point.lat,lng:point.lng,ts:point.ts}].slice(-250),lastLocation={lat:point.lat,lng:point.lng,accuracy:point.accuracy,ts:point.ts};await updateDelivery(d,{lastLocation,routePoints:route},{lastLocation,routePoints:route,status:'em_rota'});S.gpsLast=Date.now();S.gpsPoint=point;}catch(err){console.error('GPS',err);}finally{S.gpsBusy=false;}}
async function finishDelivery(form){const d=findDelivery(form.dataset.id);if(!d||!own(d)||d.status!=='em_rota')throw Error('A entrega não está disponível para finalização.');const fd=new FormData(form),name=String(fd.get('recipientName')||'').trim(),cpf=String(fd.get('cpf')||'').replace(/\D/g,'');if(name.length<3)throw Error('Informe o nome completo do recebedor.');if(!cpfValid(cpf))throw Error('CPF inválido. Confira os números digitados.');if(!S.photos.length)throw Error('Adicione ao menos uma foto da entrega.');if(!S.signed)throw Error('Colete a assinatura do recebedor.');if(!fd.get('consent'))throw Error('Confirme a ciência do recebedor sobre a coleta dos dados.');const signature=$('#signatureCanvas').toDataURL('image/png');const photos=[],proof={recipientName:name,cpf,photos,completedAt:stamp()};
 if(configured){for(let i=0;i<S.photos.length;i++){const uploaded=await uploadDrive(d.id,'photo',`foto-entrega-${i+1}.jpg`,'image/jpeg',S.photos[i]);photos.push({driveFileId:uploaded.fileId,name:uploaded.name});}const uploaded=await uploadDrive(d.id,'signature','assinatura.png','image/png',signature);proof.signatureDriveId=uploaded.fileId;}else{S.photos.forEach((url,i)=>photos.push({dataUrl:url,name:`Foto ${i+1}`}));proof.signatureDataUrl=signature;}
 const closed=stamp();await updateDelivery(d,{status:'entregue',deliveredAt:closed,proof},{status:'entregue',deliveredAt:closed,lastLocation:F?.deleteField?F.deleteField():null,routePoints:[]},{deliveryId:d.id,code:d.code,createdAt:closed});stopGps();closeModal();render();toast('Entrega finalizada e comprovante salvo. O administrativo poderá enviar o NPS.');}
function openWhatsapp(d,kind){messageModal(d,kind);}
async function uploadDrive(deliveryId,kind,name,mimeType,dataUrl){
 if(!configured)throw Error('A conexão com o Drive exige Firebase.');
 const base64=String(dataUrl).split(',')[1];
 if(!base64)throw Error('Não foi possível preparar o arquivo.');
 const call=F.httpsCallable(functions,'driveUpload',{timeout:120000});
 const res=await call({deliveryId,kind,name,mimeType,base64});
 if(!res.data?.fileId)throw Error('O Google Drive não confirmou o arquivo.');
 return res.data;
}
async function openFile(el){
 const url=el.dataset.url,driveId=el.dataset.driveId;
 if(url){window.open(url,'_blank','noopener');return;}
 if(!configured){toast('Arquivo não disponível no modo demonstração.');return;}
 if(!driveId){toast('Arquivo antigo sem referência ao Drive.');return;}
 const deliveryId=S.modal?.dataset.deliveryId;
 if(!deliveryId)throw Error('Abra os detalhes da entrega para visualizar o arquivo.');
 const tab=window.open('about:blank','_blank');
 try{
  const fn=F.httpsCallable(functions,'driveRead',{timeout:120000});
  const res=await fn({deliveryId,fileId:driveId});
  const raw=atob(res.data.base64),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const blob=new Blob([bytes],{type:res.data.mimeType||'application/octet-stream'});
  const objectUrl=URL.createObjectURL(blob);
  if(tab){tab.location.href=objectUrl;setTimeout(()=>URL.revokeObjectURL(objectUrl),120000);}
  else{const link=document.createElement('a');link.href=objectUrl;link.download=res.data.name||'arquivo';link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),120000);}
 }catch(err){tab?.close();throw err;}
}
function navigate(d){const q=[d.address,d.city].filter(Boolean).join(', ');window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(q),'_blank','noopener');}
async function copy(value,label='Link copiado.'){try{await navigator.clipboard.writeText(value);toast(label);}catch{prompt('Copie o texto abaixo:',value);}}
function publicBase(title){return `<div class="public-shell"><header class="public-top"><div class="logo" style="margin:0;max-width:800px;margin-inline:auto"><span class="brand-mark">↗</span><span>RotaCerta<small>${title}</small></span></div></header><main class="public-content" id="publicMain"></main></div>`;}
function publicError(text){app.innerHTML=publicBase('ACOMPANHAMENTO');$('#publicMain').innerHTML=`<div class="public-card error-page"><div style="font-size:50px">📦</div><h2>Não foi possível carregar</h2><p>${e(text)}</p></div>`;}
function renderTracking(doc){S.currentTracking=doc;app.innerHTML=publicBase('RASTREAMENTO');const status=doc.status||'pendente';$('#publicMain').innerHTML=`<div class="public-card"><span class="eyebrow">ACOMPANHAMENTO DE ENTREGA</span><h1>Seu pedido está ${status==='em_rota'?'a caminho!':status==='entregue'?'entregue!':'sendo preparado.'}</h1><p class="sub" style="margin-bottom:16px">Pedido <strong>${e(doc.code||'—')}</strong> · Acompanhe o andamento abaixo.</p><div class="timeline"><div class="complete"></div><div class="${status!=='pendente'?'complete':''}"></div><div class="${status==='entregue'?'complete':''}"></div></div><div class="detail-grid"><div class="detail-cell"><small>Status atual</small><strong>${statusLabel(status)}</strong></div><div class="detail-cell"><small>Início da viagem</small><strong>${formatDate(doc.startedAt)}</strong></div></div>${status==='em_rota'?`<h3 style="margin:23px 0 12px">📍 Localização do motorista</h3><div id="public-map" class="map-box" style="height:350px"></div><p class="field-note">Localização atualizada quando o motorista estiver com o aplicativo aberto e o GPS disponível. A linha mostra o percurso registrado, não uma previsão de rota.</p>`:status==='entregue'?'<div class="callout" style="margin-top:19px">✓ Entrega concluída. A localização deixou de ser compartilhada.</div>':'<div class="callout warn" style="margin-top:19px">O rastreamento ficará disponível após o início da entrega.</div>'}</div><p class="sub" style="text-align:center;font-size:11px">Apenas a posição do motorista e o status do pedido são exibidos neste link.</p>`;if(status==='em_rota')setTimeout(()=>showMap('public-map',doc),50);}
function renderTrackingDemo(){const key=new URLSearchParams(location.search).get('track'),d=S.deliveries.find(x=>x.trackingToken===key);if(!d)return publicError('Link de rastreamento não encontrado. No modo demo, ele só funciona neste navegador.');renderTracking({code:d.code,status:d.status,startedAt:d.startedAt,deliveredAt:d.deliveredAt,lastLocation:d.status==='entregue'?null:d.lastLocation,routePoints:d.status==='entregue'?[]:d.routePoints});}
function cloudTracking(key){app.innerHTML=publicBase('RASTREAMENTO');$('#publicMain').innerHTML='<div class="public-card">Carregando rastreamento...</div>';setUnsub(F.onSnapshot(F.doc(db,'tracking',key),snap=>{if(!snap.exists())return publicError('Link de rastreamento não encontrado.');renderTracking(snap.data());},problem));}
function renderNps(npsDoc,delivery){app.innerHTML=publicBase('AVALIAÇÃO DA ENTREGA');let target=$('#publicMain');if(npsDoc.submittedAt||delivery?.nps?.score!==undefined){target.innerHTML=`<div class="public-card" style="text-align:center;padding:50px 23px"><div style="font-size:60px">💚</div><h1>Obrigado pela avaliação!</h1><p class="sub">Sua opinião nos ajuda a melhorar cada entrega.</p></div>`;return;}target.innerHTML=`<div class="public-card"><span class="eyebrow">PESQUISA DE SATISFAÇÃO</span><h1>Como foi sua entrega?</h1><p class="sub">Seu pedido <strong>${e(npsDoc.code||delivery?.code||'')}</strong> já foi entregue. Queremos saber como foi a experiência de recebimento.</p><form id="npsForm"><div style="font-weight:800;font-size:14px;margin-top:28px">De 0 a 10, qual nota você daria para a entrega?</div><div class="score-grid">${Array.from({length:11},(_,i)=>`<button type="button" class="score-btn" data-action="score" data-score="${i}">${i}</button>`).join('')}</div><div class="nps-scale"><span>😕 Muito ruim</span><span>😍 Excelente</span></div><div class="field"><label>Deixe um comentário (opcional)</label><textarea name="comment" maxlength="500" placeholder="O que podemos melhorar?"></textarea></div><button class="btn btn-green btn-block" style="margin-top:23px" type="submit">Enviar minha avaliação →</button></form></div><p class="sub" style="text-align:center;font-size:12px">Pesquisa referente exclusivamente à experiência de entrega.</p>`;S.rating=null;}
function renderNpsDemo(){const key=new URLSearchParams(location.search).get('nps'),d=S.deliveries.find(x=>x.npsToken===key);if(!d||d.status!=='entregue')return publicError('A pesquisa de satisfação ainda não está disponível nesta demonstração.');renderNps({code:d.code,submittedAt:d.nps?.submittedAt},d);}
async function cloudNps(key){app.innerHTML=publicBase('AVALIAÇÃO DA ENTREGA');$('#publicMain').innerHTML='<div class="public-card">Carregando pesquisa...</div>';setUnsub(F.onSnapshot(F.doc(db,'nps',key),snap=>{if(!snap.exists())return publicError('A pesquisa ainda não está disponível.');renderNps(snap.data());},problem));}
async function submitNps(form){const score=S.rating;if(!Number.isInteger(score)||score<0||score>10)throw Error('Selecione uma nota de 0 a 10.');const comment=String(new FormData(form).get('comment')||'').trim().slice(0,500),key=new URLSearchParams(location.search).get('nps');if(configured){await F.updateDoc(F.doc(db,'nps',key),{score,comment,submittedAt:F.serverTimestamp()});}else{const d=S.deliveries.find(x=>x.npsToken===key);if(!d||d.nps)throw Error('A avaliação já foi enviada.');d.nps={score,comment,submittedAt:stamp()};writeDemo();renderNpsDemo();}}
async function simulateStep(d){if(configured)return;const base=d.lastLocation||{lat:-26.4868,lng:-49.0655};const p={lat:+(base.lat-.0015).toFixed(6),lng:+(base.lng+.0017).toFixed(6),accuracy:15,ts:Date.now()};await recordGps(d.id,p);toast('Ponto de demonstração adicionado à rota.');}

// Delegação de eventos mantém as ações disponíveis após atualização em tempo real.
document.addEventListener('click',async ev=>{
 const el=ev.target.closest('[data-action]');if(!el)return;const action=el.dataset.action,d=findDelivery(el.dataset.id);try{
 switch(action){
 case 'login-admin':enterDemo('admin');break;
  case 'signup':if(configured)renderSignup();break;
  case 'signup-back':if(auth?.currentUser&&!S.role)await F.signOut(auth);else renderLogin();break;
  case 'copy-own-uid':await copy(S.user?.uid||'','UID copiado.');break;
  case 'copy-pending-uid':await copy(el.dataset.uid||'','UID copiado.');break;


 case 'login-driver':enterDemo('driver');break;
 case 'view':S.view=el.dataset.view;render();break;
 case 'logout':stopGps();clearUnsubs();closeModal();if(configured)await F.signOut(auth);else{S.user=null;S.role=null;renderLogin();}break;
 case 'new-delivery':deliveryForm();break;
 case 'new-driver':newDriverForm();break;
 case 'driver-access':await setDriverAccess(el.dataset.uid,el.dataset.enabled==='true');break;
 case 'close-modal':closeModal();break;
 case 'detail':detail(d);break;
 case 'finish-open':openFinish(d);break;
 case 'clear-signature':initSignature();S.signed=false;break;
 case 'start':await start(d);break;
 case 'wa-start':openWhatsapp(d,'start');break;
 case 'wa-nps':openWhatsapp(d,'nps');break;
 case 'nps-send':messageModal(d,'nps');break;
 case 'copy-message':await copy($('#readyMessage')?.value||'','Mensagem copiada.');break;
 case 'copy-message-link':await copy($('#messageLink')?.value||'');break;
 case 'share-whatsapp':openPreparedWhatsapp();break;
 case 'file-open':await openFile(el);break;
 case 'navigate':navigate(d);break;
 case 'copy-track':await copy(trackLink(d));break;
 case 'score':S.rating=Number(el.dataset.score);document.querySelectorAll('.score-btn').forEach(b=>b.classList.toggle('selected',Number(b.dataset.score)===S.rating));break;
 case 'simulate':await simulateStep(d);break;
 case 'activate-gps':startGps(d.id);break;
 }
 }catch(err){problem(err);}
});
document.addEventListener('submit',async ev=>{
 const form=ev.target;if(!['loginForm','signupForm','requestAccessForm','newDeliveryForm','newDriverForm','finishForm','npsForm'].includes(form.id))return;ev.preventDefault();const submit=form.querySelector('[type="submit"]')||document.querySelector(`[form="${form.id}"][type="submit"]`);if(submit)submit.disabled=true;try{
 if(form.id==='loginForm'){const fd=new FormData(form);await F.signInWithEmailAndPassword(auth,fd.get('email'),fd.get('password'));}
  if(form.id==='signupForm')await registerAccount(form);
  if(form.id==='requestAccessForm')await requestAccess(form);

 if(form.id==='newDeliveryForm')await createDelivery(form);
 if(form.id==='newDriverForm')await createDriver(form);
 if(form.id==='finishForm')await finishDelivery(form);
 if(form.id==='npsForm')await submitNps(form);
 }catch(err){problem(err);}finally{if(submit?.isConnected)submit.disabled=false;}
});
document.addEventListener('change',ev=>{if(ev.target.id==='filterStatus'){S.filter=ev.target.value;$('#deliveryResults').innerHTML=rows(filtered());}if(ev.target.id==='proofFiles')setupPhotoPreview(Array.from(ev.target.files||[]));});
document.addEventListener('input',ev=>{if(ev.target.id==='searchDeliveries'){S.term=ev.target.value;$('#deliveryResults').innerHTML=rows(filtered());}if(ev.target.name==='cpf'){const x=ev.target.value.replace(/\D/g,'').slice(0,11);ev.target.value=x.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{2})$/,'$1-$2');}});
boot();
