# Cadastro e gestão de motoristas — sem Cloud Functions

Leia `SEM_CLOUD_FUNCTIONS.md` para o procedimento completo.

**Resumo:** publique `firestore.rules`, habilite Authentication E-mail/Senha, entre no aplicativo com o admin (`role: admin`, `active: true`), abra **Motoristas → Cadastrar motorista**. O cadastro cria um usuário no Auth secundário e o perfil pelo Firestore usando a autorização do administrador. Aprove e bloqueie motoristas pela própria tela.

Não execute `firebase deploy --only functions`; a gestão de motoristas não depende de Functions.
