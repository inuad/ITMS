FROM maven:3.9.9-eclipse-temurin-21 AS dependencies
WORKDIR /app
COPY pom.xml ./
RUN mvn -B dependency:go-offline

FROM dependencies AS build
COPY src ./src
RUN mvn -B -Dkotlin.compiler.daemon=false -DskipTests package

FROM build AS test
CMD ["mvn", "-B", "-Dkotlin.compiler.daemon=false", "test"]

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
RUN useradd --system --uid 10001 itms
COPY --from=build --chown=itms:itms /app/target/itms-backend-0.1.0.jar ./app.jar
USER itms
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
