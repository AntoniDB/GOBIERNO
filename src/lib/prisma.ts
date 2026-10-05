import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildPoolConfig } from "@/lib/db-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// La conexión (URL, SSL, pool, timeouts) se configura solo por entorno: ver lib/db-config.ts
function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(buildPoolConfig()) });
}

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") return (client ??= createClient());
  // En desarrollo (HMR) se reutiliza entre recargas de módulos
  return (globalForPrisma.prisma ??= createClient());
}

/**
 * Cliente de Prisma. Se crea en el primer uso, no al importar el módulo: así `next build`
 * (que importa los módulos sin base de datos) no exige `DATABASE_URL`, y si falta o es
 * inválida el error de configuración aparece al primer acceso, con un mensaje claro.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
