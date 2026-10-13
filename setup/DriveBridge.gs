/**
 * RotaCerta -> Google Drive (executado como o proprietário do Drive).
 * Configure as propriedades do projeto do Apps Script:
 *   ROOT_FOLDER_ID = ID da pasta principal no Google Drive
 *   BRIDGE_KEY = segredo aleatório longo (também salvo no Firebase Secret Manager)
 * Publique como Aplicativo da Web: Executar como: Eu; Quem tem acesso: Qualquer pessoa.
 * A URL NÃO deve estar no HTML. Somente Cloud Functions a utiliza com BRIDGE_KEY.
 */
function doPost(e) {
  try {
    const req = JSON.parse((e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('BRIDGE_KEY') || req.secret !== props.getProperty('BRIDGE_KEY')) {
      throw new Error('Acesso negado');
    }
    const rootId = props.getProperty('ROOT_FOLDER_ID');
    if (!rootId) throw new Error('Configure ROOT_FOLDER_ID nas propriedades do script');
    const root = DriveApp.getFolderById(rootId);
    if (req.operation === 'upload') {
      if (!/^[a-zA-Z0-9-]{10,100}$/.test(req.deliveryId || '')) throw new Error('Entrega inválida');
      if (!['order', 'photo', 'signature'].includes(req.kind)) throw new Error('Tipo inválido');
      const allowed = ['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'];
      if (!allowed.includes(req.mimeType)) throw new Error('Formato não permitido');
      const bytes = Utilities.base64Decode(req.base64 || '');
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Tamanho de arquivo inválido');
      const parent = getOrCreate_(root, 'ENTREGA_' + req.deliveryId);
      const folder = getOrCreate_(parent, req.kind === 'order' ? 'Ordens de Producao' : 'Comprovantes');
      const baseName = String(req.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0,95);
      const uniqueName = Utilities.formatDate(new Date(), 'GMT', 'yyyyMMdd_HHmmss') + '_' + Utilities.getUuid().slice(0,8) + '_' + baseName;
      const blob = Utilities.newBlob(bytes, req.mimeType, uniqueName);
      const file = folder.createFile(blob); // PRIVADO: não compartilha publicamente
      return json_({ok:true,fileId:file.getId(),name:baseName,mimeType:req.mimeType});
    }
    if (req.operation === 'read') {
      const fileId = String(req.fileId || '');
      if (!/^[a-zA-Z0-9_-]{10,160}$/.test(fileId)) throw new Error('Arquivo inválido');
      const file = DriveApp.getFileById(fileId);
      if (!belongsToRoot_(file, rootId)) throw new Error('Arquivo não está na pasta autorizada');
      const blob = file.getBlob();
      if (blob.getBytes().length > 5 * 1024 * 1024) throw new Error('Arquivo excede limite');
      return json_({ok:true,base64:Utilities.base64Encode(blob.getBytes()),mimeType:blob.getContentType(),name:file.getName()});
    }
    throw new Error('Operação inválida');
  } catch (err) {
    return json_({ok:false,error:String(err.message || err).slice(0,200)});
  }
}
function getOrCreate_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}
function belongsToRoot_(file, rootId) {
  let folders = file.getParents();
  for (let depth = 0; depth < 5 && folders.hasNext(); depth++) {
    const next = [];
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getId() === rootId) return true;
      const it = folder.getParents();
      while (it.hasNext()) next.push(it.next());
    }
    folders = { hasNext:function(){return next.length > 0;}, next:function(){return next.shift();} };
  }
  return false;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
