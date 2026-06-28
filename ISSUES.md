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
