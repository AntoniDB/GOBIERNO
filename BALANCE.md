# BALANCE.md — Formulas del motor y donde ajustarlas

Todas las constantes de balance estan centralizadas en `src/lib/balance.ts`. Para ajustar la simulacion, modifica los valores en ese archivo.

---

## Indicadores sociales

Todos los indicadores se recalculan desde cero cada turno. Donde abajo dice **impacto** de un ministerio
se refiere a `indicators.ts:getMinistryImpact`:

```
impacto = eficiencia × (1 − e^(−presupuesto% / 12))      // 0 si el presupuesto es 0; sin ministerio: 25
```

A cada fórmula se le suman además los efectos de las leyes activas (`effectsJson.<indicador>`) y de las
sub-decisiones (ver "Sub-decisiones de ministerio").

### Pobreza (`indicators.ts:calculatePoverty`)
```
pobreza = POVERTY_SOCIAL_DEV_FACTOR * impactoDesarrolloSocial
        + POVERTY_UNEMPLOYMENT_FACTOR * desempleo
        + POVERTY_INFLATION_FACTOR * inflacion
        + POVERTY_BASE
          (clamped a [0, 100])
```
- `POVERTY_SOCIAL_DEV_FACTOR` (-0.5): mas impacto de Desarrollo Social → menos pobreza
- `POVERTY_UNEMPLOYMENT_FACTOR` (0.5): mas desempleo → mas pobreza
- `POVERTY_INFLATION_FACTOR` (0.3): mas inflacion → mas pobreza
- `POVERTY_BASE` (43)

### Desempleo (`indicators.ts:calculateUnemployment`)
```
desempleo = UNEMPLOYMENT_ECONOMY_FACTOR * impactoEconomia + UNEMPLOYMENT_BASE
           (clamped a [2, 50])
```
- `UNEMPLOYMENT_ECONOMY_FACTOR` (-0.26): mas impacto economico → menos desempleo
- `UNEMPLOYMENT_BASE` (25)

### Salud / Enfermos (`indicators.ts:calculateHealthRegional`)
```
// Modo con catalogo de enfermedades (Sesion Salud-2):
sickRate = 1 − Π(1 − prevalence_i)   // probabilidad de union sobre 14 enfermedades
diseaseMortality = Σ(prevalence_i × mortalityRate_i)  // aditiva, para el motor

// Fallback sin enfermedades (modo anterior):
enfermos = SICK_HEALTH_FACTOR * impactoSalud + SICK_BASE
           (clamped a [0, 50])
```
- **Cambio en Salud-2**: el sickRate paso de ~20% (modelo antiguo, solo agudos) a ~40% (modelo Π con 14 enfermedades incluyendo cronicas y salud mental). Esto es epidemiológicamente correcto: ~40-50% de la poblacion tiene al menos 1 condicion de salud en cualquier pais. Los thresholds del dashboard se recalibraron: verde ≤25%, amarillo 25-45%, rojo >45%.
- `SICK_HEALTH_FACTOR` (-0.34) y `SICK_BASE` (28): mas impacto de Salud → menos enfermos (solo modo fallback)
- `LE_DISEASE_FACTOR` (0.04): impacto de mortalidad por enfermedades en esperanza de vida (nuevo en Salud-2)
- `LE_SATURATION_FACTOR` (0.10): impacto de saturacion hospitalaria en esperanza de vida (nuevo en Salud-2)
- La esperanza de vida resta `LE_SICK_FACTOR × sickRate` (0,12; era 0,28, ver Issue 11) y, además, un término
  muy pequeño de `diseaseMortality` (≈0,03 años). *(Esta línea decía antes que usaba solo `diseaseMortality`;
  no era cierto.)*
- Ver `diseases.ts` para el calculo completo de prevalencia por enfermedad y "Epidemiología (Issue 11)" abajo.

### Seguridad alimentaria (`indicators.ts:calculateFoodSecurity`)
```
alimentacion = FOOD_AGRICULTURE_FACTOR * impactoAgricultura + FOOD_BASE
                (clamped a [0, 100])
```
- `FOOD_AGRICULTURE_FACTOR` (0.35): mas impacto de Agricultura → mas seguridad alimentaria
- `FOOD_BASE` (54)

### Crimen (`indicators.ts:calculateCrime`)
```
crimen = CRIME_SECURITY_FACTOR * impactoSeguridad
       + CRIME_POVERTY_FACTOR * pobreza
       + CRIME_UNEMPLOYMENT_FACTOR * desempleo
       + CRIME_BASE
         (clamped a [0, 100])
```
- `CRIME_SECURITY_FACTOR` (-0.35): mas impacto de Seguridad → menos crimen
- `CRIME_BASE` (29)
- `CRIME_POVERTY_FACTOR` (0.3): mas pobreza → mas crimen
- `CRIME_UNEMPLOYMENT_FACTOR` (0.4): mas desempleo → mas crimen

### Educacion (`indicators.ts:calculateEducation`)
```
educacion = EDUCATION_EDU_FACTOR * impactoEducacion + EDUCATION_BASE
```

### Inflacion (`monetary.ts:calculateInflation`)
Inflación **anual** (%) con memoria; se calcula una vez por mes (paso 8 del turno) y los demás
indicadores la leen del estado. Detalle en "Política monetaria (Economía, Fase 2)".
```
inflación = anterior + INFLATION_ADJUST × credibilidad × (equilibrio − anterior)
equilibrio = INFLATION_TARGET + presiones × (1 + INFLATION_CRED_AMPLIFIER × (1 − credibilidad))
```
- `INFLATION_CRISIS_THRESHOLD` (15): por encima, penalización de aprobación de todas las clases.
- Los presets arrancan con su inflación (2,5 / 6 / 18 / 10) y desde ahí convergen a la meta.

---

## Aprobacion (`approval.ts:calculateApprovalByClass`)

La aprobación tiene **inercia** (`smoothApproval`, paso 13 del turno): `calculateApprovalByClass` da la aprobación
*objetivo* del mes (lo que dicen hoy las condiciones) y la de cada clase se acerca a ella:

```
aprobación(t) = aprobación(t−1) + APPROVAL_INERTIA × (objetivo − aprobación(t−1))
```

- `APPROVAL_INERTIA` (0.35): un mes malo aislado baja la aprobación ~1/3 de lo que cayó el objetivo y se recupera en pocos
  meses; una situación sostenida la arrastra (≈90 % del camino en 5 meses).
- La aprobación guardada de cada clase (`SocialClass.approval`) es la única que se usa: el panel, el snapshot, el fin de partida
  (golpe, renuncia, asesinato, estado fallido), las elecciones (votos = aprobación vigente de cada clase × su población), los eventos
  y las mociones del Congreso. `currentApproval` = promedio ponderado de esas aprobaciones. Antes el fin de partida la recalculaba
  con TODOS los eventos históricos y sin memoria, distinta de la que ve el jugador.
- El impacto de las coberturas de medios (paso 12b) se suma a la aprobación previa antes de acercarla al objetivo, así que se
  disipa en unos meses (antes se perdía: el paso 13 lo sobrescribía).
- Prueba e2e con mala gestión sostenida (presupuestos al 2 %, corrupción 85): el juego sí termina en golpe, en pocos meses.

Aprobación objetivo:

```
objetivo = APPROVAL_BASE (50)
           + efectos de leyes activas
           + efectos de sub-decisiones (por clase)
           - impacto de eventos negativos del mes (Σ puntos del evento * classMultiplier, con puntos = effectsApplied.approvalPenalty
             o, si no lo declara, severidad * APPROVAL_EVENT_WEIGHT;
             máx. APPROVAL_EVENT_MAX_PENALTY); los no negativos suman APPROVAL_EVENT_POSITIVE_FACTOR de eso
             (máx. APPROVAL_EVENT_MAX_BONUS)
           - (pobreza − 30) * APPROVAL_INDICATOR_WEIGHT si pobreza > 30% y clase es POBREZA/EXTREMA_POBREZA
           - (inflacion − INFLATION_CRISIS_THRESHOLD) * APPROVAL_INDICATOR_WEIGHT si supera el umbral
           - corrupcion promedio de funcionarios * APPROVAL_CORRUPTION_WEIGHT
           (clamped [0, 100])
```
- `APPROVAL_BASE` (50): punto de partida
- `APPROVAL_EVENT_WEIGHT` (0.2): puntos de aprobación por punto de severidad (antes había además un ×10 oculto:
  una protesta de severidad 36 quitaba 58 puntos a la clase pobre y un desastre moderado causaba un golpe)
- `APPROVAL_EVENT_POSITIVE_FACTOR` (0.5): fracción que suman los eventos positivos
- `APPROVAL_EVENT_MAX_PENALTY` (25) y `APPROVAL_EVENT_MAX_BONUS` (10): tope mensual de los eventos por clase
- Negativos: epidemia, escándalo, protesta, ola de crimen, golpe, desastre, crisis económica, brote de enfermedad,
  colapso hospitalario, escasez de medicamentos, mala praxis y filtración. Positivos: avance médico, descubrimiento y otros
- `APPROVAL_INDICATOR_WEIGHT` (0.3): peso de pobreza/inflacion en aprobacion
- `APPROVAL_CORRUPTION_WEIGHT` (0.2): penalizacion por corrupcion

**Impacto de eventos por clase** (`EVENT_CLASS_IMPACT`):
| Evento | EXTREMA_POBREZA | POBREZA | MEDIA | ELITE |
|--------|-----------------|---------|-------|-------|
| EPIDEMIC | 1.5 | 1.3 | 0.7 | 0.3 |
| PROTEST | 1.6 | 1.6 | 0.6 | 0.2 |
| SCANDAL | 0.4 | 0.5 | 1.2 | 1.3 |
| CRIME_SURGE | 0.5 | 0.8 | 1.3 | 0.7 |
| COUP_ATTEMPT | 0.3 | 0.5 | 1.3 | 1.4 |
| DISASTER | 1.5 | 1.3 | 0.7 | 0.3 |
| ECONOMIC_CRISIS | 0.7 | 1.0 | 1.4 | 0.6 |
| DISEASE_OUTBREAK | 1.5 | 1.3 | 0.7 | 0.3 |
| HOSPITAL_COLLAPSE | 1.5 | 1.3 | 0.8 | 0.3 |
| MEDICATION_SHORTAGE | 1.3 | 1.2 | 0.9 | 0.4 |
| MALPRACTICE_SCANDAL, LEAK | 0.4 | 0.5 | 1.2 | 1.3 |

Un tipo que no está en la tabla pesa 1.0 en todas las clases.

---

## Corrupcion (`corruption.ts`)

### Corrupcion individual (`updateOfficialCorruption`)
```
deltaCorrupcion = CORRUPTION_BASE_INCREASE (1.5)
                + (presupuesto% − 20) * CORRUPTION_BUDGET_FACTOR (0.1)   // solo si el ministerio supera el 20 %
                - Contraloria: COMPTROLLER_CORRUPTION_REDUCTION (3) * efectividad/100
                  (+1 con autonomia > 70, −0,5 con autonomia < 30)
                - Fiscalia Anticorrupcion: ANTICORRUPTION_CORRUPTION_REDUCTION (2) * efectividad/100
                - CORRUPTION_DETERRENCE_BY_CASES (0.5) * casos judiciales abiertos
                - leyes anticorrupcion (effectsJson.corruption < 0) y sub-decisiones de Justicia
```
Resultado acotado a [0, 100].

### Corrupcion global (`calculateGlobalCorruption`)
```
promedio ponderado: role MINISTER peso=3, otros peso=1
```

---

## Regimen (`regime.ts`)

7 metricas (0-100): powerConcentration, pressFreedom, judicialIndependence, politicalPluralism, civilLiberties, transparency, militarySubordination.

Se mueven con acciones del jugador y se regeneran gradualmente (si no cambiaron ese turno) hacia su propio
baseline (`REGIME_BASELINE`: powerConcentration 30, pressFreedom 70, judicialIndependence 60, politicalPluralism 70,
civilLiberties 70, transparency 50, militarySubordination 60) a `REGIME_REGENERATION_RATE` (0,5) por mes.

Clasificacion (`regime.ts:classifyRegime`, en este orden; `avg` = promedio de las 7 metricas):
- Democracia plena: pressFreedom, judicialIndependence y politicalPluralism todas > `REGIME_FULL_DEMOCRACY` (70)
- Estado fallido: crimen > 80, corrupcion > 80, aprobacion < 15
- Dictadura: powerConcentration > 85 y avg < 20
- Democracia defectuosa: avg > `REGIME_DEFECTIVE_DEMOCRACY` (55)
- Regimen hibrido: avg > `REGIME_HYBRID` (35)
- Autoritarismo electoral: avg > `REGIME_AUTHORITARIAN` (20)
- Dictadura: avg ≤ 20

---

## Condiciones de fin de partida (`game-over.ts`)

| Condicion | Desencadenante |
|-----------|---------------|
| Estado fallido | crimen > 80, corrupcion > 80, aprobacion < 15 |
| Juicio politico | voto del Congreso (mocion) |
| Golpe de estado | riesgo > 50, con `riesgo = COUP_BASE_RISK (5) + 0,32·(100 − subordinacion militar) + 0,28·(100 − aprobacion) + 0,22·corrupcion − 0,15·impactoDefensa − 0,10·efectividadInteligencia` (constantes `COUP_*`, acotado a [0, 100]) |
| Renuncia forzada | aprobacion < 10 por 6 meses consecutivos |
| Perdida electoral | elecciones cada 5 anios: pierdes si el % de votos (aprobacion de cada clase ponderada por su poblacion) es < 50 % |
| Fin de mandato | **no existe** (decisión de diseño, SPEC §9): no hay límite de mandatos; las elecciones siguen cada 5 años mientras ganes |
| Asesinato | aprobacion < 15 + inteligencia con autonomia < 30 (prob. 3%/mes) |

---

## Donde ajustar

Para rebalancear la simulacion:

1. **Dificultad**: modifica `getPresetConfig` en `src/lib/game-factory.ts` (corrupcion inicial, frecuencia de eventos)
2. **Economia rapida/lenta**: `BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA`, `INFLATION_DEFICIT_FACTOR`
3. **Aprobacion reactiva**: `APPROVAL_*` en balance.ts
4. **Eventos frecuentes**: umbrales en `events.ts:triggerRandomEvents`
5. **Regimen fragil/resistente**: velocidad de regeneracion en `regime.ts:regenerateRegimeMetrics`
6. **Programas de Salud y medicos**: `PROGRAM_*`, `HOSPITAL_*`, `MEDICAL_*`, `MEDICS_*` en balance.ts

---

## Programas operativos de Salud (Sesion Salud-3A Capa D)

Los programas persistentes los activa el Ministro de Salud sin aprobacion del
Senado. El descuento mensual del tesoro es automatico (igual que las leyes
activas y las LRD). Ver `programs.ts` para el ciclo completo.

Para ajustar:
- **Costos**: `PROGRAM_VACCINATION_COST`, `PROGRAM_PREVENTION_COST`, `PROGRAM_MENTAL_HEALTH_COST`
- **Efectividad por mes** (puntos-porcentaje de prevalencia que baja):
  `VACCINATION_PREVALENCE_DECAY` (0.8), `PREVENTION_PREVALENCE_DECAY` (0.15),
  `MENTAL_HEALTH_PREVALENCE_DECAY` (0.5)
- **Minimo alcanzable** como fraccion de la prevalencia de equilibrio (`diseaseTargetPrevalence`, Issue 11):
  `VACCINATION_MIN_RATIO` (0.10), `PREVENTION_MIN_RATIO` (0.90),
  `MENTAL_HEALTH_MIN_RATIO` (0.20)
- **Recuperacion al desactivar** (pp/mes hacia el equilibrio):
  `VACCINATION_RECOVERY_RATE` (0.4), `PREVENTION_RECOVERY_RATE` (0.2),
  `MENTAL_HEALTH_RECOVERY_RATE` (0.3)
- **Bonus de aprobacion salud mental**: `MENTAL_HEALTH_APPROVAL_BONUS` — POVERTY +3/mes, MIDDLE +2/mes

### Sub-decisiones legacy

Las sub-decisiones booleanas `vacunacion` y `saludMental` del seed se mantienen
(el SPEC las pide). Mientras un programa equivalente esté activo, **dejan de aplicar su efecto**
para no contarlo dos veces (ver "Solapes" en Sub-decisiones de ministerio, Issue 12).

### Tipos 4 y 5 (construccion e investigacion) — LRD

Estos programas usan el sistema generico de Long-Running Decisions definido en
`long-running-decisions.ts`. No requieren el modelo `MinistryProgram`; son
LRD con `type=HOSPITAL_CONSTRUCTION` o `MEDICAL_RESEARCH`. La UI los lanza
desde el mismo modal (pestaña "Largo plazo").

- `HOSPITAL_COSTS` / `HOSPITAL_DURATIONS`: costo y duracion por nivel (primario/secundario/terciario)
- `HOSPITAL_BEDS_ADDED` / `HOSPITAL_FACILITIES_ADDED`: cuanto aumenta la region al completarse
- `MEDICAL_RESEARCH_COST` / `MEDICAL_RESEARCH_DURATION`: costo y duracion (48 meses)
- `MEDICAL_RESEARCH_MORTALITY_REDUCTION` (0.5): si la enf. ya tenia vacuna, reduce su mortalityRate a la mitad. Si no, desbloquea vacuna (hasVaccine=true).

---

## Produccion de profesionales medicos (Sesion Salud-3A Capa E)

Primera activacion real del sistema de Cross-Ministry Dependencies de Salud-1.

```
output_mensual = (edu.budget/100) × (edu.efficiency/100) × population × MEDICAL_PROFESSIONALS_FACTOR
demanda_mensual = Σ region.beds(level) × MEDICS_PER_BED
```

Calibrado: pais promedio (10M pop, edu 16%/60%, red 3.800 beds → demanda 760)
produce 912 medicos → superavit +20% (margen comodo). Educacion abandonada
(2%/20%) produce 38 → factor operativo floor (5%). Ver `medical-professionals.ts`.

Para ajustar:
- `MEDICAL_PROFESSIONALS_FACTOR` (0.00095): subir si quieres mas mdcs en promedio
- `MEDICS_PER_BED` (0.2): subir si la red demanda mas medicos por cama
- `MEDICS_SURPLUS_BONUS_CAP` (0.2): bonus maximo de coverage operativa por superavit
- `MEDICS_OPERATIONAL_FLOOR` (0.05): floor del factor operativo (nunca 0)

### Factor operativo vs eficiencia de gestion

El `calculateHospitalOperationalFactor` retorna un factor en
`[MEDICS_OPERATIONAL_FLOOR, 1.2]` que se aplica en `calculateRegionalCoverage`
para escalar la cobertura efectiva de los hospitales. **No** modifica
`ministry.efficiency` del ministerio HEALTH — esa sigue calculandose normalmente
en `calculateMinistryEfficiency` (gestion pura).

La curva de bonus por superavit es `1 - exp(-surplus/20)` (cap `MEDICS_SURPLUS_BONUS_CAP`),
reutilizando el patron del sistema generico `RESOURCE_TYPES` con `bonusX=20`.

### MINISTRY_RESOURCE_PROFILES (registro de perfiles)

El motor generico de Cross-Ministry (`calculateResourceFlows`) itera un
registro tipado en codigo (`MINISTRY_RESOURCE_PROFILES` en `resource-balance.ts`).
Cada ministerio declara que produce/consume y como (fixed o computed). Añadir
nuevas dependencias (Defensa-3, Economica-3, etc.) es añadir entradas a ese
registro, no reescribir el motor.

## Costos de leyes y organismos (Issue 3)

Los costos fijos en USD se escalan por población para pesar lo mismo respecto del ingreso
mensual (`ingreso = 45 × población`). Código: `engine/cost-scale.ts`.

```
costo = costoBase × población / referencia
```

| Familia | Referencia | Constante |
|---|---|---|
| Programas, hospitales, investigación (Salud-3A), contratación, compra de afinidad | 10M | `COST_REFERENCE_POPULATION` |
| Leyes y organismos (Contraloría sembrada, rango del slider) | 50M | `LAW_COST_REFERENCE_POPULATION` |

Leyes: `effectsJson.monthlyCost` se cobra cada mes; `cost` es un costo único al promulgar
(negativo = ingreso) y solo aplica a leyes sin `monthlyCost` (`lawCostProfile`).

Para ajustar: subir `LAW_COST_REFERENCE_POPULATION` abarata todas las leyes y organismos a la
vez (a 50M la ley mediana de 400M/mes pesa ≈18% del ingreso mensual y la más cara ≈40%).

Presupuesto de organismos creables: `ORGANISM_BUDGET_MIN/MAX` (50M–500M a la población de
referencia de leyes, escalado por población). El motor acota el valor pedido por el cliente
(`clampOrganismBudget`); un presupuesto negativo sumaría dinero cada mes.

## Capacidad hospitalaria y colapso (Issue 5)

Demanda de camas de una región (`engine/hospital-capacity.ts`):

```
demanda = población × %región × sickRate% × HOSPITALIZATION_SHARE
saturación = demanda / camas        (colapso si > COLLAPSE_SATURATION_THRESHOLD 3 meses seguidos)
```

- `HOSPITALIZATION_SHARE` (0,00042): las camas del juego son una unidad abstracta (~160× menos que las
  reales), así que esta fracción también lo es. Calibrada con `sickRate ≈ 49 %` (el de una partida nueva,
  Issue 11; era 0,0005 con un 41 % que no era el valor real): red inicial estable
  0,3–1,2; pobre/crisis 1,4–3,2 en regiones rurales; post-conflicto hasta 10. Subirla vuelve más
  frágil el sistema; bajarla lo relaja.
- La red sembrada (camas, establecimientos, costo operativo) se escala con la población, referencia
  `HEALTH_NETWORK_REFERENCE_POPULATION` (10M). Un hospital construido añade camas con el mismo escalado.
- El detector de colapso y la mortalidad por saturación (`min(2, (ratio−1)/3)`) usan las mismas funciones.

## Epidemiología (Issue 11)

Un único objetivo de prevalencia por enfermedad (`diseases.ts:diseaseTargetPrevalence`):

```
equilibrio = base × (1 − (eficiencia/100) × preventionSensitivity) + contagio
contagio   = contagionRate × (1 − eficiencia/100) × CONTAGION_MULTIPLIER   (solo transmisibles)
```

- **Siembra:** cada enfermedad nace en su equilibrio con `DISEASE_SEED_HEALTH_EFFICIENCY` (55, la eficiencia con
  que nacen los ministerios). Antes nacía en 0 y el sickRate subía ~3 pts/mes durante años (de ~4 % a ~61 %).
- **Recuperación mensual** (`programs.ts`): sin programa, la prevalencia tiende a ese equilibrio (0,2–0,4 pp/mes),
  de modo que la eficiencia de Salud mueve el sickRate (SPEC: "función de Salud.eficiencia"). Antes el objetivo era
  `base + contagio` y la eficiencia casi no importaba (≈61 % con cualquier política).
- **Programas:** su mínimo ahora se mide sobre el equilibrio (`MIN_RATIO × equilibrio`), no sobre `prevalenceBase`; con
  la base, la prevención (0,9 × base) no habría tenido efecto con eficiencia ≥ 20.
- sickRate de equilibrio del catálogo: eficiencia 20 → 57 %, 55 → ≈49 %, 80 → 41 %, 100 → 35 %.
- `LE_SICK_FACTOR` 0,28 → 0,12: el factor se calibró con sickRate ≈ 20 % (penalización ≈ 5,6 años); con 45–50 % restaba
  13–14 años. Con 0,12 la penalización de una partida normal es ≈ 5,8 años, y entre política mala y excelente varía ≈ 2,7 años.
- Para ajustar la dificultad sanitaria: `prevalenceBase` / `preventionSensitivity` (seed-catalogs.ts), `LE_SICK_FACTOR`,
  y `HOSPITALIZATION_SHARE` si cambia el sickRate típico.

## Sub-decisiones de ministerio (Issue 10)

SPEC 4.1: *"cada cambio en una sub-decisión modifica los indicadores correspondientes"*. Antes
eran decorativas (solo la UI las leía). Ahora cada una desplaza indicadores, aprobación por clase
y costo. **Es una propuesta de balance**: la fuente de verdad son `SUB_DECISION_EFFECTS` y
`BALANCE.SUBDECISION_EFFECT_SCALE` en `balance.ts` (esta tabla se generó de ahí); el cálculo está en
`engine/sub-decision-effects.ts`.

```
numérica:  efecto = coeficiente × (clamp(valor, rango) − neutral)
booleana:  efecto = coeficiente (completo) si el valor ≠ neutral, 0 si no
grupo:     valor_i = valor_i / Σ valores del grupo × 100        (suma 100, como pide el SPEC)
indicador = fórmula existente (ministerios, leyes...) + Σ efectos de sub-decisiones
costo     = Σ (coeficiente × unidades), escalado por población (COST_REFERENCE_POPULATION)
```

- **Neutral = valor sembrado** (`generateMinistries`; `hospitalesPublicos`, que no se siembra, usa 50):
  con los valores iniciales el efecto es exactamente 0, así que una partida nueva no cambia.
- Efectos **lineales y acotados** al rango: un valor extremo (o manipulado) no dispara un indicador.
  Un test fija que ningún extremo supera 6 puntos de indicador, 3 de aprobación ni el 10% del ingreso.
- Dónde se aplican: `indicators.ts` (pobreza, desempleo, enfermos, alimentación, crimen, educación,
  Gini, inflación), `economy.ts` (PIB en % y gasto), `approval.ts` (por clase) y `corruption.ts`
  (reducción mensual de corrupción). Hay efectos de segundo orden esperables: p. ej. más desempleo
  sube la pobreza (0,5) y el costo de una decisión amplía el déficit, que sube la inflación.
- Para que ninguna decisión domine, las de "más es mejor" llevan **costo** y las "X vs Y" un efecto
  contrario en otro indicador o clase.
- `BALANCE.SUBDECISION_EFFECT_SCALE` (1) multiplica indicadores y aprobación (no costos): 0 las
  desactiva, 0.5 las reduce a la mitad.

| Ministerio | Decisión | Neutral | Rango | Indicadores (por unidad) | Aprobación (por unidad) | Costo/mes a 10M (por unidad) |
|---|---|---|---|---|---|---|
| Salud | `hospitalesPublicos` | 50 | 0–100 | enfermos -0.03 | pob. extrema +0.03, pobreza +0.03, élite -0.02 | +40.000 |
| Salud | `vacunacion` | sí | al cambiar | enfermos +1.5 | pobreza -1, media -1 | -1.000.000 |
| Salud | `saludMental` | no | al cambiar | enfermos -1 | media +1, pobreza +0.5 | +1.000.000 |
| Educación | `primaria` | 40 | grupo etapas (suma 100) | educación +0.05, pobreza -0.02 | — | — |
| Educación | `secundaria` | 35 | grupo etapas (suma 100) | educación +0.03, desempleo -0.03 | — | — |
| Educación | `superior` | 25 | grupo etapas (suma 100) | educación +0.02, PIB % +0.08, Gini +0.02 | — | — |
| Educación | `enfoqueSTEM` | 60 | 0–100 | PIB % +0.04, desempleo -0.012, educación -0.015 | — | — |
| Educación | `becas` | sí | al cambiar | educación -1 | pob. extrema -1, pobreza -1.5, media -1 | -1.500.000 |
| Economía | `tasaInteres` | 4.5 | 1–20 | desempleo +0.1, PIB % -0.35 (inflación: ver política monetaria) | — | — |
| Economía | `salarioMinimo` | 350 | 100–1000 | pobreza -0.005, desempleo +0.004, inflación +0.0036 | pobreza +0.004, pob. extrema +0.003, élite -0.003 | — |
| Economía | `politicaIndustrial` | 50 | 0–100 | PIB % +0.03, desempleo +0.02, Gini +0.03 | pobreza -0.02, élite +0.02 | — |
| Economía | `iva` | 16 | 0–30 | pobreza +0.08, inflación +0.06 | pob. extrema -0.18, pobreza -0.18, media -0.09 | — (cambia la recaudación) |
| Economía | `impuestoRenta` | 25 | 0–50 | Gini -0.08, PIB % -0.03 | élite -0.12, media -0.04, pobreza +0.02 | — (cambia la recaudación) |
| Economía | `impuestoSociedades` | 25 | 0–45 | PIB % -0.08, desempleo +0.04 | élite -0.12 | — (cambia la recaudación) |
| Economía | `emisionMonetaria` | 0 | 0–30 | — (inflación: ver política monetaria) | media -0.02, élite -0.02 | — (entra al tesoro) |
| Defensa | `tropasActivas` | 50000 | 10000–200000 | desempleo -0.000008, crimen -0.000005 | élite +0.000008 | +150 |
| Defensa | `gastoEquipamiento` | 40 | 0–100 | crimen -0.01 | élite +0.02 | +50.000 |
| Defensa | `servicioMilitar` | no | al cambiar | desempleo -0.8, crimen -0.3 | pob. extrema -1.5, pobreza -2, media -2, élite +1 | +1.000.000 |
| Seguridad | `patrullajeUrbano` | 60 | 0–100 | crimen -0.02 | pob. extrema -0.02, élite +0.02 | — |
| Seguridad | `politicaDrogas` | 50 | 0–100 | crimen +0.012, enfermos -0.012 | pobreza +0.02, pob. extrema +0.02, élite -0.01, media -0.01 | — |
| Seguridad | `inversionCarceles` | 30 | 0–100 | crimen -0.015 | media +0.01 | +60.000 |
| Justicia | `juecesContratados` | 200 | 0–1000 | crimen -0.002, reducción corrupción +0.0005 | — | +10.000 |
| Justicia | `prioridadCorrupcion` | 60 | 0–100 | crimen +0.015, reducción corrupción +0.01 | media +0.02 | — |
| Justicia | `durezaPenal` | 50 | 0–100 | crimen -0.012 | élite +0.01, media +0.01, pobreza -0.02, pob. extrema -0.02 | +30.000 |
| Agricultura | `subsidioPequenoProductor` | 70 | 0–100 | seg. alimentaria +0.02, Gini -0.02, PIB % -0.01 | pob. extrema +0.02, pobreza +0.02, élite -0.02 | — |
| Agricultura | `infraestructuraRural` | 40 | 0–100 | seg. alimentaria +0.03, pobreza -0.01 | — | +40.000 |
| Desarrollo social | `focalizacion` | 60 | 0–100 | pobreza +0.015 | media +0.03, élite +0.01 | +50.000 |
| Desarrollo social | `prioridadNinos` | 40 | grupo prioridades (suma 100) | educación +0.015, pobreza -0.01 | media +0.01 | — |
| Desarrollo social | `prioridadAdultosMayores` | 35 | grupo prioridades (suma 100) | enfermos -0.01 | pobreza +0.02, pob. extrema +0.02 | — |
| Desarrollo social | `prioridadMujeres` | 25 | grupo prioridades (suma 100) | desempleo -0.01, Gini -0.015 | media +0.015 | — |

Unidades: "por unidad" es por punto del slider (o por USD / soldado / juez en las que no son 0–100);
las booleanas aplican el coeficiente completo al cambiar de valor. `inflación` y `reducción corrupción`
son pequeñas porque esas escalas del motor lo son (inflación ≈ 0,2–0,5; corrupción ±1–3 pts/mes).

### Solapes con programas y leyes (Issue 12)

Cuatro sub-decisiones modelan lo mismo que un programa de Salud-3A o una ley. Mientras el reemplazo esté
activo, la sub-decisión no aplica los canales indicados (`SUB_DECISION_OVERLAPS` en `balance.ts`):

| Sub-decisión | Reemplazo activo | Canales anulados |
|---|---|---|
| `saludMental` | programa `MENTAL_HEALTH_PROGRAM` | indicadores, aprobación, costo |
| `vacunacion` | cualquier programa `VACCINATION_CAMPAIGN` | indicadores, aprobación, costo |
| `becas` | ley `becas-merito` | indicadores, aprobación, costo |
| `servicioMilitar` | ley `servicio-militar-obligatorio` | solo aprobación (la ley no modela empleo/crimen ni el costo mensual) |

Un programa cancelado o una ley no vigente no anulan nada. La UI muestra un aviso bajo los sliders. Es una propuesta
de balance: para cambiar un caso se edita su fila de la tabla.

## Presupuesto inicial y equilibrio fiscal (Issue 8)

Los 8 ministerios reciben `% del ingreso` (`ingreso = 45 × población`). Fuera de ellos hay gasto
comprometido: Contraloría (`INITIAL_COMPTROLLER_BUDGET`, 6,7% del ingreso en cualquier país),
sueldos (`BASE_SALARY_PER_MINISTER` × funcionarios activos), leyes, sub-decisiones, obras, programas
e importaciones. Una partida nueva reparte `100% − gastos fijos de arranque` (93,3%) entre los
ministerios con los pesos 14/16/18/10/12/8/10/12, así que el primer mes cierra en equilibrio
(`initialMinistryBudgetTotal`, `generateMinistries(total)`). La UI mide "Restante"/"Déficit" contra
`100% − calculateCommittedSpendingPercent`.

Para ajustar: cambiar `INITIAL_COMPTROLLER_BUDGET` o `BASE_SALARY_PER_MINISTER` mueve la suma inicial
(el reparto se recalcula solo); los pesos relativos están en `generateMinistries`.

## Choques de eventos sobre los indicadores (Issue 25)

Los indicadores sociales se recalculan cada mes desde su fórmula (ministerios, leyes, sub-decisiones). Para que un evento deje huella,
suma un **choque** que se añade a la fórmula y se disipa solo (`engine/shocks.ts`):

```
indicador   = fórmula + choque                       desempleo, enfermos, crimen y seguridad alimentaria
choque(t+1) = choque(t) × EVENT_SHOCK_RETENTION + choques de los eventos del mes     (acotado a ±EVENT_SHOCK_MAX)
```

- `EVENT_SHOCK_RETENTION` (0.7): vida media ≈ 2 meses. `EVENT_SHOCK_MAX` (25): tope del choque acumulado, en puntos.
- Puntos de choque por punto de severidad: ola de criminalidad → crimen `EVENT_CRIME_SURGE_CRIME` (0.1); protesta → crimen `EVENT_PROTEST_CRIME` (0.03);
  desastre → alimentación `EVENT_DISASTER_FOOD` (−0.15); epidemia → enfermos `EVENT_EPIDEMIC_SICK` (0.1); crisis económica → desempleo
  `EVENT_ECONOMIC_CRISIS_UNEMPLOYMENT` (0.05). Ejemplos: ola de severidad 70 → +7 puntos de crimen (≈ +4,9 al mes siguiente); desastre de 60 → −9 de alimentación.
- Los efectos de segundo orden salen solos: el desempleo sube el crimen y la pobreza, la pobreza sube el crimen y la aprobación.
- Se guarda en `Game.indicatorShocks`; las partidas existentes empiezan sin choques. Los choques se disipan **al inicio** del turno (antes de
  calcular ingresos, eficiencias e indicadores), así que todos los pasos ven el mismo valor.

**Resto de los efectos de los eventos (Issue 26).** Cada evento declara sus efectos en `effectsApplied` y ahora todos tienen destino
(`events.ts:applyEventEffects` → `shocks.ts` / `event-effects.ts`); las magnitudes originales se reescalaron:

| Efecto declarado (evento) | Destino | Magnitud |
|---|---|---|
| `gdpPenalty` (crisis económica) | choque `gdpPct`: `calculateGDP` × (1 + choque/100); también baja la recaudación | −severidad × `GDP_CRISIS_PENALTY` (5) / 100 (−5 % a severidad 100) |
| `economicDisruption` (protesta) | choque `gdpPct` | −severidad × `EVENT_PROTEST_GDP` (0.01) |
| `infrastructureDamage` (desastre) | choque `gdpPct` (la producción se recupera mientras se reconstruye) | −severidad × `EVENT_DISASTER_GDP` (0.03) |
| `healthMinistryPenalty` (epidemia, hoy no se genera) | choque `healthEfficiency`: se resta a la eficiencia de Salud (paso 5) | severidad × `EVENT_EPIDEMIC_HEALTH_EFFICIENCY` (0.1) |
| `securityPressure` (ola de criminalidad) | choque `securityEfficiency`: se resta a la eficiencia de Seguridad (paso 5) | severidad × `EVENT_CRIME_SURGE_SECURITY_EFFICIENCY` (0.1) |
| `corruptionIncrease` (escándalo) | suma a la corrupción de cada funcionario activo (persiste; la reducen Contraloría y Fiscalía) | severidad × `EVENT_SCANDAL_CORRUPTION` (0.02) |
| `reputationDamage` (escándalo) | resta reputación a los `EVENT_SCANDAL_EXPOSED_OFFICIALS` (3) activos más corruptos | severidad × `EVENT_SCANDAL_REPUTATION` (0.1) |
| `militarySubordinationPenalty` (golpe) | `regimeMetrics.militarySubordination` (se mueve hacia su base con `REGIME_REGENERATION_RATE`) | −severidad × `EVENT_COUP_MILITARY_SUBORDINATION` (0.15) |
| `stabilityDamage` (golpe) | `regimeMetrics.civilLiberties` | −severidad × `EVENT_COUP_CIVIL_LIBERTIES` (0.1) |
| `approvalPenalty` (escándalo, protesta, golpe, colapso hospitalario, mala praxis) | aprobación (ver "Aprobacion") | −severidad × `APPROVAL_EVENT_WEIGHT`; el golpe × `EVENT_COUP_APPROVAL_MULT` (2) |

- Los eventos sin `approvalPenalty` (ola de criminalidad, desastre, crisis económica, eventos de mercado…) usan severidad × `APPROVAL_EVENT_WEIGHT`, igual que
  antes. Con esta escala común el golpe es el único cuyo impacto en la aprobación cambia (×2); colapso hospitalario y mala praxis conservan el suyo.
- La referencia fiscal del primer mes (`fiscalBaseReference`) se calcula sin el choque de PIB de un evento de ese mes.
- Prueba e2e (Postgres, crisis + golpe + escándalo forzados en un turno): PIB −5,3 % que se recupera (choque −5 → −0,84 en 5 meses); subordinación militar y libertades civiles
  bajan 6 y 4 puntos y siguen su regeneración; los choques se guardan en `Game.indicatorShocks`.

## Política monetaria (Economía, Fase 2)

Antes la inflación no tenía memoria: se recalculaba desde cero en cada llamada (≈0,2 "mensual"),
así que el 18 % de `crisis_economica` desaparecía en el primer mes, el shock de inflación de los
eventos se perdía y la crisis económica nunca se disparaba (comparaba la constante 0,2 con 15).
Ahora (`engine/monetary.ts`, paso 8 del turno) la inflación es **anual** y tiene inercia:

```
credibilidad = MONETARY_CRED_MIN sin Banco Central (o disuelto)
             = MIN + (MAX − MIN) × autonomía/100 × (0,5 + efectividad/200)   con Banco Central
presiones    = INFLATION_DEFICIT_FACTOR × déficit%           (gasto − recaudación, sobre la recaudación)
             + INFLATION_EMISSION_FACTOR × emisión%          (dinero emitido, sobre la recaudación)
             − INFLATION_RATE_FACTOR × (tasaInteres − 4,5)
             + sub-decisiones (columna "inflación" de la tabla: IVA, salario mínimo)
equilibrio   = max(0, INFLATION_TARGET + presiones × (1 + INFLATION_CRED_AMPLIFIER × (1 − credibilidad)))
inflación    = clamp(anterior + INFLATION_ADJUST × credibilidad × (equilibrio − anterior), 0, 100)
               + shocks de eventos (persisten: el mes siguiente parten de ahí)
```

- `INFLATION_TARGET` (3), `INFLATION_ADJUST` (0.15), `INFLATION_CRED_AMPLIFIER` (1).
- `INFLATION_DEFICIT_FACTOR` (0.3), `INFLATION_EMISSION_FACTOR` (1.5), `INFLATION_RATE_FACTOR` (0.5): puntos
  anuales de equilibrio por cada 1 % de déficit, por cada 1 % emitido y por cada punto de tasa.
- `MONETARY_CRED_MIN` (0.3), `MONETARY_CRED_MAX` (0.85). Sin Banco Central la inflación del 18 % baja a ~8 %
  en 24 meses; con uno autónomo (80) a ~4 % (prueba e2e), a costa de más desempleo y menos PIB por la tasa alta.
- **Banco Central** (organismo `CENTRAL_BANK`, creable desde Justicia con titular Presidente del Banco
  Central). Con autonomía ≥ `CB_AUTONOMY_THRESHOLD` (50) decide él, por encima del jugador:
  - tasa: hacia la regla de Taylor `CB_NEUTRAL_REAL_RATE` (1.5) + inflación + `TAYLOR_INFLATION_WEIGHT` (0.5)
    × (inflación − meta), acotada a [1, 20], moviéndose como mucho `CB_MAX_RATE_STEP` (1) por mes;
  - emisión: siempre 0 (no financia al gobierno). El jugador recibe un aviso si intentó cambiarlas.
- **Emisión monetaria** (sub-decisión `emisionMonetaria`, % de la recaudación por mes): ese monto entra al
  tesoro cada mes como ingreso no tributario. En la e2e, emitir 20 % seis meses lleva la inflación de
  2,5 % a ~15 %, y tarda más de un año en bajar.
- Las columnas "inflación" de la tabla de sub-decisiones son ahora presiones en puntos anuales (antes,
  en la escala mensual: se multiplicaron ×12). La tasa de interés dejó la tabla y actúa por
  `INFLATION_RATE_FACTOR`, para no contarla dos veces.
- **Crisis económica** (evento): se dispara con inflación > `EVENT_ECONOMIC_CRISIS_INFLATION` (15).
  Severidad = `EVENT_ECONOMIC_CRISIS_BASE_SEVERITY` (30) + (inflación − 15) ×
  `EVENT_ECONOMIC_CRISIS_SEVERITY_PER_POINT` (4), máx. 100. Efectos por punto de severidad: inflación
  `EVENT_ECONOMIC_CRISIS_INFLATION_SHOCK` (0.05), costo `EVENT_ECONOMIC_CRISIS_COST_PER_CAPITA` (0.5) por
  habitante, desempleo `EVENT_ECONOMIC_CRISIS_UNEMPLOYMENT` (0.05). Con los valores anteriores (shock
  +severidad, costo ×5) cada crisis empujaba más inflación y otra crisis.
- La pobreza (`POVERTY_INFLATION_FACTOR`, 0.3) y la aprobación leen la inflación anual: en una partida
  estable (≈3 %) la pobreza queda ~0,8 puntos más alta que con la escala mensual anterior.
- Partidas existentes: su inflación guardada (≈0,2) se lee como anual y converge a la meta.

## Riesgo país y crisis de deuda (Economía, Fase 3)

**Calificación crediticia** (`engine/rating.ts`, paso 13b del turno; `Game.creditScore`, `MonthSnapshot.creditScore`): un puntaje 0-100
que resume qué tan fiable es el país para los mercados, con la letra AAA … D.

```
objetivo = 100 − RATING_BASE_PENALTY − Σ penalizaciones − memoria de default + bono del Banco Central      (acotado a [0, 100])
penalización_i = peso_i × clamp((indicador − ok) / (máx − ok), 0, 1)
puntaje(t) = puntaje(t−1) + k × (objetivo − puntaje(t−1))     k = RATING_INERTIA_DOWN si baja, RATING_INERTIA_UP si sube
```

| Penalización | Peso máx. | Indicador (sin penalización → máximo) |
|---|---|---|
| deuda | `RATING_W_DEBT` (35) | deuda/PIB `RATING_DEBT_OK` (0.3) → `RATING_DEBT_MAX` (1.2) |
| déficit | `RATING_W_DEFICIT` (15) | déficit del mes en % de la recaudación 0 → `RATING_DEFICIT_MAX` (20) |
| inflación | `RATING_W_INFLATION` (25) | inflación anual `RATING_INFLATION_OK` (5) → `RATING_INFLATION_MAX` (25) |
| intereses | `RATING_W_BURDEN` (15) | intereses / recaudación 0 → `RATING_BURDEN_MAX` (0.3) |
| inestabilidad | `RATING_W_APPROVAL` (12) | aprobación `RATING_APPROVAL_OK` (40) → 0 |
| corrupción | `RATING_W_CORRUPTION` (20) | corrupción global `RATING_CORRUPTION_OK` (10) → `RATING_CORRUPTION_MAX` (60) |
| pobreza | `RATING_W_POVERTY` (30) | pobreza `RATING_POVERTY_OK` (15) → `RATING_POVERTY_MAX` (55) |

- `RATING_BASE_PENALTY` (8): riesgo estructural fijo de un mercado emergente.
- Default reciente: `RATING_W_DEFAULT` (30) que se olvida linealmente en `RATING_DEFAULT_MEMORY_MONTHS` (48). Banco Central: hasta
  `RATING_CENTRAL_BANK_BONUS` (6) según su credibilidad.
- `RATING_INERTIA_DOWN` (0.3) y `RATING_INERTIA_UP` (0.12): las agencias bajan rápido y suben despacio. Sin puntaje previo (primer turno, o
  una partida anterior a la Fase 3) arranca en el objetivo, sin transitorio.
- Letras por puntaje mínimo (`RATING_THRESHOLDS`): AAA 88, AA 80, A 70, BBB 60, BB 48, B 36, CCC 22, D debajo.
- Diferencial anual de la deuda por letra (`RATING_SPREADS`): AAA 0, AA 0,2 %, A 0,5 %, BBB 1 %, BB 2 %, B 3,5 %, CCC 6 %, D 9 %. Con los
  mercados cerrados tras un default la deuda que queda es la reestructurada y no paga diferencial.
- Calibración (e2e, 36 turnos sin intervención): `estable_democratico` A (≈76-80), `pobre_con_potencial` BBB (69 → 54 con la deuda que
  acumula), `crisis_economica` B → BB (46 → 54), `post_conflicto` BB → BBB (59 → 65).

**Eventos de mercado** (`events.ts`): con puntaje bajo `RATING_EVENT_CAPITAL_FLIGHT_SCORE` (48, BB o peor) puede ocurrir una *fuga de capitales*
(probabilidad `RATING_EVENT_CAPITAL_FLIGHT_PROB` 0.08/mes; severidad 30 + 2 por punto bajo el umbral): inflación `RATING_CAPITAL_FLIGHT_INFLATION`
(0.04) y costo `RATING_CAPITAL_FLIGHT_COST_PER_CAPITA` (0.08) por habitante por punto de severidad. Bajo `RATING_EVENT_ATTACK_SCORE` (36, B o peor), un
*ataque especulativo* (`RATING_EVENT_ATTACK_PROB` 0.06; severidad 30 + 2,5 por punto): inflación `RATING_ATTACK_INFLATION` (0.05), costo
`RATING_ATTACK_COST_PER_CAPITA` (0.05) y hasta `RATING_ATTACK_SCORE_HIT` (12) puntos de calificación. Son eventos negativos para la aprobación
(`EVENT_CLASS_IMPACT`: la clase media los siente más). Requieren los valores `CAPITAL_FLIGHT` y `SPECULATIVE_ATTACK` del enum `EventType`
(migración `20261101000000_credit_rating`).

**Crisis de deuda** (`engine/debt-crisis.ts`):

```
abre la crisis   si intereses/recaudación ≥ DEBT_CRISIS_INTEREST_BURDEN (0.2) o deuda/PIB ≥ DEBT_CRISIS_DEBT_GDP (1.5)
                 (y no hay enfriamiento ni mercados cerrados); aviso al jugador
AUSTERIDAD       presupuestos × (1 − AUSTERITY_BUDGET_CUT 0.2), aprobación −AUSTERITY_APPROVAL_HIT (8) × peso de clase,
                 calificación +AUSTERITY_SCORE_BONUS (10); crisis cerrada; enfriamiento DEBT_CRISIS_COOLDOWN_MONTHS (6)
DEFAULT          deuda × (1 − DEFAULT_HAIRCUT 0.4), calificación = DEFAULT_SCORE (8), mercados cerrados DEFAULT_MARKET_CLOSURE_MONTHS (18),
                 sanciones DEFAULT_SANCTIONS_MULTIPLIER (1.5), inflación +DEFAULT_INFLATION_SHOCK (6), aprobación −DEFAULT_APPROVAL_HIT (15)
                 × peso de clase (CRISIS_APPROVAL_CLASS_WEIGHT: 1.4 / 1.3 / 1.0 / 0.4 de pobreza extrema a élite)
sin respuesta    tras DEBT_CRISIS_GRACE_MONTHS (2) turnos sin elegir, default automático
mercados cerrados  no se emite deuda: el faltante de caja se imprime (inflación = INFLATION_EMISSION_FACTOR × déficit% × INFLATION_ADJUST × credibilidad)
```

- La respuesta es `TurnInput.debtCrisisResponse` ("AUSTERITY" | "DEFAULT"): se aplica en el paso 1, después de los ajustes de presupuesto del jugador;
  sin crisis abierta se ignora con un aviso.
- La austeridad estabiliza una carga de intereses cercana al umbral (con el umbral en 0.2, un recorte del 20 % deja el déficit en ~1 % de la
  recaudación); con una deuda mucho mayor solo da tiempo y la crisis vuelve a abrirse tras el enfriamiento (e2e: deuda 68 % del PIB, la
  austeridad frena la deuda y la calificación se estabiliza en BB-B). El default deja la carga de intereses en ~12 %: sin recortes posteriores el
  déficit monetizado empuja la inflación (≈ 20 → 45 % en dos años) y la crisis puede repetirse al reabrirse los mercados.
- Los efectos del default sobre aprobación e inflación persisten por la inercia de ambas; el desempleo no se modifica (podría usar un choque
  de evento, ver "Choques de eventos sobre los indicadores", pero no se usa).

## Política fiscal y deuda pública (Economía, Fase 1)

Antes la recaudación solo dependía de la población y de las leyes: el PIB, la corrupción y la
gestión de Economía no la movían, y un déficit que vaciaba el tesoro se borraba sin costo (los pisos
en 0 de importaciones y desastres). Ahora (`engine/fiscal.ts`, `economy.ts:calculateTaxRevenue`):

```
mezcla     = Σ peso_i × rendimiento(tasa_i / tasaInicial_i)          i = IVA, renta, sociedades
rendim.(x) = max(0, x × (1 − TAX_LAFFER × (x − 1)))                   curva de Laffer: 1 → 1, 0 → 0
tasa       = TAX_RATE_BASE × mezcla + modificadores de leyes
potencial  = poblaciónActiva × ingresoPerCápita × tasa
evasión    = clamp(base + factor × corrupciónGlobal/100 − agencia, mín, máx)
agencia    = máx × efectividad/100 × (0,5 + autonomía/200)            Agencia Tributaria no disuelta
base       = PIB × (1 − evasión)
recaudación = potencial × (base / base del primer mes)^TAX_BASE_ELASTICITY
```

- Pesos de la mezcla (`TAX_MIX_SHARES`): IVA 0,4, renta 0,35, sociedades 0,25. Con las tasas
  sembradas (16/25/25) la mezcla vale exactamente 1.
- `TAX_LAFFER` (0.35): cada punto de tasa rinde menos que el anterior (la base se erosiona). El
  máximo de un impuesto está en (1 + L)/(2L) ≈ 1,93 veces su tasa inicial; más allá recauda menos.
- `TAX_BASE_ELASTICITY` (1): la recaudación es proporcional a la base imponible. Un PIB 20% menor
  (p. ej. peor eficiencia de Economía) recauda 20% menos; más corrupción → más evasión → menos.
- Evasión: `TAX_EVASION_BASE` (0.1) + `TAX_EVASION_CORRUPTION_FACTOR` (0.4) × corrupción global,
  acotada a [`TAX_EVASION_MIN` (0.02), `TAX_EVASION_MAX` (0.6)]. Una Agencia Tributaria (organismo
  `TAX_AGENCY`, creable desde Justicia con un titular de rol Contralor) la reduce hasta
  `TAX_AGENCY_MAX_EVASION_REDUCTION` (0.15).
- **Referencia**: la "base del primer mes" (`Game.fiscalBaseReference`) se fija al cerrar el primer
  turno que se juega con esta versión. Hasta entonces el factor vale 1, así que el equilibrio inicial
  (Issue 8) no cambia y las partidas existentes arrancan neutras.
- Las tres tasas son sub-decisiones de Economía (tabla de arriba): además de la recaudación tienen
  efectos sociales (el IVA es regresivo, la renta reduce el Gini, sociedades frena el PIB).
- La ley `impuesto-progresivo` suma +0,15 a la tasa (`taxRateModifier`): se acumula con
  `impuestoRenta`; no se anulan entre sí.

**Deuda pública** (`settlePublicDebt`, PASO 13b del turno; `Game.publicDebt`):

```
tesoro < 0                    → se emite deuda por el faltante, tesoro = 0 (aviso al jugador)
tesoro > reserva (con deuda)  → el excedente amortiza deuda; reserva = gasto del mes × meses de reserva
tasa anual = DEBT_BASE_ANNUAL_RATE + traspaso × (tasaInteres − 4,5)/100
           + diferencial de la calificación crediticia (RATING_SPREADS, Fase 3)  (mín. DEBT_MIN_ANNUAL_RATE)
intereses/mes = deuda × tasa anual / 12                                       (gasto fijo del mes)
```

- `DEBT_BASE_ANNUAL_RATE` (0.04), `DEBT_POLICY_RATE_PASSTHROUGH` (0.5): subir la tasa de referencia
  encarece la deuda. `DEBT_MIN_ANNUAL_RATE` (0.01). `DEBT_CASH_RESERVE_MONTHS` (1). Antes el recargo era una
  prima por deuda/PIB sobre 60 %; ahora lo da la calificación (que ya incluye la deuda/PIB).
- Los intereses entran en el gasto comprometido (`calculateCommittedSpending`), así que la UI de
  presupuesto los descuenta del margen de los ministerios.
- Importaciones (`trade.ts`) y desastres (eventos) ya no tienen piso en 0: lo que supera la caja se
  financia con deuda. El costo único de promulgar leyes, que se cobra después del motor, también.
- La UI muestra la recaudación estimada, la evasión y la deuda en las decisiones de Economía, y el
  indicador "Deuda / PIB" en el panel.

