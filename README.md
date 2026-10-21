# Arena dos Mortos

Como usar: copie as pastas `src/` e `assets/` para o seu projeto (substituindo as antigas), o `index.html`/`package.json` só se precisar.

    npm install
    npm run dev

## Controles
- WASD / setas: mover  |  Mouse (segurar) / Espaço / J: atacar  |  Shift / K: esquiva  |  P / Esc: pausar  |  1-2-3: upgrade

## Estrutura
- `src/main.js` – config e lista de cenas
- `src/scenes/` – Boot, Preloader (assets + texturas por código), MainMenu, Game, GameOver
- `src/game/data.js` – status, tipos de zumbi e **lista de upgrades** (fácil de editar)
- `src/game/Nav.js` – colisão por tiles + pathfinding dos zumbis
- `src/game/Sfx.js` – sons sintetizados (sem arquivos de áudio)
- `tools/prepare_assets.py` – recorta os sprites e gera `player.png`, `zombie.png`, `collision.json`
  (só precisa rodar de novo se trocar os sprites ou o mapa: `python tools/prepare_assets.py <pasta_com_originais>`)

Colisão: mar/penhascos/lagoa vêm de `collision.json`; árvores e pedras vêm da camada `objectColider` do Tiled.
Pontos de spawn: camada `player` (herói) e camada `enemy` (zumbis).
