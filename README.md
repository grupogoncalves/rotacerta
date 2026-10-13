# RotaCerta — Firebase + Google Drive, SEM Firebase Storage

**Projeto Firebase:** `rotacerta-ee675`.

## Onde cada informação fica

| Componente | Local |
|---|---|
| Login administrativo/motorista | Firebase Authentication |
| Clientes, entregas, status, posições de GPS, CPF, notas NPS e referências de arquivos | Cloud Firestore |
| Arquivos de OP, fotos e assinaturas | **Google Drive da empresa** (privado) |
| Ponte de upload/visualização dos arquivos | Firebase Cloud Functions + Google Apps Script |
| Mensagens de início/NPS | **Manuais pelo WhatsApp**, com mensagem pronta e link |

**Nenhuma dependência de Firebase Storage.** O `storage.rules` foi removido e o `firebase.json` não inclui configuração de Storage. Os arquivos armazenados no Drive não são públicos; acesso pelo aplicativo é validado pelo usuário e pela atribuição da entrega. O link público de rastreamento não expõe comprovantes/CPF/fotos.

## Estrutura no Drive

Crie manualmente uma pasta privada chamada `RotaCerta Entregas`. Durante o envio, o Apps Script criará automaticamente subpastas assim:

```
RotaCerta Entregas/
  ENTREGA_<ID_DA_ENTREGA>/
    Ordens de Producao/
      20261013_..._OP-1234.pdf
    Comprovantes/
      20261013_..._foto-entrega-1.jpg
      20261013_..._foto-entrega-2.jpg
      20261013_..._assinatura.png
```

O Drive fica sob a conta Google que **implantar o Apps Script para executar como ela mesma**. Outros usuários não precisam abrir conta Google para fazer upload — entram com o login do aplicativo. Evite usar conta pessoal se os documentos pertencerem à empresa.

## 1 — Configurar o Apps Script no Drive

1. Abra <https://script.google.com>, crie um projeto `RotaCerta Ponte Drive` com a conta Google que terá a pasta de destino.
2. Cole o conteúdo de **`setup/DriveBridge.gs`** no editor do Apps Script.
3. Na pasta privada do Drive, copie o ID da URL (`drive.google.com/drive/folders/ID_AQUI`).
4. Em **Configurações do projeto → Propriedades do script**, defina `ROOT_FOLDER_ID` como esse ID e `BRIDGE_KEY` como um segredo aleatório longo de 32+ caracteres, criado por você. Não coloque esse segredo no HTML.
5. Faça uma **Nova implantação → Aplicativo da Web**; selecione **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa**. Confirme as permissões do Drive. Copie a URL final terminada em `/exec`.
6. Não compartilhe a URL da ponte nem o segredo. A ponte valida o segredo, mas o acesso ao Apps Script é publicamente alcançável; para proteção extra, considere migrar para Google Drive API no backend.

## 2 — Conectar a ponte ao Firebase

Na pasta principal do projeto e com Firebase CLI autenticado:

```bash
npm install -g firebase-tools
firebase login
firebase use rotacerta-ee675
firebase functions:secrets:set ADMIN_SETUP_KEY
# Crie uma chave aleatória longa (mínimo 24 caracteres), guarde em segurança.
firebase functions:secrets:set DRIVE_BRIDGE_URL
# Cole a URL /exec obtida no Apps Script
firebase functions:secrets:set DRIVE_BRIDGE_KEY
# Cole o MESMO valor de BRIDGE_KEY salvo no Apps Script
firebase deploy --project rotacerta-ee675 --only firestore,functions,hosting
```

Cloud Functions e Secret Manager podem exigir o **plano Blaze** e ter cobrança. Não precisamos habilitar o Firebase Storage.

**No Console Firebase**, ative Authentication (e-mail/senha) e Firestore. Após publicar as Functions, abra o aplicativo e toque em **"Criar primeiro administrador"**. Informe nome, e-mail, senha (12+ caracteres) e a mesma chave privada que você definiu em `ADMIN_SETUP_KEY`. O sistema cria a conta no Authentication e, pela Function `setupFirstAdmin`, o perfil `users/<UID>` no Firestore. A ativação só funciona uma vez. Se a conta já tiver sido criada no Authentication, a tela tenta autenticar com o e-mail e senha informados e concluir a ativação. Os novos motoristas se cadastram sozinhos na tela de login, sem depender de Cloud Functions para o cadastro. A conta fica pendente no Firestore até ser aprovada manualmente.

**Alternativa manual, para resolver um login já cadastrado imediatamente:** no Firebase Console → Authentication → Usuários, localize o UID (ou crie o usuário com e-mail e senha). No Firestore → `users` → documento cujo ID seja exatamente o UID, adicione `name` (string), `email` (string), `role` (string com valor `admin`) e `active` (boolean `true`). Essa operação deve ser feita pelo proprietário do projeto no Console, nunca por regras de gravação abertas ao público.

**Segurança:** a chave `ADMIN_SETUP_KEY` nunca pode ficar no repositório público ou no HTML. Quem obtiver essa chave antes da primeira ativação poderá tentar assumir a administração. Após a ativação, a Function bloqueia qualquer segunda criação e mantém a trava em `system/firstAdminActivated`.

Registre o domínio publicado em **Authentication → Settings → Authorized Domains**. Hospedagem HTTPS é necessária para GPS e links públicos.

**Nenhum deploy nem configuração no Drive foi feito automaticamente.** Precisamos que você execute esses passos na sua conta, porque não recebemos autorização nem o ID da pasta Google Drive.

## Cadastro de usuários pelo aplicativo e aprovação no Firebase

1. Abra o aplicativo publicado e selecione **Criar usuário / Solicitar cadastro**.
2. Informe **nome completo, e-mail e senha com no mínimo 12 caracteres**; confirme a senha.
3. O Firebase Authentication cria o usuário e o aplicativo cria automaticamente o documento **`users/<UID>`** no Cloud Firestore com os campos:

   ```json
   {"name":"Nome do motorista","email":"email@empresa.com","role":"driver","active":false}
   ```
   (`createdAt` também é gravado como timestamp do servidor.)
4. O usuário verá **Aguardando aprovação** e **não terá acesso** a entregas ou fotos.
5. O responsável pelo projeto entra no [Console Firebase](https://console.firebase.google.com/project/rotacerta-ee675/firestore), navega até **Firestore Database → Dados → users → documento com o UID**, e altera **`active` para `true` (booleano)**. Não use a string `"true"`. Para motoristas mantenha `role` como `driver`; para administrador autorizado use `admin`.
6. O app acompanha o documento em tempo real e, após a aprovação, abre o painel correspondente automaticamente, sem novo cadastro.

**Atenção:** a regra de cadastro não permite que o usuário altere a própria função ou o próprio campo `active`. Somente o proprietário do Firebase, com as permissões adequadas no Console/Admin SDK, pode aprovar. Publique o `firestore.rules` atualizado **antes de testar o cadastro**, ou a operação será bloqueada com `Missing or insufficient permissions`.

### Como criar o primeiro administrador

**Opção rápida pelo Console:** crie uma conta pelo aplicativo, localize `users/<UID>` no Firestore e altere `role` para `admin` e `active` para `true` por meio de uma conta com permissão de edição do Firebase. Dessa forma, não é necessário configurar `ADMIN_SETUP_KEY` apenas para começar a usar o aplicativo (mas outras Functions continuam necessárias para usar o Drive).

**Opção via aplicativo com chave:** configure e publique a Function `setupFirstAdmin` com `ADMIN_SETUP_KEY`. A função aceita uma conta com perfil pendente, validando a chave privada e a trava de criação única. **Nunca** exponha a chave em HTML ou links. O procedimento foi preservado no aplicativo.

### Limites importantes

- A inscrição requer Firebase Authentication com o provedor **E-mail/Senha** habilitado e as regras Firestore da versão atual publicadas.
- O perfil pendente pode ser usado por pessoas de fora para solicitar acesso; ele não abre entregas. Para reduzir abuso em produção, ative proteção contra cadastros automatizados (App Check, quotas e políticas adequadas).
- A aprovação pelo Console exige acesso de administrador ao **projeto Firebase**, e não é feita automaticamente pelo aplicativo.
- O Google Drive recebe somente ordens de produção, fotos e assinaturas; Firebase Storage **não** é usado.

## 3 — Fluxos do aplicativo

- **Administrativo:** cadastra cliente, WhatsApp, endereço, número OP, arquivo PDF/imagem, motorista; a OP (até **5 MB**) é enviada diretamente do painel à pasta privada do Drive pela Cloud Function.
- **Motorista:** vê somente suas entregas, consulta OP, inicia viagem, acompanha GPS ao vivo, abre mensagem pronta com link de rastreamento; ele **escolhe quando enviar pelo WhatsApp**.
- **Conclusão:** coleta nome, CPF válido, 1–4 fotos comprimidas e assinatura. O aplicativo envia os arquivos ao Drive e registra **somente IDs dos arquivos** e dados da operação no Firestore.
- **Administrativo:** consulta comprovante e prepara NPS; mensagem fica pronta para abrir no WhatsApp, sem envio automático.
- **Cliente:** usa o link `?track=` para acompanhar a posição, ou `?nps=` para avaliação. Nenhuma imagem, CPF, assinatura ou link do Drive é exibido na página pública.

**Observação:** ordem de produção com limite de **5 MB** nesta versão (o envio binário em Base64 atravessa funções HTTP/Apps Script). Para PDFs maiores, substitua a ponte por upload em blocos via Google Drive API. Dependência de GPS: em PWA o rastreamento pode parar com aplicativo em segundo plano/bloqueio de tela.

### Garantias e cuidados

- Regras Firestore estão em `firestore.rules`; funções autenticam os perfis e verificam o vínculo da entrega antes de ler as fotos/assinatura.
- O Apps Script mantém pasta privada e não gera links públicos/compartilháveis de imagens.
- O cadastro de CPF, fotos e assinatura exige controles LGPD: política de retenção, necessidade, aviso claro e acesso restrito.
- Teste com **dados fictícios** após o deploy. Não há garantia de rastreamento em segundo plano nem de que o WhatsApp foi efetivamente enviado.
- Arquivos criados em Drive ficam em pasta do titular. Revogar acesso ou excluir a pasta pode impedir o aplicativo de abrir os comprovantes.
- Arquivos da versão antiga que já estiverem no Firebase Storage **não são migrados automaticamente**; esta versão usa exclusivamente os novos IDs do Drive.

## Arquivos

```
index.html / styles.css / app.js            Aplicativo PWA conectado
firebase-config.js                          Configuração web Firebase
firestore.rules                              Banco e papéis de acesso
firebase.json / .firebaserc                 Hosting e deploy (sem Storage)
functions/index.js                           Ativação segura do primeiro administrador, Drive, sincronização NPS
setup/DriveBridge.gs                         Script da ponte segura para o Drive
VERSAO_UNICA_FIREBASE.html                  HTML único conectado (sem PWA instalável)
DEMO.html                                    Demonstração local sem Firebase/Drive
manifest.webmanifest / sw.js / assets/      PWA
```

## Execução local

```
cd rotaentrega-app
python -m http.server 8080
```

Abra `http://localhost:8080/DEMO.html` para demonstração sem banco ou `/` para o Firebase real. No modo demo, arquivos pequenos ficam apenas no navegador, e não são enviados ao Drive; **não use dados pessoais reais** neste modo.
