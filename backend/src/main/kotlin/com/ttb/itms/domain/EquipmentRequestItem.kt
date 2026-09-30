package com.ttb.itms.domain

import jakarta.persistence.*
import java.time.temporal.ChronoUnit
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "equipment_request_items")
class EquipmentRequestItem(
	@Id
	val id: UUID = UUID.randomUUID(),

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "request_id", nullable = false)
	var request: EquipmentRequest? = null,

	@Enumerated(EnumType.STRING)
	@Column(name = "equipment_type", nullable = false)
	var equipmentType: EquipmentType = EquipmentType.NOTEBOOK,

	@Column(name = "quantity", nullable = false)
	var quantity: Int = 1,

	@Column(name = "specification", length = 250)
	var specification: String? = null,

	@Column(name = "created_at", nullable = false, updatable = false)
	var createdAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS),

	@Column(name = "updated_at", nullable = false)
	var updatedAt: Instant = Instant.now().truncatedTo(ChronoUnit.MICROS)
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
}
