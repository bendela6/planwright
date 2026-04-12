# Cloud Run Guidelines

## Overview
Cloud Run is the standard deployment target for containerized backend services and APIs. It provides automatic scaling, pay-per-request pricing, and native integration with GCP services (Secret Manager, VPC, IAM). These guidelines ensure services are production-ready with no cold-start gaps in high-traffic scenarios.

## Rules

### [REQUIRED] Set CPU, memory, and concurrency explicitly
- **What:** Always declare resource limits rather than relying on Cloud Run defaults.
- **Config:**
  ```yaml
  # In gcloud run deploy flags or service.yaml
  --cpu: "1"
  --memory: "512Mi"
  --concurrency: "80"
  --max-instances: "10"
  ```
- **Why:** Defaults (80 concurrency, 1 CPU) are acceptable for APIs, but explicit settings make resource planning visible in code review and prevent surprise scaling costs.

### [REQUIRED] Use Secret Manager for all environment variables containing secrets
- **What:** Never pass secrets as plain `--set-env-vars`. Mount them via `--set-secrets`.
- **Config:**
  ```bash
  gcloud run deploy my-service \
    --set-secrets="DATABASE_URL=projects/MY_PROJECT/secrets/db-url:latest,JWT_SECRET=projects/MY_PROJECT/secrets/jwt-secret:latest"
  ```
- **Why:** `--set-env-vars` values appear in Cloud Run console, audit logs, and Terraform state in plaintext. Secret Manager rotates values independently of deploys.

### [REQUIRED] Expose a `/health` endpoint
- **What:** Every service must implement `GET /health` returning `200 OK` with a JSON body.
- **Config:**
  ```typescript
  // Fastify example
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  ```
  ```bash
  gcloud run deploy my-service \
    --port=8080 \
    --set-env-vars="PORT=8080"
  ```
- **Why:** Cloud Run uses the health check to route traffic. A missing or broken health endpoint causes the revision to be marked unhealthy and traffic is not migrated.

### [REQUIRED] Set minimum instances for production services
- **What:** Set `--min-instances=1` (or higher) for any production-tier service.
- **Config:**
  ```bash
  gcloud run deploy my-service \
    --min-instances=1 \
    --max-instances=20
  ```
- **Why:** Cloud Run scales to zero by default. The cold start for a Node.js container is typically 2-5 seconds. For customer-facing APIs this is unacceptable. Minimum 1 instance keeps the service warm.

### [REQUIRED] Use a dedicated service account with least-privilege IAM
- **What:** Create a service account per service; grant only the roles it needs.
- **Config:**
  ```bash
  gcloud iam service-accounts create my-service-sa \
    --display-name="my-service Cloud Run SA"

  # Grant Secret Manager access
  gcloud secrets add-iam-policy-binding db-url \
    --member="serviceAccount:my-service-sa@MY_PROJECT.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

  gcloud run deploy my-service \
    --service-account="my-service-sa@MY_PROJECT.iam.gserviceaccount.com"
  ```
- **Why:** The default Compute Engine service account has broad project permissions. A dedicated SA with minimal grants limits blast radius if the service is compromised.

### [RECOMMENDED] Attach VPC connector for private database access
- **What:** Use a Serverless VPC Access connector to reach Cloud SQL or other private resources.
- **Config:**
  ```bash
  gcloud run deploy my-service \
    --vpc-connector=projects/MY_PROJECT/locations/us-central1/connectors/my-connector \
    --vpc-egress=private-ranges-only
  ```
- **Why:** `--vpc-egress=private-ranges-only` ensures only RFC-1918 traffic routes through the VPC; public internet traffic still exits directly, keeping latency low.

### [RECOMMENDED] Deploy feature branch preview revisions per PR
- **What:** Tag each PR deploy with the branch name so it gets a stable preview URL.
- **Config:**
  ```bash
  # In CI: compute a safe tag from branch name
  TAG=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | cut -c1-63)

  gcloud run deploy my-service \
    --tag="pr-${PR_NUMBER}" \
    --no-traffic \
    --region=us-central1
  # Preview URL: https://pr-${PR_NUMBER}---my-service-HASH-uc.a.run.app
  ```
- **Why:** Revisions with `--no-traffic` do not serve production traffic but are fully reachable via their tagged URL, giving reviewers a live environment without affecting prod.

## Configuration

Complete production deploy command:

```bash
gcloud run deploy my-service \
  --image="us-central1-docker.pkg.dev/MY_PROJECT/my-repo/my-service:$COMMIT_SHA" \
  --region=us-central1 \
  --platform=managed \
  --service-account="my-service-sa@MY_PROJECT.iam.gserviceaccount.com" \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --min-instances=1 \
  --max-instances=20 \
  --port=8080 \
  --set-secrets="DATABASE_URL=projects/MY_PROJECT/secrets/db-url:latest,JWT_SECRET=projects/MY_PROJECT/secrets/jwt-secret:latest" \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info" \
  --vpc-connector=projects/MY_PROJECT/locations/us-central1/connectors/my-connector \
  --vpc-egress=private-ranges-only \
  --allow-unauthenticated
```

## Common Pitfalls

- **No `--min-instances` on prod**: First request after a quiet period gets a 3-5 second cold start. Always set at least `--min-instances=1`.
- **Hardcoded image tag `latest`**: Cloud Run caches image references. Use `$COMMIT_SHA` as the tag so each deploy pulls the correct image.
- **`--allow-unauthenticated` on internal services**: Internal services (called only by other services or Cloud Build) should omit this flag and use service-to-service auth with IAM instead.
- **Not setting `--vpc-egress=private-ranges-only`**: Using `all-traffic` routes all outbound through the VPC, which adds latency for public API calls and may incur VPC egress charges.
- **Secrets referenced by version number**: Using `:1` instead of `:latest` means rotated secrets require a new deploy. Always use `:latest`.
- **Missing `PORT` env var**: Cloud Run injects `$PORT` but some frameworks need it explicitly. Confirm your service reads `process.env.PORT`.
