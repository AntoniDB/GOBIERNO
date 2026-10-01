# BALANCE.md — Formulas del motor y donde ajustarlas

Todas las constantes de balance estan centralizadas en `src/lib/balance.ts`. Para ajustar la simulacion, modifica los valores en ese archivo.

---

## Indicadores sociales

### Pobreza (`indicators.ts:calculatePoverty`)
```
pobreza = POVERTY_SOCIAL_DEV_FACTOR * eficienciaDesarrolloSocial
        + POVERTY_UNEMPLOYMENT_FACTOR * desempleo
        + POVERTY_INFLATION_FACTOR * inflacion
        + 25 (base)
```
- `POVERTY_SOCIAL_DEV_FACTOR` (-0.3): mas eficiencia → menos pobreza
- `POVERTY_UNEMPLOYMENT_FACTOR` (0.5): mas desempleo → mas pobreza
- `POVERTY_INFLATION_FACTOR` (0.3): mas inflacion → mas pobreza

### Desempleo (`indicators.ts:calculateUnemployment`)
```
desempleo = UNEMPLOYMENT_ECONOMY_FACTOR * eficienciaEconomia + UNEMPLOYMENT_BASE
           (clamped a [2, 50])
```
- `UNEMPLOYMENT_ECONOMY_FACTOR` (-0.4): mas eficiencia economica → menos desempleo

### Salud / Enfermos (`indicators.ts:calculateHealthRegional`)
```
// Modo con catalogo de enfermedades (Sesion Salud-2):
sickRate = 1 − Π(1 − prevalence_i)   // probabilidad de union sobre 14 enfermedades
diseaseMortality = Σ(prevalence_i × mortalityRate_i)  // aditiva, para el motor

// Fallback sin enfermedades (modo anterior):
enfermos = SICK_HEALTH_FACTOR * eficienciaSalud + SICK_BASE
           (clamped a [0, 50])
```
- **Cambio en Salud-2**: el sickRate paso de ~20% (modelo antiguo, solo agudos) a ~40% (modelo Π con 14 enfermedades incluyendo cronicas y salud mental). Esto es epidemiológicamente correcto: ~40-50% de la poblacion tiene al menos 1 condicion de salud en cualquier pais. Los thresholds del dashboard se recalibraron: verde ≤25%, amarillo 25-45%, rojo >45%.
- `SICK_HEALTH_FACTOR` (-0.34): mas eficiencia en salud → menos enfermos (solo modo fallback)
- `LE_DISEASE_FACTOR` (0.04): impacto de mortalidad por enfermedades en esperanza de vida (nuevo en Salud-2)
- `LE_SATURATION_FACTOR` (0.10): impacto de saturacion hospitalaria en esperanza de vida (nuevo en Salud-2)
- La esperanza de vida usa `diseaseMortality` (aditivo, evita doble conteo), no `sickRate` (Π, para display).
- Ver `diseases.ts` para el calculo completo de prevalencia por enfermedad.

### Seguridad alimentaria (`indicators.ts:calculateFoodSecurity`)
```
alimentacion = FOOD_AGRICULTURE_FACTOR * eficienciaAgricultura + FOOD_BASE
                (clamped a [0, 100])
```
- `FOOD_AGRICULTURE_FACTOR` (0.5): mas eficiencia → mas seguridad alimentaria

### Crimen (`indicators.ts:calculateCrime`)
```
crimen = CRIME_SECURITY_FACTOR * eficienciaSeguridad
       + CRIME_POVERTY_FACTOR * pobreza
       + CRIME_UNEMPLOYMENT_FACTOR * desempleo
       + CRIME_BASE
```
- `CRIME_SECURITY_FACTOR` (-0.35): mas eficiencia en seguridad → menos crimen
- `CRIME_POVERTY_FACTOR` (0.3): mas pobreza → mas crimen
- `CRIME_UNEMPLOYMENT_FACTOR` (0.4): mas desempleo → mas crimen

### Educacion (`indicators.ts:calculateEducation`)
```
educacion = EDUCATION_EDU_FACTOR * eficienciaEducacion + EDUCATION_BASE
```

### Inflacion (`economy.ts:calculateInflation`)
```
inflacion = BASE_INFLATION + deficitRelativo * INFLATION_DEFICIT_FACTOR
```
- `BASE_INFLATION` (2.5)
- `INFLATION_DEFICIT_FACTOR` (0.3)
- Afectada por INFLATION_CRISIS_THRESHOLD (15%) que dispara penalizacion de aprobacion

---

## Aprobacion (`approval.ts:calculateApprovalByClass`)

```
aprobacion = APPROVAL_BASE (50)
           + efectos de leyes activas
           - impacto de eventos del mes (severidad * APPROVAL_EVENT_WEIGHT * 10 * classMultiplier)
           - penalidad de pobreza si >30% y clase es POBREZA/EXTREMA_POBREZA
           - penalidad de inflacion si >INFLATION_CRISIS_THRESHOLD
           - corrupcion promedio * APPROVAL_CORRUPTION_WEIGHT
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
deltaCorrupcion = CORRUPTION_BASE_INCREASE (0.5)
                + budgetBonus (presupuesto * CORRUPTION_BUDGET_FACTOR)
                - organismoBonus (Contraloria/Fiscalia)
                - deterrenceFactor (casos activos)
```

### Corrupcion global (`calculateGlobalCorruption`)
```
promedio ponderado: MINISTER peso=3, otros peso=1
```

---

## Regimen (`regime.ts`)

7 metricas (0-100): powerConcentration, pressFreedom, judicialIndependence, politicalPluralism, civilLiberties, transparency, militarySubordination.

Se mueven con acciones del jugador y se regeneran gradualmente hacia el baseline (50) a ~0.5/mes.

Clasificacion:
- Democracia plena: promedio > 70
- Democracia defectuosa: 55-70
- Regimen hibrido: 35-55
- Autoritarismo electoral: 20-35
- Dictadura: < 20 y powerConcentration > 85
- Estado fallido: crimen > 80, corrupcion > 80, aprobacion < 15

---

## Condiciones de fin de partida (`game-over.ts`)

| Condicion | Desencadenante |
|-----------|---------------|
| Estado fallido | crimen > 80, corrupcion > 80, aprobacion < 15 |
| Juicio politico | voto del Congreso (mocion) |
| Golpe de estado | subordinacion militar < 30, aprobacion < 25, corrupcion > 50. Exito depende de defensa + inteligencia |
| Renuncia forzada | aprobacion < 10 por 6 meses consecutivos |
| Perdida electoral | elecciones cada 5 anios con aprobacion < 40 |
| Fin de mandato | limite de 2 mandatos (10 anios) |
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
- **Minimo alcanzable** como fraccion de prevalenceBase:
  `VACCINATION_MIN_RATIO` (0.10), `PREVENTION_MIN_RATIO` (0.90),
  `MENTAL_HEALTH_MIN_RATIO` (0.20)
- **Recuperacion al desactivar** (pp/mes hacia prevalenceBase):
  `VACCINATION_RECOVERY_RATE` (0.4), `PREVENTION_RECOVERY_RATE` (0.2),
  `MENTAL_HEALTH_RECOVERY_RATE` (0.3)
- **Bonus de aprobacion salud mental**: `MENTAL_HEALTH_APPROVAL_BONUS` — POVERTY +3/mes, MIDDLE +2/mes

### Sub-decisiones legacy

Las sub-decisiones booleanas `vacunacion` y `saludMental` del seed se mantienen
por compatibilidad con partidas existentes, pero los programas reales reemplazan
su rol. En el futuro deben deprecarse o migrarse a programas reales generados
en el seed.

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

