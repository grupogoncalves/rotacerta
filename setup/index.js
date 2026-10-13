'use strict';
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const {timingSafeEqual} = require('node:crypto');
const {defineSecret} = require('firebase-functions/params');
initializeApp();
const db = getFirestore();
const REGION='southamerica-east1';
const ADMIN_SETUP_KEY = defineSecret('ADMIN_SETUP_KEY');
async function identity(request){
  if(!request.auth?.uid)throw new HttpsError('unauthenticated','Faça login para continuar.');
  const userDoc=await db.collection('users').doc(request.auth.uid).get();
  const profile=userDoc.data();
  if(!profile?.active)throw new HttpsError('permission-denied','Usuário inativo.');
  return {uid:request.auth.uid,role:profile.role};
}
// Primeira ativação exige uma chave criada pelo proprietário do Firebase (Secret Manager).
// Uma trava transacional impede que duas contas sejam promovidas simultaneamente.
exports.setupFirstAdmin = onCall({region:REGION,secrets:[ADMIN_SETUP_KEY],maxInstances:3},async request=>{
  if(!request.auth?.uid)throw new HttpsError('unauthenticated','Entre com a conta do administrador para ativá-la.');
  const name=String(request.data?.name||'').trim(),supplied=String(request.data?.setupKey||'');
  if(name.length<3||name.length>100)throw new HttpsError('invalid-argument','Informe o nome completo (3 a 100 caracteres).');
  const serverKey=ADMIN_SETUP_KEY.value()||'';
  if(Buffer.byteLength(serverKey,'utf8')<24)throw new HttpsError('failed-precondition','ADMIN_SETUP_KEY não foi definida no servidor com uma chave forte.');
  const expected=Buffer.from(serverKey,'utf8'),provided=Buffer.from(supplied,'utf8');
  if(expected.length!==provided.length||!timingSafeEqual(expected,provided))throw new HttpsError('permission-denied','Chave de ativação inválida.');
  const user=await getAuth().getUser(request.auth.uid);
  if(!user.email || user.disabled)throw new HttpsError('failed-precondition','Usuário do Authentication indisponível ou sem e-mail.');
  const admins=await db.collection('users').where('role','==','admin').limit(1).get();
  if(!admins.empty)throw new HttpsError('already-exists','Já existe um administrador. Use o login ou solicite acesso ao administrador atual.');
  const setupRef=db.collection('system').doc('firstAdminActivated');
  const userRef=db.collection('users').doc(user.uid);
  await db.runTransaction(async tx=>{
    const [lock,existing]=await Promise.all([tx.get(setupRef),tx.get(userRef)]);
    if(lock.exists)throw new HttpsError('already-exists','O primeiro administrador já foi ativado.');
    if(existing.exists && (existing.data().role!=='driver' || existing.data().active!==false || existing.data().email!==user.email.toLowerCase()))throw new HttpsError('failed-precondition','Perfil já existente não está pendente de aprovação.');
    tx.create(setupRef,{adminUid:user.uid,createdAt:FieldValue.serverTimestamp()});
    const adminData={name,email:user.email.toLowerCase(),role:'admin',active:true,approvedAt:FieldValue.serverTimestamp()};
    if(existing.exists)tx.update(userRef,adminData);
    else tx.create(userRef,{...adminData,createdAt:FieldValue.serverTimestamp()});
  });
  try{await getAuth().updateUser(user.uid,{displayName:name});}catch(err){console.warn('Não foi possível atualizar o nome do Authentication:',err.message);}
  return {ok:true};
});

exports.createDriver = onCall({region:REGION},async request=>{
  const u=await identity(request);if(u.role!=='admin')throw new HttpsError('permission-denied','Somente administradores criam motoristas.');
  const name=String(request.data?.name||'').trim(),email=String(request.data?.email||'').trim().toLowerCase(),password=String(request.data?.password||'');
  if(name.length<3||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12)throw new HttpsError('invalid-argument','Nome, e-mail e senha com pelo menos 12 caracteres são obrigatórios.');
  const user=await getAuth().createUser({email,password,displayName:name});
  try{await db.collection('users').doc(user.uid).set({name,email,role:'driver',active:false,createdAt:FieldValue.serverTimestamp()});}
  catch(err){await getAuth().deleteUser(user.uid);throw err;}
  return {uid:user.uid,name};
});
exports.syncNps = onDocumentUpdated({document:'nps/{token}',region:REGION},async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(!after||before?.submittedAt||!after.submittedAt||!Number.isInteger(after.score)||after.score<0||after.score>10)return;
  const ref=db.collection('deliveries').doc(String(after.deliveryId));
  const snap=await ref.get();if(!snap.exists||snap.data().npsToken!==event.params.token)return;
  await ref.update({nps:{score:after.score,comment:String(after.comment||'').slice(0,500),submittedAt:FieldValue.serverTimestamp()}});
});

// Google Drive privado via Apps Script. Segredos SOMENTE no backend.
const DRIVE_BRIDGE_URL = defineSecret('DRIVE_BRIDGE_URL');
const DRIVE_BRIDGE_KEY = defineSecret('DRIVE_BRIDGE_KEY');
const LIMIT = 5*1024*1024;
function fail(message){throw new HttpsError('invalid-argument',message);}
function kindValid(kind,mime){
  return kind==='order' ? ['application/pdf','image/jpeg','image/png','image/webp'].includes(mime)
    : kind==='signature' ? mime==='image/png'
    : kind==='photo' ? ['image/jpeg','image/png','image/webp'].includes(mime)
    : false;
}
async function bridge(operation,payload){
  const url=DRIVE_BRIDGE_URL.value();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url||'')){
    throw new HttpsError('failed-precondition','URL segura do Apps Script não configurada.');
  }
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({operation,...payload,secret:DRIVE_BRIDGE_KEY.value()}),redirect:'follow',signal:AbortSignal.timeout(100000)});
  if(!response.ok)throw new HttpsError('unavailable','O Google Drive não respondeu.');
  const data=await response.json();
  if(!data.ok)throw new HttpsError('failed-precondition','Falha no Drive: '+String(data.error||'operação rejeitada'));
  return data;
}
exports.driveUpload=onCall({region:REGION,secrets:[DRIVE_BRIDGE_URL,DRIVE_BRIDGE_KEY],timeoutSeconds:120,memory:'512MiB',maxInstances:10},async request=>{
  const u=await identity(request),input=request.data||{};
  const deliveryId=String(input.deliveryId||''),kind=String(input.kind||''),mimeType=String(input.mimeType||''),name=String(input.name||'arquivo').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,95);
  if(!/^[a-zA-Z0-9-]{10,100}$/.test(deliveryId) || !kindValid(kind,mimeType))fail('Entrega ou formato de arquivo inválido.');
  if(kind==='order'){
    if(u.role!=='admin')throw new HttpsError('permission-denied','Somente administradores enviam a OP.');
  }else{
    const doc=await db.collection('deliveries').doc(deliveryId).get();
    if(!doc.exists || doc.data().driverId!==u.uid || doc.data().status!=='em_rota')throw new HttpsError('permission-denied','A entrega não está atribuída e em rota.');
  }
  const base64=String(input.base64||'');
  if(!base64 || base64.length > Math.ceil(LIMIT*4/3)+16 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(base64))fail('Arquivo vazio ou acima de 5 MB.');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length<1||bytes.length>LIMIT)fail('Tamanho inválido para envio ao Drive.');
  const result=await bridge('upload',{deliveryId,kind,name,mimeType,base64});
  return {fileId:result.fileId,name:result.name,mimeType:result.mimeType};
});
exports.driveRead=onCall({region:REGION,secrets:[DRIVE_BRIDGE_URL,DRIVE_BRIDGE_KEY],timeoutSeconds:120,memory:'512MiB',maxInstances:10},async request=>{
  const u=await identity(request),deliveryId=String(request.data?.deliveryId||''),fileId=String(request.data?.fileId||'');
  if(!/^[a-zA-Z0-9-]{10,100}$/.test(deliveryId)||!/^[a-zA-Z0-9_-]{10,160}$/.test(fileId))fail('Referência inválida.');
  const snap=await db.collection('deliveries').doc(deliveryId).get();
  if(!snap.exists)throw new HttpsError('not-found','Entrega não encontrada.');
  const d=snap.data();
  if(u.role!=='admin' && (u.role!=='driver'||d.driverId!==u.uid))throw new HttpsError('permission-denied','Acesso negado ao comprovante.');
  const linked= [d.orderFile?.driveFileId,d.proof?.signatureDriveId,...(d.proof?.photos||[]).map(x=>x.driveFileId)];
  if(!linked.includes(fileId))throw new HttpsError('permission-denied','Este arquivo não pertence ao registro da entrega.');
  const r=await bridge('read',{fileId});
  return {base64:r.base64,mimeType:r.mimeType,name:r.name};
});
