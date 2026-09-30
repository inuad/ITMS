package com.ttb.itms

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.sql.Connection
import java.sql.DriverManager
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.Duration
import java.util.UUID

/** Scenario 10 uses the main Compose Backend/PostgreSQL; no Spring TestContext. */
@DisplayName("TEST-02 scenario 10: Rollback on item persistence failure")
@EnabledIfEnvironmentVariable(named = "TEST_BASE_URL", matches = ".+")
class RollbackTest {

	private fun scalar(connection: Connection, sql: String, vararg parameters: String): Int =
		connection.prepareStatement(sql).use { statement ->
			parameters.forEachIndexed { index, value -> statement.setString(index + 1, value) }
			statement.executeQuery().use { result ->
				assertTrue(result.next())
				result.getInt(1)
			}
		}

	@Test
	@DisplayName("10. Item failure rolls back the entire Request+Items transaction")
	fun itemFailureRollsBackEntireTransaction() {
		val baseUrl = System.getenv("TEST_BASE_URL").trimEnd('/')
		val dbHost = System.getenv("DB_HOST") ?: "localhost"
		val dbPort = System.getenv("DB_PORT") ?: "5432"
		val dbName = System.getenv("DB_NAME") ?: "itms"
		val dbUser = System.getenv("DB_USERNAME") ?: "itms"
		val dbPass = System.getenv("DB_PASSWORD") ?: "itms"
		val jdbcUrl = "jdbc:postgresql://$dbHost:$dbPort/$dbName?connectTimeout=5&socketTimeout=15"
		// Generated SQL identifiers contain only a fixed prefix and UUID hex.
		val marker = "test02_" + UUID.randomUUID().toString().replace("-", "")
		val firstItem = "${marker}_first"
		val witness = "${marker}_witness"
		val parentSql = "SELECT COUNT(*) FROM equipment_requests WHERE title = ?"
		val itemsSql = "SELECT COUNT(*) FROM equipment_request_items WHERE specification IN (?, ?)"
		val witnessSql = "SELECT CASE WHEN is_called THEN 1 ELSE 0 END FROM public.$witness"

		DriverManager.getConnection(jdbcUrl, dbUser, dbPass).use { connection ->
			connection.autoCommit = true
			try {
				assertEquals(0, scalar(connection, parentSql, marker))
				assertEquals(0, scalar(connection, itemsSql, marker, firstItem))
				connection.createStatement().use { statement ->
					statement.execute("CREATE SEQUENCE public.$witness")
					statement.execute("""
						CREATE FUNCTION public.$marker() RETURNS trigger LANGUAGE plpgsql AS $$
						BEGIN
							IF NOT EXISTS (SELECT 1 FROM equipment_requests
								WHERE id = NEW.request_id AND title = '$marker') THEN
								RAISE EXCEPTION 'Rollback probe did not observe its parent';
							END IF;
							IF NOT EXISTS (SELECT 1 FROM equipment_request_items
								WHERE request_id = NEW.request_id AND specification = '$firstItem') THEN
								RAISE EXCEPTION 'Rollback probe did not observe its first item';
							END IF;
							-- nextval survives rollback: evidence cannot be confused with any other HTTP 500.
							PERFORM nextval('public.$witness');
							RAISE EXCEPTION 'Deliberate item failure after parent and first item writes: $marker';
						END $$;
					""".trimIndent())
					statement.execute("""
						CREATE TRIGGER $marker BEFORE INSERT ON equipment_request_items
						FOR EACH ROW WHEN (NEW.specification = '$marker')
						EXECUTE FUNCTION public.$marker()
					""".trimIndent())
				}
				assertEquals(0, scalar(connection, witnessSql))
				println("ROLLBACK $marker: before HTTP, parents=0/items=0/witness=0")

				val payload = """
					{
						"employeeName": "Somchai Developer", "employeeEmail": "somchai@example.com",
						"department": "Software Engineering", "title": "$marker",
						"purpose": "Verify atomic rollback after parent and first item writes",
						"requiredDate": "${LocalDate.now(ZoneId.of("Asia/Bangkok")).plusDays(30)}",
						"items": [
							{"equipmentType": "MONITOR", "quantity": 2, "specification": "$firstItem"},
							{"equipmentType": "NOTEBOOK", "quantity": 1, "specification": "$marker"}
						]
					}
				""".trimIndent()
				val path = "/api/v1/equipment-requests"
				val request = HttpRequest.newBuilder(URI.create("$baseUrl$path"))
					.timeout(Duration.ofSeconds(20))
					.header("Content-Type", "application/json")
					.header("X-User-Role", "EMPLOYEE")
					.header("X-User-Email", "somchai@example.com")
					.POST(HttpRequest.BodyPublishers.ofString(payload)).build()
				val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
				val started = Instant.now()
				val response = client.send(request, HttpResponse.BodyHandlers.ofString())
				assertEquals(500, response.statusCode(), response.body())
				val mapper = JsonMapper.builder().build()
				val body = mapper.readTree(response.body())
				assertEquals(setOf("timestamp", "status", "code", "message", "path", "fieldErrors"), body.propertyNames().toSet())
				assertEquals(500, body["status"].asInt())
				assertEquals("INTERNAL_ERROR", body["code"].asString())
				assertEquals("An unexpected error occurred", body["message"].asString())
				assertEquals(path, body["path"].asString())
				assertTrue(body["fieldErrors"].isObject)
				assertEquals(0, body["fieldErrors"].size())
				val timestamp = Instant.parse(body["timestamp"].asString())
				assertFalse(timestamp.isBefore(started.minusSeconds(5)))
				assertFalse(timestamp.isAfter(Instant.now().plusSeconds(5)))
				assertFalse(response.body().contains(marker), "Internal database details must not leak")

				DriverManager.getConnection(jdbcUrl, dbUser, dbPass).use { verifyConnection ->
					assertEquals(1, scalar(verifyConnection, witnessSql), "Trigger must observe parent AND first item before failing")
					assertEquals(0, scalar(verifyConnection, parentSql, marker), "Parent must roll back")
					assertEquals(0, scalar(verifyConnection, itemsSql, marker, firstItem), "Both items must roll back")
				}
				println("ROLLBACK $marker: HTTP=500/INTERNAL_ERROR; new JDBC connection witness=1, parents=0/items=0")
			} finally {
				// Only this run's fixture is removed. Cleanup failures fail the test.
				connection.createStatement().use { statement ->
					statement.execute("DROP TRIGGER IF EXISTS $marker ON equipment_request_items")
					statement.execute("DROP FUNCTION IF EXISTS public.$marker()")
					statement.execute("DROP SEQUENCE IF EXISTS public.$witness")
				}
				connection.prepareStatement("DELETE FROM equipment_requests WHERE title = ?").use { statement ->
					statement.setString(1, marker)
					statement.executeUpdate()
				}
				assertEquals(0, scalar(connection, "SELECT COUNT(*) FROM pg_trigger WHERE tgname = ?", marker))
				assertEquals(0, scalar(connection, "SELECT COUNT(*) FROM pg_proc WHERE proname = ?", marker))
				assertEquals(0, scalar(connection, "SELECT COUNT(*) FROM pg_class WHERE relname = ?", witness))
				assertEquals(0, scalar(connection, parentSql, marker))
				assertEquals(0, scalar(connection, itemsSql, marker, firstItem))
				println("ROLLBACK $marker: cleanup verified, trigger/function/sequence=0, parents/items=0")
			}
		}
	}
}
