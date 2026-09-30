package com.ttb.itms.dto

import com.ttb.itms.domain.EquipmentRequest
import com.ttb.itms.domain.EquipmentRequestItem
import com.ttb.itms.domain.EquipmentType
import com.ttb.itms.domain.RequestStatus
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * List row response — matches frontend RequestRow type.
 */
data class RequestRowDto(
	val id: UUID,
	val requestNumber: String,
	val employeeName: String,
	val employeeEmail: String,
	val department: String,
	val title: String,
	val requiredDate: LocalDate,
	val totalItems: Int,
	val status: RequestStatus,
	val version: Long,
	val createdAt: Instant,
	val updatedAt: Instant
) {
	companion object {
		fun from(entity: EquipmentRequest, totalItems: Int = entity.totalItems): RequestRowDto = RequestRowDto(
			id = entity.id,
			requestNumber = entity.requestNumber,
			employeeName = entity.employeeName,
			employeeEmail = entity.employeeEmail,
			department = entity.department,
			title = entity.title,
			requiredDate = entity.requiredDate,
			totalItems = totalItems,
			status = entity.status,
			version = entity.version,
			createdAt = entity.createdAt,
			updatedAt = entity.updatedAt
		)
	}
}

/**
 * Detail response — matches frontend RequestDetail type.
 */
data class RequestDetailDto(
	val id: UUID,
	val requestNumber: String,
	val employeeName: String,
	val employeeEmail: String,
	val department: String,
	val title: String,
	val purpose: String,
	val requiredDate: LocalDate,
	val additionalNote: String?,
	val totalItems: Int,
	val status: RequestStatus,
	val rejectionReason: String?,
	val version: Long,
	val createdAt: Instant,
	val updatedAt: Instant,
	val items: List<ItemDetailDto>
) {
	companion object {
		fun from(entity: EquipmentRequest): RequestDetailDto = RequestDetailDto(
			id = entity.id,
			requestNumber = entity.requestNumber,
			employeeName = entity.employeeName,
			employeeEmail = entity.employeeEmail,
			department = entity.department,
			title = entity.title,
			purpose = entity.purpose,
			requiredDate = entity.requiredDate,
			additionalNote = entity.additionalNote,
			totalItems = entity.totalItems,
			status = entity.status,
			rejectionReason = entity.rejectionReason,
			version = entity.version,
			createdAt = entity.createdAt,
			updatedAt = entity.updatedAt,
			items = entity.items.map { ItemDetailDto.from(it) }
		)
	}
}

/**
 * Item detail within a response.
 */
data class ItemDetailDto(
	val id: UUID,
	val equipmentType: EquipmentType,
	val quantity: Int,
	val specification: String?,
	val createdAt: Instant,
	val updatedAt: Instant
) {
	companion object {
		fun from(entity: EquipmentRequestItem): ItemDetailDto = ItemDetailDto(
			id = entity.id,
			equipmentType = entity.equipmentType,
			quantity = entity.quantity,
			specification = entity.specification,
			createdAt = entity.createdAt,
			updatedAt = entity.updatedAt
		)
	}
}

/**
 * Page response — matches frontend Page<T> type.
 */
data class PageDto<T>(
	val content: List<T>,
	val page: Int,
	val size: Int,
	val totalElements: Long,
	val totalPages: Int
)
