package com.ttb.itms.configuration

import com.github.benmanes.caffeine.cache.Caffeine
import com.ttb.itms.dto.PageDto
import com.ttb.itms.dto.RequestDetailDto
import com.ttb.itms.dto.RequestRowDto
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant
import java.util.UUID

data class ListCacheKey(
	val identity: SimulatedIdentity,
	val keyword: String?,
	val status: String?,
	val department: String?,
	val page: Int,
	val size: Int,
	val sort: String
)

@Component
class RequestCache(private val redis: StringRedisTemplate, private val mapper: ObjectMapper) {
	private val log = LoggerFactory.getLogger(javaClass)
	private val detailTtl = Duration.ofSeconds(60)
	@Volatile private var bypassUntil = Instant.MIN
	// ponytail: one backend instance; use distributed invalidation before scaling out.
	private val lists = Caffeine.newBuilder().maximumSize(500)
		.expireAfterWrite(Duration.ofSeconds(10)).build<ListCacheKey, PageDto<RequestRowDto>>()

	fun list(key: ListCacheKey): PageDto<RequestRowDto>? = lists.getIfPresent(key)

	fun putList(key: ListCacheKey, page: PageDto<RequestRowDto>) = lists.put(key, page)

	fun detail(id: UUID): RequestDetailDto? {
		if (Instant.now().isBefore(bypassUntil)) return null
		return redisOrNull("read") {
			redis.opsForValue().get(detailKey(id))?.let { mapper.readValue(it, RequestDetailDto::class.java) }
		}
	}

	fun putDetail(detail: RequestDetailDto) {
		if (Instant.now().isBefore(bypassUntil)) return
		redisOrNull("fill") {
			redis.opsForValue().set(detailKey(detail.id), mapper.writeValueAsString(detail), detailTtl)
		}
	}

	fun invalidateAfterCommit(id: UUID) {
		check(TransactionSynchronizationManager.isSynchronizationActive()) { "Cache eviction requires a transaction" }
		TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
			override fun afterCommit() {
				lists.invalidateAll()
				// Never turn a committed database write into a reported failure.
				if (redisOrNull("evict") { redis.delete(detailKey(id)) } == null) {
					// Redis may recover with the old key; bypass until its TTL has elapsed.
					bypassUntil = Instant.now().plus(detailTtl)
				}
			}
		})
	}

	private fun detailKey(id: UUID) = "itms:detail:v1:$id"

	private fun <T> redisOrNull(operation: String, block: () -> T): T? = try {
		block()
	} catch (ex: Exception) {
		log.warn("Detail cache {} failed; using database: {}", operation, ex.javaClass.simpleName)
		null
	}
}
