import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Prisma 7 requiere adapter o accelerateUrl en tipos, pero a runtime
// el datasource configurado en prisma.config.ts es suficiente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = globalForPrisma.prisma || new (PrismaClient as any)();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
