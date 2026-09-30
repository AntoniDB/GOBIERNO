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

## 4. ~~Costos fijos en USD no escalan con población~~ — RESUELTO

**Causa de fondo (descubierta al atacarlo):** los presets (25M–80M de habitantes)
no se aplicaban desde `98ac4e8`, así que toda partida corría a 10M/1.000M y el
balance "calibrado a 10M" era un efecto de ese bug, no una decisión. Ver
`ISSUES.md` Incidencia #3. Restaurado en este cambio.

**Resuelto — se escalan por población** (`scaleCost` en `engine/cost-scale.ts`,
referencia `BALANCE.COST_REFERENCE_POPULATION` = 10M; con 10M el factor es 1, así
que las partidas existentes no cambian):
- Programas de Salud-3A (`PROGRAM_*_COST`), hospitales (`HOSPITAL_COSTS`) e investigación (`MEDICAL_RESEARCH_COST`)
- Contratación de candidatos (`candidateHireCost`, compartido por motor y UI)
- Compra de afinidad mediática (`MEDIA_BUY_AFFINITY_COST`)

Fórmula: `costo = costoBase × población / 10M`. Mantiene constante el peso del costo
respecto del ingreso mensual (`45 × población`). Los valores de `balance.ts` son
costos BASE (a 10M).

**Resuelto — leyes y organismos** (referencia propia, `BALANCE.LAW_COST_REFERENCE_POPULATION` = 50M):
los costos de leyes y organismos **no** se calibraron a 10M: el catálogo se escribió el
21-22/06/2026, cuando los presets sí se aplicaban (25M–80M). A 10M pesaban 100%–200% del
ingreso solo por el bug de los presets. Se toma 50M (preset `estable_democratico`; media de
los presets ≈ 47M) como la población para la que los valores del catálogo son "el costo
real": la ley mediana (400M/mes) pesa ≈18% del ingreso y la más cara (900M) ≈40%. Es una
decisión de balance y es un solo número: subirlo abarata todas las leyes y organismos.
- **Leyes**: el motor cobra `effectsJson.monthlyCost × población / 50M` (`economy.ts`,
  `scaleLawCost`). El catálogo en la DB no se modifica (se escala al cobrar). La UI
  (`law-catalog.tsx`, `active-laws.tsx`) muestra el costo escalado y reemplaza el badge
  crudo `monthlyCost: +400000000` por "Costo/mes: M$ X".
- **Organismos**: la Contraloría sembrada se escala a la población del preset
  (`seed-game.ts`) y el slider de `create-organism.tsx` escala su rango (M$ 50–500 a 50M).
  El monto se guarda ya escalado, así que **los organismos de partidas existentes no cambian**.
- Efecto en partidas existentes (que corren a 10M por el bug de los presets): sus leyes
  activas pasan a costar 1/5 de lo que costaban (ahora pesan lo mismo que en un país de 50M).

**Sigue sin escalar, a propósito:** `BASE_SALARY_PER_MINISTER` (un sueldo no depende del
tamaño del país) y la capacidad hospitalaria (ver #5).

**Archivos:** `src/lib/engine/cost-scale.ts`, `src/lib/balance.ts`, `programs.ts`,
`long-running-decisions.ts`, `candidates.ts`, `turn.ts` (compra de afinidad y contratación),
`program-launch-modal.tsx` y `candidates-panel.tsx` (UI muestra el costo escalado), `economy.ts`, `seed-game.ts`,
`law-catalog.tsx`, `active-laws.tsx`, `create-organism.tsx`.

---

## 5. Colapso hospitalario saturado siempre (calibración)

**Descripción:** `detectHospitalCollapse` (`health-crises.ts`) calcula
`sickNeedingBeds = población_región × sickRate% × 8%` y lo compara con las camas
de la región (`healthCoverage.*.beds`). Con `sickRate ≈ 40%` (incluye crónicas y
salud mental) la razón de saturación es de 50× a 1.600× el umbral
(`COLLAPSE_SATURATION_THRESHOLD` = 1,5) **incluso a 10M**, y la severidad queda
capada en 100. Con la población de los presets es 2,5×–8× mayor, pero como ya
estaba capada no cambia el resultado.

**Impacto:** el evento `HOSPITAL_COLLAPSE` se dispara de forma sostenida (una región
cada 3 meses, siempre severidad máxima) en cualquier partida, con su penalización
de aprobación y de mortalidad. No responde a las decisiones del jugador.

**Propuesta:** dimensionar la demanda de camas sobre la población que realmente
requiere hospitalización (no `sickRate` agregado) y/o escalar las camas de cada
preset con su población. Es parte de la recalibración del sistema de salud.

---

## 6. LRD: el costo mensual lo define el cliente

**Descripción:** `newLongRunningDecisions[].monthlyCost` viaja desde el cliente
(`buildHospitalConstructionInput` corre en el navegador) y el motor lo usa tal cual
(`long-running-decisions.ts`, creación de LRD). Un cliente manipulado podría enviar
un costo menor. Contradice la regla de que el motor no es manipulable desde el
cliente. Lo mismo ocurre con los programas: `createProgram` usa el `monthlyCost`
recibido si existe y solo calcula el costo por defecto cuando no llega.

**Propuesta:** que el motor ignore el `monthlyCost` recibido para
`HOSPITAL_CONSTRUCTION`, `MEDICAL_RESEARCH` y programas, y lo calcule siempre
con el estado (población). La UI ya no necesitaría enviarlo.

---

## 7. Leyes con costo que nunca se cobra

**Descripción:** `LawCatalog.cost` solo se muestra en la UI; el motor cobra únicamente
`effectsJson.monthlyCost` (o `effectsJson.cost`, que ninguna ley define). De las 43 leyes:
- 20 tienen `monthlyCost` y se cobran cada mes (en las del segundo lote `cost == monthlyCost`).
- **17 tienen `cost > 0` pero ningún `monthlyCost`**: la UI muestra "M$ 500" (o 1.000 en
  `salud-universal`, 800 en `educacion-publica-gratuita`…) y aplicarlas no cuesta nada.
- **3 tienen `cost < 0`** (`privatizacion-empresas` −2.000M, `reforma-afp` −3.000M,
  `extincion-dominio` −500M): parecen ingresos puntuales, pero nunca se acreditan.
- `abenomics` define `effectsJson.treasury: -1.000M`, sin ningún código que lo aplique.

**Impacto:** las leyes de bienestar más grandes son gratis y las privatizaciones no dan dinero:
el Congreso es más barato de lo que muestra la UI y hay leyes estrictamente dominantes.

**Decisión pendiente (diseño):** ¿`cost` es un costo único al promulgar (negativo = ingreso),
un costo mensual, o debe ocultarse? Hasta decidirlo, no se cambió el comportamiento.

---

## 8. Déficit estructural desde el primer turno

**Descripción:** los 8 ministerios iniciales suman exactamente 100% del ingreso
(`generateMinistries`: 14+16+18+10+12+8+10+12), así que cualquier gasto fijo (Contraloría
≈6,7% del ingreso, salarios) produce déficit desde el turno 1 en los cuatro presets.
No es un bug: el jugador debe redistribuir presupuesto. Se anota porque condiciona
cualquier recalibración de costos (la holgura fiscal inicial es cero por diseño).
