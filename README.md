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

## Correção do mapa de rastreamento — 13/10/2026

- O mapa público e o dos detalhes administrativos não são mais destruídos/recriados a cada posição recebida. O marcador e o traçado são atualizados no mapa existente e há botão **Centralizar no motorista**.
- Exibe horário relativo e precisão da última posição GPS; após 90 s sem atualização avisa que o sinal está interrompido ou o aplicativo está suspenso.
- Corrigida a condição em que o primeiro ponto do GPS era descartado após iniciar a entrega porque o estado `em_rota` ainda não havia sido propagado ao navegador.
- A gravação mantém uma cópia consistente dos pontos para evitar sobrescrita de caminho por snapshots atrasados.
- O motorista pode reativar GPS pela aba de entregas; o PWA tenta retomar somente se havia consentimento local e a permissão já está concedida. No celular bloqueado/segundo plano não há garantia de rastreamento contínuo; para isso, use app nativo.
- Rastreamento público continua acessível somente via token aleatório, sem nome, telefone, CPF ou assinatura do cliente.

**Publicação:** substitua os arquivos hospedados pelos do ZIP, limpe/atualize o cache do PWA (sw.js foi versionado), execute os testes em HTTPS com celular do motorista e outro aparelho no link do cliente.

**Sem Functions:** o mapa funciona sem Cloud Functions, mas o upload/leitura de OPs, fotos e assinaturas para Google Drive continua pendente de uma integração segura independente.

## Importação da OP para o card da entrega — 13/10/2026

- No cadastro, selecione uma OP PDF com texto selecionável (até 5 MB) e aguarde a leitura local no navegador. O sistema mostra uma prévia e lista campos reconhecidos por rótulo; confira os resultados.
- O campo **Conteúdo integral da OP** pode ser corrigido e complementado antes de cadastrar. Ele é o texto final usado no card.
- O texto fica em `deliveries/{id}/orderPages/{pagina}` no Firestore, dividido em documentos pequenos para não ultrapassar o limite de 1 MiB por documento. A OP fica acessível no card completo para o administrador e para o motorista designado; o cliente público não pode ler o pedido.
- **Publique `firestore.rules` deste pacote**, incluindo as permissões de leitura/escrita para `orderPages`. Não basta subir só o HTML.
- PDF escaneado/imagem precisa de OCR ou transcrição manual; o leitor não inventa conteúdo. A visualização por texto pode mudar a diagramação das tabelas; consulte o PDF original no Drive para validar linhas e valores.
- O campo **Link privado do Google Drive** guarda o endereço do PDF original. **Sem Cloud Functions nem credenciais OAuth/Apps Script configuradas, o aplicativo ainda não envia o PDF, fotos ou assinatura automaticamente ao Drive**: o arquivo deve ser colocado no Drive pelo operador e o link colado no cadastro. A leitura do PDF no navegador NÃO implica upload ao Drive. O link abre somente para quem tiver permissão no Drive.
- Não existe botão de alterar OP após cadastrar nesta versão. Para documentos já cadastrados, a importação do texto precisa ser feita em uma nova entrega ou em uma futura tela de reprocessamento.

## Mapa ao vivo

Mantida a correção anterior: mapa persistente sem piscar a cada snapshot do Firestore, horário e precisão da posição, retomada de GPS quando autorizado e indicação de GPS desatualizado.

## Importação da OP para o card da entrega — 13/10/2026

- No cadastro, selecione uma OP PDF com texto selecionável (até 5 MB) e aguarde a leitura local no navegador. O sistema mostra uma prévia e lista campos reconhecidos por rótulo; confira os resultados.
- O campo **Conteúdo integral da OP** pode ser corrigido e complementado antes de cadastrar. Ele é o texto final usado no card.
- O texto fica em `deliveries/{id}/orderPages/{pagina}` no Firestore, dividido em documentos pequenos para não ultrapassar o limite de 1 MiB por documento. A OP fica acessível no card completo para o administrador e para o motorista designado; o cliente público não pode ler o pedido.
- **Publique `firestore.rules` deste pacote**, incluindo as permissões de leitura/escrita para `orderPages`. Não basta subir só o HTML.
- PDF escaneado/imagem precisa de OCR ou transcrição manual; o leitor não inventa conteúdo. A visualização por texto pode mudar a diagramação das tabelas; consulte o PDF original no Drive para validar linhas e valores.
- O campo **Link privado do Google Drive** guarda o endereço do PDF original. **Sem Cloud Functions nem credenciais OAuth/Apps Script configuradas, o aplicativo ainda não envia o PDF, fotos ou assinatura automaticamente ao Drive**: o arquivo deve ser colocado no Drive pelo operador e o link colado no cadastro. A leitura do PDF no navegador NÃO implica upload ao Drive. O link abre somente para quem tiver permissão no Drive.
- Não existe botão de alterar OP após cadastrar nesta versão. Para documentos já cadastrados, a importação do texto precisa ser feita em uma nova entrega ou em uma futura tela de reprocessamento.

## Mapa ao vivo

Mantida a correção anterior: mapa persistente sem piscar a cada snapshot do Firestore, horário e precisão da posição, retomada de GPS quando autorizado e indicação de GPS desatualizado.
