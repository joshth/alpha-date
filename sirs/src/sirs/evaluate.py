"""Random-walk DTW baseline (paper Appendix C.3) and summary helpers."""

from __future__ import annotations

import numpy as np

from .decompose import rescale
from .fit import dtw_dist

N_WALKS = 500


def random_walk_dtws(y: np.ndarray, rng: np.random.Generator, n_walks: int = N_WALKS,
                     lo: float = -1.0, hi: float = 1.0) -> np.ndarray:
    """DTW from y to n_walks random walks (N(0,1) steps, same length, rescaled to [lo, hi])."""
    n = len(y)
    out = np.empty(n_walks)
    for w in range(n_walks):
        walk = rescale(np.cumsum(rng.standard_normal(n)), lo, hi)
        out[w] = dtw_dist(y, walk)
    return out


def baseline_summary(model_dtw: float, rw: np.ndarray) -> dict:
    """Paper criterion: the model 'beats' the baseline if its DTW is below the first
    quartile of the random-walk DTWs. Also report mean and best (min) random walk."""
    q1 = float(np.percentile(rw, 25))
    return {
        "model_dtw": float(model_dtw),
        "rw_mean": float(rw.mean()),
        "rw_q1": q1,
        "rw_best": float(rw.min()),
        "beats_q1": bool(model_dtw < q1),
        "beats_mean": bool(model_dtw < rw.mean()),
        "beats_best": bool(model_dtw < rw.min()),
    }
