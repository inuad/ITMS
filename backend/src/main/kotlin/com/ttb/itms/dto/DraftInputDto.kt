package com.ttb.itms.dto

import com.ttb.itms.domain.EquipmentType
import jakarta.validation.Valid
import jakarta.validation.constraints.*

/**
 * Write DTO for creating/editing a draft request.
 * Field validation follows the matrix in the implementation plan.
 */
data class DraftInputDto(
	@field:NotBlank(message = "Employee name is required")
	@field:Size(min = 2, max = 100, message = "Employee name must be between 2 and 100 characters")
	val employeeName: String?,

	@field:NotBlank(message = "Employee email is required")
	@field:Email(message = "Employee email must be a valid email format")
	val employeeEmail: String?,

	@field:NotBlank(message = "Department is required")
	val department: String?,

	@field:NotBlank(message = "Title is required")
	@field:Size(min = 5, max = 150, message = "Title must be between 5 and 150 characters")
	val title: String?,

	@field:NotBlank(message = "Purpose is required")
	@field:Size(min = 10, max = 500, message = "Purpose must be between 10 and 500 characters")
	val purpose: String?,

	@field:NotBlank(message = "Required date is required")
	@field:Pattern(
		regexp = "\\d{4}-\\d{2}-\\d{2}",
		message = "Required date must be in YYYY-MM-DD format"
	)
	val requiredDate: String?,

	@field:Size(max = 500, message = "Additional note must not exceed 500 characters")
	val additionalNote: String? = null,

	@field:Valid
	val items: List<@NotNull @Valid ItemInputDto> = emptyList()
)
