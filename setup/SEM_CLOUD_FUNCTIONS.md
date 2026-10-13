# RotaCerta — cadastro de motoristas sem Cloud Functions

O cadastro e a aprovação/bloqueio de motoristas agora exigem somente Firebase Authentication e Cloud Firestore.

## Ativação do cadastro

1. No Firebase Console, abra **Authentication → Método de login**, habilite **E-mail/Senha** e adicione seu domínio de hospedagem aos autorizados.
2. Em **Firestore Database → Regras**, substitua pelas regras do arquivo `firestore.rules` deste pacote e clique em **Publicar**.
3. Confirme que o administrador já existe em **Authentication** e em `users/<UID>` do **Firestore** com `role: "admin"` (exatamente assim) e `active: true` (booleano). O UID dos dois registros precisa ser o mesmo.
4. Publique o HTML atualizado e os outros arquivos do aplicativo no Firebase Hosting ou em site HTTPS, usando `firebase deploy --only hosting,firestore --project rotacerta-ee675` na pasta do projeto.
5. Acesse o sistema como admin → **Motoristas → + Cadastrar motorista**, informe nome, telefone opcional, e-mail e senha provisória. Você pode ativar imediatamente ou deixar pendente.
6. Os botões **Aprovar / Desativar / Reativar** gravam o campo `active` diretamente no Firestore; não precisam de Cloud Functions.

## Como funciona

O navegador cria um segundo Firebase Auth, temporário e **apenas em memória**, para registrar o motorista. Essa sessão secundária não altera o login do administrador. O aplicativo usa a sessão original do administrador para gravar o documento do motorista no Firestore, onde as regras exigem perfil `admin` ativo e impedem autoaprovação.

Não há uma API pública do Firebase Auth que permita ao administrador criar contas de terceiros com privilégios de servidor diretamente no navegador: este método utiliza o cadastro normal do Firebase Auth com sessão secundária. Se o cadastro no Authentication funcionar mas o registro no Firestore falhar, o aplicativo tenta excluir automaticamente a conta recém-criada. Em eventual falha nessa exclusão, o erro exibe UID e e-mail para reconciliação manual no Console.

## Limitações dos demais recursos

Esta alteração remove **Cloud Functions do cadastro e da gestão de motoristas**. Ela não converte automaticamente o restante do projeto para funcionar sem backend. Nesta base anterior, **o envio/leitura de OP, fotos e assinatura ao Google Drive** utiliza `driveUpload`/`driveRead` via Cloud Functions e **a ativação pelo botão de primeiro administrador** utiliza `setupFirstAdmin`; sem Functions esses recursos não funcionarão até serem migrados para outra solução autorizada (ex.: Apps Script com autenticação verificada).

O envio das mensagens pelo WhatsApp continua manual. O formulário NPS usa Firestore e salva a nota na coleção `nps`, mas a sincronização da nota de volta ao documento da entrega dependia da Function `syncNps`; até substituí-la, visualize as avaliações diretamente na coleção `nps`.

**Segurança:** não exponha credenciais de serviço do Google Drive, chaves de conta de serviço nem senhas administrativas no HTML. Dados como CPF, assinaturas e fotos exigem acesso restrito e tratamento compatível com a LGPD.
