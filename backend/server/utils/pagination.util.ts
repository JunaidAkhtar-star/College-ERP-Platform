import type { PaginationQuery, PaginatedResult } from "../types";

/** Parse and sanitize pagination parameters from a request query. */
export function parsePagination(query: Record<string, unknown>): Required<PaginationQuery> {
  const page = Math.max(1, parseInt(String(query.page ?? 1), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 20), 10)));
  const sortBy = typeof query.sortBy === "string" ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const search = typeof query.search === "string" ? query.search.trim() : "";
  return { page, limit, sortBy, sortOrder, search };
}

/** Build a PaginatedResult wrapper from raw data. */
export function buildPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
