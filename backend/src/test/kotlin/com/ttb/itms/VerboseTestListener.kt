package com.ttb.itms

import org.junit.platform.engine.TestExecutionResult
import org.junit.platform.engine.TestExecutionResult.Status
import org.junit.platform.engine.support.descriptor.ClassSource
import org.junit.platform.launcher.TestExecutionListener
import org.junit.platform.launcher.TestIdentifier

/** Console-only reporting; Surefire still owns results and the process exit code. */
class VerboseTestListener : TestExecutionListener {
	override fun executionStarted(identifier: TestIdentifier) {
		if (identifier.source.orElse(null) is ClassSource)
			println("[SUITE] ${identifier.displayName}")
	}

	override fun executionFinished(identifier: TestIdentifier, result: TestExecutionResult) {
		if (identifier.isTest || result.status == Status.FAILED) {
			val label = when (result.status) {
				Status.SUCCESSFUL -> "PASS"
				Status.FAILED -> "FAIL"
				Status.ABORTED -> "ABORTED"
			}
			println("[$label] ${identifier.displayName}")
		}
	}

	override fun executionSkipped(identifier: TestIdentifier, reason: String) {
		println("[SKIP] ${identifier.displayName}: $reason")
	}
}
