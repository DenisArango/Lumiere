import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  /** null cuando lo origino el sistema (por ejemplo un webhook del proveedor de pago). */
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface ListAuditParams {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
}

async function fetchAuditLogs(params: ListAuditParams): Promise<PaginatedResult<AuditEntry>> {
  const { data } = await apiClient.get<PaginatedResult<AuditEntry>>("/audit-logs", { params });
  return data;
}

export function useAuditLogs(params: ListAuditParams) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => fetchAuditLogs(params),
    placeholderData: (previous) => previous,
  });
}
