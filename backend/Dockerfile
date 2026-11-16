FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build/backend
ENV MAVEN_OPTS="-Xmx512m -XX:ActiveProcessorCount=2"
COPY backend/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY backend/src src
COPY shared /build/shared
RUN mvn -B -q package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -g 10001 app && adduser -D -u 10001 -G app app
WORKDIR /app
ARG GIT_COMMIT=""
ENV LAB_BUILD_COMMIT=$GIT_COMMIT
COPY --from=build /build/backend/target/tech-lab-0.0.1-SNAPSHOT.jar app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
