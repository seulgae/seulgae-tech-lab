# seulgae-tech-lab
Interactive 2D tech lab built with React, Phaser, Spring Boot and PostgreSQL.

## Infrastructure

React + Phaser frontend and a Java 17 / Spring Boot backend run under the dedicated `seulgae-tech-lab` Compose project. The existing PostgreSQL instance hosts separate development and production databases and least-privilege roles.

See [the infrastructure and Windows/IntelliJ runbook](docs/infrastructure.md) for SSH tunnels, credentials, deployment, verification, and the GitHub Actions activation requirements. Research APIs are deferred to the next stage.
