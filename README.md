# RotaCerta — Entregas PWA

Versão adaptada ao Firebase **rotacerta-ee675**, com **cadastro e gestão de motoristas sem Cloud Functions**.

## Comece aqui

- Abra `setup/SEM_CLOUD_FUNCTIONS.md` — instalação, publicação das regras e limitações.
- Para criar o primeiro administrador, veja `setup/ATIVAR_ADMINISTRADOR.md`.
- Publique `firestore.rules` antes do aplicativo.
- Abra `index.html` em seu Hosting para entrar; `VERSAO_UNICA_FIREBASE.html` é uma alternativa em arquivo único para hospedagem HTTPS; `DEMO.html` testa o visual offline.

## Funcionalidades

- Administrador cria e atribui entregas, acompanha o status e os motoristas.
- **Motoristas:** cadastro pelo administrador (Firebase Auth em segunda sessão temporária), liberação imediata ou pendente, aprovação, desativação e reativação via Firestore.
- Motorista visualiza suas entregas, inicia a viagem e compartilha link por **WhatsApp manual**.
- GPS e link público de acompanhamento via Firestore quando a página está aberta e a localização é permitida.
- Captura de fotos, CPF e assinatura no formulário de comprovante.
- Link NPS para cliente avaliar a entrega de 0 a 10.

## Limitações nesta versão sem Cloud Functions

- A **gestão de usuários** não depende de Cloud Functions.
- O **Google Drive** ainda não funciona no fluxo real de upload e leitura de arquivos: o código original utiliza as Functions `driveUpload` e `driveRead`. É necessário substituí-las por uma integração segura sem Functions (como Apps Script com verificação de autenticação/autorização) antes de usar OPs, fotos e assinaturas reais.
- Sem a Function `syncNps`, a nota do cliente é registrada em `nps/{token}`, mas ainda não é sincronizada automaticamente com os relatórios agregados da entrega.
- A autocriação inicial do primeiro administrador via Cloud Functions foi desativada: crie o primeiro administrador pelo Console Firebase.
- O rastreamento de um PWA pode ser interrompido quando o celular suspende o navegador em segundo plano.

**Não use este projeto para dados reais de clientes antes de concluir a integração privada com Google Drive e os testes de ponta a ponta.**
