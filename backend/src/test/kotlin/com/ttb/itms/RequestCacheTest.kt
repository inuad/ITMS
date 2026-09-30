package com.ttb.itms

import com.ttb.itms.configuration.*
import com.ttb.itms.dto.*
import io.mockk.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.transaction.support.TransactionSynchronizationManager
import tools.jackson.databind.ObjectMapper
import java.util.UUID

class RequestCacheTest {
	@Test
	fun `lists are isolated and invalidation waits for commit even when Redis fails`() {
		val redis = mockk<StringRedisTemplate>()
		val cache = RequestCache(redis, mockk<ObjectMapper>())
		val owner = IdentityRegistry.resolve(Role.EMPLOYEE, "somchai@example.com")!!
		val key = ListCacheKey(owner, "equipment", "DRAFT", "IT", 0, 10, "createdAt: DESC")
		val page = PageDto<RequestRowDto>(emptyList(), 0, 10, 0, 0)
		cache.putList(key, page)
		assertSame(page, cache.list(key))
		for (different in listOf(
			key.copy(identity = IdentityRegistry.resolve(Role.EMPLOYEE, "suda@example.com")!!),
			key.copy(identity = IdentityRegistry.resolve(Role.APPROVER, "arun@example.com")!!),
			key.copy(keyword = null), key.copy(status = null), key.copy(department = null),
			key.copy(page = 1), key.copy(size = 20), key.copy(sort = "createdAt: ASC")
		)) assertNull(cache.list(different))

		val id = UUID.randomUUID()
		every { redis.delete("itms:detail:v1:$id") } throws IllegalStateException("Redis unavailable")
		TransactionSynchronizationManager.initSynchronization()
		try {
			cache.invalidateAfterCommit(id)
			assertSame(page, cache.list(key))
			verify(exactly = 0) { redis.delete(any<String>()) }
			// Rollback does not call afterCommit and must keep the cached page.
			TransactionSynchronizationManager.getSynchronizations().forEach { it.afterCompletion(1) }
			assertSame(page, cache.list(key))
			TransactionSynchronizationManager.getSynchronizations().forEach { it.afterCommit() }
			assertNull(cache.list(key))
			verify(exactly = 1) { redis.delete("itms:detail:v1:$id") }
		} finally {
			TransactionSynchronizationManager.clearSynchronization()
		}
		every { redis.opsForValue() } throws IllegalStateException("Redis unavailable")
		assertNull(cache.detail(id))
		verify(exactly = 0) { redis.opsForValue() }
	}
}
