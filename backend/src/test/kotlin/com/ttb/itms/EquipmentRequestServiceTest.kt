package com.ttb.itms

import com.ttb.itms.configuration.*
import com.ttb.itms.controller.EquipmentRequestController
import com.ttb.itms.domain.*
import com.ttb.itms.dto.*
import com.ttb.itms.exception.*
import com.ttb.itms.repository.EquipmentRequestRepository
import com.ttb.itms.repository.ItemTotal
import com.ttb.itms.service.EquipmentRequestService
import io.mockk.*
import jakarta.validation.Valid
import jakarta.validation.Validation
import jakarta.servlet.http.HttpServletRequest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.data.domain.*
import org.springframework.core.MethodParameter
import org.springframework.http.ResponseEntity
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import java.time.Instant
import java.time.LocalDate
import java.util.*

/**
 * TEST-02 unit scenarios 1–9: pure JUnit 5 + MockK tests for EquipmentRequestService.
 * No Spring context, no database, no HTTP — only mocked repository and cache.
 */
@DisplayName("TEST-02: EquipmentRequestService unit scenarios")
@TestMethodOrder(MethodOrderer.DisplayName::class)
class EquipmentRequestServiceTest {

	private lateinit var repository: EquipmentRequestRepository
	private lateinit var cache: RequestCache
	private lateinit var service: EquipmentRequestService
	private val handler = GlobalExceptionHandler()
	private val basePath = "/api/v1/equipment-requests"

	private fun httpRequest(path: String) = mockk<HttpServletRequest> {
		every { requestURI } returns path
	}

	private fun assertError(
		response: ResponseEntity<ErrorResponse>, status: Int, code: String,
		path: String, fieldErrors: Map<String, String> = emptyMap()
	) {
		val body = requireNotNull(response.body)
		assertEquals(status, response.statusCode.value())
		assertEquals(status, body.status)
		assertEquals(code, body.code)
		assertEquals(path, body.path)
		assertEquals(fieldErrors, body.fieldErrors)
		assertTrue(body.message.isNotBlank())
		assertTrue(body.timestamp.isAfter(Instant.now().minusSeconds(60)))
		assertFalse(body.timestamp.isAfter(Instant.now()))
	}

	private val owner = IdentityRegistry.resolve(Role.EMPLOYEE, "somchai@example.com")!!
	private val otherEmployee = IdentityRegistry.resolve(Role.EMPLOYEE, "suda@example.com")!!
	private val approver = IdentityRegistry.resolve(Role.APPROVER, "arun@example.com")!!

	@BeforeEach
	fun setUp() {
		repository = mockk(relaxed = false)
		cache = mockk(relaxed = true)
		Validation.buildDefaultValidatorFactory().use { factory ->
			service = EquipmentRequestService(repository, factory.validator, cache)
		}
	}

	private fun draftInput(
		employeeEmail: String = owner.email,
		items: List<ItemInputDto> = emptyList()
	): DraftInputDto = DraftInputDto(
		employeeName = "Somchai Developer",
		employeeEmail = employeeEmail,
		department = "Software Engineering",
		title = "Valid title here",
		purpose = "Valid purpose for testing purposes",
		requiredDate = LocalDate.now().plusDays(7).toString(),
		additionalNote = null,
		items = items
	)

	private fun draftEntity(
		ownerIdentity: SimulatedIdentity = owner,
		status: RequestStatus = RequestStatus.DRAFT,
		version: Long = 0,
		items: List<EquipmentRequestItem> = emptyList()
	): EquipmentRequest {
		val request = EquipmentRequest(
			employeeName = ownerIdentity.name,
			employeeEmail = ownerIdentity.email,
			department = ownerIdentity.department,
			title = "Valid title here",
			purpose = "Valid purpose for testing purposes",
			requiredDate = LocalDate.now().plusDays(7),
			status = status,
			additionalNote = null
		)
		request.version = version
		items.forEach { request.addItem(it) }
		return request
	}

	// ── Scenario 1: Create Draft สำเร็จและ response ถูกต้อง ──────────

	@Test
	@DisplayName("1. Create Draft สำเร็จและ response ถูกต้อง")
	fun createDraftSuccess() {
		every { repository.saveAndFlush(any()) } answers {
			firstArg<EquipmentRequest>().also { it.requestNumber = "REQ-2026-000001" }
		}

		val result = service.create(owner, draftInput())

		assertEquals("DRAFT", result.status.name)
		assertEquals(owner.email, result.employeeEmail)
		assertEquals("Valid title here", result.title)
		assertEquals("REQ-2026-000001", result.requestNumber)
		assertEquals(0L, result.version)
		assertEquals("Valid purpose for testing purposes", result.purpose)
		assertEquals(LocalDate.now().plusDays(7), result.requiredDate)
		assertTrue(result.items.isEmpty())
		assertEquals(0, result.totalItems)
		verify(exactly = 1) { repository.saveAndFlush(any()) }
		verify { cache.invalidateAfterCommit(any()) }
	}

	@Test
	@DisplayName("1b. Create Draft ด้วย items ถูก map ครบ")
	fun createDraftWithItems() {
		val items = listOf(ItemInputDto(EquipmentType.NOTEBOOK, 2, "16 inch"))
		every { repository.saveAndFlush(any()) } answers {
			firstArg<EquipmentRequest>().also { it.requestNumber = "REQ-2026-000002" }
		}

		val result = service.create(owner, draftInput(items = items))

		assertEquals(1, result.items.size)
		assertEquals(EquipmentType.NOTEBOOK, result.items[0].equipmentType)
		assertEquals(2, result.items[0].quantity)
		assertEquals("16 inch", result.items[0].specification)
		assertEquals(2, result.totalItems)
	}

	@Test
	@DisplayName("1c. Create ด้วย email ที่ไม่ตรง owner ไม่สำเร็จ")
	fun createDraftWrongOwner() {
		val exception = assertThrows(ForbiddenException::class.java) {
			service.create(owner, draftInput(employeeEmail = "suda@example.com"))
		}
		assertTrue(exception.message!!.contains("identity"))
		assertError(handler.handleForbidden(exception, httpRequest(basePath)), 403, "FORBIDDEN", basePath)
		verify(exactly = 0) { repository.saveAndFlush(any()) }
	}

	// ── Scenario 2: Submit โดยไม่มี items ไม่สำเร็จ ──────────────────

	@Test
	@DisplayName("2. Submit โดยไม่มี items ไม่สำเร็จ")
	fun submitWithoutItems() {
		val request = draftEntity()
		every { repository.findById(request.id) } returns Optional.of(request)

		val exception = assertThrows(BusinessRuleException::class.java) {
			service.submit(owner, request.id, 0)
		}
		assertTrue(exception.fieldErrors.containsKey("items"))
		val path = "$basePath/${request.id}/submit"
		assertError(handler.handleBusinessRule(exception, httpRequest(path)), 422, "BUSINESS_RULE_VIOLATION", path,
			mapOf("items" to "At least one item is required"))
		assertEquals(RequestStatus.DRAFT, request.status)
		verify(exactly = 0) { cache.invalidateAfterCommit(any()) }
		verify(exactly = 0) { repository.saveAndFlush(any()) }
	}

	// ── Scenario 3: Submit DRAFT→PENDING สำเร็จ ──────────────────────

	@Test
	@DisplayName("3. Submit DRAFT→PENDING สำเร็จ")
	fun submitSuccess() {
		val item = EquipmentRequestItem(
			equipmentType = EquipmentType.NOTEBOOK,
			quantity = 1,
			specification = "High-spec laptop"
		)
		val request = draftEntity(items = listOf(item))
		every { repository.findById(request.id) } returns Optional.of(request)
		every { repository.saveAndFlush(any()) } answers {
			firstArg<EquipmentRequest>().also { it.requestNumber = "REQ-2026-000003" }
		}

		val result = service.submit(owner, request.id, 0)

		assertEquals(RequestStatus.PENDING, result.status)
		verify(exactly = 1) { repository.saveAndFlush(match { it.status == RequestStatus.PENDING }) }
	}

	// ── Scenario 4: Approve จากสถานะที่ไม่ใช่ PENDING ไม่สำเร็จ ───────

	@Test
	@DisplayName("4. Approve จากสถานะที่ไม่ใช่ PENDING ไม่สำเร็จ")
	fun approveNonPending() {
		val request = draftEntity(status = RequestStatus.DRAFT)
		every { repository.findById(request.id) } returns Optional.of(request)

		val exception = assertThrows(StateConflictException::class.java) {
			service.approve(approver, request.id, 0)
		}
		val path = "$basePath/${request.id}/approve"
		assertError(handler.handleStateConflict(exception, httpRequest(path)), 409, "REQUEST_STATE_CONFLICT", path)
		assertEquals(RequestStatus.DRAFT, request.status)
		verify(exactly = 0) { repository.saveAndFlush(any()) }
	}

	@Test
	@DisplayName("4b. Approve ที่ไม่ใช่ Approver ไม่สำเร็จ")
	fun approveByEmployee() {
		val id = UUID.randomUUID()
		val exception = assertThrows(ForbiddenException::class.java) {
			service.approve(owner, id, 0)
		}
		val path = "$basePath/$id/approve"
		assertError(handler.handleForbidden(exception, httpRequest(path)), 403, "FORBIDDEN", path)
		verify(exactly = 0) { repository.findById(any()) }
	}

	// ── Scenario 5: Reject ไม่มี reason ไม่สำเร็จ ────────────────────

	@Test
	@DisplayName("5. Reject ไม่มี reason ไม่สำเร็จ (controller validation)")
	fun rejectNoReason() {
		// Exercise the DTO validation -> MVC exception -> handler path without Spring TestContext.
		val method = EquipmentRequestController::class.java.methods.single { it.name == "reject" }
		assertTrue(method.parameterAnnotations[3].any { it.annotationClass.java == Valid::class.java },
			"Reject endpoint must enable validation on its input DTO")
		val path = "$basePath/${UUID.randomUUID()}/reject"
		Validation.buildDefaultValidatorFactory().use { factory ->
			for (reason in listOf(null, "", "   ")) {
				val dto = RejectInputDto(version = 0, reason = reason)
				val violations = factory.validator.validate(dto)
				assertEquals(setOf("reason"), violations.map { it.propertyPath.toString() }.toSet())
				val binding = BeanPropertyBindingResult(dto, "rejectInputDto")
				violations.forEach { binding.addError(FieldError(binding.objectName, it.propertyPath.toString(), it.message)) }
				val exception = MethodArgumentNotValidException(MethodParameter(method, 3), binding)
				assertError(handler.handleValidation(exception, httpRequest(path)), 400, "VALIDATION_ERROR", path,
					mapOf("reason" to "Rejection reason is required"))
			}
			assertTrue(factory.validator.validate(RejectInputDto(0, "Not needed")).isEmpty())
		}
		verify(exactly = 0) { repository.saveAndFlush(any()) }
		verify(exactly = 0) { cache.invalidateAfterCommit(any()) }
	}

	// ── Scenario 6: Edit ที่ไม่ใช่ DRAFT ไม่สำเร็จ ────────────────────

	@Test
	@DisplayName("6. Edit ที่ไม่ใช่ DRAFT ไม่สำเร็จ")
	fun editNonDraft() {
		val request = draftEntity(status = RequestStatus.PENDING, version = 1)
		every { repository.findById(request.id) } returns Optional.of(request)

		val before = RequestDetailDto.from(request)
		val exception = assertThrows(StateConflictException::class.java) {
			service.edit(owner, request.id, draftInput(), 1)
		}
		val path = "$basePath/${request.id}"
		assertError(handler.handleStateConflict(exception, httpRequest(path)), 409, "REQUEST_STATE_CONFLICT", path)
		assertEquals(before, RequestDetailDto.from(request))
		verify(exactly = 0) { repository.saveAndFlush(any()) }
	}

	@Test
	@DisplayName("6b. Edit ของคนอื่นไม่สำเร็จ")
	fun editNotOwner() {
		val request = draftEntity(ownerIdentity = owner)
		every { repository.findById(request.id) } returns Optional.of(request)

		val exception = assertThrows(ForbiddenException::class.java) {
			service.edit(otherEmployee, request.id, draftInput(employeeEmail = otherEmployee.email), 0)
		}
		val path = "$basePath/${request.id}"
		assertError(handler.handleForbidden(exception, httpRequest(path)), 403, "FORBIDDEN", path)
		verify(exactly = 0) { repository.saveAndFlush(any()) }
	}

	// ── Scenario 7: Missing request คืน 404 error contract ───────────

	@Test
	@DisplayName("7. Missing request คืน 404 error")
	fun missingRequest404() {
		val missingId = UUID.randomUUID()
		every { repository.findById(missingId) } returns Optional.empty()
		// cache.detail returns null so detail() falls through to findOrThrow
		every { cache.detail(missingId) } returns null

		val path = "$basePath/$missingId"
		val actions: List<Pair<String, () -> Unit>> = listOf(
			path to { service.detail(owner, missingId) },
			"$path/submit" to { service.submit(owner, missingId, 0) },
			path to { service.edit(owner, missingId, draftInput(), 0) }
		)
		for ((actionPath, action) in actions) {
			val exception = assertThrows(NotFoundException::class.java) { action() }
			assertError(handler.handleNotFound(exception, httpRequest(actionPath)), 404, "REQUEST_NOT_FOUND", actionPath)
		}
		verify(exactly = 0) { repository.saveAndFlush(any()) }
		verify(exactly = 0) { cache.invalidateAfterCommit(any()) }
	}

	// ── Scenario 8: Stale version คืน 409 และไม่ write ทับ ────────────

	@Test
	@DisplayName("8. Stale version คืน 409 และไม่ write ทับ")
	fun versionConflict409() {
		val request = draftEntity(version = 5, items = listOf(EquipmentRequestItem(quantity = 2)))
		every { repository.findById(request.id) } returns Optional.of(request)
		val before = RequestDetailDto.from(request)
		val path = "$basePath/${request.id}"
		val actions: List<Pair<String, () -> Unit>> = listOf(
			path to { service.edit(owner, request.id, draftInput(), 3) },
			"$path/submit" to { service.submit(owner, request.id, 4) },
			"$path/cancel" to { service.cancel(owner, request.id, 0) },
			"$path/approve" to { service.approve(approver, request.id, 3) },
			"$path/reject" to { service.reject(approver, request.id, 3, "Not needed") }
		)
		for ((actionPath, action) in actions) {
			val exception = assertThrows(VersionConflictException::class.java) { action() }
			assertError(handler.handleVersionConflict(exception, httpRequest(actionPath)), 409, "REQUEST_VERSION_CONFLICT", actionPath)
			assertEquals(before, RequestDetailDto.from(request))
		}
		verify(exactly = 0) { repository.saveAndFlush(any()) }
		verify(exactly = 0) { cache.invalidateAfterCommit(any()) }
	}

	// ── Scenario 9: Keyword/status query criteria ร่วมกัน + owner scope ─

	@Test
	@DisplayName("9. Keyword/status query criteria ทำงานร่วมกัน พร้อม owner scope")
	fun queryComposition() {
		val request = draftEntity()
		request.requestNumber = "REQ-2026-000009"
		request.title = "Notebook for testing"
		request.department = "IT"
		val resultPage = PageImpl(listOf(request), PageRequest.of(0, 10), 1)
		val total = mockk<ItemTotal>()
		every { total.requestId } returns request.id
		every { total.total } returns 3L
		every { repository.itemTotals(listOf(request.id)) } returns listOf(total)

		// Cache must miss so list() reaches repository.search
		every { cache.list(any()) } returns null

		every {
			repository.search(
				ownerEmail = any(),
				keyword = any(),
				status = any(),
				department = any(),
				pageable = any()
			)
		} returns resultPage

		// Employee query with all filters — owner email is enforced
		val result = service.list(owner, "Notebook", "DRAFT", "IT", 0, 10, "createdAt,desc")
		assertEquals(listOf(RequestRowDto.from(request, 3)), result.content)
		assertEquals(0, result.page)
		assertEquals(10, result.size)
		assertEquals(1L, result.totalElements)
		assertEquals(1, result.totalPages)

		verify {
			repository.search(
				ownerEmail = owner.email,
				keyword = "%Notebook%",
				status = RequestStatus.DRAFT,
				department = "IT",
				pageable = any()
			)
		}

		// Approver query — owner email is null (sees all)
		service.list(approver, null, null, null, 0, 10, "createdAt,desc")
		verify {
			repository.search(
				ownerEmail = null,
				keyword = null,
				status = null,
				department = null,
				pageable = any()
			)
		}

		// Keyword with special characters is escaped
		service.list(owner, "50%_off!", null, null, 0, 10, "createdAt,desc")
		verify {
			repository.search(
				ownerEmail = owner.email,
				keyword = "%50!%!_off!!%",
				status = null,
				department = null,
				pageable = any()
			)
		}

		// Invalid status throws ValidationException
		assertThrows(ValidationException::class.java) {
			service.list(owner, null, "INVALID_STATUS", null, 0, 10, "createdAt,desc")
		}

		// Invalid sort throws ValidationException
		assertThrows(ValidationException::class.java) {
			service.list(owner, null, null, null, 0, 10, "badField,desc")
		}

		// Page/size validation
		assertThrows(ValidationException::class.java) {
			service.list(owner, null, null, null, -1, 10, "createdAt,desc")
		}
		assertThrows(ValidationException::class.java) {
			service.list(owner, null, null, null, 0, 101, "createdAt,desc")
		}
	}
}
