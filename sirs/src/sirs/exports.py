"""Exports for the TypeScript Aura scorer: sirs_params.json, stage_rule.md, aura_fixtures.json."""

from __future__ import annotations

import datetime as dt
import json

import numpy as np
import pandas as pd

from . import GENERATIONS, stages
from .model import describe, simulate
from .pipeline import EXPORTS, ROOT, SPLIT_SEED, _save_json

N_CASES = 200
FIXTURE_SEED = 9417
WINDOW_DAYS = 180
RATE_MIN, RATE_MAX = 0.3, 15.0
PEAK_RATE_RANGE = (2.0, 15.0)
IGNORED_TYPES = ["llm_generated", "prompt_generated"]
IGNORED_MEAN = 3.0  # mean number of ignored events per case
R_VISIBLE = 0.05  # 'now' is only sampled where I/I_peak >= 5% (curve visible above the 0.3/day floor)


# ---------------------------------------------------------------------------
# Noise-free curves per term (Track B, feedback model)
# ---------------------------------------------------------------------------

SETTLE_WEEKS = 52 * 200  # horizon on which the steady level is read off


def steady_level(p, i_peak: float) -> tuple[float, str]:
    """Steady level the noise-free curve settles at.

    The analytic X* (eq. 9) is used when the trajectory gets there within 200 years.
    With alpha, delta near zero Gamma drifts so slowly that X* is only reached on
    geological timescales; then the level the curve has settled at by year 200 (the
    constant-gamma quasi-steady state) is used instead. Returns (level, which)."""
    i_star = describe(p)["I_star"]
    sim = simulate(p, SETTLE_WEEKS)
    tail = sim["I"][-52:]
    settled = (tail.max() - tail.min()) <= 0.01 * i_peak
    if abs(tail.mean() - i_star) <= 0.05 * i_peak:
        return i_star, "analytic X*"
    if settled:
        return float(tail.mean()), "settled level at year 200 (X* not reached)"
    return i_star, "analytic X* (curve not settled by year 200)"


def term_curves(aligned: dict) -> dict[str, dict]:
    """Per-term noise-free trajectory in calendar time from the Track B feedback fits."""
    out = {}
    for gen in GENERATIONS:
        a = aligned[(gen, "B", "feedback")]
        p, sim = a["params"], a["sim"]
        d = describe(p)
        i_peak = float(sim["I"].max())
        t_peak = float(sim["t"][int(sim["I"].argmax())])
        i_ss, ss_kind = steady_level(p, i_peak)
        for t, r in zip(a["terms"], a["res"]):
            out[t.term] = {
                "generation": gen, "params": p, "sim": sim, "k": r["k"],
                "onset": pd.Timestamp(r["onset_week"]), "start": pd.Timestamp(t.start), "n": t.n,
                "end": pd.Timestamp(t.start) + pd.Timedelta(weeks=t.n - 1),
                "i_peak": i_peak, "t_peak": t_peak, "i_star": d["I_star"],
                "i_ss": i_ss, "ss_kind": ss_kind, "stable": d["region"] == "stable",
            }
    return out


def state_at(c: dict, when) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Model time (weeks since onset) and interpolated S, I, Gamma at calendar times."""
    when = pd.DatetimeIndex(np.atleast_1d(when))
    tm = (when - c["onset"]).total_seconds().values / (7 * 86400.0)
    sim = c["sim"]
    S = np.interp(tm, sim["t"], sim["S"], left=1 - 1e-3)
    I = np.interp(tm, sim["t"], sim["I"], left=1e-3)
    G = np.interp(tm, sim["t"], sim["Gamma"], left=sim["Gamma"][0])
    return tm, S, I, G


def window_change(c: dict, when) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(weeks since onset, I(now), I(now - 180 days)) for calendar times ``when``."""
    when = pd.DatetimeIndex(np.atleast_1d(when))
    tm, _, I, _ = state_at(c, when)
    _, _, I_prev, _ = state_at(c, when - pd.Timedelta(days=stages.WINDOW_DAYS))
    return tm, I, I_prev


def label_at(c: dict, when) -> np.ndarray:
    tm, I, I_prev = window_change(c, when)
    return stages.label(tm, I, I_prev, c["i_peak"], c["t_peak"])


def weekly_stage_shares(curves: dict) -> pd.DataFrame:
    rows = []
    for term, c in curves.items():
        weeks = pd.date_range(c["start"], c["end"], freq="7D")
        for s in label_at(c, weeks):
            rows.append({"generation": c["generation"], "term": term, "stage": s})
    df = pd.DataFrame(rows)
    return (df.groupby(["generation", "stage"]).size().unstack(fill_value=0)
            .reindex(columns=stages.STAGES + [stages.PRE_EMERGENCE], fill_value=0))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _iso(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"


def build_fixtures(curves: dict, split_map: dict[str, str] | None = None, n_cases: int = N_CASES,
                   seed: int = FIXTURE_SEED) -> dict:
    """``split_map``: term -> "train" | "test" (exports/split.json)."""
    split_map = split_map or {}
    rng = np.random.default_rng(seed)
    # candidate "now" days per stage: observed data range, at least 180 days after onset
    cand: dict[str, dict[str, pd.DatetimeIndex]] = {s: {} for s in stages.STAGES}
    for term, c in curves.items():
        lo = max(c["onset"] + pd.Timedelta(days=WINDOW_DAYS), c["start"] + pd.Timedelta(days=WINDOW_DAYS))
        hi = c["end"] + pd.Timedelta(days=6)
        if lo >= hi:
            continue
        days = pd.date_range(lo.normalize(), hi.normalize(), freq="D")
        labs = label_at(c, days + pd.Timedelta(hours=24))  # 'now' = end of that day
        _, _, I_now, _ = state_at(c, days + pd.Timedelta(hours=24))
        visible = I_now / c["i_peak"] >= R_VISIBLE
        for s in stages.STAGES:
            sel = days[(labs == s) & visible]
            if len(sel):
                cand[s][term] = sel
    available = [s for s in stages.STAGES if cand[s]]
    targets = {s: 0 for s in stages.STAGES}
    for i in range(n_cases):
        targets[available[i % len(available)]] += 1

    cases = []
    case_id = 0
    for s in stages.STAGES:
        for _ in range(targets[s]):
            case_seed = int(seed * 1000 + case_id)
            crng = np.random.default_rng(case_seed)
            term = sorted(cand[s])[crng.integers(len(cand[s]))]
            day = cand[s][term][crng.integers(len(cand[s][term]))]
            now = day + pd.Timedelta(days=1)  # midnight UTC ending that day
            c = curves[term]
            lab_now = label_at(c, now)[0]
            assert lab_now == s
            days = pd.date_range(now - pd.Timedelta(days=WINDOW_DAYS), periods=WINDOW_DAYS, freq="D")
            _, _, I_days, _ = state_at(c, days + pd.Timedelta(hours=12))
            peak_rate = float(crng.uniform(*PEAK_RATE_RANGE))
            rel = np.clip(I_days / c["i_peak"], 0.0, 1.0)
            lam = RATE_MIN + (peak_rate - RATE_MIN) * rel
            counts = crng.poisson(lam)
            events = []
            for d0, k in zip(days, counts):
                secs = np.sort(crng.uniform(0, 86400, size=k))
                types = crng.choice(["search_hit", "view"], size=k, p=[0.6, 0.4])
                for sec, ty in zip(secs, types):
                    events.append({"eventType": str(ty), "createdAt": _iso(d0 + pd.Timedelta(seconds=float(sec)))})
            n_ign = int(crng.poisson(IGNORED_MEAN)) + 1
            for _ in range(n_ign):
                off = float(crng.uniform(0, WINDOW_DAYS * 86400))
                events.append({"eventType": str(crng.choice(IGNORED_TYPES)),
                               "createdAt": _iso(days[0] + pd.Timedelta(seconds=off))})
            events.sort(key=lambda e: e["createdAt"])
            tm, S, I, G = state_at(c, now)
            f = stages.features(c["params"], S[0], I[0], G[0], c["i_peak"])
            _, I_w, I_prev = window_change(c, now)
            cases.append({
                "id": f"case-{case_id:03d}", "term": term, "generation": c["generation"],
                "now": _iso(now), "windowStart": _iso(days[0]), "windowDays": WINDOW_DAYS,
                "rate": round(float(lam.mean()), 4), "peakRate": round(peak_rate, 4),
                "seed": case_seed, "stage": s, "split": split_map.get(term),
                "noiseFree": {"change_over_window_over_peak": round(float((I_w[0] - I_prev[0]) / c["i_peak"]), 6),
                              "I_over_peak": round(f["r"], 6), "dI_over_peak_per_week": round(f["v"], 6),
                              "d2I_over_peak_per_week2": round(f["c"], 6),
                              "weeks_since_onset": round(float(tm[0]), 2),
                              "I_star_over_peak": round(c["i_star"] / c["i_peak"], 6),
                              "I_steady_over_peak": round(c["i_ss"] / c["i_peak"], 6) if c["stable"] else None,
                              "region": "stable" if c["stable"] else "unstable"},
                "countedEvents": int(counts.sum()), "ignoredEvents": n_ign,
                "events": events,
            })
            case_id += 1
    counts = {s: sum(1 for c in cases if c["stage"] == s) for s in stages.STAGES}
    by_split = {sp: {s: sum(1 for c in cases if c["stage"] == s and c["split"] == sp) for s in stages.STAGES}
                for sp in ("train", "test")}
    return {
        "schema": "aura-fixtures/1",
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "description": ("Synthetic event streams derived from Track B SIRS fits to public Google Trends / "
                        "Wikimedia pageview shapes. Stage labels come from exports/stage_rule.md applied to the "
                        "noise-free fitted curve at 'now'. Events of type llm_generated / prompt_generated must be "
                        "ignored by the scorer. No user identifiers of any kind."),
        "windowDays": WINDOW_DAYS, "rateRange": [RATE_MIN, RATE_MAX], "seed": seed,
        "stageCounts": counts, "stageCountsBySplit": by_split, "nCases": len(cases),
        "stageRule": {"floor": stages.FLOOR, "rPeak": stages.R_PEAK, "windowDays": stages.WINDOW_DAYS},
        "fields": {
            "term/generation": "source slang term and its generation",
            "now": "ISO-8601 UTC end of the 180-day window (exclusive)",
            "rate": "mean expected daily rate of counted events (search_hit + view) over the window",
            "peakRate": "daily rate the curve would reach at its own first-wave peak",
            "seed": "numpy default_rng seed that reproduces this case",
            "stage": "label of the noise-free curve at 'now' (emerging|peaking|declining|parent_territory)",
            "split": "train | test: whether the source term was a training or held-out term (exports/split.json)",
            "noiseFree": "noise-free curve features at 'now' (relative to the curve's peak, weekly units); "
                         "change_over_window_over_peak = (I(now) - I(now - 180 d)) / I_peak drives the label",
            "events": "list of {eventType, createdAt}; eventType in search_hit|view|llm_generated|prompt_generated",
        },
        "cases": cases,
    }


# ---------------------------------------------------------------------------
# sirs_params.json and stage_rule.md
# ---------------------------------------------------------------------------

def params_json(cache, ev, summary, paper_rows, paper_shared, budget, curves: dict) -> dict:
    from .pipeline import get_params
    gens = {}
    for gen in GENERATIONS:
        g = {}
        for track in ("A", "B"):
            tr = {}
            for variant in ("feedback", "constant_gamma"):
                p = get_params(cache, SPLIT_SEED, gen, track, variant, budget)
                d = describe(p, constant_gamma=(variant == "constant_gamma"))
                srow = summary[(summary["generation"] == gen) & (summary["track"] == track)
                               & (summary["variant"] == variant)].iloc[0]
                pd_ = p.as_dict()
                if variant == "constant_gamma":
                    pd_ = {"beta": pd_["beta"], "xi": pd_["xi"], "gamma": pd_["gamma0"], "alpha": 0.0, "delta": 0.0}
                metrics = {k: (None if pd.isna(v) else float(v)) for k, v in srow.items()
                           if k not in ("generation", "track", "variant", "region", "I_star")}
                tr[variant] = {"params": pd_, "fixed_point": {k: d[k] for k in ("S_star", "I_star", "Gamma_star")},
                               "stability": d["region"], "fit": metrics}
                if track == "B" and variant == "feedback":  # same numbers the stage rule uses
                    c = next(v for v in curves.values() if v["generation"] == gen)
                    tr[variant]["steady_level"] = {
                        "I_peak": c["i_peak"], "I_ss": c["i_ss"], "I_ss_over_peak": c["i_ss"] / c["i_peak"],
                        "I_star_over_peak": c["i_star"] / c["i_peak"], "source": c["ss_kind"],
                        "note": "I_peak = max I(t) from onset to the end of the generation's fitting grid"}
            if track == "A":
                pr = paper_rows[paper_rows["generation"] == gen]
                te = pr[pr["set"] == "test"]
                b = paper_shared[gen]
                from .fit import paper_params
                pp = paper_params(b)
                d = describe(pp)
                tr["paper_shared_beta"] = {
                    "params": pp.as_dict(), "fixed_point": {k: d[k] for k in ("S_star", "I_star", "Gamma_star")},
                    "stability": d["region"],
                    "fit": {"test_pct_beat_q1": 100 * float(te["shared_beats_q1"].mean()),
                            "test_model_dtw": float(te["shared_model_dtw"].mean()),
                            "test_rw_mean_dtw": float(te["shared_rw_mean"].mean())}}
                tr["paper_per_term_beta"] = {
                    "note": "paper protocol: beta chosen per term (all terms, no split)",
                    "pct_beat_q1_all_terms": 100 * float(pr["perterm_beats_q1"].mean()),
                    "pct_beat_q1_test_terms": 100 * float(te["perterm_beats_q1"].mean())}
            g[f"track_{track}"] = tr
        gens[gen] = g
    return {
        "model": "modified SIRS with feedback recovery rate (Mazzarisi et al. 2024, eqs. 5-7)",
        "equations": ["dS/dt = -beta*S*I + xi*(1-S-I)", "dI/dt = beta*S*I - Gamma*I",
                      "dGamma/dt = Gamma*(alpha*I - delta*S)"],
        "time_unit": "week", "initial_state_at_onset": {"S": 1 - 1e-3, "I": 1e-3, "Gamma": "gamma0 (fitted)"},
        "tracks": {"A": "paper replication on 52-week-detrended residuals rescaled to [-1,1]; DTW loss",
                   "B": "lifecycle fit on deseasonalised series rescaled to [0,1]; squared-error loss"},
        "stability_rule": "Proposition 1: unstable iff alpha > beta+xi and delta >= alpha^2 xi/((alpha-beta)(alpha-beta-xi))",
        "split_seed": SPLIT_SEED, "fit_budget": budget,
        "generations": gens,
    }


STAGE_RULE_MD = """# Stage rule for noise-free SIRS curves

This rule labels the **noise-free** fitted Track B curves (feedback model, one
shared parameter set per generation, per-term onset). It produced the `stage`
labels in `aura_fixtures.json`. Code: `src/sirs/stages.py`.

## Quantities

All quantities are relative to the curve's own peak `I_peak`, the maximum of
`I(t)` from onset to the end of the generation's fitting grid (which covers every
term's observed range; in every fit here this is the first-wave peak):

| symbol | definition |
|---|---|
| `r` | `I(now) / I_peak` |
| `delta` | `(I(now) - I(now - 180 days)) / I_peak`, the change across the scorer's 180-day window |
| `t_peak` | time of `I_peak` |

## Rule (first match wins)

1. **peaking**: `r >= {R_PEAK}` (the top band, either side of the peak).
2. **Flat on this horizon** (`|delta| < {FLOOR}`):
   - after `t_peak`: **parent_territory**;
   - before `t_peak`: `pre_emergence`. That is not a product stage: the term
     has not taken off yet and its counts sit on the 0.3/day floor. It never
     appears in the fixtures and is shown separately in the shares table.
3. **emerging**: `delta >= {FLOOR}`.
4. **declining**: `delta <= -{FLOOR}`.

`I'`, `I''`, `I*` and the steady level `I_ss` no longer enter the rule. They are
still reported in each fixture's `noiseFree` block, together with `delta`
(`change_over_window_over_peak`).

## Why a floor, and why {FLOOR}

The previous rule used only the *sign* of `I'` and `I''`. A curve drifting up by
6% of its peak over six months was "emerging", even though nothing in 180 days
of Poisson counts can show that. Labels must describe what the scorer can see.

Detectability model (`stages.min_detectable_change`). Fixture rates are
`lambda(r) = 0.3 + (peakRate - 0.3) * r` events per day, with `peakRate` drawn from
2 to 15. Compare the first and last {BLOCK} days of the window: a change `d` (in
units of `I_peak`) is visible at about {Z} standard errors when

    {BLOCK} * (lambda(r + d) - lambda(r)) >= {Z} * sqrt({BLOCK} * (lambda(r) + lambda(r + d)))

Smallest detectable `d`:

{DETECT}

At the low end of the rate range (`peakRate` = 2, so 0.3 to 2 events per day) a
change of about 0.2 x `I_peak` is the smallest one that shows up at 2 sigma for
the typical post-peak level `r` ~ 0.2 (0.15 to 0.25 across `r` = 0.05 to 0.5).
At higher rates much smaller changes are visible, but the label must not depend
on the arbitrary rate scale of a fixture, so the floor is set for the weakest
case: **`FLOOR` = {FLOOR}**. As a product statement this also reads well: a
term is "emerging" or "declining" only if it gained or lost at least a fifth of
its peak popularity in the last six months.

Consequences:

- *Rule 4 of the old rule (rising but decelerating) is gone.* Curvature over 180
  days is even harder to resolve than slope, so the label uses the visible change
  only: a visible rise below the top band is "emerging", whether or not it is
  decelerating.
- *Net change, not instantaneous slope.* `delta` is the change across the whole
  window, which is what block comparisons of counts measure.
- *parent_territory* means "flat on this horizon, past the peak, below the top
  band": the settled state, well below the peak.
- *Above-peak plateaus.* The Boomer and Gen Z fits settle above their first peak
  (`I_ss` > `I_peak`, a centuries-long revival). On a 180-day horizon those
  curves are flat; they read as `parent_territory` while `r` < {R_PEAK} and as
  `peaking` once `r` >= {R_PEAK}, never as emerging.

## Mapping for the TypeScript scorer

The scorer sees ~180 days of daily counts (0.3 to 15 per day). In the fixtures
the daily rate is `0.3 + (peakRate - 0.3) * r(t)`, so a rate near `peakRate`
means `r ~ 1`. A direct estimator of `delta` is the difference between the mean
rate of the last and first {BLOCK} days, divided by an estimate of
`peakRate - 0.3`.

Fixture sampling: "now" is drawn from the term's observed date range, at least
180 days after the fitted onset, and only where `r >= {R_VISIBLE}`. Stages are
balanced round-robin (term drawn first, then a day). Every case carries `split`
(`train` / `test`, from `exports/split.json`) so the scorer can be tuned on
train-term cases and reported on test-term cases.

## Steady levels per generation (Track B, feedback fits; informational)

{LEVELS}

## Stage shares on the observed weeks (noise-free fitted curves)

Share of observed term-weeks per label (`pre_emergence` = before take-off).

{SHARES}
"""


def stage_rule_md(shares: pd.DataFrame, curves: dict) -> str:
    cols = stages.STAGES + [stages.PRE_EMERGENCE]
    tab = ["| generation | " + " | ".join(cols) + " |", "|---|" + "---|" * len(cols)]
    for gen in GENERATIONS:
        if gen in shares.index:
            row = shares.loc[gen]
            tot = row.sum()
            tab.append(f"| {gen} | " + " | ".join(f"{100 * row[s] / tot:.0f}%" for s in cols) + " |")
    lev = ["| generation | region | I*/I_peak | I_ss/I_peak | I_ss source |", "|---|---|---|---|---|"]
    for gen in GENERATIONS:
        c = next(v for v in curves.values() if v["generation"] == gen)
        lev.append(f"| {gen} | {'stable' if c['stable'] else 'unstable'} | {c['i_star'] / c['i_peak']:.3g} | "
                   f"{c['i_ss'] / c['i_peak']:.3g} | {c['ss_kind']} |")
    rs = [0.05, 0.2, 0.5]
    det = ["| peakRate (events/day) | " + " | ".join(f"r = {r}" for r in rs) + " |", "|---|" + "---|" * len(rs)]
    for pr in (2.0, 5.0, 15.0):
        det.append(f"| {pr:g} | " + " | ".join(f"{stages.min_detectable_change(pr, r):.3f}" for r in rs) + " |")
    return STAGE_RULE_MD.format(R_PEAK=stages.R_PEAK, FLOOR=stages.FLOOR, BLOCK=stages.BLOCK_DAYS,
                                Z=f"{stages.Z:g}", DETECT="\n".join(det), SHARES="\n".join(tab),
                                LEVELS="\n".join(lev), R_VISIBLE=R_VISIBLE)


def write_exports(cache, ev, summary, paper_rows, paper_shared, aligned, budget, fixtures: bool = True) -> dict:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    curves = term_curves(aligned)
    _save_json(EXPORTS / "sirs_params.json",
               params_json(cache, ev, summary, paper_rows, paper_shared, budget, curves))
    shares = weekly_stage_shares(curves)
    (EXPORTS / "stage_rule.md").write_text(stage_rule_md(shares, curves), encoding="utf-8")
    out = {"shares": shares}
    if fixtures:
        b = ev[ev["track"] == "B"].drop_duplicates("term")
        fx = build_fixtures(curves, dict(zip(b["term"], b["set"])))
        (EXPORTS / "aura_fixtures.json").write_text(json.dumps(fx, separators=(",", ":")), encoding="utf-8")
        out["stage_counts"] = fx["stageCounts"]
        out["stage_counts_by_split"] = fx["stageCountsBySplit"]
    return out
