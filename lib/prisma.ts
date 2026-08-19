import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton so hot reload doesn't open a new
// Postgres connection pool on every file save and exhaust Supabase's
// connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
