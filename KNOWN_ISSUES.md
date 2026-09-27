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

## 2. Backfill de nuevas entidades para partidas existentes

**Descripción:** Cada sesión que agrega entidades nuevas al modelo de datos deja las partidas existentes sin esos registros. El motor tiene fallbacks (ej: sin enfermedades → `calculateHealth` viejo), pero los valores mostrados no reflejan la nueva mecánica hasta que el jugador crea una partida nueva.

**Impacto:** El jugador ve valores inconsistentes (ej: sickRate al 3% en vez de ~41%) hasta que se ejecuta un script de backfill manual. Esto va a repetirse en Salud-3, Educación-1, Defensa-1, etc.

**Propuesta de solución:** Ver recomendación en el commit `77bad4e` (patrón `ensureSeedIntegrity` al cargar partida). No implementada aún — evaluar en la próxima sesión que agregue entidades.

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
- `prisma/seed.ts` y `scripts/backfill-diseases.ts` — costos de leyes sembradas
- Programas de Salud-3A en `programs.ts` y LRD en `long-running-decisions.ts`
