package com.ttb.itms.configuration

/**
 * Simulated identity — three fixed users, no real authentication.
 * Role and email are sent via X-User-Role / X-User-Email headers.
 */
data class SimulatedIdentity(
	val role: Role,
	val email: String,
	val name: String,
	val department: String
)

enum class Role {
	EMPLOYEE,
	APPROVER
}

object IdentityRegistry {
	private val identities = listOf(
		SimulatedIdentity(Role.EMPLOYEE, "somchai@example.com", "Somchai Developer", "Software Engineering"),
		SimulatedIdentity(Role.EMPLOYEE, "suda@example.com", "Suda Analyst", "Finance"),
		SimulatedIdentity(Role.APPROVER, "arun@example.com", "Arun Approver", "IT"),
	)

	/**
	 * Resolve a valid identity from Role+Email pair.
	 * Returns null if the pair is invalid.
	 */
	fun resolve(role: Role, email: String): SimulatedIdentity? =
		identities.find { it.role == role && it.email == email }

	/**
	 * Parse role string, returns null if invalid.
	 */
	fun parseRole(roleStr: String?): Role? =
		try { roleStr?.let { Role.valueOf(it) } } catch (_: IllegalArgumentException) { null }
}
