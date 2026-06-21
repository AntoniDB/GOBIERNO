# Simulador de Gobierno y Sociedad

Simulador de gobierno y sociedad en el que el jugador asume el cargo de mandatario de un pais. Cada turno representa **1 mes**. Las decisiones del jugador modifican datos crudos y un motor matematico recalcula todo el estado. Los problemas y eventos son **emergentes**, no scripteados.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Base de datos**: PostgreSQL + Prisma 7
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Graficos**: Recharts
- **Estado del cliente**: Zustand
- **Tests**: Vitest

## Requisitos previos

- Node.js 22+
- PostgreSQL 16+
- Docker (opcional, para levantar la DB)

## Setup

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd juego_de_la_vida
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL:
#   DATABASE_URL="postgresql://usuario:password@localhost:5432/simulador"
#   AUTH_SECRET="cualquier-string-largo"

# 3. Levantar PostgreSQL (opcion A: Docker)
docker compose up -d

# 4. Ejecutar migraciones
npx prisma migrate deploy
# o para desarrollo:
npx prisma migrate dev

# 5. Poblar la base de datos con datos de demo
npx prisma db seed

# 6. Iniciar el servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Usuario demo

- Email: `demo@simulador.local`
- Password: `demo123`

## Comandos

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de produccion |
| `npm run start` | Iniciar en produccion |
| `npm run lint` | Linter (ESLint) |
| `npx vitest run` | Ejecutar todos los tests |
| `npx vitest` | Tests en modo watch |
| `npx prisma db seed` | Re-poblar la base de datos |
| `npx prisma studio` | Explorador visual de la DB |

## Arquitectura

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── (game)/               # Layout del juego (sidebar + HUD)
│   │   ├── dashboard/        # Panel principal
│   │   ├── ministerios/      # 8 ministerios con sub-decisiones
│   │   ├── congreso/         # Leyes, Senado, partidos
│   │   ├── justicia/         # Casos judiciales, funcionarios, organismos
│   │   ├── poblacion/        # 4 clases sociales
│   │   ├── medios/           # 3 medios de comunicacion
│   │   ├── regimen/          # 7 metricas de regimen emergente
│   │   ├── reportes/         # Graficos historicos (Recharts)
│   │   └── fin/              # Pantalla de fin de partida
│   ├── nueva-partida/        # Wizard de creacion de partida
│   └── actions/              # Server Actions (turno, juego, congreso)
├── lib/
│   ├── balance.ts            # Constantes de balance centralizadas
│   ├── game-factory.ts       # Generacion de entidades por preset
│   ├── rng.ts                # PRNG determinista (mulberry32)
│   ├── prisma.ts             # Cliente Prisma singleton
│   └── engine/               # Motor de calculo puro (14 pasos)
│       ├── turn.ts           # Orquestador principal
│       ├── economy.ts        # Ingresos, gastos, tesoro, PIB, inflacion
│       ├── ministries.ts     # Eficiencia ministerial
│       ├── corruption.ts     # Corrupcion individual y global
│       ├── indicators.ts     # 8 indicadores sociales
│       ├── approval.ts       # Aprobacion por clase social
│       ├── justice.ts        # Casos judiciales
│       ├── congress.ts       # Senado bicameral, votacion, mociones
│       ├── regime.ts         # 7 metricas + clasificacion
│       ├── events.ts         # Eventos emergentes
│       ├── media.ts          # Coberturas mediaticas
│       ├── snapshot.ts       # Creacion de MonthSnapshot
│       └── game-over.ts      # Condiciones de fin de partida
└── components/
    ├── ui/                   # Componentes shadcn/ui
    └── game/                 # Componentes del juego
```

## Flujo de un turno

1. El jugador toma decisiones (presupuestos, leyes, nombramientos, organismos)
2. Presiona "Avanzar Mes"
3. El servidor ejecuta 14 pasos deterministicos
4. Se persiste todo en una transaccion atomica
5. Se genera un `MonthSnapshot` para graficos historicos
6. Se evaluan condiciones de fin de partida
7. Se devuelve el nuevo estado + notificaciones

## Documentacion adicional

- `SPEC.md`: Especificacion completa del proyecto
- `BALANCE.md`: Formulas del motor y donde ajustarlas
- `PHASE2.md`: Modulos pendientes y plan de integracion
- `AGENTS.md`: Instrucciones para desarrollo con agentes
