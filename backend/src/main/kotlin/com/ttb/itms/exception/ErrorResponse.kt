package com.ttb.itms.exception

import java.time.Instant

/**
 * Unified error response matching the API error contract.
 * Every error has timestamp/status/code/message/path/fieldErrors.
 */
data class ErrorResponse(
	val timestamp: Instant = Instant.now(),
	val status: Int,
	val code: String,
	val message: String,
	val path: String,
	val fieldErrors: Map<String, String> = emptyMap()
)
