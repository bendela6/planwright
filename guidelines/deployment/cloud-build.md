# Cloud Build Guidelines

## Overview
Cloud Build is the standard CI/CD pipeline for GCP-hosted services. It builds Docker images, runs tests, pushes to Artifact Registry, and deploys to Cloud Run. These guidelines ensure pipelines are fast, secure, and observable.

## Rules

### [REQUIRED] Follow the canonical step order: install → test → build → push → deploy
- **What:** Every `cloudbuild.yaml` must follow this sequence with no shortcuts.
- **Config:** See full example in the Configuration section below.
- **Why:** Running tests before building the image catches failures cheaply (no image build cost). Pushing before deploy ensures the image exists before Cloud Run references it.

### [REQUIRED] Use Artifact Registry, not Container Registry
- **What:** Push images to `us-central1-docker.pkg.dev/$PROJECT_ID/REPO/IMAGE:$COMMIT_SHA`.
- **Config:**
  ```yaml
  images:
    - 'us-central1-docker.pkg.dev/$PROJECT_ID/my-repo/my-service:$COMMIT_SHA'
  ```
- **Why:** Container Registry (`gcr.io`) is deprecated. Artifact Registry supports fine-grained IAM, vulnerability scanning, and multi-format repositories.

### [REQUIRED] Tag images with `$COMMIT_SHA`, not `latest`
- **What:** Always use `$COMMIT_SHA` as the primary image tag. Optionally also tag `latest`.
- **Config:**
  ```yaml
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/my-repo/my-service:$COMMIT_SHA', '.']
  ```
- **Why:** Mutable `latest` tags make rollbacks ambiguous. `$COMMIT_SHA` creates a 1:1 mapping between code and image that is auditable and rollback-safe.

### [REQUIRED] Read secrets from Secret Manager in build steps
- **What:** Use `availableSecrets` to inject build-time secrets (e.g., npm token, test DB URL).
- **Config:**
  ```yaml
  availableSecrets:
    secretManager:
      - versionName: projects/$PROJECT_ID/secrets/npm-token/versions/latest
        env: NPM_TOKEN
  steps:
    - name: 'node:20'
      secretEnv: ['NPM_TOKEN']
      entrypoint: 'bash'
      args: ['-c', 'echo "//registry.npmjs.org/:_authToken=$$NPM_TOKEN" >> ~/.npmrc && npm ci']
  ```
- **Why:** Secrets in `substitutions` appear in build logs. `availableSecrets` masks the values in all log output.

### [REQUIRED] Set build timeout and machine type
- **What:** Set `timeout` and `options.machineType` at the top level.
- **Config:**
  ```yaml
  timeout: '1200s'
  options:
    machineType: 'E2_HIGHCPU_8'
    logging: CLOUD_LOGGING_ONLY
  ```
- **Why:** Default timeout is 10 minutes, which is too short for monorepo builds. `E2_HIGHCPU_8` cuts test + build time in half vs the default `E2_MEDIUM` for CPU-bound workloads.

### [REQUIRED] Configure triggers for main push and PR preview
- **What:** Create two triggers: one for `main` (production deploy), one for PRs (preview deploy with `--no-traffic`).
- **Config:**
  ```yaml
  # main trigger substitutions
  substitutions:
    _DEPLOY_FLAGS: '--traffic=100'

  # PR trigger substitutions
  substitutions:
    _DEPLOY_FLAGS: '--no-traffic --tag=pr-$_PR_NUMBER'
  ```
- **Why:** Separating triggers allows different substitution values and IAM permissions for prod vs preview without duplicating the entire pipeline file.

### [RECOMMENDED] Use substitution variables for all environment-specific values
- **What:** Never hardcode project IDs, region, or service names. Use `$PROJECT_ID` (built-in) and `$_` prefixed custom substitutions.
- **Config:**
  ```yaml
  substitutions:
    _REGION: 'us-central1'
    _SERVICE_NAME: 'my-service'
    _REPO: 'my-repo'
  ```
- **Why:** Built-in substitution `$PROJECT_ID` is populated by Cloud Build automatically. Custom `$_VAR` substitutions can be overridden per trigger, making the same `cloudbuild.yaml` reusable across environments.

## Configuration

Complete `cloudbuild.yaml` example:

```yaml
timeout: '1200s'

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

substitutions:
  _REGION: 'us-central1'
  _SERVICE_NAME: 'my-service'
  _REPO: 'my-repo'
  _DEPLOY_FLAGS: '--traffic=100'

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/npm-token/versions/latest
      env: NPM_TOKEN

steps:
  # Step 1: Install dependencies
  - id: 'install'
    name: 'node:20-alpine'
    secretEnv: ['NPM_TOKEN']
    entrypoint: 'sh'
    args:
      - '-c'
      - |
        echo "//registry.npmjs.org/:_authToken=$$NPM_TOKEN" >> ~/.npmrc
        npm ci

  # Step 2: Run tests
  - id: 'test'
    name: 'node:20-alpine'
    entrypoint: 'npm'
    args: ['run', 'test', '--', '--reporter=verbose']
    waitFor: ['install']

  # Step 3: Build Docker image
  - id: 'docker-build'
    name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--cache-from'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME:latest'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME:$COMMIT_SHA'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME:latest'
      - '.'
    waitFor: ['test']

  # Step 4: Push to Artifact Registry
  - id: 'docker-push'
    name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME'
    waitFor: ['docker-build']

  # Step 5: Deploy to Cloud Run
  - id: 'deploy'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk:slim'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - '$_SERVICE_NAME'
      - '--image=us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME:$COMMIT_SHA'
      - '--region=$_REGION'
      - '--platform=managed'
      - $_DEPLOY_FLAGS
    waitFor: ['docker-push']

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME:$COMMIT_SHA'
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/$_REPO/$_SERVICE_NAME:latest'
```

## Common Pitfalls

- **Secrets in `substitutions`**: Values appear in plain text in build history and logs. Use `availableSecrets` for any sensitive value.
- **Not setting `waitFor`**: Without explicit `waitFor`, Cloud Build runs all steps in parallel. Test must wait for install; deploy must wait for push.
- **Using `gcr.io` image URLs**: Container Registry is deprecated. All new images go to Artifact Registry at `docker.pkg.dev`.
- **Default machine type for large monorepos**: `E2_MEDIUM` (1 vCPU) makes `npm ci` and Docker builds painfully slow. Use `E2_HIGHCPU_8` for any repo with significant dependencies.
- **Missing `--cache-from`**: Without layer caching, every build reinstalls all node_modules into the image. Pull the `latest` tag and pass it as `--cache-from` to dramatically speed up builds.
- **No `timeout` set**: Default 10-minute timeout kills builds in large repos. Set `1200s` (20 min) or higher.
