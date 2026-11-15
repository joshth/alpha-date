"""JSON fit of one slang term from the cached Track B fits: python -m sirs.fit_term TERM --json."""
from __future__ import annotations

import argparse
import functools
import json
import sys

import numpy as np
import pandas as pd

from .decompose import rescale
from .exports import label_at, state_at, term_curves, window_change
from .fit import align_terms, make_term
from .pipeline import BUDGET_MAIN, RESULTS, SPLIT_SEED, _load_json, get_params
from .plot_term import resolve_terms, track_b_aligned
from .stages import PRE_EMERGENCE, WINDOW_DAYS

# Must change whenever results/fits_main.json or the stage rule changes.
MODEL_VERSION = "sirs-trackB-feedback/1"
A_EPS = 1e-9  # align_b gives a ~ 1e-13 float noise, not exactly 0, on a flat series


@functools.lru_cache(maxsize=1)
def _load():
    aligned = track_b_aligned()
    data = {t.term: (t, r) for a in aligned.values() for t, r in zip(a["terms"], a["res"])}
    return term_curves(aligned), data


def _iso(ts) -> str:
    return pd.Timestamp(ts).date().isoformat()


def _result(name, generation, weeks, y, c, res, now):
    weeks = pd.DatetimeIndex(weeks)
    now_ts = pd.Timestamp(now) if now else weeks[-1]
    _, S, I, G = state_at(c, weeks)
    _, I_now, I_prev = window_change(c, now_ts)
    stage = str(label_at(c, now_ts)[0])
    curve = res["curve"]
    r2 = float(res["r2"])
    return {
        "term": name, "generation": generation, "modelVersion": MODEL_VERSION, "now": _iso(now_ts),
        "weeks": [_iso(w) for w in weeks], "counts": np.asarray(y).astype(float).tolist(),
        "fitted": {"I": curve.astype(float).tolist(), "S": S.tolist(), "R": (1 - S - I).clip(0, 1).tolist(),
                   "Gamma": G.tolist()},
        "r": float(I_now[0] / c["i_peak"]), "delta": float((I_now[0] - I_prev[0]) / c["i_peak"]),
        "stage": None if stage == PRE_EMERGENCE or res["a"] <= A_EPS else stage,  # curve unused (a ~ 0): no signal
        "confidence": 0.0 if np.isnan(r2) else min(max(r2, 0.0), 1.0),
        "peakWeek": _iso(weeks[int(curve.argmax())]),
        "windowStart": _iso(now_ts - pd.Timedelta(days=WINDOW_DAYS)),
    }


def _fit_term(term: str, now: str | None, curves: dict, data: dict) -> dict:
    matched, _ = resolve_terms([term], curves)
    if not matched:
        raise LookupError(term)
    name = matched[0]
    c, (td, res) = curves[name], data[name]
    weeks = pd.date_range(td.start, periods=td.n, freq="7D")
    return _result(name, c["generation"], weeks, td.y, c, res, now)


def fit_term(term: str, now: str | None = None) -> dict:
    return _fit_term(term, now, *_load())


@functools.lru_cache(maxsize=None)
def _gen_params(generation: str):
    return get_params(_load_json(RESULTS / "fits_main.json"), SPLIT_SEED, generation, "B", "feedback", BUDGET_MAIN)


def fit_counts(term: str, weeks: list[str], counts: list[float], generation: str = "gen_alpha",
               now: str | None = None) -> dict:
    """Align a short weekly series to a generation's cached shared params (no optimisation)."""
    x = np.asarray(counts, dtype=float)
    if not x.any():
        raise ValueError("no data to fit")
    y = rescale(x, 0.0, 1.0)  # same min-max as decompose's Track B series
    wk = pd.to_datetime(weeks)
    td = make_term(term.strip(), generation, y, wk[0], wk[0].year)
    res, extra = align_terms(_gen_params(generation), [td], "B")
    r, sim = res[0], extra["sim"]
    c = {"onset": pd.Timestamp(r["onset_week"]), "sim": sim, "i_peak": float(sim["I"].max()),
         "t_peak": float(sim["t"][int(sim["I"].argmax())])}
    return _result(td.term, generation, wk, y, c, r, now)


def fit_terms(terms: list[str], now: str | None = None, counts_by_term: dict | None = None) -> dict:
    """Fit many terms after loading the shared vendored alignment only once."""
    curves, data = _load()
    counts_by_term = counts_by_term or {}
    results = {}
    for term in terms:
        try:
            fit = _fit_term(term, now, curves, data)
            results[term] = {"kind": "fit", "source": "vendored", "fit": fit}
            continue
        except LookupError:
            counts = counts_by_term.get(term)
            if counts and np.asarray(counts.get("counts", []), dtype=float).any():
                try:
                    fit = fit_counts(term, counts["weeks"], counts["counts"], counts.get("generation", "gen_alpha"), now)
                    results[term] = {"kind": "fit", "source": "synthetic", "fit": fit}
                    continue
                except ValueError:
                    pass
        results[term] = {"kind": "no_data"}
    return results


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m sirs.fit_term", description=__doc__)
    ap.add_argument("term", nargs="?")
    ap.add_argument("--json", action="store_true", help="accepted for clarity; output is always JSON")
    ap.add_argument("--now", help="YYYY-MM-DD (default: last observed week)")
    ap.add_argument("--batch", action="store_true", help="read multiple terms and fallback counts from JSON stdin")
    ap.add_argument("--counts", action="store_true",
                    help='read {"weeks": [...], "counts": [...], "generation"?} JSON from stdin instead of terms.csv')
    args = ap.parse_args(argv)
    if args.batch:
        if args.term or args.counts:
            ap.error("--batch cannot be combined with a term or --counts")
        payload = json.load(sys.stdin)
        terms = payload.get("terms") if isinstance(payload, dict) else None
        counts = payload.get("counts", {}) if isinstance(payload, dict) else {}
        if not isinstance(terms, list) or not all(isinstance(term, str) for term in terms):
            ap.error("--batch input needs a terms array")
        print(json.dumps(fit_terms(terms, args.now, counts)))
        return 0
    if not args.term:
        ap.error("give a term or use --batch")
    try:
        if args.counts:
            d = json.load(sys.stdin)
            out = fit_counts(args.term, d["weeks"], d["counts"], d.get("generation", "gen_alpha"), args.now)
        else:
            out = fit_term(args.term, args.now)
        print(json.dumps(out))
    except (LookupError, ValueError):
        print(json.dumps({"error": "no_data", "term": args.term}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
