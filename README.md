## Buzz Game Multifuncional (Remoto)

### 1. Visão Geral

Aplicação de quiz em tempo real para equipes 100% remotas: host inicia rodada com resposta secreta, participantes dão "buzz" para responder, host valida acerto/erro e atribui pontos com base na velocidade.

### 2. Infraestrutura

- **Container Docker** rodando Node.js + Express + Socket.IO (porta 3000).
- **Tunnel Cloudflared** expõe `https://<domínio>` → `localhost:3000`.
- **Namespaces Socket.IO**:

  - `/admin` (host)
  - `/game` (players)

### 3. Fluxo de Negócio

1. **Join**: participante insere nome.
2. **Iniciar Rodada** (host): define _resposta secreta_ e _maxPoints_.
3. **RoundStarted**: sinaliza início e desbloqueia buzzer nos players.
4. **Buzz**: primeiro que disparar registra tempo (delta desde início).
5. **Host Valida**: marca acerto ou erro:

   - **Acertou**: calcula pontos = `ceil(maxPoints * (1 - delta/5000ms))` (mínimo 0).
   - **Errou**: sem pontos.

6. **Block**: player buzzado fica travado 30s.
7. **ScoreUpdate**: atualiza placar geral para todos no `/admin`.
8. **NextRound**: host limpa estado e prepara próxima rodada.

### 4. Eventos & Payloads

| Evento         | Emissor    | Payload                       | Descrição                               |
| -------------- | ---------- | ----------------------------- | --------------------------------------- |
| `join`         | player     | `{ name }`                    | Registra jogador                        |
| `startRound`   | host/admin | `{ secretAnswer, maxPoints }` | Inicia rodada                           |
| `roundStarted` | servidor   | —                             | Desbloqueia buzzer players              |
| `buzz`         | player     | —                             | Primeiro buzz dispara `buzzed`          |
| `buzzed`       | servidor   | `{ name }`                    | Notifica quem buzzou primeiro           |
| `answerResult` | host/admin | `{ playerId, correct }`       | Informa acerto/erro e dispara `blocked` |
| `blocked`      | servidor   | `30000`                       | Bloqueia buzzer do player por 30s       |
| `scoreUpdate`  | servidor   | `[{ name, score }]`           | Placar atualizado                       |
| `nextRound`    | host/admin | —                             | Zera estado para nova rodada            |

### 5. Regras de Negócio

- **Anônimo controlado**: registra IP via socket, sem necessidade de login.
- **Velocidade premia**: mais rápido = mais pontos (até `maxPoints`, decresce linearmente até 5s).
- **Fair play**: bloqueio de 30s impede monopolização.
- **Privacidade**: resposta secreta armazenada no servidor, nunca exposta aos players.

### 6. Setup Rápido

1. Clone repositório.
2. `docker build -t buzz-game .`
3. `docker run -d -p 3000:3000 buzz-game`
4. Inicie `cloudflared tunnel run <tunnel>` com ingress para `localhost:3000`.
5. Acesse:

   - Host: `https://<domínio>/admin.html`
   - Players: `https://<domínio>/index.html`
