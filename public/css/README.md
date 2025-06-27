# Arquitetura CSS

## Estrutura

O CSS foi organizado de forma modular seguindo os princípios de separação de responsabilidades:

### Visão Geral dos Arquivos

- **`base.css`** - Variáveis CSS, reset global, layout base e tipografia
- **`components.css`** - Componentes reutilizáveis da UI (botões, cards, inputs, etc.)
- **`player.css`** - Estilos específicos do jogador (index.html)
- **`creator.css`** - Estilos específicos do criador de jogos (create.html)
- **`admin.css`** - Estilos específicos do painel admin (admin.html)

### Padrão de Uso

Cada página HTML importa apenas o CSS necessário:

```html
<!-- Página do jogador (index.html) -->
<link rel="stylesheet" href="/css/base.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/css/player.css" />

<!-- Página do criador (create.html) -->
<link rel="stylesheet" href="/css/base.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/css/creator.css" />

<!-- Página do admin (admin.html) -->
<link rel="stylesheet" href="/css/base.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/css/admin.css" />
```

## Benefícios

1. **Separação de Responsabilidades** - Cada arquivo tem uma responsabilidade específica
2. **Manutenibilidade** - Mais fácil encontrar e modificar estilos
3. **Performance** - Carrega apenas o CSS necessário para cada página
4. **Escalabilidade** - Fácil adicionar novos estilos específicos de página
5. **Reutilização** - Componentes podem ser compartilhados entre páginas

## Design System

Todas as cores, espaçamentos e outros tokens de design estão centralizados no `base.css` usando propriedades customizadas do CSS (variáveis), garantindo consistência em toda a aplicação.
