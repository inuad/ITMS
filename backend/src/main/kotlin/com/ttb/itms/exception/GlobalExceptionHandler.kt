package com.ttb.itms.exception

import jakarta.servlet.http.HttpServletRequest
import jakarta.persistence.OptimisticLockException
import org.slf4j.LoggerFactory
import org.springframework.web.ErrorResponse as SpringErrorResponse
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.HttpMediaTypeNotAcceptableException
import org.springframework.web.servlet.resource.NoResourceFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * Global exception handler producing the unified error contract.
 */
@RestControllerAdvice
class GlobalExceptionHandler {

	private val log = LoggerFactory.getLogger(javaClass)

	@ExceptionHandler(MethodArgumentNotValidException::class)
	fun handleValidation(
		ex: MethodArgumentNotValidException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> {
		val fieldErrors = ex.bindingResult.fieldErrors.associate { error ->
			error.field.replace(Regex("\\[(\\d+)]"), ".$1") to (error.defaultMessage ?: "Invalid value")
		}
		return respond(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed", request, fieldErrors)
	}

	@ExceptionHandler(HttpMessageNotReadableException::class)
	fun handleUnreadable(
		ex: HttpMessageNotReadableException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Malformed request body", request)

	@ExceptionHandler(MethodArgumentTypeMismatchException::class)
	fun handleTypeMismatch(
		ex: MethodArgumentTypeMismatchException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid parameter: ${ex.name}", request)

	@ExceptionHandler(OptimisticLockingFailureException::class, OptimisticLockException::class)
	fun handleOptimisticLock(
		ex: Exception,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.CONFLICT, "REQUEST_VERSION_CONFLICT", "Request was changed by another operation", request)

	@ExceptionHandler(ValidationException::class)
	fun handleCustomValidation(
		ex: ValidationException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", ex.message ?: "Validation failed", request, ex.fieldErrors)

	@ExceptionHandler(ForbiddenException::class)
	fun handleForbidden(
		ex: ForbiddenException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.FORBIDDEN, "FORBIDDEN", ex.message ?: "Forbidden", request)

	@ExceptionHandler(NotFoundException::class)
	fun handleNotFound(
		ex: NotFoundException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", ex.message ?: "Not found", request)

	@ExceptionHandler(VersionConflictException::class)
	fun handleVersionConflict(
		ex: VersionConflictException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.CONFLICT, "REQUEST_VERSION_CONFLICT", ex.message ?: "Version conflict", request)

	@ExceptionHandler(StateConflictException::class)
	fun handleStateConflict(
		ex: StateConflictException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.CONFLICT, "REQUEST_STATE_CONFLICT", ex.message ?: "State conflict", request)

	@ExceptionHandler(BusinessRuleException::class)
	fun handleBusinessRule(
		ex: BusinessRuleException,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> =
		respond(HttpStatus.UNPROCESSABLE_ENTITY, "BUSINESS_RULE_VIOLATION", ex.message ?: "Business rule violation", request, ex.fieldErrors)

	@ExceptionHandler(HttpRequestMethodNotSupportedException::class, HttpMediaTypeNotSupportedException::class,
		HttpMediaTypeNotAcceptableException::class, NoResourceFoundException::class)
	fun handleHttpError(ex: Exception, request: HttpServletRequest): ResponseEntity<ErrorResponse> {
		val status = HttpStatus.valueOf((ex as SpringErrorResponse).statusCode.value())
		return respond(status, if (status == HttpStatus.NOT_FOUND) "REQUEST_NOT_FOUND" else "INVALID_REQUEST",
			status.reasonPhrase, request)
	}

	@ExceptionHandler(Exception::class)
	fun handleGeneric(
		ex: Exception,
		request: HttpServletRequest
	): ResponseEntity<ErrorResponse> {
		log.error("Unexpected error on ${request.method} ${request.requestURI}", ex)
		return respond(
			HttpStatus.INTERNAL_SERVER_ERROR,
			"INTERNAL_ERROR",
			"An unexpected error occurred",
			request
		)
	}

	private fun respond(
		status: HttpStatus,
		code: String,
		message: String,
		request: HttpServletRequest,
		fieldErrors: Map<String, String> = emptyMap()
	): ResponseEntity<ErrorResponse> =
		ResponseEntity.status(status).body(
			ErrorResponse(
				status = status.value(),
				code = code,
				message = message,
				path = request.requestURI,
				fieldErrors = fieldErrors
			)
		)
}
