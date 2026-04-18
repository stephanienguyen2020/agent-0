"""Shared constants for API routes and middleware."""

ESCROW_FEE_BPS = 1300

# Added to executor score on successful verify+release (`reputation_events.event_type = completion`).
REP_COMPLETION_DELTA_SCORE = 10

# Applied when dispute resolves in favor of requester (`reputation_events.event_type = dispute_loss`).
REP_DISPUTE_LOSS_DELTA_SCORE = -5
