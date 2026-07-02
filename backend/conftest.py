"""Shared pytest fixtures."""

import os

# The chat module reads OPENROUTER_API_KEY at import time and fails fast
# when unset. Every test that loads app.main (directly or transitively)
# needs this in place, so do it before any app imports.
os.environ.setdefault("OPENROUTER_API_KEY", "test-key-not-used")