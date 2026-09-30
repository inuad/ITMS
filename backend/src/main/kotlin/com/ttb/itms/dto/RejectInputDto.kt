package com.ttb.itms.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

/**
 * Reject input: version + reason.
 */
data class RejectInputDto(
	@field:NotNull(message = "Version is required")
	val version: Long?,

	@field:NotBlank(message = "Rejection reason is required")
	val reason: String?
)
