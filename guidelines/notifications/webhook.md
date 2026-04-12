# Generic Webhook Notification Guidelines

## Overview
A generic HTTP webhook pattern lets CI/CD pipelines notify any HTTP endpoint — Microsoft Teams, PagerDuty, custom observability dashboards, or internal tooling — using a standardized JSON payload format. This document covers the payload structure, authentication, retry behavior, and both GitHub Actions and Cloud Build integration patterns.

## Rules

### [REQUIRED] Use a consistent JSON payload schema for all events
- **What:** All webhook posts from this project must follow the standard event envelope defined below.
- **Config:**
  ```json
  {
    "event": "deployment.success",
    "timestamp": "2024-11-01T12:00:00.000Z",
    "project": "my-service",
    "environment": "production",
    "version": "abc1234",
    "actor": "github-actions",
    "url": "https://my-service.example.com",
    "metadata": {}
  }
  ```
  Event values: `build.failure`, `build.success`, `deployment.success`, `deployment.failure`, `test.failure`.
- **Why:** A consistent envelope lets receivers parse and route any event without per-pipeline customization. `metadata` provides a typed extension point for event-specific data.

### [REQUIRED] Authenticate all webhook requests
- **What:** Choose one of two auth schemes: Bearer token (simpler) or HMAC signature (more secure).
- **Config:**
  ```bash
  # Bearer token
  curl -X POST "$WEBHOOK_URL" \
    -H "Authorization: Bearer $WEBHOOK_SECRET" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"

  # HMAC-SHA256 signature
  SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | awk '{print $2}')
  curl -X POST "$WEBHOOK_URL" \
    -H "X-Signature-SHA256: sha256=$SIGNATURE" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"
  ```
- **Why:** Unauthenticated webhooks allow anyone to inject fake events into your pipeline notifications or incident management system. HMAC also ensures payload integrity.

### [REQUIRED] Store webhook URL and secret in GitHub Secrets or Secret Manager
- **What:** Never commit webhook credentials. Store `WEBHOOK_URL` and `WEBHOOK_SECRET` as secrets.
- **Config:**
  ```yaml
  # GitHub Actions
  - name: Send webhook
    run: bash .github/scripts/notify.sh
    env:
      WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
      WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}
  ```
- **Why:** Webhook secrets rotate independently of code. Secrets in code require a new commit and redeploy to rotate, and the old secret remains in git history.

### [REQUIRED] Set a request timeout
- **What:** Webhook POSTs must time out if the receiver is slow or unreachable.
- **Config:**
  ```bash
  curl --max-time 10 --connect-timeout 5 -X POST "$WEBHOOK_URL" ...
  ```
- **Why:** Without `--max-time`, a hung receiver blocks the CI step indefinitely, stalling or failing the pipeline. 10 seconds is sufficient for any notification endpoint.

### [RECOMMENDED] Implement retry with exponential backoff for transient failures
- **What:** Retry up to 3 times with exponential backoff on 5xx or network errors.
- **Config:**
  ```bash
  # .github/scripts/notify.sh
  #!/usr/bin/env bash
  set -euo pipefail

  MAX_RETRIES=3
  RETRY_DELAY=2

  for attempt in $(seq 1 $MAX_RETRIES); do
    HTTP_CODE=$(curl --max-time 10 --connect-timeout 5 -s -o /dev/null -w "%{http_code}" \
      -X POST "$WEBHOOK_URL" \
      -H "Authorization: Bearer $WEBHOOK_SECRET" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD")

    if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
      echo "Webhook delivered (HTTP $HTTP_CODE)"
      exit 0
    fi

    echo "Attempt $attempt failed (HTTP $HTTP_CODE). Retrying in ${RETRY_DELAY}s..."
    sleep "$RETRY_DELAY"
    RETRY_DELAY=$((RETRY_DELAY * 2))
  done

  echo "Webhook delivery failed after $MAX_RETRIES attempts" >&2
  exit 1
  ```
- **Why:** Transient 503s from notification services are common. Three retries with doubling delay cover the vast majority of brief outages without blocking the pipeline for more than ~14 seconds total.

### [RECOMMENDED] Cloud Build: use Pub/Sub → Cloud Function → webhook for reliable delivery
- **What:** Instead of inline `curl` steps, route Cloud Build events through Pub/Sub to a Cloud Function that fans out to webhook targets.
- **Config:**
  ```
  Cloud Build → Pub/Sub topic: cloud-builds → Cloud Function: notify-webhook
                                                     ↓
                                              POST to WEBHOOK_URL
  ```
  ```javascript
  // Cloud Function (Node.js)
  exports.notifyWebhook = async (pubSubEvent) => {
    const build = JSON.parse(Buffer.from(pubSubEvent.data, 'base64').toString());
    if (!['SUCCESS', 'FAILURE'].includes(build.status)) return;

    const payload = {
      event: build.status === 'SUCCESS' ? 'deployment.success' : 'build.failure',
      timestamp: new Date().toISOString(),
      project: build.substitutions?.REPO_NAME ?? build.projectId,
      version: build.substitutions?.SHORT_SHA ?? build.id,
    };

    await fetch(process.env.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  };
  ```
- **Why:** Cloud Functions retries on failure (configurable), decouples webhook delivery from build steps, and lets you add new webhook targets without editing every `cloudbuild.yaml`.

## Configuration

### GitHub Actions: complete webhook notification job

```yaml
notify-webhook:
  runs-on: ubuntu-latest
  needs: [deploy]
  if: always()
  steps:
    - name: Build webhook payload
      id: payload
      run: |
        STATUS="${{ needs.deploy.result == 'success' && 'deployment.success' || 'deployment.failure' }}"
        PAYLOAD=$(jq -n \
          --arg event "$STATUS" \
          --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
          --arg project "${{ github.repository }}" \
          --arg version "${{ github.sha }}" \
          --arg actor "${{ github.actor }}" \
          '{event: $event, timestamp: $ts, project: $project, version: $version, actor: $actor}')
        echo "payload=$PAYLOAD" >> "$GITHUB_OUTPUT"

    - name: Send webhook
      run: bash .github/scripts/notify.sh
      env:
        WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
        WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}
        PAYLOAD: ${{ steps.payload.outputs.payload }}
```

## Common Pitfalls

- **No timeout on `curl`**: A slow endpoint blocks the CI step indefinitely. Always set `--max-time` and `--connect-timeout`.
- **Failing the build on webhook delivery failure**: Notification failures should not fail the deployment. In GitHub Actions, add `continue-on-error: true` to webhook steps.
- **Building JSON via string interpolation**: Shell string concatenation breaks when values contain quotes or newlines. Use `jq -n` with `--arg` flags to safely construct JSON.
- **Same `WEBHOOK_URL` for prod and non-prod**: Route production events to PagerDuty/Teams/critical channels; PR build events to a lower-noise channel or suppressed entirely.
- **Not verifying HMAC on the receiver**: HMAC signatures only provide integrity if the receiver validates them. Document the verification pattern alongside this configuration.
- **Applicable providers**: Teams (use `messageCard` or Adaptive Card in `metadata`), PagerDuty (V2 Events API), custom dashboards, status page automation (Statuspage.io).
