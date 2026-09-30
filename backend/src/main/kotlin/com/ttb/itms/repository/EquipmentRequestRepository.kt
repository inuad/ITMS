package com.ttb.itms.repository

import com.ttb.itms.domain.EquipmentRequest
import com.ttb.itms.domain.RequestStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface ItemTotal {
	val requestId: UUID
	val total: Long
}

interface EquipmentRequestRepository : JpaRepository<EquipmentRequest, UUID> {

	@Query("""
		SELECT i.request.id AS requestId, SUM(i.quantity) AS total
		FROM EquipmentRequestItem i WHERE i.request.id IN :ids GROUP BY i.request.id
	""")
	fun itemTotals(@Param("ids") ids: List<UUID>): List<ItemTotal>

	/**
	 * Search with optional keyword, status, department, and owner scope.
	 * Keyword searches requestNumber, title, employeeName case-insensitively.
	 * All filters combine with AND.
	 */
	@Query("""
		SELECT r FROM EquipmentRequest r
		WHERE (:ownerEmail IS NULL OR r.employeeEmail = :ownerEmail)
		  AND (:status IS NULL OR r.status = :status)
		  AND (:department IS NULL OR r.department = :department)
		  AND (:keyword IS NULL
		       OR LOWER(r.requestNumber) LIKE LOWER(CAST(:keyword AS string)) ESCAPE '!'
		       OR LOWER(r.title) LIKE LOWER(CAST(:keyword AS string)) ESCAPE '!'
		       OR LOWER(r.employeeName) LIKE LOWER(CAST(:keyword AS string)) ESCAPE '!')
	""")
	fun search(
		@Param("ownerEmail") ownerEmail: String?,
		@Param("keyword") keyword: String?,
		@Param("status") status: RequestStatus?,
		@Param("department") department: String?,
		pageable: Pageable
	): Page<EquipmentRequest>
}
