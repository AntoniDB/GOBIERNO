# ISSUES.md — Registro de incidentes

## Incidencia #1: Capa 3 rompe avance de turnos (2026-06-27)

### Resumen

La capa de idempotencia (Layer 3, agregada para evitar doble-procesamiento en
concurrencia) introdujo una regresión que **bloqueaba todo avance de turno
después del primer mes**. Leyes aprobadas por el Congreso no se aplicaban,
investigaciones judiciales no avanzaban, y ningún indicador se actualizaba.

### Causa raíz

La transacción en `advanceMonth` actualizaba `game.currentMonth` **antes** de
insertar el `MonthSnapshot`. La capa de idempotencia comparaba:

```
game.currentMonth > latestSnapshot.month
```

Después del primer turno exitoso:
- `game.currentMonth` en DB = N+1 (ya avanzado por la transacción previa)
- `latestSnapshot.month` = N (snapshot del mes anterior)

∴ `N+1 > N` siempre era `true` → la idempotencia **nunca dejaba pasar**
llamadas legítimas. Solo el primer turno (sin snapshot previo) funcionaba.

### Por qué pasó

Se intentó resolver un bug de concurrencia (P2002 por doble-click insertando
duplicados en tabla `MonthSnapshot`) agregando tres capas de defensa:

| Capa | Mecanismo | ¿Funciona? |
|------|-----------|------------|
| 1 | `useRef` guard en botón (cliente) | ✅ Siempre funcionó |
| 2 | try-catch P2002 con retry (servidor) | ❌ Causó 25P02 (transacción abortada por PostgreSQL) |
| 3 | Idempotencia pre-procesamiento (servidor) | ❌ Bug: comparación incorrecta bloquea todo |

La Capa 2 se eliminó y se reemplazó con `INSERT ... ON CONFLICT` (raw SQL).
La Capa 3 se agregó como optimización para abortar temprano, pero la
comparación `>` en vez de `===` la rompió.

**Problema de diseño subyacente:** `game.currentMonth` se actualiza en la
misma transacción que crea el snapshot, pero **antes** que él. Cualquier
lectura concurrente ve `currentMonth` avanzado pero sin snapshot — imposible
distinguir "doble-click legítimo" de "llamada al mes siguiente".

### Solución aplicada

Dos cambios en `src/app/actions/turn.ts`:

**1. Fórmula de idempotencia corregida** (líneas 325-331):

```
// ANTES (roto):
game.currentYear > latestSnapshot.year ||
(game.currentYear === latestSnapshot.year && game.currentMonth > latestSnapshot.month)

// DESPUÉS (correcto):
game.currentYear === latestSnapshot.year &&
game.currentMonth === latestSnapshot.month
```

Ahora detecta: "si ya existe un snapshot exacto para el mes actual, es
duplicado". Ya no bloquea llamadas a meses siguientes porque `currentMonth`
es siempre > `latestSnapshot.month` en el caso normal.

**2. Reorden de la transacción** (pasos a y f intercambiados):

```
// ANTES (ventana de race grande):
a. UPDATE game SET currentMonth = N+1   ← se actualiza PRIMERO
...
f. INSERT MonthSnapshot (mes=N)         ← se crea DESPUÉS

// DESPUÉS (ventana mínima):
a. INSERT MonthSnapshot (mes=N)         ← se crea PRIMERO
...
f. UPDATE game SET currentMonth = N+1   ← se actualiza DESPUÉS
```

Con este orden, si un segundo request llega después del paso a pero antes
del paso f:
- Ve `currentMonth = N` (no avanzado aún) y `MonthSnapshot = N` (ya existe)
- Idempotencia: `N === N` → `true` → balea ✅

Si llega antes del paso a:
- Ve `currentMonth = N`, sin snapshot para N
- ON CONFLICT maneja el INSERT duplicado sin error

### Estado actual del sistema de defensa contra doble-click

| Capa | Mecanismo | Cubre | No cubre |
|------|-----------|-------|----------|
| 1 | `useRef` guard (`advancingRef`) en botón | Doble-click físico en-sesión, misma pestaña | Otra pestaña, otro dispositivo, reintento HTTP |
| 2 | `INSERT ... ON CONFLICT` raw SQL | Race donde dos transacciones procesan el MISMO mes concurrentemente | (no aplica — no bloquea, solo maneja el conflicto atómicamente) |
| 3 | Idempotencia corregida (`===`) | Reintento que llega DESPUÉS de que la transacción completó (segundos/minutos después) | Doble-click exacto donde R2 lee DB antes de que R1 llegue al paso a |

**Riesgo residual aceptado:** Existe una ventana de microsegundos donde dos
requests desde pestañas/dispositivos distintos pueden procesar el mismo mes
concurrentemente. En ese caso, ambos producen el mismo resultado (mismo input),
ON CONFLICT resuelve el INSERT duplicado, y el game update final es idempotente.
El riesgo se considera aceptable porque:
- No produce errores ni corrupción de datos
- El resultado es determinista (mismo input → mismo output)
- El caso requiere dos pestañas/dispositivos haciendo clic exactamente a la vez

### Archivos modificados

- `src/app/actions/turn.ts` — idempotencia corregida (líneas 325-331) + reorden
  de transacción (snapshot antes que game update)

### Verificación

- ✅ 300 tests unitarios pasan (27 archivos)
- ✅ TypeScript compila sin errores nuevos en `turn.ts`
- ❌ Pruebas funcionales (ley, justicia, doble-click, 3-4 meses consecutivos)
     requieren servidor + DB + navegador — pendientes de verificación manual

---

## Incidencia #2: Seed snapshot bloquea idempotencia `===` (2026-06-28)

### Resumen

Después de corregir la fórmula de idempotencia a `===`, el presupuesto de
ministerios dejó de persistir. El slider se movía visualmente pero al recargar
volvía al valor anterior. El síntoma era idéntico a un bug anterior de «slider
sin persistencia».

### La línea exacta del bug

`src/app/actions/turn.ts:330-332` — la idempotencia `===` entre `game.currentMonth`
y `latestSnapshot.month`. El valor de `game.currentMonth` era `0` (semilla del
juego), y `latestSnapshot.month` también era `0` (snapshot inicial creado por
`seed-game.ts:264`). La comparación `0 === 0` retornaba `true` → la función
retornaba `existingState` sin ejecutar `processTurn` → el `input.budgetAdjustments`
del jugador nunca se aplicaba.

### Por qué la lectura superficial del código no lo detectaba

En las dos revisiones anteriores de este archivo, el diagnóstico fue «el código
está bien». El razonamiento era:

1. `processTurn` PASO 1a (`turn.ts:120-135`) — aplica `input.budgetAdjustments`
   correctamente. Revisado línea por línea, confirmado.
2. Transacción paso b (`turn.ts:488-503`) — persiste `budgetPercent` en la DB.
   Revisado, confirmado.
3. Las keys coinciden (uppercase inglés en frontend y DB). Confirmado.
4. No hay ningún paso intermedio que sobrescriba `ministry.budgetPercent`.
   Confirmado.

**Todo eso era correcto, pero irrelevante.** El bug no estaba en ninguna de esas
líneas. Estaba en la línea 330-332, que decidía SIQUIERA EJECUTAR esas líneas.
La idempotencia retornaba antes de llegar a `processTurn`, haciendo que todo el
análisis de PASO 1a y la transacción fuera condicional muerto.

**Patrón de error:** confiar en lectura de código sin verificar con evidencia de
ejecución real. La lectura de código confirma que la lógica ES CORRECTA cuando
se ejecuta — pero no confirma que SE EJECUTE. Solo un log de runtime (o un test
end-to-end) revela si el código muerto es alcanzado.

### Diagnóstico

La confirmación llegó con logs estratégicos en tres niveles:

| Nivel | Log | ¿Apareció? | ¿Qué implica? |
|-------|-----|------------|---------------|
| 1. Server action (antes de idempotencia) | `DEBUG input crudo recibido: {"budgetAdjustments":{"DEFENSE":5}}` | ✅ | El cliente envía bien el input |
| 2. Idempotencia | `game: {year:1, month:0} === latestSnapshot: {year:1, month:0}` | ✅ match | La idempotencia está bloqueando |
| 3. `processTurn` PASO 1a | `DEBUG ministerios después de PASO 1a: ...` | ❌ NUNCA | `processTurn` nunca se ejecuta |

El log del nivel 2 reveló que `game.currentMonth` y `latestSnapshot.month`
tenían el mismo valor (`0`), lo que no debería ocurrir en un flujo normal
donde `currentMonth` avanza después de crear el snapshot. La investigación
retrospectiva encontró que el seed (`seed-game.ts:264`) crea un snapshot
inicial con `year:1, month:0` — exactamente el mismo mes en que empieza el
juego (`currentMonth:0` en `seed-game.ts:38`).

### Solución aplicada

Eliminar el `MonthSnapshot` inicial del seed (`seed-game.ts:260-283`). El
primer `advanceMonth` naturalmente crea el snapshot del mes 0 como parte del
flujo normal.

Flujo resultante:
- Juego nuevo: `currentMonth=0`, cero snapshots
- 1er avance: `latestSnapshot=null` → skip idempotencia → `processTurn` → snapshot mes 0, `currentMonth=1`
- 2do avance: `latestSnapshot.month=0, currentMonth=1` → `0 !== 1` → procede
- N-ésimo avance: siempre `latestSnapshot.month < currentMonth` → procede

### Lección aprendida

La fórmula de idempotencia con `===` tiene una precondición implícita: el
juego NO debe tener un snapshot para el mes actual antes de la primera
llamada a `advanceMonth`. Si el seed crea un snapshot que coincide con
`currentMonth`, la primera llamada válida también es bloqueada.

**Metodológicamente:** cuando un bug persiste después de revisar el código,
no alcanza con volver a leerlo. Hay que instrumentar con logs en los puntos
de decisión (no solo en los puntos de ejecución) para confirmar que el flujo
de control llega donde se espera.

### Archivos modificados

- `src/app/actions/seed-game.ts` — eliminado snapshot inicial (líneas 260-283)

### Verificación

- ✅ 300 tests unitarios pasan (27 archivos)
- ✅ Prueba funcional manual: slider de presupuesto persiste tras avanzar mes y recargar
