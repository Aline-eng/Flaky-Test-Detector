import { logger } from '../lib/logger';
import type { QuarantineNotifier } from './notifier';
import type { TestSummary } from './types';

export class SlackQuarantineNotifier implements QuarantineNotifier {
  constructor(private readonly webhookUrl: string | undefined) {}

  async notifyQuarantined(test: TestSummary, reason: string): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn(
        { testId: test.id },
        'SLACK_WEBHOOK_URL not configured; skipping quarantine notification',
      );
      return;
    }

    const text = [
      ':rotating_light: *Test quarantined*',
      `*${test.repo}* — \`${test.suite}\` / \`${test.name}\``,
      reason,
    ].join('\n');

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        logger.error(
          { testId: test.id, status: response.status },
          'Slack webhook responded with a non-2xx status',
        );
      }
    } catch (err) {
      logger.error({ err, testId: test.id }, 'failed to send Slack quarantine notification');
    }
  }
}
