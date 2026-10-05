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

### Inflacion (`economy.ts:calculateInflation`)
```
deficit% = max(0, gastos − ingresos) / ingresos × 100
inflacion = BASE_INFLATION + deficit% * INFLATION_DEFICIT_FACTOR   (+ sub-decisiones; mínimo 0)
```
- `BASE_INFLATION` (0.2): inflación mensual sin déficit (≈ 2,4 % anual)
- `INFLATION_DEFICIT_FACTOR` (0.02): puntos de inflación por cada 1 % de déficit sobre el ingreso
- Con los valores sembrados la inflación ronda 0,2–0,5; `INFLATION_CRISIS_THRESHOLD` (15) solo se alcanza con
  déficits enormes, y entonces dispara la penalizacion de aprobacion

---

## Aprobacion (`approval.ts:calculateApprovalByClass`)

```
aprobacion = APPROVAL_BASE (50)
           + efectos de leyes activas
           + efectos de sub-decisiones (por clase)
           - impacto de eventos negativos del mes (severidad * APPROVAL_EVENT_WEIGHT * 10 * classMultiplier;
             los eventos no negativos suman la mitad)
           - (pobreza − 30) * APPROVAL_INDICATOR_WEIGHT si pobreza > 30% y clase es POBREZA/EXTREMA_POBREZA
           - (inflacion − INFLATION_CRISIS_THRESHOLD) * APPROVAL_INDICATOR_WEIGHT si supera el umbral
           - corrupcion promedio de funcionarios * APPROVAL_CORRUPTION_WEIGHT
           (clamped [0, 100])
```
- `APPROVAL_BASE` (50): punto de partida
- `APPROVAL_EVENT_WEIGHT` (0.1): peso de eventos en aprobacion
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
| Economía | `tasaInteres` | 4.5 | 1–20 | inflación -0.01, desempleo +0.1, PIB % -0.35 | — | — |
| Economía | `salarioMinimo` | 350 | 100–1000 | pobreza -0.005, desempleo +0.004, inflación +0.0003 | pobreza +0.004, pob. extrema +0.003, élite -0.003 | — |
| Economía | `politicaIndustrial` | 50 | 0–100 | PIB % +0.03, desempleo +0.02, Gini +0.03 | pobreza -0.02, élite +0.02 | — |
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

