# Ativar o primeiro administrador — RotaCerta

Projeto: `rotacerta-ee675`

## Opção A — Criar pelo aplicativo

1. No Firebase Console, abra **Build → Authentication → Sign-in method** e ative **E-mail/Senha**.
2. Crie o **Cloud Firestore** em modo de produção. Não abra as regras para usuários anônimos.
3. Na pasta do aplicativo, instale o Firebase CLI e entre com a conta que é proprietária do projeto:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use rotacerta-ee675
   firebase functions:secrets:set ADMIN_SETUP_KEY
   ```

   Gere uma chave longa e aleatória (ex.: `openssl rand -hex 24`) e cole-a no prompt. Guarde-a fora do aplicativo e do repositório.

4. Publique a função e as regras:

   ```bash
   firebase deploy --project rotacerta-ee675 --only functions:setupFirstAdmin,firestore:rules,hosting
   ```

5. Abra o aplicativo publicado, clique em **Criar primeiro administrador** e informe nome, e-mail, senha forte (12+ caracteres) e a chave.
6. A função cria `users/<UID>` com `role: admin`, `active: true`. A conta do Authentication deve usar o mesmo UID.
7. Entre normalmente com o e-mail e senha escolhidos.

A criação é **permitida uma única vez**. Se o e-mail já existir no Authentication, o aplicativo aceita a senha da conta existente e conclui a ativação. Depois disso, o botão de primeiro administrador não concede novos perfis. Cloud Functions pode exigir plano Blaze.

## Opção B — Ativar manualmente no Console (sem implantar função)

1. No Console Firebase, em **Authentication → Usuários**, crie o usuário (ou abra o já existente) e copie o **UID**.
2. Em **Firestore Database → Dados**, crie a coleção `users`.
3. Crie um documento cujo ID seja **exatamente o UID** copiado.
4. Campos: `name` (string, nome completo), `email` (string, e-mail do usuário), `role` (string, valor `admin`), `active` (boolean, valor `true`).
5. Salve, publique as regras `firestore.rules` e faça login no aplicativo com o e-mail e senha do Authentication.

A opção manual não cria a trava `system/firstAdminActivated`; no entanto, a função automática confere se já existe um perfil com role admin e rejeita qualquer segunda criação.

**Não coloque a senha do administrador nem a chave ADMIN_SETUP_KEY em mensagens, no HTML, em regras públicas ou no GitHub.**
