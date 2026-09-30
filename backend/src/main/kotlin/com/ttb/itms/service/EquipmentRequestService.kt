package com.ttb.itms.service

import com.ttb.itms.configuration.RequestCache
import com.ttb.itms.configuration.ListCacheKey
import com.ttb.itms.configuration.IdentityRegistry
import com.ttb.itms.configuration.Role
import com.ttb.itms.configuration.SimulatedIdentity
import com.ttb.itms.domain.*
import com.ttb.itms.dto.*
import com.ttb.itms.exception.*
import com.ttb.itms.repository.EquipmentRequestRepository
import jakarta.validation.Validator
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.temporal.ChronoUnit
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

@Service
class EquipmentRequestService(
	private val repository: EquipmentRequestRepository,
	private val validator: Validator,
	private val cache: RequestCache
) {
	companion object {
		private val BANGKOK = ZoneId.of("Asia/Bangkok")
		private val VALID_SORT_FIELDS = setOf("createdAt")
		private val VALID_SORT_DIRECTIONS = setOf("asc", "desc")
	}

	// ── Identity resolution ───────────────────────────────────────────

	/**
	 * Resolve identity from headers.
	 * Invalid format → 400; invalid pair → 403.
	 */
	fun resolveIdentity(roleHeader: String?, emailHeader: String?): SimulatedIdentity {
		if (roleHeader.isNullOrBlank() || emailHeader.isNullOrBlank()) {
			throw ValidationException("X-User-Role and X-User-Email headers are required")
		}
		val role = IdentityRegistry.parseRole(roleHeader)
			?: throw ValidationException("Invalid role: $roleHeader")
		if (validator.validateValue(DraftInputDto::class.java, "employeeEmail", emailHeader).isNotEmpty()) {
			throw ValidationException("Invalid email header")
		}
		return IdentityRegistry.resolve(role, emailHeader)
			?: throw ForbiddenException("Unknown identity: $roleHeader / $emailHeader")
	}

	// ── Create ────────────────────────────────────────────────────────

	@Transactional
	fun create(identity: SimulatedIdentity, input: DraftInputDto): RequestDetailDto {
		requireEmployee(identity)
		requireOwnerMatch(identity, input.employeeEmail)
		validateRequiredDate(input.requiredDate!!)

		val request = EquipmentRequest(
			employeeName = input.employeeName!!,
			employeeEmail = input.employeeEmail!!,
			department = input.department!!,
			title = input.title!!,
			purpose = input.purpose!!,
			requiredDate = LocalDate.parse(input.requiredDate),
			additionalNote = input.additionalNote?.takeIf { it.isNotBlank() },
			status = RequestStatus.DRAFT
		)

		input.items.forEach { itemInput ->
			request.addItem(toItemEntity(itemInput))
		}

		return save(request)
	}

	// ── List / Search ─────────────────────────────────────────────────

	@Transactional(readOnly = true)
	fun list(
		identity: SimulatedIdentity,
		keyword: String?,
		status: String?,
		department: String?,
		page: Int?,
		size: Int?,
		sort: String?
	): PageDto<RequestRowDto> {
		val resolvedPage = (page ?: 0).also {
			if (it < 0) throw ValidationException("Page must be >= 0")
		}
		val resolvedSize = (size ?: 10).also {
			if (it < 1 || it > 100) throw ValidationException("Size must be between 1 and 100")
		}

		val sortOrder = parseSort(sort ?: "createdAt,desc")
		val pageable = PageRequest.of(resolvedPage, resolvedSize, sortOrder)

		val statusEnum = status?.let {
			try { RequestStatus.valueOf(it) } catch (_: IllegalArgumentException) {
				throw ValidationException("Invalid status: $it")
			}
		}

		// Employee sees only own requests; Approver sees all
		val key = ListCacheKey(identity, keyword, status, department, resolvedPage, resolvedSize, sortOrder.toString())
		cache.list(key)?.let { return it }
		val ownerEmail = if (identity.role == Role.EMPLOYEE) identity.email else null

		val result = repository.search(
			ownerEmail = ownerEmail,
			keyword = keyword?.takeIf { it.isNotBlank() }?.let {
				"%" + it.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
			},
			status = statusEnum,
			department = department?.takeIf { it.isNotBlank() },
			pageable = pageable
		)

		val totals = if (result.isEmpty) emptyMap() else
			repository.itemTotals(result.content.map { it.id }).associate { it.requestId to it.total.toInt() }
		val response = PageDto(
			content = result.content.map { RequestRowDto.from(it, totals[it.id] ?: 0) },
			page = result.number,
			size = result.size,
			totalElements = result.totalElements,
			totalPages = result.totalPages
		)
		cache.putList(key, response)
		return response
	}

	// ── Detail ────────────────────────────────────────────────────────

	@Transactional(readOnly = true)
	fun detail(identity: SimulatedIdentity, id: UUID): RequestDetailDto {
		val detail = cache.detail(id) ?: RequestDetailDto.from(findOrThrow(id)).also { cache.putDetail(it) }
		if (identity.role == Role.EMPLOYEE && detail.employeeEmail != identity.email)
			throw ForbiddenException("You can only view your own requests")
		return detail
	}

	// ── Edit ──────────────────────────────────────────────────────────

	@Transactional
	fun edit(identity: SimulatedIdentity, id: UUID, input: DraftInputDto, expectedVersion: Long): RequestDetailDto {
		requireEmployee(identity)
		val request = findOrThrow(id)
		requireOwnership(identity, request)
		checkVersion(request, expectedVersion)
		requireStatus(request, RequestStatus.DRAFT, "edit")

		// Owner cannot change via PUT
		requireOwnerMatch(identity, input.employeeEmail)
		validateRequiredDate(input.requiredDate!!)

		val note = input.additionalNote?.takeIf { it.isNotBlank() }
		val sameItems = request.items.map { ItemInputDto(it.equipmentType, it.quantity, it.specification) }.groupingBy { it }.eachCount() ==
			input.items.map { it.copy(specification = it.specification?.takeIf { text -> text.isNotBlank() }) }.groupingBy { it }.eachCount()
		if (request.employeeName == input.employeeName && request.department == input.department &&
			request.title == input.title && request.purpose == input.purpose &&
			request.requiredDate.toString() == input.requiredDate && request.additionalNote == note && sameItems)
			return RequestDetailDto.from(request)

		request.employeeName = input.employeeName!!
		request.department = input.department!!
		request.title = input.title!!
		request.purpose = input.purpose!!
		request.requiredDate = LocalDate.parse(input.requiredDate)
		request.additionalNote = input.additionalNote?.takeIf { it.isNotBlank() }

		// Dirty the aggregate so item-only edits also participate in @Version locking.
		request.updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS)

		// Replace items
		request.clearItems()
		input.items.forEach { itemInput ->
			request.addItem(toItemEntity(itemInput))
		}

		return save(request)
	}

	// ── Submit ────────────────────────────────────────────────────────

	@Transactional
	fun submit(identity: SimulatedIdentity, id: UUID, expectedVersion: Long): RequestDetailDto {
		requireEmployee(identity)
		val request = findOrThrow(id)
		requireOwnership(identity, request)
		checkVersion(request, expectedVersion)
		requireStatus(request, RequestStatus.DRAFT, "submit")

		// Submit requires at least one item and re-validates persisted fields
		validatePersistedForSubmit(request)

		request.status = RequestStatus.PENDING
		return save(request)
	}

	// ── Approve ───────────────────────────────────────────────────────

	@Transactional
	fun approve(identity: SimulatedIdentity, id: UUID, expectedVersion: Long): RequestDetailDto {
		requireApprover(identity)
		val request = findOrThrow(id)
		checkVersion(request, expectedVersion)
		requireStatus(request, RequestStatus.PENDING, "approve")

		request.status = RequestStatus.APPROVED
		return save(request)
	}

	// ── Reject ────────────────────────────────────────────────────────

	@Transactional
	fun reject(identity: SimulatedIdentity, id: UUID, expectedVersion: Long, reason: String): RequestDetailDto {
		requireApprover(identity)
		val request = findOrThrow(id)
		checkVersion(request, expectedVersion)
		requireStatus(request, RequestStatus.PENDING, "reject")

		request.status = RequestStatus.REJECTED
		request.rejectionReason = reason
		return save(request)
	}

	// ── Cancel ────────────────────────────────────────────────────────

	@Transactional
	fun cancel(identity: SimulatedIdentity, id: UUID, expectedVersion: Long): RequestDetailDto {
		requireEmployee(identity)
		val request = findOrThrow(id)
		requireOwnership(identity, request)

		checkVersion(request, expectedVersion)
		if (request.status != RequestStatus.DRAFT && request.status != RequestStatus.PENDING) {
			throw StateConflictException("Cannot cancel request in ${request.status} status")
		}

		request.status = RequestStatus.CANCELLED
		return save(request)
	}

	private fun save(request: EquipmentRequest): RequestDetailDto {
		val saved = repository.saveAndFlush(request)
		cache.invalidateAfterCommit(saved.id)
		return RequestDetailDto.from(saved)
	}

	// ── Private helpers ───────────────────────────────────────────────

	private fun findOrThrow(id: UUID): EquipmentRequest =
		repository.findById(id).orElseThrow {
			NotFoundException("Equipment request not found: $id")
		}

	private fun requireEmployee(identity: SimulatedIdentity) {
		if (identity.role != Role.EMPLOYEE)
			throw ForbiddenException("Only employees can perform this action")
	}

	private fun requireApprover(identity: SimulatedIdentity) {
		if (identity.role != Role.APPROVER)
			throw ForbiddenException("Only approvers can perform this action")
	}

	private fun requireOwnership(identity: SimulatedIdentity, request: EquipmentRequest) {
		if (request.employeeEmail != identity.email)
			throw ForbiddenException("You can only manage your own requests")
	}

	private fun requireOwnerMatch(identity: SimulatedIdentity, bodyEmail: String?) {
		if (bodyEmail != identity.email)
			throw ForbiddenException("Employee email must match your identity")
	}

	private fun requireStatus(request: EquipmentRequest, expected: RequestStatus, action: String) {
		if (request.status != expected)
			throw StateConflictException("Cannot $action request in ${request.status} status")
	}

	private fun checkVersion(request: EquipmentRequest, expectedVersion: Long) {
		if (request.version != expectedVersion)
			throw VersionConflictException("Version conflict: expected $expectedVersion but current is ${request.version}")
	}

	private fun validateRequiredDate(dateStr: String) {
		val date = try { LocalDate.parse(dateStr) } catch (_: Exception) {
			throw ValidationException("Invalid date format", mapOf("requiredDate" to "Invalid date format"))
		}
		val today = LocalDate.now(BANGKOK)
		if (date.isBefore(today)) {
			throw ValidationException("Required date cannot be in the past", mapOf("requiredDate" to "Required date cannot be in the past"))
		}
	}

	private fun validatePersistedForSubmit(request: EquipmentRequest) {
		val errors = mutableMapOf<String, String>()

		if (request.items.isEmpty()) {
			throw BusinessRuleException("At least one item is required for submit", mapOf("items" to "At least one item is required"))
		}

		// Re-validate persisted date at submit time
		val today = LocalDate.now(BANGKOK)
		if (request.requiredDate.isBefore(today)) {
			errors["requiredDate"] = "Required date cannot be in the past"
		}

		// Apply the same DTO constraints to all persisted fields and nested items.
		val persisted = DraftInputDto(
			employeeName = request.employeeName,
			employeeEmail = request.employeeEmail,
			department = request.department,
			title = request.title,
			purpose = request.purpose,
			requiredDate = request.requiredDate.toString(),
			additionalNote = request.additionalNote,
			items = request.items.map { ItemInputDto(it.equipmentType, it.quantity, it.specification) }
		)
		validator.validate(persisted).forEach {
			errors[it.propertyPath.toString().replace(Regex("\\[(\\d+)]"), ".$1")] = it.message
		}

		if (errors.isNotEmpty()) {
			throw BusinessRuleException("Persisted data validation failed for submit", errors)
		}
	}

	private fun toItemEntity(input: ItemInputDto): EquipmentRequestItem =
		EquipmentRequestItem(
			equipmentType = input.equipmentType!!,
			quantity = input.quantity!!,
			specification = input.specification?.takeIf { it.isNotBlank() }
		)

	private fun parseSort(sortParam: String): Sort {
		val parts = sortParam.split(",")
		if (parts.size != 2) {
			throw ValidationException("Sort must be in format: field,direction (e.g., createdAt,desc)")
		}
		val field = parts[0]
		val direction = parts[1].lowercase()

		if (field !in VALID_SORT_FIELDS) {
			throw ValidationException("Sort field must be one of: ${VALID_SORT_FIELDS.joinToString()}")
		}
		if (direction !in VALID_SORT_DIRECTIONS) {
			throw ValidationException("Sort direction must be one of: ${VALID_SORT_DIRECTIONS.joinToString()}")
		}

		// Map API field name to JPA property
		val jpaField = when (field) {
			"createdAt" -> "createdAt"
			else -> field
		}

		return if (direction == "asc") Sort.by(jpaField).ascending().and(Sort.by("id"))
		else Sort.by(jpaField).descending().and(Sort.by("id"))
	}
}
