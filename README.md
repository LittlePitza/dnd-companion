# Consola de Mesa — D&D 2024

Hoja de personaje y consola de juego para usar **durante la partida**: ataques a un toque,
conjuros que cobran sus recursos y comprueban las reglas, y una bitácora de recuerdos que
sobrevive entre sesiones.

Viene sembrada con **Soryn Vort**, hechicero de Magia Salvaje nivel 5, pero la arquitectura es
multi-personaje: el motor de reglas es genérico y cada personaje es un archivo de datos.

---

## Qué hace

| Pestaña       | Para qué sirve                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Combate**   | «¿Qué hago este turno?» con secuencias ya comprobadas, puntos de golpe, salvaciones de muerte, espacios, puntos de hechicería, efectos activos, Fuente de Magia, oleada de magia salvaje, descansos y bitácora de la sesión. |
| **Ataques**   | Armas y conjuros de ataque en una sola lista, con su bonificador ya calculado y botones de tirada normal, con ventaja y con desventaja.                                                                                      |
| **Conjuros**  | Lista completa. Lanzar desde aquí gasta el espacio, cobra la metamagia, aplica la subida de nivel y **te dice por qué una jugada es ilegal**.                                                                                |
| **Hoja**      | Características, salvaciones y habilidades tirables, rasgos, dotes, inventario con peso y monedas.                                                                                                                           |
| **Recuerdos** | Bitácora de campaña con búsqueda, categorías, fijados, y respaldo exportable e importable en JSON.                                                                                                                           |

### Reglas de 2024 que la app vigila por ti

- **Un solo espacio de conjuro por turno.**
- **Conjuro Acelerado** no puede seguir —ni ser seguido por— un conjuro de nivel 1+.
- Una sola metamagia por conjuro, y solo las que conoces.
- **Conjuro Transmutado** rechaza el daño de fuerza (adiós, Proyectil Mágico).
- Acción, acción adicional y reacción se gastan una vez por turno.
- **Francotirador de Conjuros** solo extiende el alcance de conjuros con tirada de ataque.
- **Oleada de Magia Salvaje** solo tras gastar un espacio en un conjuro _de hechicero_, una vez por turno.
- **Mareas de Caos**: al gastarlo, la siguiente oleada es automática y el uso vuelve.
- Los espacios creados con **Fuente de Magia** desaparecen en el descanso largo.

---

## Puesta en marcha

```bash
npm install
npm run dev
```

| Script                  | Qué hace                                    |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo.                     |
| `npm run build`         | Comprueba tipos y compila a `dist/`.        |
| `npm test`              | Ejecuta las 194 pruebas.                    |
| `npm run test:watch`    | Pruebas en modo vigilancia.                 |
| `npm run test:coverage` | Cobertura del dominio y los stores.         |
| `npm run lint`          | oxlint.                                     |
| `npm run format`        | Prettier.                                   |
| `npm run verify`        | Lint + pruebas + build. Lo que corre en CI. |

---

## Arquitectura

Cuatro capas, con las dependencias apuntando siempre hacia adentro. El dominio no sabe que
React existe.

```
src/
├── domain/          Reglas puras. Sin React, sin navegador, sin E/S.
│   ├── dice/        Notación de dados y aleatoriedad como puerto inyectable.
│   ├── character/   Tipos y estadísticas derivadas.
│   ├── turn/        Motor de economía de acciones (el corazón).
│   ├── wildmagic/   Oleada y Mareas de Caos.
│   └── session/     Estado mutable de la partida: PG, recursos, lanzamientos, descansos.
├── data/            Personajes como datos. Añadir uno es añadir un archivo.
├── content/         Todo el texto en español, aislado de la lógica.
├── infrastructure/  Adaptadores: almacenamiento con degradación elegante.
├── store/           Zustand. Envuelve el dominio; no reimplementa reglas.
├── features/        UI por funcionalidad.
└── shared/          Componentes y hooks reutilizables.
```

### Decisiones que vale la pena conocer

**El dominio es puro y está probado.** Cada regla es una función sin efectos secundarios. La
aleatoriedad entra por un puerto `RandomSource`, así que las pruebas guionizan los dados y las
reglas son deterministas. 194 pruebas, y las de `derived.test.ts` verifican los números contra
la hoja oficial: si el personaje se desvía de la hoja, fallan.

**El código está en inglés, la mesa juega en español.** Los identificadores, los tipos y los
comentarios están en inglés. Todo el texto visible vive en `src/content/`. El motor de reglas
devuelve códigos estables (`ONE_SLOT_PER_TURN`); `ruleMessages.ts` los convierte en prosa.

**Nada se guarda precalculado.** CA, CD de salvación, bonificadores de ataque y habilidad se
derivan de las puntuaciones en cada render. La hoja no puede contradecirse a sí misma, y activar
Armadura de Mago o Hechicería Innata recalcula todo el sistema.

**El almacenamiento degrada con elegancia.** Si el navegador bloquea `localStorage`, la app
sigue funcionando en memoria y avisa. Un error de cuota nunca rompe un render.

**Los recuerdos se respaldan con un sobre versionado.** El archivo exportado lleva formato y
versión; la importación valida cada campo de cada recuerdo antes de tocar nada, y pide
confirmación porque reemplaza todo.

**Sin `dangerouslySetInnerHTML`.** El único formato que necesita el contenido es `**énfasis**`,
y `RichText` lo renderiza como nodos de React.

---

## Añadir un personaje

1. Copia `src/data/characters/sorynVort.ts` y cambia los valores.
2. Regístralo en `src/data/characters/index.ts`.

No hay que tocar ningún componente ni ninguna regla. Aparecerá en el selector de la cabecera.

---

## Despliegue

`.github/workflows/deploy.yml` compila y publica en GitHub Pages. El `base` de Vite se toma de
`VITE_BASE_PATH`, así que el mismo código sirve en `localhost` y en un subdirectorio de Pages.

> En un repositorio **privado**, GitHub Pages requiere un plan de pago. El workflow está listo:
> actívalo en _Settings → Pages → Source: GitHub Actions_ cuando el repositorio sea público o
> tengas plan. Mientras tanto, `npm run dev` funciona igual.

---

## Estado

- Lint limpio, tipos estrictos (`strict` + `noUncheckedIndexedAccess`), 194 pruebas en verde.
- Reglas de referencia: _Player's Handbook_ (2024). La app no reproduce texto del reglamento:
  para la tabla de Oleada de Magia Salvaje te da el resultado del d100 y la página donde buscarlo.
