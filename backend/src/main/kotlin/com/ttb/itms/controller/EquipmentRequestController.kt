package com.ttb.itms.controller

import com.ttb.itms.dto.*
import com.ttb.itms.service.EquipmentRequestService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

/**
 * REST controller for equipment requests.
 * No business logic here — delegates entirely to EquipmentRequestService.
 */
@RestController
@RequestMapping("/api/v1/equipment-requests")
class EquipmentRequestController(
	private val service: EquipmentRequestService
) {
	companion object {
		private const val ROLE_HEADER = "X-User-Role"
		private const val EMAIL_HEADER = "X-User-Email"
	}

	/** POST / — Create Draft */
	@PostMapping
	fun create(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@Valid @RequestBody input: DraftInputDto
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.create(identity, input)
		return ResponseEntity.status(HttpStatus.CREATED).body(result)
	}

	/** GET / — Search/list */
	@GetMapping
	fun list(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@RequestParam(required = false) keyword: String?,
		@RequestParam(required = false) status: String?,
		@RequestParam(required = false) department: String?,
		@RequestParam(required = false) page: Int?,
		@RequestParam(required = false) size: Int?,
		@RequestParam(required = false) sort: String?
	): ResponseEntity<PageDto<RequestRowDto>> {
		val identity = service.resolveIdentity(role, email)
		val result = service.list(identity, keyword, status, department, page, size, sort)
		return ResponseEntity.ok(result)
	}

	/** GET /{id} — Detail */
	@GetMapping("/{id}")
	fun detail(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@PathVariable id: UUID
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.detail(identity, id)
		return ResponseEntity.ok(result)
	}

	/** PUT /{id} — Edit Draft */
	@PutMapping("/{id}")
	fun edit(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@PathVariable id: UUID,
		@Valid @RequestBody input: EditInputDto
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.edit(identity, id, input.toDraftInput(), input.version!!)
		return ResponseEntity.ok(result)
	}

	/** POST /{id}/submit — Submit Draft */
	@PostMapping("/{id}/submit")
	fun submit(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@PathVariable id: UUID,
		@Valid @RequestBody input: VersionInputDto
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.submit(identity, id, input.version!!)
		return ResponseEntity.ok(result)
	}

	/** POST /{id}/approve — Approve */
	@PostMapping("/{id}/approve")
	fun approve(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@PathVariable id: UUID,
		@Valid @RequestBody input: VersionInputDto
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.approve(identity, id, input.version!!)
		return ResponseEntity.ok(result)
	}

	/** POST /{id}/reject — Reject */
	@PostMapping("/{id}/reject")
	fun reject(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@PathVariable id: UUID,
		@Valid @RequestBody input: RejectInputDto
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.reject(identity, id, input.version!!, input.reason!!)
		return ResponseEntity.ok(result)
	}

	/** POST /{id}/cancel — Cancel */
	@PostMapping("/{id}/cancel")
	fun cancel(
		@RequestHeader(ROLE_HEADER, required = false) role: String?,
		@RequestHeader(EMAIL_HEADER, required = false) email: String?,
		@PathVariable id: UUID,
		@Valid @RequestBody input: VersionInputDto
	): ResponseEntity<RequestDetailDto> {
		val identity = service.resolveIdentity(role, email)
		val result = service.cancel(identity, id, input.version!!)
		return ResponseEntity.ok(result)
	}
}
