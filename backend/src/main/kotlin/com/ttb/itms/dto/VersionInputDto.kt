package com.ttb.itms.dto

import jakarta.validation.constraints.NotNull

/**
 * Version-only input for submit/approve/cancel actions.
 */
data class VersionInputDto(
	@field:NotNull(message = "Version is required")
	val version: Long?
)
