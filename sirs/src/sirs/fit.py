"""Shared-per-generation fitting with per-term nuisance onset/affine maps.

Efficiency trick (brief, Step 4): for one parameter set the ODE is solved once
on a long weekly grid; each term's model curve is a shifted window of that one
solution. The shift (onset t0) is found by sliding the window; the affine map
(amplitude a >= 0, baseline b) by closed-form least squares.

Shift convention: a term's data week j corresponds to model time k + j, so
k > 0 means the onset t0 lies k weeks *before* the first data week. Model
time before the onset (k < 0) is padded with the seed value I = 1e-3.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from dtaidistance import dtw
from scipy.optimize import differential_evolution
from scipy.signal import fftconvolve

from .decompose import rescale
from .model import I0_SEED, Params, simulate

LOG_LO, LOG_HI = np.log10(1e-3), np.log10(2.0)  # rates in [1e-3, 2] per week
# alpha, delta go down to 1e-6 so the feedback model nests the constant-gamma ablation:
# with alpha = delta = 1e-3, Gamma would still drift by ~e^-3 over a 4000-week grid.
LOG_FB_LO = np.log10(1e-6)
ONSET_YEARS_BEFORE = 15  # earliest onset: Jan 1 of (first_popular_year - 15)
ONSET_WEEKS_BEFORE_END = 26  # latest onset: 26 weeks before the last data week
A_CAP = 10.0  # amplitude cap: a * max(I) <= A_CAP (series are scaled to max 1)
PENALTY = 1e3
DTW_FIT_WINDOW = 26  # Sakoe-Chiba band used only inside the Track A optimiser
DTW_CANDIDATES = 3  # best-correlated shifts re-scored with DTW in Track A
MIN_WINDOW_VAR = 1e-8  # Track A: model window must have std(I) >= 1e-4


@dataclass
class TermData:
    term: str
    generation: str
    y: np.ndarray
    start: pd.Timestamp  # calendar week of y[0]
    k_min: int
    k_max: int

    @property
    def n(self) -> int:
        return len(self.y)


def make_term(term: str, generation: str, y: np.ndarray, start: pd.Timestamp,
              first_popular_year: int) -> TermData:
    n = len(y)
    t0_min = pd.Timestamp(year=first_popular_year - ONSET_YEARS_BEFORE, month=1, day=1)
    k_max = max(0, int((start - t0_min).days // 7))
    k_min = -(n - ONSET_WEEKS_BEFORE_END)
    return TermData(term, generation, np.asarray(y, dtype=float), start, k_min, k_max)


# ---------------------------------------------------------------------------
# Parameterisations (search space is log10 of the rates)
# ---------------------------------------------------------------------------

def params_from_x(x, variant: str) -> Params:
    v = 10.0 ** np.asarray(x)
    if variant == "feedback":
        return Params(*v)
    if variant == "constant_gamma":
        b, xi, g = v
        return Params(b, xi, 0.0, 0.0, g)
    raise ValueError(variant)


def search_bounds(variant: str) -> list[tuple[float, float]]:
    if variant == "feedback":  # beta, xi, alpha, delta, gamma0
        return [(LOG_LO, LOG_HI), (LOG_LO, LOG_HI), (LOG_FB_LO, LOG_HI), (LOG_FB_LO, LOG_HI), (LOG_LO, LOG_HI)]
    return [(LOG_LO, LOG_HI)] * 3  # beta, xi, gamma


def nested_x0(x_constant_gamma) -> list[float]:
    """Feedback-model starting point equivalent to a constant-gamma solution."""
    b, xi, g = x_constant_gamma
    return [b, xi, LOG_FB_LO, LOG_FB_LO, g]


# ---------------------------------------------------------------------------
# Shared grid and sliding-window alignment
# ---------------------------------------------------------------------------

def grid_size(terms: list[TermData]) -> tuple[int, int]:
    """(padding P, grid length G) covering every term's shift range."""
    P = max(-t.k_min for t in terms)
    G = max(t.k_max + t.n for t in terms) + 1
    return P, G


def padded_I(I: np.ndarray, P: int) -> np.ndarray:
    return np.concatenate([np.full(P, I0_SEED), I])


def _sliding_stats(Ip: np.ndarray, P: int, t: TermData):
    """Window sums over every allowed shift k in [k_min, k_max]."""
    lo, hi = P + t.k_min, P + t.k_max + t.n
    seg = Ip[lo:hi]
    n = t.n
    c1 = np.concatenate([[0.0], np.cumsum(seg)])
    c2 = np.concatenate([[0.0], np.cumsum(seg * seg)])
    Sx = c1[n:] - c1[:-n]
    Sxx = c2[n:] - c2[:-n]
    Sxy = fftconvolve(seg, t.y[::-1], mode="valid")
    return Sx, Sxx, Sxy


def affine_sse(t: TermData, Sx, Sxx, Sxy, a_cap: float):
    """Closed-form least squares y ~ a*x + b per window with 0 <= a <= a_cap."""
    n = t.n
    Sy, Syy = t.y.sum(), (t.y ** 2).sum()
    var = Sxx - Sx ** 2 / n
    cov = Sxy - Sx * Sy / n
    with np.errstate(divide="ignore", invalid="ignore"):
        a = np.where((var > 1e-14) & (cov > 0), cov / var, 0.0)
    a = np.clip(a, 0.0, a_cap)
    b = (Sy - a * Sx) / n
    sse = Syy + a * a * Sxx + n * b * b - 2 * a * Sxy - 2 * b * Sy + 2 * a * b * Sx
    return a, b, np.maximum(sse, 0.0)


def align_b(Ip: np.ndarray, P: int, t: TermData, a_cap: float) -> dict:
    """Track B alignment: best shift by squared error with LS affine map."""
    Sx, Sxx, Sxy = _sliding_stats(Ip, P, t)
    a, b, sse = affine_sse(t, Sx, Sxx, Sxy, a_cap)
    j = int(np.argmin(sse))
    k = t.k_min + j
    x = Ip[P + k:P + k + t.n]
    return {"k": k, "a": float(a[j]), "b": float(b[j]), "sse": float(sse[j]),
            "mse": float(sse[j] / t.n), "curve": a[j] * x + b[j], "I": x}


def _candidate_shifts(Ip, P, t: TermData, n_cand: int) -> list[int]:
    Sx, Sxx, Sxy = _sliding_stats(Ip, P, t)
    n = t.n
    Sy, Syy = t.y.sum(), (t.y ** 2).sum()
    var = Sxx - Sx ** 2 / n
    cov = Sxy - Sx * Sy / n
    vy = Syy - Sy ** 2 / n
    with np.errstate(divide="ignore", invalid="ignore"):
        # windows with no visible dynamics (std of I < 1e-4) cannot be min-max rescaled
        corr = np.where(var / n > MIN_WINDOW_VAR, cov / np.sqrt(var * vy), -np.inf)
    order = np.argsort(-corr)
    picked: list[int] = []
    for j in order:
        if not np.isfinite(corr[j]):
            break
        if all(abs(j - q) >= 13 for q in picked):
            picked.append(int(j))
        if len(picked) >= n_cand:
            break
    return [t.k_min + j for j in picked]


def dtw_dist(a: np.ndarray, b: np.ndarray, window: int | None = None) -> float:
    a = np.ascontiguousarray(a, dtype=np.double)
    b = np.ascontiguousarray(b, dtype=np.double)
    if window is None:
        return float(dtw.distance_fast(a, b))
    return float(dtw.distance_fast(a, b, window=window))


def align_a(Ip: np.ndarray, P: int, t: TermData, window: int | None = DTW_FIT_WINDOW,
            n_cand: int = DTW_CANDIDATES) -> dict:
    """Track A alignment: model window min-max rescaled to [-1, 1] (paper), shift by DTW
    among the best-correlated candidate shifts."""
    best = None
    for k in _candidate_shifts(Ip, P, t, n_cand):
        x = Ip[P + k:P + k + t.n]
        curve = rescale(x)
        d = dtw_dist(t.y, curve, window)
        if best is None or d < best["dtw"]:
            best = {"k": k, "dtw": d, "curve": curve, "I": x, "flat": False}
    if best is None:  # the model never moves inside the allowed shifts
        k = t.k_max
        x = Ip[P + k:P + k + t.n]
        curve = np.zeros(t.n)
        best = {"k": k, "dtw": dtw_dist(t.y, curve, window), "curve": curve, "I": x, "flat": True}
    return best


# ---------------------------------------------------------------------------
# Objectives (picklable, so differential_evolution can use worker processes)
# ---------------------------------------------------------------------------

class Objective:
    def __init__(self, terms: list[TermData], track: str, variant: str):
        self.terms, self.track, self.variant = terms, track, variant
        self.P, self.G = grid_size(terms)

    def solve(self, p: Params):
        sim = simulate(p, self.G)
        if not sim["ok"]:
            return None, None
        I = sim["I"]
        return padded_I(I, self.P), I.max()

    def __call__(self, x) -> float:
        p = params_from_x(x, self.variant)
        Ip, imax = self.solve(p)
        if Ip is None:
            return PENALTY
        if self.track == "B":
            cap = A_CAP / max(imax, 1e-12)
            return float(np.mean([align_b(Ip, self.P, t, cap)["mse"] for t in self.terms]))
        losses = []
        for t in self.terms:
            r = align_a(Ip, self.P, t)
            losses.append(PENALTY if r["flat"] else r["dtw"])
        return float(np.mean(losses))


def fit_shared(terms: list[TermData], track: str, variant: str, seed: int = 0,
               popsize: int = 12, maxiter: int = 60, workers: int = 1, x0=None) -> dict:
    """differential_evolution in log10 space. ``x0`` (e.g. the nested constant-gamma
    solution) seeds one population member; DE keeps its best member, so the feedback
    fit ends no worse on the training terms than (almost exactly) the model it nests."""
    obj = Objective(terms, track, variant)
    res = differential_evolution(
        obj, search_bounds(variant), seed=seed, popsize=popsize, maxiter=maxiter, tol=1e-7,
        polish=False, init="sobol", workers=workers, x0=x0,
        updating="deferred" if workers != 1 else "immediate",
    )
    p = params_from_x(res.x, variant)
    return {"params": p, "loss": float(res.fun), "nfev": int(res.nfev), "x": res.x.tolist(),
            "track": track, "variant": variant}


def align_terms(p: Params, terms: list[TermData], track: str) -> tuple[list[dict], dict]:
    """Freeze shared params; refit only t0 (and a, b) per term. Unconstrained DTW reported."""
    P, G = grid_size(terms)
    sim = simulate(p, G)
    if not sim["ok"]:
        raise RuntimeError(f"simulation failed for {p}")
    Ip = padded_I(sim["I"], P)
    out = []
    for t in terms:
        if track == "B":
            r = align_b(Ip, P, t, A_CAP / max(sim["I"].max(), 1e-12))
            sst = float(((t.y - t.y.mean()) ** 2).sum())
            r["rmse"] = float(np.sqrt(r["mse"]))
            r["r2"] = float(1 - r["sse"] / sst) if sst > 0 else float("nan")
            r["dtw"] = dtw_dist(t.y, r["curve"])
        else:
            r = align_a(Ip, P, t)
            r["dtw_fit"] = r["dtw"]
            r["dtw"] = dtw_dist(t.y, r["curve"])
        r["term"], r["generation"] = t.term, t.generation
        r["onset_week"] = t.start - pd.Timedelta(weeks=r["k"])
        out.append(r)
    return out, {"P": P, "G": G, "sim": sim}


# ---------------------------------------------------------------------------
# Paper replication (Track A): beta only, fixed xi, alpha = delta past Hopf
# ---------------------------------------------------------------------------

PAPER_XI = 0.1
PAPER_BETAS = np.round(np.arange(0.01, 0.31, 0.01), 2)
PAPER_BURN_IN = 52


def paper_params(beta: float, xi: float = PAPER_XI) -> Params:
    a = beta + xi + np.sqrt(xi * (beta + xi)) + 0.01
    return Params(beta, xi, a, a, 0.1)


def paper_curve(beta: float, n: int) -> np.ndarray:
    """Authors' code: S(t) from S0=0.9, I0=0.1, Gamma0=0.1, first 52 weeks dropped,
    rescaled to [-1, 1]. (The authors compare residuals with S, not I.)"""
    sim = simulate(paper_params(beta), n + PAPER_BURN_IN, s0=0.9, i0=0.1)
    return rescale(sim["S"][PAPER_BURN_IN:PAPER_BURN_IN + n])


def paper_dtw_table(terms: list[TermData]) -> pd.DataFrame:
    """DTW between every term's residual and every beta's model curve."""
    nmax = max(t.n for t in terms)
    rows = []
    for beta in PAPER_BETAS:
        sim = simulate(paper_params(beta), nmax + PAPER_BURN_IN, s0=0.9, i0=0.1)
        S = sim["S"][PAPER_BURN_IN:]
        for t in terms:
            rows.append({"term": t.term, "generation": t.generation, "beta": float(beta),
                         "dtw": dtw_dist(t.y, rescale(S[:t.n]))})
    return pd.DataFrame(rows)
