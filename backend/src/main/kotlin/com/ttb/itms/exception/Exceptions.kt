package com.ttb.itms.exception

/**
 * Custom exceptions for the ITMS error contract.
 * These map to specific HTTP status codes and error codes.
 */

/** 400 — Invalid request format or fields */
class ValidationException(
	message: String,
	val fieldErrors: Map<String, String> = emptyMap()
) : RuntimeException(message)

/** 403 — Invalid identity pair, role, or ownership */
class ForbiddenException(message: String) : RuntimeException(message)

/** 404 — Request not found */
class NotFoundException(message: String) : RuntimeException(message)

/** 409 — Version conflict (stale version) */
class VersionConflictException(message: String) : RuntimeException(message)

/** 409 — State conflict (invalid transition) */
class StateConflictException(message: String) : RuntimeException(message)

/** 422 — Business rule violation */
class BusinessRuleException(
	message: String,
	val fieldErrors: Map<String, String> = emptyMap()
) : RuntimeException(message)
