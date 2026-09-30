package com.ttb.itms

import com.ttb.itms.configuration.IdentityRegistry
import com.ttb.itms.configuration.Role
import com.ttb.itms.domain.EquipmentRequest
import com.ttb.itms.domain.EquipmentRequestItem
import com.ttb.itms.exception.BusinessRuleException
import com.ttb.itms.exception.ForbiddenException
import com.ttb.itms.exception.ValidationException
import com.ttb.itms.repository.EquipmentRequestRepository
import com.ttb.itms.service.EquipmentRequestService
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import jakarta.validation.Validation
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.util.Optional

class ReviewRegressionTest {
	@Test
	fun `submit revalidates persisted fields and permissions before writing`() {
		Validation.buildDefaultValidatorFactory().use { factory ->
			val repository = mockk<EquipmentRequestRepository>()
			val service = EquipmentRequestService(repository, factory.validator, mockk(relaxed = true))
			val owner = IdentityRegistry.resolve(Role.EMPLOYEE, "somchai@example.com")!!
			val other = IdentityRegistry.resolve(Role.EMPLOYEE, "suda@example.com")!!
			val request = EquipmentRequest(
				employeeName = "Somchai Developer", employeeEmail = owner.email,
				department = " ", title = "Valid title", purpose = "Valid purpose text",
				requiredDate = LocalDate.of(2099, 1, 1), additionalNote = "x".repeat(501)
			)
			request.addItem(EquipmentRequestItem(quantity = 0, specification = "x".repeat(251)))
			every { repository.findById(request.id) } returns Optional.of(request)
			val error = assertThrows(BusinessRuleException::class.java) { service.submit(owner, request.id, 0) }
			assertTrue(error.fieldErrors.keys.containsAll(setOf("department", "additionalNote", "items.0.quantity", "items.0.specification")))
			assertThrows(ForbiddenException::class.java) { service.submit(other, request.id, 0) }
			assertThrows(ValidationException::class.java) { service.resolveIdentity("EMPLOYEE", "bad") }
			assertThrows(ForbiddenException::class.java) { service.resolveIdentity("EMPLOYEE", "arun@example.com") }
			verify(exactly = 0) { repository.saveAndFlush(any()) }
		}
	}
}
