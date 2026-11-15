"""Lifecycle stage rule applied to noise-free fitted I(t) curves.

See ``exports/stage_rule.md`` for the reasoning. All quantities are relative to
the curve's own peak I_peak, with time in weeks:

    r     = I(now) / I_peak
    delta = (I(now) - I(now - 180 days)) / I_peak      (change over the scorer's window)

Rules, first match wins:
    1. peaking:          r >= R_PEAK
    2. flat on this horizon (|delta| < FLOOR):
         parent_territory  if now is after the curve's peak
         pre_emergence     otherwise (not yet taken off; not a product stage, never a fixture)
    3. emerging:         delta >= FLOOR
    4. declining:        delta <= -FLOOR

The old sign-only rules on I' and I'' are gone: a slope or a curvature that does
not move the curve by FLOOR * I_peak inside 180 days cannot be seen in the counts.
"""

from __future__ import annotations

import numpy as np

from .model import Params

STAGES = ["emerging", "peaking", "declining", "parent_territory"]
PRE_EMERGENCE = "pre_emergence"
WINDOW_DAYS = 180
WINDOW_WEEKS = WINDOW_DAYS / 7.0
R_PEAK = 0.80
FLOOR = 0.20  # minimum |I(now) - I(now - 180 d)| / I_peak for emerging / declining

# Detectability model behind FLOOR (see min_detectable_change and stage_rule.md)
RATE_FLOOR = 0.3  # counted events per day at I = 0
BLOCK_DAYS = 60  # compare the first and last 60 days of the 180-day window
Z = 2.0  # ~2 standard errors


def min_detectable_change(peak_rate: float, r_base: float, block_days: int = BLOCK_DAYS,
                          z: float = Z, rate_floor: float = RATE_FLOOR) -> float:
    """Smallest change in r (as a fraction of I_peak) whose effect on daily Poisson counts
    shows up as a z-sigma difference between two blocks of ``block_days`` days.

    Daily rate lambda(r) = rate_floor + (peak_rate - rate_floor) * r, as in the fixtures.
    Condition: block*(lambda(r+d) - lambda(r)) >= z * sqrt(block*(lambda(r) + lambda(r+d))).
    With k = block*(peak_rate - rate_floor) and A = 2*block*lambda(r) this is
    k^2 d^2 - z^2 k d - z^2 A >= 0, so d = (z^2 + sqrt(z^4 + 4 z^2 A)) / (2k).
    """
    k = block_days * (peak_rate - rate_floor)
    a = 2 * block_days * (rate_floor + (peak_rate - rate_floor) * r_base)
    return float((z * z + np.sqrt(z ** 4 + 4 * z * z * a)) / (2 * k))


def label(t, I, I_prev, i_peak: float, t_peak: float) -> np.ndarray:
    """Stage label per time point. ``t`` is weeks since onset, ``I`` the noise-free I(t),
    ``I_prev`` the noise-free I(t - 180 days)."""
    t, I, I_prev = map(np.atleast_1d, (t, I, I_prev))
    r = I / i_peak
    delta = (I - I_prev) / i_peak
    out = np.where(delta >= FLOOR, "emerging", "declining").astype(object)
    flat = np.abs(delta) < FLOOR
    out[flat] = np.where(t[flat] > t_peak, "parent_territory", PRE_EMERGENCE)
    out[r >= R_PEAK] = "peaking"
    return out


def derivatives(p: Params, S, I, G):
    """Analytic I' and I'' for the modified SIRS (reported in fixtures; not used for labels)."""
    S, I, G = map(np.asarray, (S, I, G))
    dS = -p.beta * S * I + p.xi * (1 - S - I)
    dG = G * (p.alpha * I - p.delta * S)
    g = p.beta * S - G
    dI = g * I
    d2I = (p.beta * dS - dG) * I + g * dI
    return dI, d2I


def features(p: Params, S, I, G, i_peak: float) -> dict:
    dI, d2I = derivatives(p, S, I, G)
    return {"r": float(I / i_peak), "v": float(dI / i_peak), "c": float(d2I / i_peak)}
