# KNOWN_ISSUES.md — Problemas conocidos y deuda técnica

---

## 1. ~~Corrupción en snapshot (post-judicial) vs regimeType (pre-judicial)~~ — RESUELTO

**Estado:** Ya no existe. Revisado en 2026-09-27: en el código actual, `classifyRegime`
solo se invoca una vez, dentro de `createMonthSnapshot` (`snapshot.ts:60`), que corre
en el PASO 14 de `turn.ts` — después de que `advanceJudicialCases` (PASO 9) ya modificó
la corrupción de los officials. `regimeType` y `corruption` del snapshot leen por lo
tanto el mismo valor post-judicial, calculado en el mismo paso. El `classifyRegime`
que este documento describía llamándose desde el PASO 7/10 con una variable
pre-judicial ya no existe: en algún refactor posterior a este documento, la llamada
se centralizó en `snapshot.ts` y quedó como código muerto la variable
`globalCorruption` del PASO 7 y el import de `classifyRegime` en `turn.ts` (ninguno
se usaba). Ambos se eliminaron en este commit.

**Archivos modificados:**
- `src/lib/engine/turn.ts` — eliminado PASO 7 (`globalCorruption` sin uso) y los
  imports muertos de `calculateGlobalCorruption` y `classifyRegime`.

---

## 2. ~~Backfill de nuevas entidades para partidas existentes~~ — RESUELTO

**Problema original:** cada sesión que agregaba entidades por partida (enfermedades, bienes de comercio) dejaba las partidas existentes sin esos registros hasta correr un script manual, y el catálogo estaba copiado en 4 lugares (`seed-game.ts`, 2 scripts de backfill y `engine/trade.ts`).

**Solución:** patrón `ensureSeedIntegrity`, que repone lo que falte al cargar la partida.
- `src/lib/seed-catalogs.ts` — única fuente de verdad de los catálogos (`DISEASE_CATALOG`, `TRADE_GOOD_CATALOG`). Lo usan la creación de partidas, el motor y la reparación.
- `src/lib/seed-integrity.ts` — `ensureSeedIntegrity(prisma, gameId)`. Un solo `count` por carga; solo si algo falta abre una transacción con advisory lock por partida (re-chequea dentro del lock, así cargas concurrentes no duplican). Idempotente, no pisa datos existentes y nunca lanza (si falla, registra el error y la partida carga igual).
- Se invoca desde `getGameState` (`actions/game.ts`) y `advanceMonth` (`actions/turn.ts`).
- Se eliminaron `scripts/backfill-diseases.ts` y `scripts/backfill-trade-data.ts`.

**Cómo agregar una entidad nueva por partida (Educación-1, Defensa-1, ...):**
1. Agregar su catálogo a `seed-catalogs.ts` y usarlo en `createInitialGame`.
2. Agregar un `SeedStep` a `SEED_STEPS` en `seed-integrity.ts` (`isMissing` con conteos + `fill` idempotente) y su conteo en `findMissingSteps`.

**Limitación conocida:** repone entidades *ausentes*; no corrige valores de entidades ya existentes (si cambia un parámetro del catálogo, las partidas viejas conservan el suyo). Si hiciera falta, sería una migración de datos explícita.

**Verificación:** tests en `tests/persistence/seed-integrity.test.ts` y prueba manual contra Postgres 16 real (partida con 10/14 enfermedades y sin comercio + 8 cargas concurrentes → 1 sola repara, 14 enfermedades/14 prevalencias/2 bienes/2 flujos sin duplicados; segunda pasada no hace nada; partida nueva no requiere reparación).

---

## 3. Componente IndicatorCards muerto

**Estado:** Eliminado en `77bad4e`. El componente `src/components/game/indicator-cards.tsx` existía pero nunca fue importado ni renderizado en el dashboard. El dashboard usa sus propias tarjetas inline (`MiniIndicatorCard`, `IndicatorCard`). Si en el futuro se decide unificar la UI de indicadores, este componente puede resucitarse desde el historial de git.

---

## 4. Costos fijos en USD no escalan con poblacion

**Descripción:** Varios costos del motor están definidos como montos fijos en
USD en `balance.ts`, sin escalar con el tamaño del pais (poblacion o PIB).
Esto afecta a:

- `Organism.monthlyBudget` (organismos creables: Contraloria $150M, Fiscalia $200M, Inteligencia $250M)
- `LawCatalog.cost` y `effectsJson.monthlyCost` (leyes activas con costo fijo)
- `HOSPITAL_COSTS`, `MEDICAL_RESEARCH_COST` (construcción e investigación LRD de Salud-3A)
- `PROGRAM_VACCINATION_COST`, `PROGRAM_PREVENTION_COST`, `PROGRAM_MENTAL_HEALTH_COST` (programas persistentes de Salud-3A)
- `CANDIDATE_HIRE_COST_BASE` y `MEDIA_BUY_AFFINITY_COST` (contratación de funcionarios y compra de afinidad mediática)

**Impacto:** En paises pequeños (preset `pobre_con_potencial`, ~10M.population),
estos costos representan un % desproporcionado del ingreso/presupuesto. En
paises grandes (80M+), son triviales. Por ejemplo, 3 programas de Salud-3A
simultáneos cuestan 7.5M/mes — un 12% del presupuesto de Salud en pais 10M,
pero solo 1.5% en pais 80M.

**Por qué no se corrige ahora:** El balance del juego está calibrado contra el
preset default de 10M de población (donde los valores son jugables). Modificar
la escala impactaría el balance de todas las sesiones anteriores
simultáneamente. Se prefiere resolver en una sesión futura de **balance general**
que revise la escala del motor completo, no a nivel de ministerio.

**Propuesta de solución futura:** Los costos deberían definirse como función
de la población o del PIB (por ejemplo, % del PIB per cápita) en lugar de
monto fijo. Una fórmula como `cost = baseline × (population / 10_000_000)`
haría que el costo sea proporcional al tamaño del país. Aplicar de forma
transversal a organismos, leyes, programas y LRDs.

**Sesión para resolverlo:** Sesión de balance general (probablemente Sesion 7
o posterior), una vez que todos los ministerios tengan sus programas de
profundización definidos. Documentado explicitamente por el prompt de Salud-3A
para que conste antes de seguir añadiendo costos fijos.

**Archivos afectados:**
- `src/lib/balance.ts` — todas las constantes `*_COST` (legacy + Salud-3A)
- `src/lib/game-factory.ts` — `generateOrganisms` siembra con costos fijos
- `prisma/seed.ts` — costos de leyes sembradas
- Programas de Salud-3A en `programs.ts` y LRD en `long-running-decisions.ts`
