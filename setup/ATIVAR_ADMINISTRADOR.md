# Primeiro administrador sem Cloud Functions

Para o projeto `rotacerta-ee675`, crie o administrador **uma única vez** pelo Console Firebase, sem disponibilizar um botão público de autoprovisão:

1. Em **Authentication → Usuários**, crie uma conta de e-mail/senha e copie o UID.
2. Em **Firestore Database → Dados**, crie `users/<esse mesmo UID>` com:

```json
{"name":"Administrador","email":"seu-email@empresa.com","role":"admin","active":true}
```

3. Em Authentication, confirme que o método **E-mail/Senha** está ativado.
4. Publique as regras do arquivo `firestore.rules` e abra o aplicativo com o e-mail e senha cadastrados.

**Importante:** `role` precisa ser a string exata `admin`, e `active` o booleano `true`. Somente um administrador já validado poderá cadastrar, aprovar, desativar e reativar motoristas pelo painel. Não coloque credenciais de administrador dentro do HTML.
