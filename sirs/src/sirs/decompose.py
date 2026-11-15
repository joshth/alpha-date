"""Additive decomposition (paper Appendix C.1) and the two track inputs."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from statsmodels.tsa.seasonal import seasonal_decompose

PERIOD = 52
MIN_WEEKS_SEASONAL = 156  # 3 years
ACTIVE_THRESHOLD = 0.05  # a week is "active" once the series first reaches 5% of its max


def rescale(x: np.ndarray, lo: float = -1.0, hi: float = 1.0) -> np.ndarray:
    """Min-max rescale to [lo, hi] (paper's ``normalize`` for lo=-1, hi=1)."""
    x = np.asarray(x, dtype=float)
    mn, mx = np.nanmin(x), np.nanmax(x)
    if mx - mn == 0:
        return np.full_like(x, (lo + hi) / 2)
    return lo + (hi - lo) * (x - mn) / (mx - mn)


@dataclass
class Decomposition:
    term: str
    weeks: pd.DatetimeIndex
    value: np.ndarray
    trend: np.ndarray
    seasonal: np.ndarray
    resid: np.ndarray
    seasonal_estimated: bool
    active_weeks: int
    # Track A: residual with NaN ends dropped, rescaled to [-1, 1]
    track_a: np.ndarray
    track_a_weeks: pd.DatetimeIndex
    # Track B: value - seasonal, rescaled to [0, 1]
    track_b: np.ndarray
    track_b_min: float
    track_b_max: float


def decompose_term(term: str, weeks: pd.DatetimeIndex, value: np.ndarray) -> Decomposition:
    value = np.asarray(value, dtype=float)
    n = len(value)
    peak = np.nanmax(value) if n else 0.0
    active_start = int(np.argmax(value >= ACTIVE_THRESHOLD * peak)) if peak > 0 else n
    active_weeks = n - active_start
    s = pd.Series(value, index=weeks)
    if n >= 2 * PERIOD:
        dec = seasonal_decompose(s, model="additive", period=PERIOD)
        trend = dec.trend.values
        if active_weeks >= MIN_WEEKS_SEASONAL:
            seasonal, est = dec.seasonal.values, True
        else:
            seasonal, est = np.zeros(n), False
        resid = value - trend - seasonal
    else:  # too short for a centred 52-week trend at all
        trend = np.full(n, np.nan)
        seasonal, est = np.zeros(n), False
        resid = np.full(n, np.nan)
    ok = ~np.isnan(resid)
    track_a = rescale(resid[ok]) if ok.sum() > 1 else np.array([])
    deseason = value - seasonal
    b_min, b_max = float(np.min(deseason)), float(np.max(deseason))
    track_b = rescale(deseason, 0.0, 1.0)
    return Decomposition(term, weeks, value, trend, seasonal, resid, est, active_weeks,
                         track_a, weeks[ok], track_b, b_min, b_max)
