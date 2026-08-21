import type { FlakinessStatus } from '../api/types';

const LABEL: Record<FlakinessStatus, string> = {
  STABLE: 'Stable',
  FLAGGED: 'Flagged',
  QUARANTINED: 'Quarantined',
};

export function StatusBadge({ status }: { status: FlakinessStatus }) {
  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>{LABEL[status]}</span>
  );
}
