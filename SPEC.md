# Simulador de Gobierno y Sociedad — Especificación para Agente

---

## Cómo ejecutar este proyecto con OpenCode (leer primero)

Este proyecto es grande y **no se puede construir en una sola sesión** porque el agente tiene una ventana de contexto limitada. OpenCode hace auto-compactación automática al 95% del contexto, pero esa compactación pierde detalles de esta especificación, y a partir de ahí el código sale inconsistente. La solución es dividir el trabajo en **sesiones independientes**, una por fase del proyecto.

OpenCode tiene tres características que vamos a aprovechar:

1. **Archivo `AGENTS.md`** en la raíz del proyecto: instrucciones permanentes que el agente lee en todas las sesiones. Ahí guardas el resumen del proyecto para no tener que repegarlo siempre.
2. **Agente Plan vs Agente Build**: Plan es read-only y sirve para diseñar la arquitectura antes de tocar código. Build escribe el código. Cambias entre ellos con `Tab`.
3. **Sesiones persistentes en SQLite**: cada sesión queda guardada, puedes cerrar el terminal y volver. Listadas con `opencode session list`.

### Setup inicial (una sola vez, antes de empezar)

1. Crear carpeta del proyecto y entrar en ella
2. Crear archivo `AGENTS.md` en la raíz con este contenido mínimo:

   ```markdown
   # Simulador de Gobierno y Sociedad

   Proyecto Next.js 14+ con TypeScript, Prisma, PostgreSQL, Tailwind y shadcn/ui.

   La especificación completa está en `SPEC.md`. Léelo siempre antes de empezar cualquier trabajo.

   ## Reglas de oro
   - Respetar siempre la especificación de SPEC.md, no simplificar ni saltarse partes definidas
   - El motor de cálculo de turno corre en servidor (Server Actions), nunca en cliente
   - El motor debe ser puro y determinista (sembrado)
   - Centralizar constantes de balanceo en `lib/balance.ts`
   - Crear tests para cualquier función pura del motor
   - Comentar las fórmulas con su justificación
   - i18n: todo el código y UI en español
   ```

3. Copiar este documento completo a `SPEC.md` en la raíz del proyecto
4. Inicializar git: `git init`
5. Hacer commit inicial con `AGENTS.md` y `SPEC.md`

Con esto, en cada sesión OpenCode ya tiene el contexto base sin que se lo tengas que repegar manualmente.

### Cómo arrancar cada sesión

Para cada fase del proyecto:

1. Abrir OpenCode en la carpeta del proyecto: `opencode`
2. **Empezar con el agente Plan** (Tab para cambiar si no está activo). Pegar este mensaje:

   > "Estoy iniciando la **Sesión X** del proyecto. Lee primero `SPEC.md` completo y luego revisa el estado actual del código. Después dame un plan de ejecución detallado para implementar solo las etapas A–B de la sección 12 del SPEC. No avances a etapas de otras sesiones. Espera mi confirmación antes de pasar al agente Build."

3. Revisar el plan, ajustarlo si hace falta y confirmar
4. Cambiar al agente Build con `Tab`. Decirle: "Procede con el plan aprobado."
5. Acompañar el trabajo, revisar cambios significativos
6. Al terminar la sesión: hacer `git commit` de todo lo trabajado
7. Cerrar OpenCode (la sesión queda guardada por si necesitas volver)

### División de sesiones

| Sesión | Etapas (sección 12) | Objetivo |
|---|---|---|
| **1 — Cimientos** | 1, 2, 3 | Setup Next.js + Prisma + Postgres, esquema completo de DB con migración aplicable, seed inicial, motor de cálculo central con tests unitarios |
| **2 — Núcleo jugable** | 4, 5 | Dashboard principal con HUD y botón de avance de mes, vista de los 8 ministerios con sub-decisiones funcionales |
| **3 — Sistema legislativo** | 6 | Catálogo de leyes, sistema de propuesta, Senado con partidos ideológicos y votación por afinidad |
| **4 — Justicia y corrupción** | 7, 8 | Casos judiciales con etapas, corrupción individualizada de funcionarios, organismos creables (Contraloría, Fiscalía Anticorrupción) |
| **5 — Sociedad y régimen** | 9, 10 | 4 clases sociales con aprobación y demandas propias, 7 métricas de régimen con cálculo de tipo emergente |
| **6 — Reacción del mundo** | 11, 12 | Indicadores sociales recalculados, eventos emergentes por umbrales, 3 medios de comunicación con sesgo |
| **7 — Cierre** | 13, 14, 15, 16 | Reportes históricos con Recharts, onboarding/creación de partida, condiciones de fin de partida, polish y testing integral |

### Reglas importantes durante el desarrollo

- **No pasar a la sesión siguiente** hasta que el código de la actual esté funcionando y commiteado.
- **Siempre arrancar con el agente Plan** (Tab). Diseñar primero, codear después. Esto evita rework masivo.
- Si OpenCode te avisa que se acerca al límite de contexto (indicador de tokens en la TUI), termina lo que estés haciendo, haz commit y arranca una sesión nueva — no dejes que la auto-compactación pierda detalles.
- Si el agente propone "simplificar" o "saltarse" algo definido en SPEC.md, rechazarlo y exigir que se respete la especificación.
- En cada nueva sesión, decirle al agente: "Antes de empezar, explora la estructura del proyecto y dime qué entiendes del estado actual." Así toma conciencia del trabajo previo sin necesidad de cargar todo a contexto.

### Riesgo si se intenta todo de una vez

Si le pasas el SPEC al agente con la indicación "hazlo todo", lo que ocurrirá es:

- Las primeras etapas (cimientos, motor) saldrán bien
- A partir de la etapa 6–7 OpenCode auto-compactará la conversación y el agente empezará a perder detalles de la especificación
- Las últimas etapas (reportes, onboarding, polish) saldrán flojas o con bugs porque ya no recuerda los requisitos originales
- Cuando intentes corregir, costará más tiempo que haber dividido desde el inicio

---

## Contexto y objetivo

Construye un simulador de gobierno y sociedad en el que el jugador asume el cargo de mandatario de un país. Cada turno representa **1 mes**. Las decisiones del jugador modifican datos crudos (presupuestos, leyes, nombramientos, organismos), un motor matemático recalcula todo el estado a partir de esos datos y los problemas y eventos que surgen son **emergentes**, no scripteados. El objetivo es que la simulación se sienta orgánica: nada está prescrito, todo sale de las interacciones numéricas entre sistemas.

**Importante**: este es un MVP profundo. Implementa los **8 módulos prioritarios** de la sección 5 con lógica completa. Los módulos de fase 2 (sección 6) deben quedar incluidos en el esquema de base de datos para no tener que reescribir luego, pero su lógica de gameplay puede quedar como stub documentado.

---

## 1. Stack tecnológico

- **Framework**: Next.js 14+ (App Router) con TypeScript
- **Base de datos**: PostgreSQL
- **ORM**: Prisma
- **UI**: Tailwind CSS + shadcn/ui
- **Gráficos**: Recharts
- **Estado del cliente**: Zustand
- **Validación**: Zod
- **Autenticación**: simple (NextAuth con credenciales locales o email — solo para asociar partidas a usuario)

El motor de cálculo del turno debe correr **en el servidor** (API routes o Server Actions) para que el estado sea consistente y no manipulable desde el cliente.

---

## 2. Arquitectura general

- **Cliente**: pantallas reactivas que muestran el estado actual del país, permiten al jugador tomar decisiones (asignar presupuestos, proponer leyes, nombrar funcionarios, crear organismos) y disparar la acción de "avanzar mes".
- **Servidor**: motor de simulación que recibe las decisiones, calcula el nuevo estado, persiste el snapshot mensual, dispara eventos emergentes y devuelve el resultado.
- **Persistencia**: cada mes se genera un `MonthSnapshot` con todos los indicadores clave para permitir gráficos históricos y reproducibilidad.
- **Bucle**: el jugador puede pausar entre meses o configurar avance automático (1 mes = X segundos configurable).

---

## 3. Modelo de datos (Prisma)

Implementa este esquema completo desde el inicio, incluso para módulos de fase 2. Los módulos no implementados pueden tener stubs en las relaciones.

### Entidades principales

```
User              { id, email, createdAt, games[] }
Game              { id, userId, countryName, currentYear, currentMonth, status, createdAt, snapshots[], officials[], ... }
MonthSnapshot     { id, gameId, year, month, treasury, gdp, population, approval, corruption,
                    povertyRate, unemploymentRate, sickRate, crimeRate, foodSecurity, educationLevel,
                    inflation, gini, regimeType, regimeMetrics (JSON), createdAt }
```

### Ministerios

```
Ministry          { id, gameId, key (enum), budgetPercent, efficiency, internalCorruption,
                    subDecisions (JSON), ministerOfficialId }
MinistryDecision  { id, ministryId, key, value, activatedAt }
```

Los 8 ministerios iniciales: `HEALTH, EDUCATION, ECONOMY, DEFENSE, SECURITY, JUSTICE, AGRICULTURE, SOCIAL_DEVELOPMENT`. Deja en el enum también: `FOREIGN_AFFAIRS, ENVIRONMENT, LABOR, INFRASTRUCTURE, CULTURE, SCIENCE_TECH` (fase 2).

### Funcionarios (Officials)

```
Official          { id, gameId, name, role (enum), ministryId?, partyId?, loyalty, ambition,
                    wealth, ideology (JSON: economic, social, authority axes), corruption,
                    skill, reputation, status (ACTIVE | INVESTIGATED | INDICTED | CONVICTED | DISMISSED),
                    appointedAt, investigations[], cases[] }
```

Roles posibles: `MINISTER, JUDGE, PROSECUTOR, GENERAL, CHIEF_OF_INTELLIGENCE, COMPTROLLER, OMBUDSMAN, CENTRAL_BANK_PRESIDENT`, etc.

Genera nombres realistas en español al iniciar la partida.

### Senado y partidos

```
Party             { id, gameId, name, ideology (JSON: economic [-100..100], social [-100..100],
                    authority [-100..100]), leaderOfficialId, popularity, seatsLower, seatsUpper }
Senator           { id, gameId, partyId, name, personalIdeology (JSON, puede divergir del partido),
                    chamber (LOWER | UPPER), loyalty }
```

Generar 4–6 partidos al iniciar, con ideologías que cubran el espectro político.

### Leyes

```
LawCatalog        { id, key (slug), name, description, effectsJson, idealIdeology (JSON),
                    cost, isAvailable (boolean) }
LawProposal       { id, gameId, lawKey, proposedAt, status (PENDING | APPROVED | REJECTED),
                    votesFor, votesAgainst, votesAbstain, resolvedAt }
ActiveLaw         { id, gameId, lawKey, activatedAt, repealedAt? }
```

Catálogo inicial de leyes (mínimo 15): subsidio alimentario, impuesto progresivo, ley anticorrupción, servicio militar obligatorio, educación pública gratuita, salud universal, liberalización económica, estado de emergencia, reforma judicial, ley de transparencia, libertad de prensa garantizada, censura de medios opositores, reforma constitucional, despenalización del aborto, ley anti-monopolios.

### Justicia (casos individuales)

```
JudicialCase      { id, gameId, defendantOfficialId, caseType (CORRUPTION | CRIMINAL | CIVIL),
                    description, openedAt, currentPhase (INVESTIGATION | TRIAL | SENTENCING | APPEAL | CLOSED),
                    monthsInPhase, evidenceStrength, prosecutorId, judgeId, verdict?, sentenceMonths? }
Investigation     { id, caseId, openedBy (organismId or 'public'), monthsActive, progress }
```

### Organismos creables

```
Organism          { id, gameId, type (COMPTROLLER | ANTICORRUPTION_PROSECUTION | INTELLIGENCE |
                    OMBUDSMAN | CONSTITUTIONAL_COURT | CENTRAL_BANK | TAX_AGENCY | ELECTORAL_COUNCIL),
                    name, monthlyBudget, staff, effectiveness, autonomyLevel (0-100),
                    headOfficialId, createdAt, dissolvedAt? }
```

### Clases sociales

```
SocialClass       { id, gameId, key (EXTREME_POVERTY | POVERTY | MIDDLE | ELITE),
                    populationPercent, averageIncome, approval, demands (JSON),
                    educationLevel, healthAccess }
```

### Régimen emergente

```
RegimeMetrics     { id, gameId, powerConcentration, pressFreedom, judicialIndependence,
                    politicalPluralism, civilLiberties, transparency, militarySubordination,
                    updatedAt }
```

`regimeType` se calcula en cada `MonthSnapshot` desde estas 7 métricas (ver sección 5.6).

### Medios de comunicación

```
Media             { id, gameId, name, type (TV | NEWSPAPER | DIGITAL),
                    ideologicalAffinity (JSON), reach, credibility,
                    governmentAffinity (-100..100), status (ACTIVE | CENSORED | CLOSED) }
MediaCoverage     { id, mediaId, gameId, year, month, eventId?, headline, sentiment,
                    impactOnApproval (JSON por clase social) }
```

### Eventos

```
Event             { id, gameId, type (enum: EPIDEMIC | SCANDAL | PROTEST | CRIME_SURGE |
                    COUP_ATTEMPT | DISASTER | DISCOVERY | etc.), severity, year, month,
                    description, effectsApplied (JSON), resolvedAt? }
```

### Fase 2 (solo esquema, sin lógica completa)

```
Country           { id, gameId, name, relationStatus, militaryPower, economicPower, isNeighbor }
Treaty            { id, gameId, countryId, type, signedAt }
Disease           { id, gameId, name, contagionRate, mortalityRate, prevalence, hasVaccine }
Infrastructure    { id, gameId, type (ENERGY | WATER | ROADS | RAIL | INTERNET | HOUSING),
                    coveragePercent, maintenanceCost, condition }
Region            { id, gameId, name, populationPercent, povertyRate, infrastructureLevel }
```

---

## 4. Módulos prioritarios (implementación profunda)

### 4.1 Ministerios con sub-decisiones internas

Cada ministerio tiene:
- **Presupuesto** (% del total, asignable por el jugador, suma libre — puede generar déficit)
- **Eficiencia** (calculada: `budgetPercent × (1 − internalCorruption/100) × ministerSkill`)
- **Corrupción interna** (0–100, evoluciona mes a mes)
- **Ministro** (Official con sus propios atributos)
- **Sub-decisiones específicas**

Sub-decisiones por ministerio (2–3 cada uno, mínimo):

- **Salud**: balance hospitales públicos/privados (0–100), campañas de vacunación (on/off, costo), enfoque en salud mental (on/off)
- **Educación**: nivel de inversión por etapa (primaria/secundaria/superior, suma 100), enfoque curricular (STEM vs humanidades), becas estudiantiles
- **Economía**: tasa de interés referencial, salario mínimo, política industrial (proteccionismo vs apertura)
- **Defensa**: tropas activas, gasto en equipamiento, servicio militar obligatorio (on/off)
- **Seguridad**: patrullaje urbano vs rural, política antidrogas (represiva vs preventiva), inversión en cárceles
- **Justicia**: cantidad de jueces y fiscales contratados, prioridad (corrupción vs crimen común), dureza penal (0–100)
- **Agricultura**: subsidios al pequeño productor vs grandes empresas, inversión en infraestructura rural
- **Desarrollo social**: focalización vs universalidad de programas, prioridad demográfica (niños / adultos mayores / mujeres)

Cada cambio en una sub-decisión modifica los indicadores correspondientes el siguiente mes.

### 4.2 Senado y partidos políticos

- 4–6 partidos generados al iniciar, con ideologías diferenciadas en 3 ejes: económico (izq–der), social (progresista–conservador), autoridad (libertario–autoritario).
- Composición de cámaras fija hasta la próxima elección legislativa (configurable, default cada 4 años).
- Cuando el jugador propone una ley, cada senador vota por afinidad ideológica con la ley (`idealIdeology` del catálogo vs `personalIdeology` del senador), modulado por:
  - Lealtad al partido (puede votar contra su preferencia si el partido manda)
  - Aprobación del gobierno (alta aprobación reduce oposición)
  - Negociaciones (el jugador puede ofrecer cargos, presupuesto a regiones, etc. — implementar como acciones explícitas)
- Mostrar conteo de votos antes de cerrar (animación opcional).
- Mociones que el Congreso puede activar contra el jugador: censura a un ministro, vacancia presidencial, juicio político — dependen de la composición y la aprobación.

### 4.3 Justicia individualizada

- Casos judiciales se abren por:
  - Detección automática (cuando `Official.corruption > 60` con probabilidad mensual proporcional a la efectividad de la Fiscalía Anticorrupción)
  - Acción del jugador (ordenar investigar a alguien — pero solo si Justicia es independiente; si controlas el Poder Judicial, esto puede usarse políticamente)
  - Eventos aleatorios (escándalos filtrados por la prensa)
- Etapas: investigación (3–8 meses) → juicio (2–6 meses) → sentencia → apelación (opcional)
- Cada etapa puede acelerarse o frenarse según corrupción del juez/fiscal asignado
- Condena resulta en: dimisión del cargo (si era ministro/funcionario activo), prisión (`sentenceMonths`), reducción de corrupción global, mejora de aprobación si era opositor o miembro del gobierno previo, deterioro de aprobación si era aliado del jugador
- Lista de casos activos visible en una pantalla dedicada

### 4.4 Corrupción individualizada + organismos

- Cada `Official` tiene corrupción individual que evoluciona mes a mes:
  - Sube por: presupuesto grande del ministerio, baja vigilancia (sin Contraloría), influencia de aliados corruptos, eventos económicos negativos
  - Baja por: Contraloría activa con efectividad alta, Fiscalía Anticorrupción independiente, casos judiciales en curso contra otros (efecto disuasivo), exposición mediática
- Corrupción global = promedio ponderado de los funcionarios activos
- Organismos creables prioritarios:
  - **Contraloría General**: $150M/mes, reduce corrupción de funcionarios (−2 a −5/mes según efectividad), requiere nombrar titular. Si autonomía alta, también investiga al gobierno.
  - **Fiscalía Anticorrupción**: $200M/mes, abre casos automáticamente, su efectividad depende del titular. Si autonomía baja, solo abre casos contra opositores.
  - **Servicio de Inteligencia**: $250M/mes, detecta amenazas (golpes, conspiraciones), puede usarse políticamente si autonomía baja.
- Cada organismo tiene `autonomyLevel`: alto = más legítimo y efectivo contra todos, bajo = controlado por el jugador, herramienta política.

### 4.5 Clases sociales separadas

- 4 estratos: `EXTREME_POVERTY`, `POVERTY`, `MIDDLE`, `ELITE`
- Cada clase tiene:
  - Porcentaje poblacional (movilidad social: educación + economía suben gente; crisis baja gente)
  - Ingreso promedio
  - Aprobación al gobierno (independiente entre clases)
  - Demandas dominantes (alimentación, seguridad, oportunidades, libertad económica, etc.)
- Cada ley/decisión tiene efectos diferenciados por clase. Ejemplos:
  - Impuesto progresivo: `ELITE −5 aprobación, POVERTY +3, EXTREME_POVERTY +5`
  - Liberalización económica: `ELITE +5, MIDDLE +2, POVERTY −3, EXTREME_POVERTY −5`
  - Subsidio alimentario: `EXTREME_POVERTY +8, POVERTY +4, MIDDLE −1, ELITE −2`
- Aprobación general = promedio ponderado por porcentaje poblacional
- Si una clase tiene aprobación <20% y representa >25% de la población, puede disparar evento de protesta masiva o disturbios

### 4.6 Régimen emergente

7 métricas internas (0–100) que se mueven con acciones específicas del jugador:

1. **Concentración de poder**
2. **Libertad de prensa**
3. **Independencia judicial**
4. **Pluralismo político**
5. **Libertades civiles**
6. **Transparencia**
7. **Subordinación militar al poder civil**

Acciones que las mueven (ejemplos no exhaustivos):

| Acción | Efecto |
|---|---|
| Censurar o cerrar un medio | −15 libertad de prensa, +5 concentración |
| Nombrar jueces afines sin proceso | −10 independencia judicial, +5 concentración |
| Disolver el Congreso (decreto) | −30 pluralismo, +25 concentración |
| Estado de emergencia >6 meses | −10 libertades civiles por mes adicional |
| Comprar votos en el Senado (si se detecta) | −15 transparencia |
| Aprobar Ley de Transparencia | +20 transparencia |
| Crear Contraloría con autonomía alta | +15 transparencia, +5 independencia judicial |
| Defensoría del Pueblo autónoma | +15 libertades civiles |
| Elecciones limpias garantizadas | +10 pluralismo |
| Subordinar generales corruptos | +10 subordinación militar |
| Promover militares como ministros civiles | −10 subordinación militar |

Cada mes se calcula el `regimeType` desde el promedio ponderado:

- **Democracia plena**: todas las métricas >70 (peso especial: prensa, judicial, pluralismo)
- **Democracia defectuosa**: promedio 55–70
- **Régimen híbrido**: promedio 35–55
- **Autoritarismo electoral**: promedio 20–35
- **Dictadura**: promedio <20 y concentración de poder >85
- **Estado fallido**: crimen >80, corrupción >80, aprobación <15 simultáneamente

Consecuencias del régimen:

- **Democracia plena**: inversión extranjera +20%, ayuda internacional disponible, comercio libre, pero Congreso bloquea más decisiones, opositores intocables sin debido proceso
- **Democracia defectuosa**: similar pero con friction
- **Régimen híbrido**: comercio normal, algo de aislamiento, decretos posibles con costo de aprobación
- **Autoritarismo**: sanciones internacionales suaves, fuga de capitales, posibilidad de decretos amplios, riesgo de revolución +
- **Dictadura**: aislamiento total, sanciones duras, control interno alto, riesgo permanente de magnicidio y golpe
- **Estado fallido**: regiones se autonomizan, surgen grupos armados, posible game over

El régimen puede recuperarse: liberar prensa, devolver autonomía judicial, restaurar Congreso → métricas suben gradualmente.

### 4.7 Indicadores sociales y eventos emergentes

Indicadores recalculados cada mes a partir de los ministerios y leyes:

- **Pobreza** (%): función de Desarrollo Social.eficiencia, desempleo, subsidios activos, inflación
- **Desempleo** (%): función de Economía.eficiencia, política industrial, ciclo económico
- **Salud / enfermos** (%): función de Salud.eficiencia, brotes activos, contaminación
- **Seguridad alimentaria** (%): función de Agricultura.eficiencia, importaciones
- **Crimen** (%): función de Seguridad.eficiencia, pobreza, desempleo, estado de emergencia
- **Educación** (nivel 0–100): función de Educación.eficiencia, cobertura, programas
- **Inflación** (%): función de masa monetaria, déficit fiscal, decisiones del Banco Central
- **PIB**: función de población activa, productividad por sector, inversión

Eventos emergentes (no scripteados — se disparan por umbrales con probabilidad mensual):

- **Epidemia**: si Salud.eficiencia <40 y vacunación off, probabilidad 5–10%. Dura 3–6 meses, sube enfermos y mortalidad
- **Escándalo de corrupción**: si corrupción global >40, probabilidad 6%. Cae aprobación −4 a −8, puede abrir caso judicial
- **Protestas masivas**: si pobreza >50% o aprobación de POVERTY <20, probabilidad 8%. Cae aprobación, daño económico
- **Crisis criminal**: si crimen >65, probabilidad 7%. Cae aprobación
- **Intento de golpe**: si aprobación <25, militares con baja subordinación, corrupción alta — probabilidad 5%. Resultado depende de defensa.eficiencia y inteligencia
- **Desastre natural**: probabilidad mensual constante 2–4%, severidad variable. Costo económico y humanitario inmediato
- **Crisis económica**: si déficit fiscal sostenido o inflación >15%. Cae PIB, sube desempleo
- **Filtración de información**: si Inteligencia tiene autonomía baja y se usa contra opositores, probabilidad de filtración mediática

### 4.8 Medios de comunicación básicos

- 3 medios al iniciar con afinidad política diferenciada (uno pro-gobierno, uno neutral, uno opositor — ajustable)
- Cada mes cubren los eventos principales con sesgo según afinidad:
  - Medio afín minimiza escándalos del gobierno, amplifica logros
  - Medio opositor lo contrario
- Influencian aprobación de las clases sociales según el alcance del medio y la afinidad ideológica de cada clase
- Acciones del jugador sobre medios:
  - Comprar afinidad (corrupción de transparencia +, riesgo de filtración)
  - Censurar/cerrar (impacto fuerte en régimen)
  - Ignorar (default)

---

## 5. Módulos de fase 2 (solo esquema, stubs documentados)

Estos módulos deben existir en el modelo de datos pero su lógica puede quedar como TODO documentado:

- Geopolítica (países vecinos, tratados, conflictos)
- Enfermedades como catálogo completo (vacunas, mutaciones, mortalidad por edad)
- Medio ambiente (contaminación granular, cambio climático)
- Infraestructura granular (energía por matriz, agua, internet)
- Ministerios adicionales: Exteriores, Ambiente, Trabajo, Infraestructura, Cultura, Ciencia y Tecnología
- División regional del país
- Demografía con pirámide poblacional detallada
- Inflación con modelo monetario completo

Deja comentarios `// TODO: fase 2` claros en el código donde estos módulos se integrarían.

---

## 6. Bucle de juego y motor de cálculo

### Flujo de un turno

1. El jugador hace decisiones durante el "mes": ajusta presupuestos, propone leyes, nombra funcionarios, crea organismos, toma decisiones puntuales en modales de crisis
2. El jugador presiona "Avanzar mes" (o el avance es automático según configuración)
3. El servidor ejecuta el motor de cálculo:
   1. Aplicar decisiones del jugador (presupuestos, sub-decisiones, leyes recién aprobadas)
   2. Calcular ingresos del estado (impuestos según tax rate × población activa × productividad)
   3. Calcular gastos (ministerios + organismos + leyes activas)
   4. Actualizar tesoro
   5. Calcular eficiencia de cada ministerio
   6. Aplicar evolución de corrupción individual y global
   7. Recalcular indicadores sociales
   8. Recalcular aprobación por clase social
   9. Avanzar casos judiciales (cada uno suma 1 mes a su fase actual)
   10. Recalcular métricas de régimen y `regimeType`
   11. Disparar eventos aleatorios según umbrales
   12. Generar coberturas mediáticas
   13. Aplicar efectos de eventos
   14. Crear `MonthSnapshot` completo
4. Devolver al cliente el nuevo estado + lista de novedades del mes (notificaciones)

### Determinismo y aleatoriedad

- Usa una semilla almacenada en `Game` para reproducibilidad
- Aleatoriedad solo en eventos y rolls de votación senatorial
- El motor debe ser **puro**: mismo estado + mismas decisiones + misma semilla = mismo resultado

---

## 7. UI/UX

### Pantallas principales

1. **Dashboard** (vista principal): HUD permanente con fecha, tesoro, aprobación, corrupción, tipo de régimen. Resumen de indicadores sociales. Feed de eventos recientes. Botón grande "Avanzar mes".
2. **Vista de Ministerio** (entras a cada uno): sliders de presupuesto, sub-decisiones específicas, info del ministro actual, gráfico de eficiencia histórica, lista de problemas pendientes en su área.
3. **Vista del Congreso**: composición visual de cámaras (hemiciclo con partidos coloreados), leyes en trámite, leyes activas, catálogo de leyes proponibles. Negociaciones de coalición.
4. **Vista de Justicia**: lista de casos activos con su etapa, funcionarios bajo investigación, organigrama del Poder Judicial, organismos creados.
5. **Vista de Población**: 4 clases sociales con aprobación, demandas dominantes, gráfico de movilidad. Indicadores generales (pobreza, desempleo, etc.).
6. **Vista de Medios**: 3 medios con su afinidad, titulares del mes, opciones para influir.
7. **Vista de Régimen**: las 7 métricas con barras, clasificación actual, histórico de evolución.
8. **Vista de Reportes**: gráficos históricos de los principales indicadores mes a mes (Recharts).
9. **Feed de notificaciones**: lateral o modal, muestra todo lo que pasó este mes.
10. **Modales de decisión**: aparecen ante crisis ("Hay un brote de epidemia, ¿declarás cuarentena nacional?"), bloquean el avance hasta que el jugador decide.

### Diseño visual

- Estética sobria, informativa, tipo dashboard gubernamental
- Tailwind + shadcn/ui para componentes consistentes
- Colores semánticos: verde para indicadores buenos, rojo para crisis, amarillo para alerta
- Recharts para todos los gráficos históricos
- Cada cambio de turno con feedback claro de qué pasó

---

## 8. Configuración inicial / Onboarding

Al crear partida, el jugador elige:
- Nombre del país
- Preset inicial: "Estable democrático" / "Pobre con potencial" / "Crisis económica" / "Post-conflicto" — esto define valores iniciales de indicadores, ministerios, corrupción y régimen
- Dificultad: fácil / normal / difícil — afecta frecuencia de eventos negativos y corrupción inicial

El sistema genera automáticamente:
- 4–6 partidos con nombres y líderes ficticios
- Funcionarios iniciales para cada ministerio y organismos básicos
- 3 medios de comunicación
- Composición inicial del Senado y Cámara

Tutorial guiado primer año: tooltips contextuales explican cada sistema cuando se accede por primera vez.

---

## 9. Condiciones de fin de partida

- **Golpe de estado exitoso**: se ejecuta cuando un riesgo de golpe supera 50. El riesgo (0–100) sube con la baja subordinación militar, la baja aprobación y la corrupción, y baja con el impacto de Defensa y la efectividad del organismo de Inteligencia (pesos `COUP_*` en `lib/balance.ts`)
- **Vacancia presidencial / juicio político**: aprobado por mayoría en Senado
- **Renuncia forzada**: aprobación <10 durante 6 meses consecutivos
- **Pérdida electoral**: elecciones presidenciales periódicas (configurable, default cada 5 años). El voto de cada clase social es su aprobación del gobierno; el % de votos es el promedio ponderado por población de las clases, y pierdes si es menor a 50 %
- **Sin límite de mandatos**: no hay fin de mandato constitucional. Mientras sigas ganando las elecciones puedes ser reelecto indefinidamente (decisión de diseño: la partida termina por pérdida, no por calendario)
- **Asesinato político**: posible si inteligencia tiene autonomía baja y se usa contra opositores, o si aprobación es muy baja
- **Estado fallido**: ver sección 4.6

Al final, mostrar pantalla con resumen estadístico de la partida: años gobernados, régimen final, indicadores económicos, sociales, legado histórico.

---

## 10. Notas críticas para el agente

- **Prioriza la conexión entre sistemas**: lo importante no es que cada módulo tenga muchas opciones, sino que las decisiones en un módulo afecten a otros de forma visible. Un cambio en Economía debe verse reflejado en empleo, en aprobación de clase media, en presión sobre Seguridad, etc.
- **El motor debe ser determinista** (sembrado) y **puro**: separar lógica de cálculo de I/O.
- **Performance**: el cálculo de un turno debe correr en <1 segundo. Evitar consultas N+1 en Prisma.
- **No scripted events**: todo evento se dispara por umbrales numéricos + probabilidad, nunca por triggers narrativos prefijados.
- **Persistencia incremental**: cada turno crea un nuevo `MonthSnapshot`, no se sobrescribe el anterior. Esto permite gráficos históricos y eventualmente "replay".
- **Documentación inline**: comenta las fórmulas del motor para que el balanceo sea ajustable. Centraliza constantes de balanceo en un archivo `balance.ts`.
- **Testing**: tests unitarios mínimos para el motor de cálculo (turno determinista dado un estado inicial).
- **i18n**: textos en español. No es necesario soporte multi-idioma en MVP.

---

## 11. Entregables esperados

1. Repositorio Next.js funcional con `npm run dev` operativo
2. Schema de Prisma completo con migración inicial aplicable
3. Motor de cálculo de turno con tests unitarios básicos
4. Todas las pantallas de la sección 7 implementadas (mínimo funcional, no necesariamente pulidas)
5. Onboarding básico (crear partida con preset)
6. Sistema de save/load (partidas persistentes en DB asociadas a usuario)
7. README con instrucciones de setup (DB, variables de entorno, seed inicial)
8. Documento `BALANCE.md` describiendo las fórmulas del motor y dónde ajustarlas
9. Documento `PHASE2.md` listando los módulos pendientes y cómo integrarlos al esquema actual

---

## 12. Sugerencia de orden de implementación

1. Setup base (Next.js + Prisma + DB + auth simple)
2. Esquema completo de Prisma + migración + seed inicial (genera partidas de ejemplo)
3. Motor de cálculo central + tests
4. Dashboard principal con HUD y avance de mes
5. Vista de ministerios y sub-decisiones
6. Sistema de leyes + Senado con partidos y votación
7. Justicia individualizada + casos
8. Corrupción individual + organismos
9. Clases sociales
10. Régimen emergente (métricas + clasificación)
11. Indicadores + eventos emergentes
12. Medios de comunicación
13. Pantallas de Reportes históricos
14. Onboarding y configuración de partida
15. Condiciones de fin de partida + pantalla resumen
16. Polish y testing integral

---

Fin de la especificación.