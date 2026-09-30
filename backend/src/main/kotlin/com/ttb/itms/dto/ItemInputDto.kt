package com.ttb.itms.dto

import com.ttb.itms.domain.EquipmentType
import jakarta.validation.constraints.*

/**
 * Item within a draft request.
 */
data class ItemInputDto(
	@field:NotNull(message = "Equipment type is required")
	val equipmentType: EquipmentType?,

	@field:NotNull(message = "Quantity is required")
	@field:Min(value = 1, message = "Quantity must be at least 1")
	@field:Max(value = 5, message = "Quantity must be at most 5")
	val quantity: Int?,

	@field:Size(max = 250, message = "Specification must not exceed 250 characters")
	val specification: String? = null
)
