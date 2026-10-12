# Platform App (`platform-app`)

Microservices application and CI pipeline for the GitOps & DevSecOps Platform.

## Architecture

* **`services/api`**: Node.js Express backend service providing:
  * Liveness probe: `/healthz`
  * Readiness probe: `/readyz` (checks Redis cache when configured)
  * Prometheus metrics: `/metrics` (`http_requests_total`, `http_request_duration_seconds`)
  * Business API: `/api/products`
  * Canary test fault injection: `/api/fault`
  * Structured JSON logs to stdout
* **`services/frontend`**: Web dashboard with glassmorphism UI, real-time API latency and status tracking.
* **Security & Containerization**: Multi-stage Docker builds running as non-root `USER 10001` to meet Kyverno admission policy standards.

## CI Workflow (`.github/workflows/ci.yaml`)

Every push triggers:
1. Unit and endpoint test execution.
2. Multi-stage Docker build using Buildx.
3. **Trivy vulnerability scan** (blocks pipeline on High/Critical vulnerabilities).
4. Image publishing to GitHub Container Registry (`ghcr.io`) tagged with immutable **Git commit SHA** (no `:latest`).
