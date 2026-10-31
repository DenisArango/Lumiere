import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { paginate, toSkipTake, paginationSchema, type PaginatedResult } from "@/utils/pagination";
import { z } from "zod";

export interface AuditInput {
  /** null cuando lo origina el sistema (por ejemplo un webhook del proveedor de pago). */
  userId?: string | null;
  /** Verbo con punto: "order.refund", "user.update", "webhook.order_paid". */
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/**
 * Registra una accion en la bitacora. Una falla al auditar JAMAS debe tumbar la operacion real (el
 * reembolso ya ocurrio): se registra en el log del servidor y se sigue.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "No se pudo registrar la acción en la bitácora");
  }
}

export const listAuditLogsQuerySchema = paginationSchema.extend({
  entityType: z.string().trim().min(1).max(50).optional(),
  action: z.string().trim().min(1).max(100).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export async function listAuditLogs(query: ListAuditLogsQuery): Promise<PaginatedResult<unknown>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paginate(items, total, query);
}
