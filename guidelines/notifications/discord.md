# Discord Notification Guidelines

## Overview
Discord notifications are an alternative to Slack for teams using Discord as their communication hub. Discord Webhooks accept rich embed payloads via a simple HTTP POST, making them easy to integrate with GitHub Actions and Cloud Build with no additional dependencies.

## Rules

### [REQUIRED] Store the webhook URL as a secret, never in code
- **What:** Store the Discord webhook URL in GitHub Secrets (`DISCORD_WEBHOOK_URL`) or GCP Secret Manager.
- **Config:**
  ```yaml
  # GitHub Actions
  env:
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
  ```
- **Why:** Discord webhook URLs bypass channel-level permissions. Any exposure allows anyone to post to the channel indefinitely.

### [REQUIRED] Use embeds, not plain `content`, for pipeline notifications
- **What:** Post a JSON body with an `embeds` array rather than a plain `content` string.
- **Config:** See embed JSON example in the Configuration section.
- **Why:** Embeds render with color-coded sidebars, structured fields, timestamps, and footer text. Plain `content` is indistinguishable from a regular chat message.

### [REQUIRED] Set embed `color` to indicate status
- **What:** Use decimal color values: red for failure, green for success, yellow for in-progress.
- **Config:**
  ```json
  "color": 15158332
  ```
  Common values:
  - `15158332` — Red (`#E74C3C`) for failures
  - `3066993`  — Green (`#2ECC71`) for success
  - `16776960` — Yellow (`#FFFF00`) for in-progress/warning
- **Why:** Color is the fastest visual signal for triage. Teams scanning notification channels parse color before reading text.

### [REQUIRED] Use `curl` for the POST — no extra Action needed
- **What:** Send Discord notifications with a `curl` step directly in GitHub Actions. No third-party Action is needed.
- **Config:**
  ```yaml
  - name: Notify Discord on failure
    if: failure()
    run: |
      curl -fsSL -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$(cat .github/discord/failure-embed.json)"
    env:
      DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
  ```
- **Why:** `curl` is available in all GitHub-hosted runners. Avoiding a third-party Action reduces supply-chain risk and removes an external dependency.

### [RECOMMENDED] Interpolate dynamic values with `envsubst` or `jq`
- **What:** Use `envsubst` to inject GitHub context values into the embed JSON template at runtime.
- **Config:**
  ```yaml
  - name: Notify Discord on failure
    if: failure()
    run: |
      PAYLOAD=$(envsubst < .github/discord/failure-embed.json)
      curl -fsSL -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD"
    env:
      DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
      REPO: ${{ github.repository }}
      BRANCH: ${{ github.ref_name }}
      ACTOR: ${{ github.actor }}
      SHA: ${{ github.sha }}
      RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
  ```
- **Why:** Constructing JSON via string concatenation in shell is fragile (special characters break the payload). A template file with `envsubst` keeps the JSON valid and readable.

## Configuration

### Failure embed JSON template (`.github/discord/failure-embed.json`)

```json
{
  "embeds": [
    {
      "title": ":x: Build Failed",
      "color": 15158332,
      "fields": [
        {
          "name": "Repository",
          "value": "$REPO",
          "inline": true
        },
        {
          "name": "Branch",
          "value": "`$BRANCH`",
          "inline": true
        },
        {
          "name": "Triggered by",
          "value": "$ACTOR",
          "inline": true
        },
        {
          "name": "Commit",
          "value": "[$SHA]($RUN_URL)",
          "inline": false
        }
      ],
      "footer": {
        "text": "GitHub Actions"
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Deploy success embed JSON

```json
{
  "embeds": [
    {
      "title": ":rocket: Deployed to Production",
      "color": 3066993,
      "fields": [
        {
          "name": "Service",
          "value": "$SERVICE_NAME",
          "inline": true
        },
        {
          "name": "Environment",
          "value": "Production",
          "inline": true
        },
        {
          "name": "Version",
          "value": "`$SHA`",
          "inline": true
        }
      ],
      "footer": {
        "text": "Deployed via GitHub Actions"
      }
    }
  ]
}
```

### Cloud Build — inline notification step

```yaml
# In cloudbuild.yaml — add after deploy step
- id: 'notify-discord'
  name: 'curlimages/curl:latest'
  entrypoint: 'sh'
  args:
    - '-c'
    - |
      curl -fsSL -X POST "$$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{"embeds":[{"title":":rocket: Deployed $SHORT_SHA","color":3066993,"fields":[{"name":"Project","value":"$PROJECT_ID","inline":true}]}]}'
  secretEnv: ['DISCORD_WEBHOOK_URL']
  waitFor: ['deploy']

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/discord-webhook-url/versions/latest
      env: DISCORD_WEBHOOK_URL
```

## Common Pitfalls

- **Using `content` field instead of `embeds`**: Plain `content` looks like a chat message with no structure. Always use `embeds` for pipeline alerts.
- **Hardcoding the timestamp**: Discord embeds display timestamps as relative time ("2 minutes ago"). Hardcoding a static timestamp makes every notification show the same age. In production, inject the current ISO timestamp dynamically or omit the field.
- **Not setting `color`**: Without a color, the embed renders with a grey sidebar — visually identical regardless of success or failure.
- **Webhook URL in repo**: Even in private repos, webhook URLs committed to source are often leaked via public forks, exported repos, or log scraping. Always use GitHub Secrets.
- **Long field values**: Discord truncates field `value` at 1024 characters and embed `description` at 4096. Truncate long error messages before embedding them.
