# SIGNAL backend — multi-stage build.
# Stage 1 builds the Spring Boot fat jar inside Maven + JDK 21 (matches the pom's
# java.version=21). Stage 2 runs it on a slim JRE as a non-root user.
# Flyway runs at boot (spring.flyway.enabled=true), so an empty database rebuilds
# itself through V1–V24 — no init scripts needed here.

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies in their own layer: pom.xml first, source second.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Non-root user (the jar service account has no write needs beyond /tmp).
RUN addgroup -S signal && adduser -S signal -G signal
USER signal

COPY --from=build /build/target/*.jar /app/signal.jar

# JAVA_OPTS is the memory tuning knob; compose sets -Xmx for small hosts.
ENV JAVA_OPTS=""
EXPOSE 8080

# /actuator/health is exposed in application.properties (health,info).
# Healthcheck lives here so any orchestrator (or bare docker run) gets it for free;
# docker-compose.prod.yml additionally uses it for depends_on ordering.
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/actuator/health | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/signal.jar"]
