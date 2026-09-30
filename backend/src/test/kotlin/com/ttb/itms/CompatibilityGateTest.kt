package com.ttb.itms

import io.mockk.mockk
import io.mockk.every
import io.mockk.verify
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * JUnit 5 + MockK compatibility gate.
 * Verifies that Jupiter 5.14.4 / Platform 1.14.4 / MockK discovery works
 * before any business logic is implemented.
 *
 * This is NOT a business test — it validates the test tooling setup.
 */
@DisplayName("BE-01: JUnit 5 + MockK Compatibility Gate")
class CompatibilityGateTest {

	/** Interface used for MockK verification (must be non-local in Kotlin 2.2+). */
	interface SampleService {
		fun greet(name: String): String
	}

	/** Enum used to verify Kotlin enum support in tests. */
	enum class Color { RED, GREEN, BLUE }

	@Test
	@DisplayName("JUnit 5 test discovery works")
	fun junitDiscovery() {
		assertTrue(true, "JUnit 5 Jupiter test was discovered and executed")
	}

	@Test
	@DisplayName("MockK mock creation and verification works")
	fun mockkWorks() {
		val mock = mockk<SampleService>()
		every { mock.greet("World") } returns "Hello, World!"

		val result = mock.greet("World")

		assertEquals("Hello, World!", result)
		verify(exactly = 1) { mock.greet("World") }
	}

	@Test
	@DisplayName("JUnit 5 assertions available")
	fun assertionsWork() {
		assertAll(
			{ assertEquals(4, 2 + 2) },
			{ assertNotNull("not null") },
			{ assertThrows(IllegalArgumentException::class.java) {
				throw IllegalArgumentException("test")
			}}
		)
	}

	@Test
	@DisplayName("Kotlin data class and enum work with test tooling")
	fun kotlinFeaturesWork() {
		data class Sample(val value: String)

		val sample = Sample("test")
		assertEquals("test", sample.value)
		assertEquals(Color.GREEN, Color.valueOf("GREEN"))
	}
}
