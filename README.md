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
# Editar .env: DATABASE_URL (local con Docker, o un Postgres remoto: ver "PostgreSQL en un VPS")
# y AUTH_SECRET (cualquier string largo; tambien se acepta el nombre antiguo NEXTAUTH_SECRET)

# 3. Levantar PostgreSQL (opcion A: Docker; si usas un Postgres remoto, omite este paso)
docker compose up -d

# 3b. Comprobar la conexion (local o remota)
npm run db:check

# 4. Ejecutar migraciones
npx prisma migrate deploy
# o para desarrollo:
npx prisma migrate dev

# 5. Poblar el catalogo de leyes (idempotente: se puede repetir sin borrar datos)
npx prisma db seed

# 6. Iniciar el servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## PostgreSQL en un VPS

La app solo necesita una cadena de conexion en `DATABASE_URL`; el resto (TLS, pool, timeouts) se
configura por variables de entorno (ver `.env.example` y `src/lib/db-config.ts`).

**1. En el servidor** (como superusuario de Postgres): crear un rol y una base dedicados, sin privilegios de superusuario.

```sql
CREATE ROLE simulador LOGIN PASSWORD 'una-clave-larga';
CREATE DATABASE simulador OWNER simulador;
```

**2. Acceso remoto.** En `postgresql.conf`: `listen_addresses = '*'` (o la IP publica). En `pg_hba.conf`, permitir solo
tu IP y exigir TLS: `hostssl simulador simulador <TU_IP>/32 scram-sha-256`. Abrir el puerto 5432 en el firewall
**solo para esa IP** (la de tu maquina de desarrollo y, luego, la del servidor de produccion). Para cifrar, activar
`ssl = on` con certificado y clave en `postgresql.conf`; si no puedes, usa un tunel SSH
(`ssh -L 5432:localhost:5432 usuario@vps` y `DATABASE_URL` apuntando a `localhost`).

**3. En tu `.env`** (la contraseña, codificada si tiene `@ : / ? # %`; nunca se sube al repo):

```bash
DATABASE_URL="postgresql://simulador:CLAVE@mi-vps.example.com:5432/simulador"
DATABASE_SSL="require"      # certificado autofirmado; "verify" (+ DATABASE_SSL_CA) si el certificado es valido
```

La CLI de Prisma (`migrate`, `db seed`) no lee `DATABASE_SSL`: negocia TLS por su cuenta a partir de la URL. En las
pruebas conectó sin parametros extra a un servidor que exigia TLS con certificado autofirmado; si el tuyo falla por el
certificado, añade a la URL `?sslmode=require&sslaccept=accept_invalid_certs` (opcion documentada por Prisma).

**4. Comprobar y preparar la base** (la primera vez):

```bash
npm run db:check             # servidor, usuario, si va cifrado, latencia y migraciones aplicadas
npx prisma migrate deploy    # crea las tablas (aplica todas las migraciones pendientes)
npx prisma db seed           # catalogo de leyes (idempotente)
```

**Latencia.** Cada consulta a un Postgres remoto cuesta una ida y vuelta de red (≈200 ms a un VPS lejano; ≈1 ms si la app
corre en el mismo servidor). Guardar un turno se agrupa en ≈15 sentencias (antes ≈85), asi que con 200 ms un turno tarda
≈6 s; crear una partida (cientos de inserts) puede tardar ~40 s. Para desarrollar con comodidad usa una base local
(Docker) y deja la remota para probar el despliegue; en produccion, con la app en el mismo VPS, no se nota. El tiempo
maximo de una transaccion se ajusta con `DATABASE_TRANSACTION_TIMEOUT_MS` (60 s por defecto).

En produccion la app usa la misma `DATABASE_URL` (definida como variable de entorno del servidor, no en un archivo del repo).

## Actualizar tras un `git pull`

```bash
npm install                  # tambien regenera el cliente de Prisma (postinstall)
npx prisma migrate deploy    # aplica migraciones nuevas a tu base de datos
```

Si ves `Unknown argument ...` al crear una partida o `Unknown field`, el cliente de Prisma esta desfasado del esquema:
ejecuta `npm run prisma:generate` y reinicia `npm run dev` (el servidor en marcha mantiene cargado el cliente viejo).

## Comandos

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de produccion |
| `npm run start` | Iniciar en produccion |
| `npm run lint` | Linter (ESLint) |
| `npx vitest run` | Ejecutar todos los tests |
| `npx vitest` | Tests en modo watch |
| `npm run db:check` | Comprobar la conexion a PostgreSQL (cifrado, latencia, migraciones) |
| `npx prisma db seed` | Poblar el catalogo de leyes (idempotente) |
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
