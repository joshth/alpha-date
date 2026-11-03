"""End-to-end experiment: decomposition, split, fitting, evaluation, exports.

Heavy steps cache their results as JSON under ``results/`` so the notebook can
re-run top to bottom quickly; delete ``results/`` (or pass ``force=True``) to
recompute. ``python -m sirs.pipeline`` runs everything.
"""

from __future__ import annotations

import json
import os
import zlib
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd

from . import GENERATIONS
from .data import load_terms
from .decompose import Decomposition, decompose_term
from .evaluate import random_walk_dtws
from .fit import (TermData, align_terms, dtw_dist, fit_shared, make_term, nested_x0, paper_dtw_table,
                  params_from_x)
from .model import Params, describe

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "results"
EXPORTS = ROOT / "exports"
FIGURES = ROOT / "figures"
SPLIT_SEED = 20261103
TEST_FRAC = 0.30
N_REPEATS = 20
BUDGET_MAIN = {"popsize": 15, "maxiter": 100}
BUDGET_REPEAT = {"popsize": 6, "maxiter": 20}
FIT_SEED = 7
# constant_gamma first: its solution seeds the feedback fit (the feedback model nests it)
VARIANTS = {"A": ["constant_gamma", "feedback"], "B": ["constant_gamma", "feedback"]}


def _workers() -> int:
    return max(1, min(16, (os.cpu_count() or 2) - 1))


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Data, decomposition, split
# ---------------------------------------------------------------------------

def load_dataset() -> tuple[pd.DataFrame, pd.DataFrame]:
    terms = load_terms(ROOT / "data" / "terms.csv")
    df = pd.read_parquet(ROOT / "data" / "processed" / "trends_weekly.parquet")
    terms = terms[terms["term"].isin(df["term"].unique())].reset_index(drop=True)
    return terms, df


def decompose_all(df: pd.DataFrame) -> dict[str, Decomposition]:
    out = {}
    for term, g in df.groupby("term", sort=False):
        g = g.sort_values("week")
        out[term] = decompose_term(term, pd.DatetimeIndex(g["week"]), g["value"].values)
    return out


def make_split(terms: pd.DataFrame, seed: int, test_frac: float = TEST_FRAC) -> dict:
    rng = np.random.default_rng(seed)
    split = {}
    for gen in GENERATIONS:
        names = sorted(terms.loc[terms["generation"] == gen, "term"])
        n_test = int(round(test_frac * len(names)))
        test = sorted(rng.choice(names, size=n_test, replace=False).tolist())
        split[gen] = {"train": [t for t in names if t not in test], "test": test}
    return split


def build_term_data(terms: pd.DataFrame, decs: dict[str, Decomposition]) -> dict[str, dict[str, TermData]]:
    """TermData per track. Track A needs a residual (>= 104 weeks of data)."""
    fpy = dict(zip(terms["term"], terms["first_popular_year"]))
    gen = dict(zip(terms["term"], terms["generation"]))
    out = {"A": {}, "B": {}}
    for term, d in decs.items():
        out["B"][term] = make_term(term, gen[term], d.track_b, d.weeks[0], fpy[term])
        if len(d.track_a) >= 52:
            out["A"][term] = make_term(term, gen[term], d.track_a, d.track_a_weeks[0], fpy[term])
    return out


# ---------------------------------------------------------------------------
# Fitting with cache
# ---------------------------------------------------------------------------

def fit_key(seed, gen, track, variant, budget) -> str:
    return f"split{seed}|{gen}|{track}|{variant}|p{budget['popsize']}i{budget['maxiter']}"


def fit_all(split: dict, td: dict, seed: int, budget: dict, cache_name: str,
            force: bool = False, verbose: bool = True, variants_by_track: dict | None = None,
            workers=None) -> dict:
    """Shared fits per generation x track x variant on the training terms only."""
    path = RESULTS / cache_name
    cache = {} if force else _load_json(path)
    for gen in GENERATIONS:
        for track, variants in (variants_by_track or VARIANTS).items():
            train = [td[track][t] for t in split[gen]["train"] if t in td[track]]
            for variant in variants:
                key = fit_key(seed, gen, track, variant, budget)
                if key in cache:
                    continue
                x0 = None
                cg_key = fit_key(seed, gen, track, "constant_gamma", budget)
                if variant == "feedback" and cg_key in cache:
                    x0 = nested_x0(cache[cg_key]["x"])
                res = fit_shared(train, track, variant, seed=FIT_SEED, workers=workers or _workers(), x0=x0,
                                 **budget)
                cache[key] = {"x": res["x"], "loss": res["loss"], "nfev": res["nfev"],
                              "params": res["params"].as_dict(), "n_train": len(train)}
                _save_json(path, cache)
                if verbose:
                    print(f"{key}: loss={res['loss']:.4f} {res['params'].as_dict()}", flush=True)
    return cache


def get_params(cache: dict, seed, gen, track, variant, budget) -> Params:
    return params_from_x(cache[fit_key(seed, gen, track, variant, budget)]["x"], variant)


# ---------------------------------------------------------------------------
# Random-walk baseline with cache
# ---------------------------------------------------------------------------

def rw_baselines(td: dict, force: bool = False) -> dict:
    """500 random-walk DTWs per term and track (summaries cached)."""
    path = RESULTS / "rw_baseline.json"
    cache = {} if force else _load_json(path)
    changed = False
    for track, lohi in (("A", (-1.0, 1.0)), ("B", (0.0, 1.0))):
        for term, t in td[track].items():
            key = f"{track}|{term}|n{t.n}"
            if key in cache:
                continue
            rng = np.random.default_rng(zlib.crc32(key.encode()))
            rw = random_walk_dtws(t.y, rng, lo=lohi[0], hi=lohi[1])
            cache[key] = {"mean": float(rw.mean()), "q1": float(np.percentile(rw, 25)),
                          "best": float(rw.min()), "n_walks": len(rw)}
            changed = True
    if changed:
        _save_json(path, cache)
    return cache


def _rw(rw: dict, track: str, t: TermData) -> dict:
    return rw[f"{track}|{t.term}|n{t.n}"]


def compare_rw(model_dtw: float, s: dict) -> dict:
    return {"model_dtw": float(model_dtw), "rw_mean": s["mean"], "rw_q1": s["q1"], "rw_best": s["best"],
            "beats_q1": bool(model_dtw < s["q1"]), "beats_mean": bool(model_dtw < s["mean"]),
            "beats_best": bool(model_dtw < s["best"])}


def flat_control(t: TermData, track: str, s: dict) -> dict:
    """A 'model' with no dynamics: a constant line at the series median (on the
    track's own scale). If this also beats the random walks, the random-walk test
    cannot tell dynamics from no dynamics."""
    d = dtw_dist(t.y, np.full(t.n, float(np.median(t.y))))
    return {"flat_dtw": d, "flat_beats_q1": bool(d < s["q1"])}


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate(split: dict, td: dict, cache: dict, seed: int, budget: dict, rw: dict) -> tuple[pd.DataFrame, dict]:
    """Per-term evaluation rows for every fit; alignments kept for plots/exports."""
    rows, aligned = [], {}
    for gen in GENERATIONS:
        for track, variants in VARIANTS.items():
            for variant in variants:
                p = get_params(cache, seed, gen, track, variant, budget)
                names = [t for t in split[gen]["train"] + split[gen]["test"] if t in td[track]]
                terms = [td[track][t] for t in names]
                res, extra = align_terms(p, terms, track)
                aligned[(gen, track, variant)] = {"params": p, "terms": terms, "res": res, **extra}
                for t, r in zip(terms, res):
                    row = {"generation": gen, "track": track, "variant": variant, "term": t.term,
                           "set": "test" if t.term in split[gen]["test"] else "train", "n_weeks": t.n,
                           "k": r["k"], "onset_week": r["onset_week"],
                           "loss": r["mse"] if track == "B" else r["dtw"]}
                    if track == "B":
                        row.update(rmse=r["rmse"], r2=r["r2"], a=r["a"], b=r["b"])
                    s = _rw(rw, track, t)
                    row.update(compare_rw(r["dtw"], s))
                    row.update(flat_control(t, track, s))
                    if track == "A":
                        row["flat_model"] = bool(r["flat"])
                    rows.append(row)
    return pd.DataFrame(rows), aligned


def paper_replication(split: dict, td: dict, rw: dict) -> tuple[pd.DataFrame, dict]:
    """Track A paper replication: per-term best beta (paper protocol) and a shared beta
    per generation fitted on training terms."""
    path = RESULTS / "paper_dtw_table.parquet"
    if path.exists():
        tab = pd.read_parquet(path)
    else:
        tab = paper_dtw_table(list(td["A"].values()))
        path.parent.mkdir(parents=True, exist_ok=True)
        tab.to_parquet(path, index=False)
    rows, shared = [], {}
    for gen in GENERATIONS:
        tr = [t for t in split[gen]["train"] if t in td["A"]]
        sub = tab[tab["term"].isin(tr)].groupby("beta")["dtw"].mean()
        beta_shared = float(sub.idxmin())
        shared[gen] = beta_shared
        for t in split[gen]["train"] + split[gen]["test"]:
            if t not in td["A"]:
                continue
            tt = tab[tab["term"] == t]
            best = tt.loc[tt["dtw"].idxmin()]
            d_shared = float(tt.loc[np.isclose(tt["beta"], beta_shared), "dtw"].iloc[0])
            s = _rw(rw, "A", td["A"][t])
            rows.append({"generation": gen, "term": t, "set": "test" if t in split[gen]["test"] else "train",
                         "best_beta": float(best["beta"]), **{f"perterm_{k}": v for k, v in compare_rw(best["dtw"], s).items()},
                         "shared_beta": beta_shared, **{f"shared_{k}": v for k, v in compare_rw(d_shared, s).items()},
                         **flat_control(td["A"][t], "A", s)})
    return pd.DataFrame(rows), shared


def summary_table(ev: pd.DataFrame, cache: dict, seed: int, budget: dict) -> pd.DataFrame:
    rows = []
    for (gen, track, variant), g in ev.groupby(["generation", "track", "variant"], sort=False):
        p = get_params(cache, seed, gen, track, variant, budget)
        d = describe(p, constant_gamma=(variant == "constant_gamma"))
        tr, te = g[g["set"] == "train"], g[g["set"] == "test"]
        row = {"generation": gen, "track": track, "variant": variant,
               "train_loss": tr["loss"].mean(), "test_loss": te["loss"].mean(),
               "test_model_dtw": te["model_dtw"].mean(), "test_rw_mean_dtw": te["rw_mean"].mean(),
               "test_rw_best_dtw": te["rw_best"].mean(),
               "test_pct_beat_q1": 100 * te["beats_q1"].mean(), "test_pct_beat_best": 100 * te["beats_best"].mean(),
               "test_pct_flat_beat_q1": 100 * te["flat_beats_q1"].mean(),
               "region": d["region"], "I_star": d["I_star"]}
        if track == "B":
            row.update(test_rmse=te["rmse"].mean(), test_r2=te["r2"].mean(), test_r2_median=te["r2"].median())
        rows.append(row)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Repeated splits
# ---------------------------------------------------------------------------

def repeated_splits(terms: pd.DataFrame, td: dict, rw: dict, n: int = N_REPEATS,
                    force: bool = False, verbose: bool = True) -> pd.DataFrame:
    path = RESULTS / "repeats.json"
    out = {} if force else _load_json(path)
    paper_tab = pd.read_parquet(RESULTS / "paper_dtw_table.parquet")
    todo = [SPLIT_SEED + 1000 + r for r in range(n) if str(SPLIT_SEED + 1000 + r) not in out]
    pool = Pool(_workers()) if todo else None  # one pool for every fit (Windows process start-up is slow)
    for r, seed in enumerate(todo):
        split = make_split(terms, seed)
        cache = fit_all(split, td, seed, BUDGET_REPEAT, f"fits_repeat_{seed}.json", verbose=False,
                        workers=pool.map)
        ev, _ = evaluate(split, td, cache, seed, BUDGET_REPEAT, rw)
        te = ev[ev["set"] == "test"]
        recs = []
        for (gen, track, variant), g in te.groupby(["generation", "track", "variant"]):
            recs.append({"generation": gen, "track": track, "variant": variant,
                         "test_loss": g["loss"].mean(), "pct_beat_q1": 100 * g["beats_q1"].mean(),
                         "n_test": len(g)})
        for gen in GENERATIONS:  # paper shared beta
            tr = [t for t in split[gen]["train"] if t in td["A"]]
            tst = [t for t in split[gen]["test"] if t in td["A"]]
            b = paper_tab[paper_tab["term"].isin(tr)].groupby("beta")["dtw"].mean().idxmin()
            beats = [paper_tab[(paper_tab["term"] == t) & np.isclose(paper_tab["beta"], b)]["dtw"].iloc[0]
                     < rw[f"A|{t}|n{td['A'][t].n}"]["q1"] for t in tst]
            recs.append({"generation": gen, "track": "A", "variant": "paper_shared_beta",
                         "test_loss": np.nan, "pct_beat_q1": 100 * float(np.mean(beats)), "n_test": len(tst)})
        out[str(seed)] = recs
        _save_json(path, out)
        (RESULTS / f"fits_repeat_{seed}.json").unlink(missing_ok=True)
        if verbose:
            print(f"repeat {r + 1}/{len(todo)} done", flush=True)
    if pool is not None:
        pool.close()
        pool.join()
    rows = [dict(seed=int(s), **rec) for s, recs in out.items() for rec in recs]
    return pd.DataFrame(rows)


def early_fixtures():
    """First version of exports/aura_fixtures.json from the Track B feedback fits alone."""
    terms, df = load_dataset()
    td = build_term_data(terms, decompose_all(df))
    split = make_split(terms, SPLIT_SEED)
    cache = fit_all(split, td, SPLIT_SEED, BUDGET_MAIN, "fits_main.json", variants_by_track={"B": ["feedback"]})
    aligned = {}
    for gen in GENERATIONS:
        p = get_params(cache, SPLIT_SEED, gen, "B", "feedback", BUDGET_MAIN)
        tl = [td["B"][t] for t in split[gen]["train"] + split[gen]["test"]]
        res, extra = align_terms(p, tl, "B")
        aligned[(gen, "B", "feedback")] = {"params": p, "terms": tl, "res": res, **extra}
    from .exports import build_fixtures, term_curves
    split_map = {t: s for g in split.values() for s in ("train", "test") for t in g[s]}
    fx = build_fixtures(term_curves(aligned), split_map)
    EXPORTS.mkdir(parents=True, exist_ok=True)
    (EXPORTS / "aura_fixtures.json").write_text(json.dumps(fx, separators=(",", ":")), encoding="utf-8")
    print("fixtures:", fx["stageCounts"])


def main():
    terms, df = load_dataset()
    decs = decompose_all(df)
    td = build_term_data(terms, decs)
    split = make_split(terms, SPLIT_SEED)
    _save_json(EXPORTS / "split.json", {"seed": SPLIT_SEED, "test_fraction": TEST_FRAC, "split": split})
    cache = fit_all(split, td, SPLIT_SEED, BUDGET_MAIN, "fits_main.json")
    rw = rw_baselines(td)
    ev, aligned = evaluate(split, td, cache, SPLIT_SEED, BUDGET_MAIN, rw)
    summ = summary_table(ev, cache, SPLIT_SEED, BUDGET_MAIN)
    paper_rows, paper_shared = paper_replication(split, td, rw)
    from .exports import write_exports
    out = write_exports(cache, ev, summ, paper_rows, paper_shared, aligned, BUDGET_MAIN)
    print(summ.to_string())
    print(out.get("stage_counts"))
    repeated_splits(terms, td, rw)


if __name__ == "__main__":
    import sys
    early_fixtures() if "--early-fixtures" in sys.argv else main()
