package com.ttb.itms.domain

import jakarta.persistence.*
import org.hibernate.annotations.Generated
import org.hibernate.generator.EventType
import java.time.temporal.ChronoUnit
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Entity
@Table(name = "equipment_requests")
class EquipmentRequest(
	@Id
	val id: UUID = UUID.randomUUID(),

	@Generated(event = [EventType.INSERT])
	@Column(name = "request_number", nullable = false, unique = true, insertable = false, updatable = false, length = 28)
	var requestNumber: String = "",

	@Column(name = "employee_name", nullable = false, length = 100)
	var employeeName: String = "",

	@Column(name = "employee_email", nullable = false)
	var employeeEmail: String = "",

	@Column(name = "department", nullable = false, columnDefinition = "text")
	var department: String = "",

	@Column(name = "title", nullable = false, length = 150)
	var title: String = "",

	@Column(name = "purpose", nullable = false, length = 500)
	var purpose: String = "",

	@Column(name = "required_date", nullable = false)
	var requiredDate: LocalDate = LocalDate.now(),

	@Column(name = "additional_note", length = 500)
	var additionalNote: String? = null,

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false)
	var status: RequestStatus = RequestStatus.DRAFT,

	@Column(name = "rejection_reason")
	var rejectionReason: String? = null,

	@Version
	@Column(name = "version", nullable = false)
	var version: Long = 0,

	@Column(name = "created_at", nullable = false, updatable = false)
	var createdAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),

	@Column(name = "updated_at", nullable = false)
	var updatedAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),

	@OneToMany(
		mappedBy = "request",
		cascade = [CascadeType.ALL],
		orphanRemoval = true,
		fetch = FetchType.LAZY
	)
	var items: MutableList<EquipmentRequestItem> = mutableListOf()
) {
	@PrePersist
	fun onPrePersist() {
		val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
		createdAt = now
		updatedAt = now
	}

	@PreUpdate
	fun onPreUpdate() {
		updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS)
	}

	fun addItem(item: EquipmentRequestItem) {
		items.add(item)
		item.request = this
	}

	fun clearItems() {
		items.forEach { it.request = null }
		items.clear()
	}

	val totalItems: Int
		get() = items.sumOf { it.quantity }
}
