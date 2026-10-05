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

## 5. ~~Colapso hospitalario saturado siempre (calibración)~~ — RESUELTO

**Problema original:** `detectHospitalCollapse` comparaba `población_región × sickRate% × 8%` con las camas
de la región. Con `sickRate ≈ 40%` (incluye crónicas y salud mental) la saturación era de 50× a 1.600×
el umbral (`COLLAPSE_SATURATION_THRESHOLD` = 1,5), capada en severidad 100, y las camas de los presets
no escalaban con la población. El evento `HOSPITAL_COLLAPSE` se disparaba sin parar en cualquier partida
(medido antes del cambio: 5–6 colapsos en 8 meses en los 4 presets) con su penalización de aprobación y
de mortalidad, sin responder a las decisiones del jugador.

**Solución:**
- `engine/hospital-capacity.ts` (nuevo) centraliza `regionBeds`, `regionBedDemand` y `regionSaturation`.
  El detector de colapso y la mortalidad por saturación (`calculateNationalSaturationMortality`) usan las
  mismas funciones, de modo que ya no pueden desalinearse.
- Demanda = población de la región × `sickRate%` × `BALANCE.HOSPITALIZATION_SHARE` (0,0005). Las camas
  están en "unidades de juego" (~160× menos que las reales), así que la fracción hospitalizada es una
  unidad abstracta calibrada con `sickRate ≈ 49%` (valor 0,00042; la primera versión usaba 41 % → 0,0005, que no era
  el sickRate real de una partida nueva, ver #11): red inicial estable 0,3–1,2; pobre/crisis 1,4–3,2 en
  regiones rurales; post-conflicto hasta 10.
- Las camas, establecimientos y costo operativo de cada preset se escalan con la población
  (`scaleHealthNetwork`, referencia 10M `HEALTH_NETWORK_REFERENCE_POPULATION`), igual que los demás
  costos (#4). Construir un hospital añade camas escaladas por la misma razón.

**Verificación (Postgres real, 4 presets × 12 turnos, tras corregir #11):** colapsos 0/6/6/9 (estable/pobre/
crisis/post-conflicto): las regiones rurales de los presets pobres siguen saturadas por diseño y el jugador las
alivia construyendo hospitales. Antes del cambio eran 6/6/6/5 en solo 8 turnos. 24 tests nuevos o reescritos (módulo, escalado, calibración por
preset, colapso estable = 0 en 12 meses y post-conflicto sí colapsa, construir hospitales alivia).

**Limitaciones:**
- Las partidas ya creadas conservan sus camas sembradas sin escalar (no hay backfill), por lo que
  seguirán más saturadas que las nuevas.
- `HOSPITALIZATION_SHARE` es una calibración de diseño, no un dato real.
- El hallazgo de que el `sickRate` partía en ~4 % y subía ~3 pts/mes (preexistente) se corrigió en #11.

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
- ~~Solapes con otros sistemas (`vacunacion`/`saludMental` con los programas de Salud-3A, `servicioMilitar`
  con la ley `servicio-militar-obligatorio` y `becas` con `becas-merito`): los efectos se sumaban.~~
  Resuelto en #12.
- No hay efecto sobre las métricas de régimen (`regime.ts`) ni sobre eventos o fin de partida;
  Defensa solo toca empleo, crimen, aprobación y costo.
- Las decisiones aplican el mismo mes (los indicadores se recalculan de cero cada turno); no hay
  inercia ni demora.
- Los números de inflación y corrupción mensual del motor son pequeños, así que esos canales pesan poco.

**Verificación:** 33 tests de la tabla y de las fórmulas (con mutación comprobada) y 4 de `processTurn`;
prueba en navegador real (Playwright + Postgres): sin cambios al iniciar, efectos visibles al mover el
salario mínimo, valor escrito a mano acotado a 10.000 y turno avanzado con la decisión persistida.

---

## 11. ~~Epidemiología: rampa del sickRate y sickRate insensible a la política de Salud~~ — RESUELTO

**Problema original** (hallado midiendo el #5, preexistente):
- Las prevalencias de las 14 enfermedades se sembraban en 0. El `sickRate` arrancaba en ~4 % y subía ~3 pts/mes
  (la recuperación mueve 0,2–0,4 pp/mes por enfermedad hacia su objetivo, la hipertensión tardaba ~70 meses), y
  la esperanza de vida caía ~1 año por mes (estable: 77,0 → 70,7 en 8 meses).
- El objetivo de esa recuperación era `base + contagio` e ignoraba la eficiencia de Salud: el equilibrio quedaba en
  ≈61 % con cualquier política (61,3 % con eficiencia 20; 60,4 % con 100), contra SPEC.md ("función de
  Salud.eficiencia"). La fórmula que sí usa la eficiencia (`calculateDiseasePrevalence`) solo se ejecutaba si no
  había prevalencias.
- `LE_SICK_FACTOR` (0,28) estaba calibrado con sickRate ≈ 20 % (BALANCE.md decía que la esperanza de vida no
  usaba sickRate, pero el código sí): con 45–60 % restaba 13–17 años.

**Solución:**
- `diseaseTargetPrevalence` (`engine/diseases.ts`) es el único objetivo de prevalencia: siembra, recuperación
  mensual y mínimos de los programas lo usan. `calculateDiseasePrevalence` delega en él.
- Las prevalencias se siembran en el equilibrio con eficiencia 55 (`initialDiseasePrevalence`,
  `DISEASE_SEED_HEALTH_EFFICIENCY`) tanto al crear partidas como al reponer enfermedades faltantes
  (`ensureSeedIntegrity`).
- Los programas miden su mínimo sobre el equilibrio (antes sobre `prevalenceBase`; con la eficiencia ya incluida en
  el equilibrio, la prevención habría quedado sin efecto).
- `LE_SICK_FACTOR` 0,28 → 0,12 (penalización ≈ 5,6–5,8 años en una partida normal, como la calibración original).
- `HOSPITALIZATION_SHARE` 0,0005 → 0,00042 (ver #5): se había calibrado con un sickRate de 41 % que no era el real.

**Verificación (Postgres real, 4 presets × 12–24 turnos):** sickRate plano ≈ 46–51 % desde el mes 1 (antes 4 % →
26 % en 8 meses); esperanza de vida 74 / 70 / 71 / 69 años al mes 1 y estable después (antes 77 → 71 en 8 meses
por la rampa). Tests nuevos con mutación comprobada (siembra en 0, objetivo sin eficiencia).

**Limitaciones:**
- Las partidas ya creadas conservan sus prevalencias actuales: seguirán convergiendo, ahora hacia el nuevo (menor)
  equilibrio, a 0,2–0,4 pp/mes. No se les hace backfill.
- La eficiencia de Salud solo mueve la prevalencia a 0,2–0,4 pp/mes por enfermedad: un cambio de política tarda meses
  en notarse en el sickRate (diseño existente, no cambiado).
- La esperanza de vida sigue bajando levemente con el tiempo (≈0,1–0,4 años en 12 meses) por otros indicadores (pobreza,
  crimen), no por epidemiología. Investigado en #14.

---

## 12. ~~Sub-decisiones que solapan con programas y leyes~~ — RESUELTO (propuesta de balance)

**Problema original** (anotado en el #10): cuatro sub-decisiones del SPEC modelan lo mismo que un programa de
Salud-3A o una ley, y sus efectos se sumaban: con un programa de salud mental activo el interruptor
`saludMental` volvía a restar enfermos, sumar aprobación y cobrar costo; con la ley de Servicio Militar
Obligatorio el interruptor repetía su golpe de aprobación; lo mismo con `vacunacion` y `becas`.

**Solución:** regla "lo específico reemplaza a lo genérico". `SUB_DECISION_OVERLAPS` (`balance.ts`) declara, para cada
par, qué programa o ley lo reemplaza y qué canales se anulan mientras esté activo (`engine/sub-decision-effects.ts`):

| Sub-decisión | Reemplazo | Se anula |
|---|---|---|
| Salud · `saludMental` | programa `MENTAL_HEALTH_PROGRAM` activo | indicadores, aprobación y costo |
| Salud · `vacunacion` | programa `VACCINATION_CAMPAIGN` activo (cualquiera) | indicadores, aprobación y costo |
| Educación · `becas` | ley `becas-merito` vigente | indicadores, aprobación y costo |
| Defensa · `servicioMilitar` | ley `servicio-militar-obligatorio` vigente | solo la aprobación |

El servicio militar anula solo la aprobación porque la ley no modela empleo ni crimen (`defenseEfficiency` no lo lee
ningún cálculo) y su costo es otro (la ley es un pago único, el interruptor son cuarteles mensuales). `subDecisionDeltas`
recibe ahora el contexto (programas y leyes del estado) en los tres enganches (indicadores, gasto/PIB y aprobación) y la
UI avisa bajo los sliders cuando una sub-decisión no suma efecto propio por este motivo. Un programa CANCELLED o una ley
no vigente no anulan nada, y con el valor sembrado no hay efecto que anular.

**Es una propuesta de diseño**, no del SPEC. Se ajusta en una sola tabla. Conviene que el diseñador la revise, sobre todo
que una campaña de una sola enfermedad anule también el castigo de apagar la vacunación general.

**Verificación:** 21 tests nuevos (integridad de la tabla contra el catálogo de leyes y la tabla de efectos, lógica,
enganches en `calculateHealthRegional`/`calculateEducation`/`calculateExpenses`/`calculateApprovalByClass`) con mutación
comprobada (quitar el contexto de aprobación o de gasto, o ignorar `suppress`). **No lo he probado en navegador:** el
aviso de la UI es JSX trivial y solo se comprobó con `tsc` y `next build`.

**No cubierto:** no hay solape declarado entre `PREVENTION_EDUCATION` y `vacunacion` (la prevención también baja
transmisibles), ni entre otras sub-decisiones y leyes de efecto parecido (p. ej. `salario mínimo`); se deja a juicio del diseñador.

---

## 13. ~~BALANCE.md desactualizado respecto del código~~ — RESUELTO

**Problema original:** el documento llevaba valores y fórmulas de sesiones antiguas: inflación (2,5 / 0,3 en vez de 0,2 /
0,02), pobreza, desempleo y alimentación (factores y bases), corrupción base (0,5 en vez de 1,5) y las fórmulas de régimen,
golpe de estado y pérdida electoral. Las fórmulas hablaban de "eficiencia" cuando el código usa el **impacto**
(`eficiencia × (1 − e^(−presupuesto%/12))`).

**Solución:** se revisaron contra el código todas las secciones de indicadores, aprobación, corrupción, régimen y fin de
partida, y se reescribieron. Un test (`tests/balance-doc.test.ts`) compara cada constante citada como `` `NOMBRE` (valor) ``
con `balance.ts` y falla si se desalinean (comprobado con mutación).

**Divergencia con el SPEC (resuelta actualizando el SPEC):** el SPEC pedía "fin de mandatos máximos" y que la pérdida
electoral dependiera de "aprobación baja", y describía el golpe con umbrales fijos. El código eliminó el límite de mandatos
(las elecciones siguen cada 5 años mientras se gane), decide la elección por el % de votos de las clases (< 50 % pierde) y
calcula el golpe con un riesgo ponderado. Por decisión del diseñador se actualizó el SPEC (§9) a este comportamiento.

---

## 14. Deriva lenta de la esperanza de vida — causa identificada, se deja como diseño

**Qué se midió** (Postgres real, 4 presets × 36 turnos sin intervención del jugador): la esperanza de vida baja
≈0,1–0,4 años por año (p. ej. estable 72,5 → 71,9, pobre 70,8 → 69,9 en 36 meses).

**Causa:** no es la fórmula de la esperanza de vida ni la epidemiología (sickRate plano ≈46–48 %). Es la corrupción:
- Cada funcionario suma `CORRUPTION_BASE_INCREASE` (1,5) al mes y la única reducción sembrada es la Contraloría con
  efectividad 40 y autonomía 70: `3 × 40/100 = 1,2` (el bono de +1 por autonomía exige `> 70` y la sembrada vale 70).
  Neto: **+0,3 puntos/mes por funcionario**, medido: corrupción global 6,1 → 13–15 en 30 meses en el preset estable.
- La corrupción del ministro baja la eficiencia de su ministerio (≈ −0,2 puntos/mes: Salud 66 → 60, Economía 60 → 56 …) y
  con ella el impacto de cada ministerio en pobreza, desempleo, crimen, alimentación y PIB per cápita (todos empeoran
  despacio: en el preset estable la pobreza sube 1,1 puntos y el PIB per cápita baja ≈4 % en 36 meses). Esos indicadores restan a la esperanza de vida (`LE_CRIME/POVERTY/FOOD/GDP_FACTOR`).
- En los presets pobres la corrupción se estabiliza (~27–29) y la deriva sale de la misma cadena con otro punto de partida.

**Es dinámica coherente con el SPEC §4.4** (la corrupción crece sin vigilancia y se combate con organismos, leyes y
casos judiciales), no un artefacto numérico. Lo frágil es que el signo dependa de un umbral (`autonomía > 70` con
autonomía sembrada 70, efectividad 40 vs 50 que daría neto 0). **Decisión del diseñador: dejarlo como está** (el gobierno que no
hace nada se degrada despacio; se combate con organismos, leyes y casos judiciales). Alternativas descartadas por ahora: subir la
efectividad sembrada de la Contraloría a ~50 (neto 0) o hacer gradual el bono de autonomía.

**Otros hallazgos del mismo barrido (no investigados a fondo, sin cambios):**
- Un desastre cuesta `severidad × población × 2` USD: en el preset estable (tesoro 8 B) uno de severidad 52 se llevó 5,2 B; en
  los presets pobres (tesoro 0,5–2 B) uno de severidad 31 deja el tesoro en ≈0, y como el balance sembrado es ≈ +0,03 % del
  ingreso (#8) el tesoro tarda años en recuperarse. Escala bien con la población; lo que descuadra es tesoro inicial vs
  ingreso mensual.
- Los eventos de protesta suben el crimen de golpe (`severidad × 0,5` puntos): con severidad 100 el crimen del mes llegó a 88.

