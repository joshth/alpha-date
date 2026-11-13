"""JSON fit of one slang term from the cached Track B fits: python -m sirs.fit_term TERM --json."""
from __future__ import annotations

import argparse
import functools
import json

import pandas as pd

from .exports import label_at, state_at, term_curves, window_change
from .plot_term import resolve_terms, track_b_aligned
from .stages import PRE_EMERGENCE, WINDOW_DAYS

# Must change whenever results/fits_main.json or the stage rule changes.
MODEL_VERSION = "sirs-trackB-feedback/1"


@functools.lru_cache(maxsize=1)
def _load():
    aligned = track_b_aligned()
    data = {t.term: (t, r) for a in aligned.values() for t, r in zip(a["terms"], a["res"])}
    return term_curves(aligned), data


def _iso(ts) -> str:
    return pd.Timestamp(ts).date().isoformat()


def fit_term(term: str, now: str | None = None) -> dict:
    curves, data = _load()
    matched, _ = resolve_terms([term], curves)
    if not matched:
        raise LookupError(term)
    name = matched[0]
    c, (td, res) = curves[name], data[name]
    weeks = pd.date_range(td.start, periods=td.n, freq="7D")
    now_ts = pd.Timestamp(now) if now else weeks[-1]
    _, S, I, G = state_at(c, weeks)
    _, I_now, I_prev = window_change(c, now_ts)
    stage = str(label_at(c, now_ts)[0])
    curve = res["curve"]
    return {
        "term": name, "generation": c["generation"], "modelVersion": MODEL_VERSION, "now": _iso(now_ts),
        "weeks": [_iso(w) for w in weeks], "counts": td.y.astype(float).tolist(),
        "fitted": {"I": curve.astype(float).tolist(), "S": S.tolist(), "R": (1 - S - I).clip(0, 1).tolist(),
                   "Gamma": G.tolist()},
        "r": float(I_now[0] / c["i_peak"]), "delta": float((I_now[0] - I_prev[0]) / c["i_peak"]),
        "stage": None if stage == PRE_EMERGENCE else stage,
        "confidence": min(max(float(res["r2"]), 0.0), 1.0),
        "peakWeek": _iso(weeks[int(curve.argmax())]),
        "windowStart": _iso(now_ts - pd.Timedelta(days=WINDOW_DAYS)),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m sirs.fit_term", description=__doc__)
    ap.add_argument("term")
    ap.add_argument("--json", action="store_true", help="accepted for clarity; output is always JSON")
    ap.add_argument("--now", help="YYYY-MM-DD (default: last observed week)")
    args = ap.parse_args(argv)
    try:
        print(json.dumps(fit_term(args.term, args.now)))
    except LookupError:
        print(json.dumps({"error": "no_data", "term": args.term}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
