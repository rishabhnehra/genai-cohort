/**
 * Application error with a stable machine-readable `code` and a `safeMessage`
 * that is OK to surface to end users (never leaks internals like stack
 * traces, file paths, or upstream provider errors).
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly safeMessage: string;

  constructor(
    code: string,
    safeMessage: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(safeMessage, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? 400;
    this.safeMessage = safeMessage;
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  FETCH_BLOCKED: "FETCH_BLOCKED",
  FETCH_FAILED: "FETCH_FAILED",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  EMBEDDING_FAILED: "EMBEDDING_FAILED",
  INDEXING_FAILED: "INDEXING_FAILED",
  SOURCE_NOT_READY: "SOURCE_NOT_READY",
  INTERNAL: "INTERNAL",
} as const;

export function toSafeErrorPayload(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof AppError) {
    return { errorCode: error.code, errorMessage: error.safeMessage };
  }

  if (error instanceof Error) {
    return { errorCode: ErrorCodes.INTERNAL, errorMessage: "Something went wrong while processing this source." };
  }

  return { errorCode: ErrorCodes.INTERNAL, errorMessage: "An unknown error occurred." };
}

/** Maps an AppError (or generic error) to an HTTP JSON response body + status. */
export function toApiErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.safeMessage, code: error.code } };
  }

  console.error(error);
  return {
    status: 500,
    body: { error: "Something went wrong.", code: ErrorCodes.INTERNAL },
  };
}
