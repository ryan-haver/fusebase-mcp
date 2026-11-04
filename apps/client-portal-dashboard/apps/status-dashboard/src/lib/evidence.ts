export type EvidenceState = 'current' | 'working-tree' | 'stale' | 'incomplete' | 'missing'

export function evidencePresentation(status: string, failed: number) {
  const states: Record<EvidenceState, { label: string; detail: string; tone: string }> = {
    current: { label: 'Selected checks passed', detail: 'Results match this committed source. Only the selected stages below were checked.', tone: 'success' },
    'working-tree': { label: 'Uncommitted validation', detail: 'These results cover local changes. Commit and revalidate before releasing.', tone: 'warning' },
    stale: { label: 'Stale validation evidence', detail: 'Recorded results belong to different source. They do not verify this release.', tone: 'warning' },
    incomplete: { label: 'Validation incomplete', detail: 'The selected run has not recorded every stage. Missing results are unverified.', tone: 'warning' },
    missing: { label: 'No validation evidence', detail: 'No test run is recorded for this source.', tone: 'warning' },
  }
  const state = Object.prototype.hasOwnProperty.call(states, status) ? states[status as EvidenceState] : states.missing
  return failed ? { ...state, label: `Recorded run failed${status === 'current' ? '' : ` · ${state.label.toLowerCase()}`}`, tone: 'danger' } : state
}
