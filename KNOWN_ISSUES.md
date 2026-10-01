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

## 6. ~~LRD: el costo mensual lo define el cliente~~ — RESUELTO

**Problema original:** `newLongRunningDecisions` y `newPrograms` llegaban con `name`, `totalMonths`
y `monthlyCost` (y `effectOnCompletion`) definidos por el navegador, y el motor los usaba tal cual.
Un cliente manipulado podía abaratar o acortar una obra, o enviar un costo **negativo** (el motor
resta `totalCost` del tesoro cada mes, así que sumaba dinero). Lo mismo con el presupuesto de un
organismo nuevo.

**Solución — el cliente solo elige tipo y parámetros; el motor decide el resto:**
- `buildDecision` / `createNewDecisions` (`long-running-decisions.ts`): `HOSPITAL_CONSTRUCTION`
  `{regionId, level}` y `MEDICAL_RESEARCH` `{diseaseIds}` (1–2). Nombre, duración y costo salen de
  `BALANCE` y del estado (costo escalado por población); los parámetros se reconstruyen desde el
  estado. Se rechazan tipos desconocidos (incluido `OBRA_DE_PRUEBA`, que quedó solo como no-op
  interno), niveles inválidos, regiones/enfermedades inexistentes y más de 2 enfermedades.
- `createNewPrograms` (`programs.ts`): el costo siempre es `defaultCostFor`; la vacunación exige una
  enfermedad existente con vacuna y toma el nombre del estado.
- Presupuesto de organismos: `clampOrganismBudget` lo acota al rango `[50M, 500M]` escalado por
  población (`ORGANISM_BUDGET_MIN/MAX`); el slider de la UI usa el mismo rango.
- Lo rechazado se descarta y el jugador recibe una notificación ("Decisión/Programa rechazado").
- API honesta: `TurnInput` ya no tiene `name`/`totalMonths`/`monthlyCost`/`effectOnCompletion`;
  el store envía `startLongRunningDecision(type, parameters)` y `startProgram(type, parameters)`;
  se eliminaron `buildHospitalConstructionInput` y `buildMedicalResearchInput`.
- `effectOnCompletion` se guardaba pero ningún código lo leía; ahora siempre es `{}`.

**Verificación:** tests unitarios y de `processTurn` (con mutación comprobada) y prueba de punta a
punta contra Postgres 16 real con un cliente hostil (costo −9e12, 1 mes, región inexistente, tipo
`OBRA_DE_PRUEBA`, vacuna inexistente, presupuesto −5e12): en la base quedó la obra a 64M × 24 meses,
el programa a 24M, el organismo a 80M y 3 rechazos avisados.

---

## 7. ~~Leyes con costo que nunca se cobra~~ — RESUELTO

**Problema original:** `LawCatalog.cost` solo se mostraba en la UI; el motor cobraba únicamente
`effectsJson.monthlyCost`. De las 43 leyes, 17 mostraban un costo que nunca se cobraba
(`salud-universal` 1.000M, `educacion-publica-gratuita` 800M…) y 3 con `cost` negativo
(`privatizacion-empresas`, `reforma-afp`, `extincion-dominio`) nunca daban dinero.

**Decisión (diseño):** `cost` es un **costo único al promulgar**; negativo = ingreso único.
- Las leyes con `monthlyCost` (20) **no** tienen costo único: en todo el catálogo su `cost`
  repite el monto mensual (hay un test que lo garantiza), así que cobrarlo también sería
  contar el gasto dos veces. Siguen cobrándose cada mes como antes.
- El costo se escala por población con la misma referencia que el resto de leyes (50M).

**Implementación:** `lawCostProfile` y `resolveLawEnactments` (`engine/economy.ts`, puras y
con tests). El cobro ocurre en `advanceMonth` (`actions/turn.ts`) justo después de la
votación del Senado, que se resuelve fuera del motor: se ajusta `newState.treasury` y
`monthSnapshot.treasury` (el snapshot es la base del turno siguiente) y se emite una
notificación "Costo/Ingreso por promulgación". La UI muestra "M$ X/mes", "M$ X (único)"
o "INGRESO M$ X", y el modal de propuesta avisa si el tesoro no alcanza.

**Política de fondos insuficientes:** la ley se promulga igual y el tesoro puede quedar
negativo (igual que ya ocurre con los déficits: `calculateTreasury` no recorta a 0). Si se
prefiere bloquear la promulgación sin fondos, hay que decidir qué pasa con la propuesta ya
votada.

**Guard contra duplicados (corrige un bug previo):** `ActiveLaw` no tiene restricción de
unicidad y el motor auto-propone `estado-emergencia` en cada brote; una ley ya vigente que
se volvía a aprobar se duplicaba. Ahora una ley vigente (o repetida en el mismo turno) no se
vuelve a promulgar, ni a cobrar, ni a duplicar.

**Nota:** `abenomics` define además `effectsJson.treasury: -1.000M`, que ningún código aplica.
Se deja como dato muerto a propósito: su `cost` (1.000M) ya se cobra como costo único, y
aplicar también ese efecto lo contaría dos veces.

**Verificación:** tests en `tests/engine/cost-scale.test.ts` y prueba de punta a punta contra
Postgres 16 real con dos partidas idénticas (control vs. ley aprobada): la diferencia de tesoro
coincide exactamente con el costo escalado (gasto de 800M, ingreso de 3.200M a 80M, 0 para leyes
con costo mensual o sin costo), el snapshot persistido lo refleja y la re-aprobación no duplica.

---

## 8. ~~Déficit estructural desde el primer turno~~ — RESUELTO

**Problema original:** los 8 ministerios iniciales sumaban exactamente 100% del ingreso, así que
cualquier gasto fijo (la Contraloría sembrada pesa el 6,7% del ingreso en todos los presets, más los
sueldos) producía déficit desde el turno 1: −75M a −240M al mes según el preset, con tesoros de
500M a 8.000M (el preset `crisis_economica`, con 500M, se quedaba sin fondos en ~5 meses sin tocar
nada). Además la UI definía "Restante" y "Déficit" contra el 100% de los ministerios e ignoraba los
gastos fijos, así que el 100% que mostraba no era el equilibrio real.

**Solución:**
- `initialMinistryBudgetTotal(población, funcionarios)` (`game-factory.ts`) calcula la suma de los
  presupuestos iniciales como `100% − gastos fijos de arranque / ingreso` (93,3% en todos los presets,
  porque la Contraloría escala con la población) y `generateMinistries(total)` reparte ese total entre
  los 8 ministerios en décimas, por el método del mayor resto y con los mismos pesos relativos. Se
  redondea hacia abajo, así que el balance inicial es 0 o un superávit de menos de 0,1% del ingreso.
- `calculateCommittedSpending[Percent]` (`economy.ts`): gasto comprometido fuera de los ministerios
  (salarios, organismos, leyes, sub-decisiones, obras y programas en curso, importaciones activas).
  `calculateExpenses` se refactorizó para exponer ese gasto fijo sin cambiar su resultado.
- UI (`budget-slider.tsx`, `ministerios/page.tsx`): "Restante" y "Déficit" se miden contra
  `100% − gastos fijos`, y se muestra el porcentaje de gastos fijos comprometidos.
- `BALANCE.INITIAL_COMPTROLLER_BUDGET` y `BALANCE.ACTIVE_POPULATION_SHARE` sustituyen dos literales.

**Efectos a tener en cuenta:**
- Solo afecta a partidas **nuevas**: los presupuestos de las existentes están persistidos y siguen
  sumando 100% (con la UI corregida ahora ven su déficit real).
- Al bajar cada presupuesto ~6,7%, los indicadores de arranque se mueven menos de 1 punto (pobreza
  +0,8, crimen +0,9, educación −0,6, seguridad alimentaria −0,5, desempleo +0,3) y la inflación baja
  de 0,33 a 0,20 porque desaparece el déficit. El PIB no cambia (depende de la eficiencia).
- La holgura fiscal inicial es 0 por diseño: cualquier gasto nuevo (ley, programa, obra, organismo)
  genera déficit salvo que el jugador recorte ministerios. Los gastos fijos que el jugador añada
  después se reflejan solos en la UI.

**Verificación:** 30 tests (reparto exacto, balance inicial ≥ 0 y < 0,1% para cada preset y 30–60
funcionarios, gasto comprometido; con mutación comprobada); prueba contra Postgres 16 real con los 4
presets (balance +0,02–0,03% del ingreso, variación del tesoro del primer turno de +0,2M a +1,0M en
vez de −75M a −240M) y prueba en navegador (barra "93,3% + 6,7% gastos fijos" sin aviso de déficit;
al subir Economía +8 aparece "Déficit: 8,2%").

---

## 9. ~~`subDecisionChanges` se acepta sin validar~~ — RESUELTO

**Problema original:** `processTurn` (PASO 1b) escribía cualquier clave y valor del cliente en
`ministry.subDecisions`, y `budgetAdjustments` con `NaN` dejaba el presupuesto en `NaN` (`Math.max/min`
propagan `NaN`) y contaminaba el tesoro de esa partida.

**Solución:**
- `engine/sub-decisions.ts` define las sub-decisiones válidas de cada ministerio con su tipo y rango
  (`SUB_DECISION_SPECS`), tomados de los que ofrece la UI. El motor acepta solo claves conocidas del
  ministerio con el tipo correcto, **acota** los números al rango y rechaza lo demás (claves
  inventadas o heredadas como `constructor`/`__proto__`, tipos incorrectos, `NaN`/`Infinity`,
  ministerios desconocidos). Cada rechazo llega al jugador como aviso "Sub-decisión rechazada".
- Los tres numéricos que la UI dejaba sin tope (salario mínimo, tropas activas, jueces y fiscales)
  tienen ahora un techo holgado (10.000 / 2.000.000 / 50.000, muy por encima de los valores
  iniciales). Es un valor de diseño arbitrario y se cambia en un solo sitio. La UI toma su rango del
  motor y acota lo que se escribe a mano.
- `budgetAdjustments` rechaza valores no numéricos o no finitos con aviso (antes un `NaN` pasaba).
- Un test lee `sub-decisions.tsx` y falla si algún control de la UI no coincide con los specs
  (tipo, mínimo, máximo, paso) o si falta alguno, para que no se desalineen.

**Verificación:** 44 tests nuevos (unitarios, de `processTurn` y de consistencia UI/motor, con
mutación comprobada).

---

## 10. ~~Las sub-decisiones no afectan a la simulación~~ — RESUELTO (propuesta de balance)

**Problema original:** ninguna fórmula del motor leía `subDecisions`; mover "Dureza penal" o
"Tasa de interés" no cambiaba nada, contra `SPEC.md:270`.

**Solución:** `engine/sub-decision-effects.ts` aplica la tabla `SUB_DECISION_EFFECTS` (`balance.ts`):
cada sub-decisión es un efecto lineal respecto de su valor sembrado sobre indicadores, aprobación por
clase y costo mensual (detalle, fórmula y tabla completa en `BALANCE.md`). Con los valores iniciales el
efecto es 0, así que una partida nueva no cambia. Los grupos que el SPEC define como "suma 100"
(etapas de educación, prioridades sociales) se normalizan, lo que además cierra el hueco de que fueran
sliders independientes. La UI muestra bajo los sliders el efecto de la configuración actual.

**Los coeficientes son una propuesta mía, no una decisión del SPEC** (que solo dice que modifican
"los indicadores correspondientes"). Se eligieron con magnitudes moderadas (un extremo mueve el
indicador principal ~1–3 puntos) y se ajustan en un solo sitio; `SUBDECISION_EFFECT_SCALE` los
atenúa o desactiva todos a la vez. Conviene que el diseñador los revise.

**No cubierto:**
- Solapes con otros sistemas, sin deduplicar: `vacunacion`/`saludMental` con los programas de
  Salud-3A, `servicioMilitar` con la ley `servicio-militar-obligatorio` y `becas` con `becas-merito`.
  Los efectos se suman.
- No hay efecto sobre las métricas de régimen (`regime.ts`) ni sobre eventos o fin de partida;
  Defensa solo toca empleo, crimen, aprobación y costo.
- Las decisiones aplican el mismo mes (los indicadores se recalculan de cero cada turno); no hay
  inercia ni demora.
- Los números de inflación y corrupción mensual del motor son pequeños, así que esos canales pesan poco.

**Verificación:** 33 tests de la tabla y de las fórmulas (con mutación comprobada) y 4 de `processTurn`;
prueba en navegador real (Playwright + Postgres): sin cambios al iniciar, efectos visibles al mover el
salario mínimo, valor escrito a mano acotado a 10.000 y turno avanzado con la decisión persistida.
