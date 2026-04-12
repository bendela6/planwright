# Slack Notification Guidelines

## Overview
Slack notifications are the standard alerting channel for CI/CD pipeline events (build failures, deployment completions, error spikes). Two integration paths are supported: GitHub Actions via `slackapi/slack-github-action`, and Cloud Build via the managed Slack notifier. Both use Incoming Webhooks backed by a Slack App.

## Rules

### [REQUIRED] Store the webhook URL as a secret, never in code
- **What:** The webhook URL is a credential. Store it in GitHub Secrets (`SLACK_WEBHOOK_URL`) or GCP Secret Manager (`slack-webhook-url`).
- **Config:**
  ```yaml
  # GitHub Actions
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  ```
  ```bash
  # Cloud Build — reference via availableSecrets
  gcloud secrets create slack-webhook-url --data-file=-
  ```
- **Why:** Webhook URLs are unauthenticated POST endpoints. Exposure means anyone can send messages to your channel.

### [REQUIRED] Use Block Kit for all messages
- **What:** Use Slack's Block Kit format instead of plain `text` payloads for all pipeline notifications.
- **Config:** See Block Kit JSON example in the Configuration section.
- **Why:** Block Kit renders consistently across Slack clients, supports markdown, buttons, and structured fields. Plain text messages are unsearchable and visually noisy.

### [REQUIRED] Always notify on failure; only notify on success when deploying to production
- **What:** In GitHub Actions, add the `if: failure()` condition for failure notifications. Wrap success notifications with an environment check.
- **Config:**
  ```yaml
  - name: Notify Slack on failure
    if: failure()
    uses: slackapi/slack-github-action@v2
    with:
      webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
      webhook-type: incoming-webhook
      payload-file-path: .github/slack/failure.json

  - name: Notify Slack on deploy success
    if: success() && github.ref == 'refs/heads/main'
    uses: slackapi/slack-github-action@v2
    with:
      webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
      webhook-type: incoming-webhook
      payload-file-path: .github/slack/deploy-success.json
  ```
- **Why:** Notifying on every successful PR build creates noise that causes the channel to be ignored. Reserve success pings for prod deployments.

### [RECOMMENDED] Use Cloud Build Slack notifier for GCP pipelines
- **What:** Deploy the Cloud Build Slack notifier Cloud Run service for GCP pipelines instead of inline curl steps.
- **Config:**
  ```yaml
  # In cloudbuild-notifier.yaml (deployed separately)
  apiVersion: cloud-build-notifiers/v1
  kind: SlackNotifier
  metadata:
    name: slack-notifier
  spec:
    notification:
      filter: build.status == Build.Status.FAILURE || build.status == Build.Status.SUCCESS
      delivery:
        webhookUrl:
          secretRef: slack-webhook-url
  ```
- **Why:** The managed notifier handles retry logic, Pub/Sub subscription, and filtering so you don't need to inline notification steps in every `cloudbuild.yaml`.

## Configuration

### GitHub Actions workflow step with inline payload

```yaml
- name: Notify Slack
  if: failure()
  uses: slackapi/slack-github-action@v2
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    webhook-type: incoming-webhook
    payload: |
      {
        "blocks": [
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": ":x: Build Failed"
            }
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Repository:*\n${{ github.repository }}"
              },
              {
                "type": "mrkdwn",
                "text": "*Branch:*\n${{ github.ref_name }}"
              },
              {
                "type": "mrkdwn",
                "text": "*Triggered by:*\n${{ github.actor }}"
              },
              {
                "type": "mrkdwn",
                "text": "*Commit:*\n<${{ github.server_url }}/${{ github.repository }}/commit/${{ github.sha }}|${{ github.sha }}>"
              }
            ]
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": { "type": "plain_text", "text": "View Run" },
                "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
              }
            ]
          }
        ]
      }
```

### Deploy success Block Kit message JSON

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": ":rocket: Deployed to Production"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Service:*\nmy-service" },
        { "type": "mrkdwn", "text": "*Environment:*\nProduction" },
        { "type": "mrkdwn", "text": "*Version:*\n`abc1234`" },
        { "type": "mrkdwn", "text": "*Deployed by:*\ngithub-actions" }
      ]
    }
  ]
}
```

## Common Pitfalls

- **Webhook URL in `env:` at the job level exposed to forked PRs**: Use `secrets.SLACK_WEBHOOK_URL` and ensure the workflow only runs on trusted branches for steps that read secrets.
- **Not using `payload-file-path`**: Inline YAML payloads with special characters (backticks, quotes) break YAML parsing. Use `payload-file-path` pointing to a `.json` file for complex Block Kit layouts.
- **No `if: failure()` guard**: Without a condition, the notification step runs regardless of prior step outcomes, flooding the channel with success pings.
- **Using deprecated `icon_emoji` / `username` fields**: These are ignored by the Block Kit renderer. Set the bot's name and icon in the Slack App configuration instead.
- **Single webhook for all alerts**: Create separate webhooks for `#alerts-critical` (failures) and `#deployments` (successes) so teams can tune notification levels independently.
