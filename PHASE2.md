# PHASE2.md — Modulos pendientes y como integrarlos

Este documento lista los modulos de fase 2 que tienen esquema de base de datos pero no logica completa. Todos los modelos existen en `prisma/schema.prisma`.

---

## Modulos con esquema, sin logica

### 1. Geopolitica (`Country`, `Treaty`)
- **Modelos**: `Country`, `Treaty`
- **Estado**: Solo esquema. La tabla `Country` tiene `relationStatus`, `militaryPower`, `economicPower`, `isNeighbor`.
- **Integracion**: 
  - Agregar generacion de paises vecinos en `game-factory.ts` (o seed)
  - Crear `src/lib/engine/geopolitics.ts` con funciones de relacion diplomatica, sanciones, alianzas
  - Nueva vista `/relaciones-exteriores` en `src/app/(game)/`
  - Modificar `economy.ts:calculateIncome` para incluir ingresos/egresos por comercio exterior

### 2. Enfermedades (`Disease`)
- **Modelo**: `Disease` (contagionRate, mortalityRate, prevalence, hasVaccine)
- **Estado**: Esquema listo. La logica actual usa `sickRate` como indicador agregado.
- **Integracion**:
  - Crear `src/lib/engine/disease.ts` con propagacion y mutaciones
  - Reemplazar eventos EPIDEMIC para usar el catalogo de enfermedades
  - Sub-decision de Salud "vacunacion" ya existente → conectar a diseases

### 3. Infraestructura (`Infrastructure`, `Region`)
- **Modelos**: `Infrastructure` (ENERGY, WATER, ROADS, RAIL, INTERNET, HOUSING), `Region`
- **Estado**: Solo esquema.
- **Integracion**:
  - Generar regiones e infraestructura en `game-factory.ts`
  - Crear `src/lib/engine/infrastructure.ts` con efectos en economia y calidad de vida
  - Nueva vista `/infraestructura` con mapa conceptual de regiones

### 4. Ministerios fase 2
- **Enumerados**: `FOREIGN_AFFAIRS`, `ENVIRONMENT`, `LABOR`, `INFRASTRUCTURE`, `CULTURE`, `SCIENCE_TECH`
- **Estado**: Definidos en el enum `MinistryKey` pero no creados en seed ni game-factory
- **Integracion**:
  - Agregar sub-decisiones para cada ministerio nuevo
  - Conectar a indicadores existentes (ej: ENVIRONMENT → salud, desastres naturales)
  - Actualizar `generateMinistries` en `game-factory.ts`

### 5. Division regional
- **Modelo**: `Region` (populationPercent, povertyRate, infrastructureLevel)
- **Integracion**:
  - Generar 3-6 regiones con caracteristicas diferenciadas
  - Desglosar `povertyRate` y otros indicadores por region
  - Afectar aprobacion y estabilidad por region

### 6. Demografia detallada
- **Concepto**: Piramide poblacional, mortalidad por edad, natalidad
- **Integracion**:
  - Agregar modelo `PopulationSegment` (ageGroup, count, birthRate, deathRate)
  - Conectar a ministerio de SALUD y DESARROLLO_SOCIAL

### 7. Inflacion completa
- **Concepto**: Modelo monetario con Banco Central, oferta monetaria, tasas
- **Estado actual**: `calculateInflation` usa solo deficit fiscal
- **Integracion**:
  - Crear sub-decisiones de ECONOMIA para politica monetaria
  - Conectar al organismo CENTRAL_BANK

### 8. Medio ambiente y cambio climatico
- **Concepto**: Contaminacion, emisiones, desastres naturales intensificados
- **Integracion**:
  - Conectar al ministerio ENVIRONMENT (nuevo)
  - Agregar indicador ambiental que afecte salud, agricultura, eventos

---

## Orden recomendado de implementacion

1. Geopolitica (mayor impacto en gameplay)
2. Infraestructura + Regiones (profundiza la simulacion interna)
3. Enfermedades (agrega profundidad a Salud y eventos)
4. Ministerios nuevos (expande opciones del jugador)
5. Modelo monetario (profundiza Economia)
6. Demografia (capa adicional de realismo)
7. Medio ambiente (capa de presion a largo plazo)

---

## Puntos de integracion en el codigo actual

| Archivo | Que modificar |
|---------|--------------|
| `src/lib/engine/economy.ts` | Agregar comercio exterior, modelo monetario |
| `src/lib/engine/indicators.ts` | Agregar indicador ambiental, desglose regional |
| `src/lib/engine/events.ts` | Conectar enfermedades a eventos EPIDEMIC |
| `src/lib/engine/turn.ts` | Agregar pasos para geopolitica, infraestructura |
| `src/lib/game-factory.ts` | Generar paises, enfermedades, regiones, infraestructura |
| `src/app/(game)/` | Nuevas vistas: relaciones-exteriores, infraestructura |
| `prisma/schema.prisma` | Los modelos ya existen (Country, Disease, etc.) |

---

## Reglas para la integracion

- Respetar el patron: funciones puras en `lib/engine/`, persistencia en `app/actions/`
- Centralizar constantes de balance en `lib/balance.ts`
- Crear tests para cada funcion pura nueva
- Mantener i18n en espanol
- No duplicar calculos: leer valores ya computados donde sea posible
