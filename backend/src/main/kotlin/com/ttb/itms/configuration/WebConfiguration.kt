package com.ttb.itms.configuration

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfiguration(@param:Value("\${CORS_ALLOWED_ORIGINS:http://localhost:3000,http://127.0.0.1:3000}") private val origins: String) : WebMvcConfigurer {
	override fun addCorsMappings(registry: CorsRegistry) {
		registry.addMapping("/api/v1/**")
			.allowedOrigins(*origins.split(",").toTypedArray())
			.allowedMethods("GET", "POST", "PUT", "OPTIONS")
			.allowedHeaders("Content-Type", "X-User-Role", "X-User-Email")
			.maxAge(600)
	}
}
