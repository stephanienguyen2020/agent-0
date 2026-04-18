"""Shared constants for API routes and middleware."""

ESCROW_FEE_BPS = 1300

# Added to executor score on successful verify+release (`reputation_events.event_type = completion`).
REP_COMPLETION_DELTA_SCORE = 10
