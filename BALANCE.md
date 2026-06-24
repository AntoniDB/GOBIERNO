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
