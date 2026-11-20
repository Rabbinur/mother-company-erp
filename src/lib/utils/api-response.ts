import { NextResponse } from "next/server";

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export function successResponse<T>(
  data: T,
  message = "Operation completed successfully",
  meta?: ApiResponseMeta,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

export function errorResponse(
  message = "An error occurred",
  status = 400,
  details: unknown = null,
  code = "OPERATION_FAILED"
) {
  return NextResponse.json(
    {
      success: false,
      message,
      code,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function unauthorizedResponse(message = "Authentication required") {
  return errorResponse(message, 401, null, "UNAUTHORIZED");
}

export function forbiddenResponse(message = "Insufficient permissions to perform this action") {
  return errorResponse(message, 403, null, "FORBIDDEN");
}

export function notFoundResponse(message = "Resource not found") {
  return errorResponse(message, 404, null, "NOT_FOUND");
}
