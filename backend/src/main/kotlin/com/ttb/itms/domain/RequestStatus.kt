package com.ttb.itms.domain

enum class RequestStatus {
	DRAFT,
	PENDING,
	APPROVED,
	REJECTED,
	CANCELLED;

	companion object {
		val TERMINAL = setOf(APPROVED, REJECTED, CANCELLED)
	}
}
