/** Standard paginated query parameters extracted from request query string. */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

/** Generic paginated response wrapper. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** Standard API success response shape. */
export interface ApiResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

/** Standard API error response shape. */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/** File upload result from Cloudinary. */
export interface UploadResult {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  format: string;
  bytes: number;
}
