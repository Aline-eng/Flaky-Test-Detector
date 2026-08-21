import { SlackQuarantineNotifier } from '../slackNotifier';
import type { TestSummary } from '../types';

const TEST: TestSummary = { id: 'test-1', repo: 'o/r', suite: 'unit', name: 'flaky it' };

describe('SlackQuarantineNotifier', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs a message to the configured webhook URL exactly once', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    const notifier = new SlackQuarantineNotifier('https://hooks.slack.test/abc');
    await notifier.notifyQuarantined(
      TEST,
      'flakiness detection classified this test as QUARANTINED',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.slack.test/abc');
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body.text).toContain('o/r');
    expect(body.text).toContain('unit');
    expect(body.text).toContain('flaky it');
  });

  it('does not throw and skips the request when no webhook URL is configured', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    const notifier = new SlackQuarantineNotifier(undefined);
    await expect(notifier.notifyQuarantined(TEST, 'reason')).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not throw when the webhook request fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const notifier = new SlackQuarantineNotifier('https://hooks.slack.test/abc');
    await expect(notifier.notifyQuarantined(TEST, 'reason')).resolves.toBeUndefined();
  });
});
