# seulgae-tech-lab
Interactive 2D tech lab built with React, Phaser, Spring Boot and PostgreSQL.

## Infrastructure

React + Phaser frontend and a Java 17 / Spring Boot backend run under the dedicated `seulgae-tech-lab` Compose project. The existing PostgreSQL instance hosts separate development and production databases and least-privilege roles.

See [the infrastructure and Windows/IntelliJ runbook](docs/infrastructure.md) for SSH tunnels and development setup, [the operations guide](docs/operations.md) for the no-argument deployment and service commands, [the research API guide](docs/research-records.md) for the implemented schema and API, [room interactions](docs/room-interactions.md) for the per-room E actions and lab status API, [room atmosphere](docs/room-atmosphere.md) for per-room themes, door animation and room events, and [network latency](docs/network-latency.md) for the production latency diagnosis. Automatic deployment stays disabled until its dedicated Secrets are registered and verified.
