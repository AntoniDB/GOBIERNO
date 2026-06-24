# KNOWN_ISSUES.md — Problemas conocidos y deuda técnica

---

## 1. Corrupción en snapshot (post-judicial) vs regimeType (pre-judicial)

**Descripción:** Hay una divergencia entre el valor de corrupción que se usa para clasificar el tipo de régimen y el que se persiste en el snapshot histórico.

- **`snapshot.ts:57`**: `calculateGlobalCorruption(state.officials)` — se ejecuta en el PASO 14, *después* de que los casos judiciales (PASO 9: `advanceJudicialCases`) modifican la corrupción de officials condenados. El snapshot guarda la corrupción **post-judicial**.
- **`regime.ts:60-65`**: `classifyRegime` recibe `corruption` desde `turn.ts:710` donde se calculó en el PASO 7, *antes* de que los casos judiciales modifiquen officials. La clasificación de régimen usa corrupción **pre-judicial**.

**Impacto:** En la práctica es mínimo porque los casos judiciales rara vez modifican la corrupción de suficientes officials como para cambiar la clasificación de régimen en un solo turno. El delta típico es <1 punto de corrupción global. Además, al turno siguiente la corrupción post-judicial ya está sincronizada vía `updateOfficialCorruption` (PASO 6) y todo converge.

**No es urgente porque:**
- Lleva sin causar problemas visibles desde la Sesión 4 (marzo 2025)
- El impacto numérico es marginal (<1% de corrupción global)
- La clasificación de régimen usa thresholds amplios (20, 35, 55, 70) que amortiguan pequeñas variaciones

**Sesión futura para resolverlo:** cuando se profundice el Ministerio de Justicia (Sesión Justicia-2 o similar), donde los casos judiciales van a tener más impacto sistémico. En ese momento, el orden de los pasos del motor debería reorganizarse para que la corrupción usada en `classifyRegime` sea coherente con la del snapshot.

**Archivos y líneas:**
- `src/lib/engine/turn.ts:624` — PASO 7: `calculateGlobalCorruption`
- `src/lib/engine/turn.ts:710` — PASO 10: `classifyRegime` usa variable local del PASO 7
- `src/lib/engine/turn.ts:654` — PASO 9: `advanceJudicialCases` modifica officials después del PASO 7
- `src/lib/engine/snapshot.ts:57` — PASO 14: recalcula corrupción con officials ya modificados

---

## 2. Backfill de nuevas entidades para partidas existentes

**Descripción:** Cada sesión que agrega entidades nuevas al modelo de datos deja las partidas existentes sin esos registros. El motor tiene fallbacks (ej: sin enfermedades → `calculateHealth` viejo), pero los valores mostrados no reflejan la nueva mecánica hasta que el jugador crea una partida nueva.

**Impacto:** El jugador ve valores inconsistentes (ej: sickRate al 3% en vez de ~41%) hasta que se ejecuta un script de backfill manual. Esto va a repetirse en Salud-3, Educación-1, Defensa-1, etc.

**Propuesta de solución:** Ver recomendación en el commit `77bad4e` (patrón `ensureSeedIntegrity` al cargar partida). No implementada aún — evaluar en la próxima sesión que agregue entidades.

---

## 3. Componente IndicatorCards muerto

**Estado:** Eliminado en `77bad4e`. El componente `src/components/game/indicator-cards.tsx` existía pero nunca fue importado ni renderizado en el dashboard. El dashboard usa sus propias tarjetas inline (`MiniIndicatorCard`, `IndicatorCard`). Si en el futuro se decide unificar la UI de indicadores, este componente puede resucitarse desde el historial de git.
