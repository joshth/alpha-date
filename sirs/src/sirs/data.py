"""Data collection: Google Trends (trendspyg) first, Wikimedia pageviews as fallback.

Every raw response is cached under ``data/raw/<slug>/`` so nothing is fetched
twice. Manual Google Trends CSV exports dropped into ``data/raw/<slug>/`` (any
``*.csv`` file in the standard "Week,<term>: (Worldwide)" layout) take
precedence over the automated client.

Run ``python -m sirs.data`` (with ``src`` on the path) to collect everything and
write ``data/processed/trends_weekly.parquet``.
"""

from __future__ import annotations

import datetime as dt
import json
import random
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote

import numpy as np
import pandas as pd

GEO = ""  # worldwide
GEO_LABEL = "Worldwide"
WIKIMEDIA_START = dt.date(2015, 7, 1)
USER_AGENT = (
    "SIRS-gen-alpha-research/0.1 "
    "(https://github.com/eyesmool/SIRS-model-gen-alpha; research on slang lifecycles) "
    "python-requests"
)
WINDOW_YEARS = 5
STEP_YEARS = 4  # 5-year windows every 4 years -> >= 1 year (52+ weeks) overlap
MIN_NONZERO_SHARE = 0.10  # a Trends series with fewer non-zero weeks counts as empty


def slugify(term: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", term.lower()).strip("_")
    return s or "term"


def load_terms(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df["first_popular_year"] = df["first_popular_year"].astype(int)
    df["slug"] = df["term"].map(slugify)
    assert df["slug"].is_unique, "term slugs must be unique"
    return df


# ---------------------------------------------------------------------------
# Parsing and stitching
# ---------------------------------------------------------------------------

def _to_value(v) -> float:
    """Trends values: ints 0-100, '<1' means a non-zero value below 1 -> 0.5."""
    if isinstance(v, str):
        v = v.strip()
        if v.startswith("<"):
            return 0.5
        return float(v) if v else np.nan
    return float(v)


def to_week_start(ts: pd.Series | pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Map dates to the Sunday that starts their week (Google Trends convention)."""
    idx = pd.DatetimeIndex(ts).tz_localize(None).normalize()
    return idx - pd.to_timedelta((idx.day_of_week + 1) % 7, unit="D")


def points_to_series(points: list[dict], drop_partial: bool = True) -> pd.Series:
    """trendspyg dict output -> float Series indexed by (naive) date."""
    rows = [p for p in points if not (drop_partial and p.get("is_partial"))]
    idx = pd.to_datetime([p["date"] for p in rows], utc=True).tz_localize(None)
    return pd.Series([_to_value(p["value"]) for p in rows], index=idx, dtype=float)


def read_manual_csv(path: str | Path) -> tuple[str, pd.Series]:
    """Parse a Google Trends 'multiTimeline.csv' export. Returns (granularity, series)."""
    lines = Path(path).read_text(encoding="utf-8-sig").splitlines()
    for i, line in enumerate(lines):
        head = line.split(",")[0].strip().lower()
        if head in ("week", "month", "day"):
            body = lines[i:]
            break
    else:
        raise ValueError(f"{path}: no Week/Month/Day header found")
    df = pd.DataFrame([r.split(",", 1) for r in body[1:] if r.strip()], columns=["date", "value"])
    s = pd.Series(df["value"].map(_to_value).values, index=pd.to_datetime(df["date"]), dtype=float)
    return head, s


def stitch_windows(windows: list[pd.Series]) -> tuple[pd.Series, list[dict]]:
    """Chain overlapping windows onto the first window's scale.

    Each new window is multiplied by the median ratio (stitched / new) over the
    overlap weeks where both are > 0. Weeks already covered keep their stitched
    value; only the new window's tail is appended. Result rescaled to max 100.
    """
    windows = sorted([w.sort_index() for w in windows if len(w)], key=lambda w: w.index[0])
    if not windows:
        return pd.Series(dtype=float), []
    out = windows[0].copy()
    diags = []
    for w in windows[1:]:
        common = out.index.intersection(w.index)
        both = common[(out.loc[common] > 0).values & (w.loc[common] > 0).values]
        if len(both) == 0:
            ratio = 1.0
        else:
            ratio = float(np.median(out.loc[both].values / w.loc[both].values))
        diags.append({
            "window_start": str(w.index[0].date()),
            "window_end": str(w.index[-1].date()),
            "overlap_weeks": int(len(common)),
            "overlap_weeks_both_positive": int(len(both)),
            "ratio": ratio,
        })
        tail = w[w.index > out.index[-1]] * ratio
        out = pd.concat([out, tail])
    if out.max() > 0:
        out = out * (100.0 / out.max())
    return out, diags


def monthly_correlation(weekly: pd.Series, monthly: pd.Series) -> float:
    """Pearson r between weekly resampled to monthly means and the monthly series."""
    wm = weekly.groupby(weekly.index.to_period("M")).mean()
    mm = monthly.copy()
    mm.index = mm.index.to_period("M")
    common = wm.index.intersection(mm.index)
    if len(common) < 6:
        return float("nan")
    a, b = wm.loc[common].values, mm.loc[common].values
    if np.std(a) == 0 or np.std(b) == 0:
        return float("nan")
    return float(np.corrcoef(a, b)[0, 1])


def plan_windows(start_year: int, today: dt.date) -> list[tuple[dt.date, dt.date]]:
    """Overlapping 5-year windows from Jan 1 of start_year; last window ends today."""
    out = []
    s = dt.date(start_year, 1, 1)
    while True:
        e = dt.date(s.year + WINDOW_YEARS, s.month, s.day) - dt.timedelta(days=1)
        if e >= today:
            last_start = dt.date(today.year - WINDOW_YEARS, today.month, today.day) + dt.timedelta(days=1)
            out.append((last_start, today))
            break
        out.append((s, e))
        s = dt.date(s.year + STEP_YEARS, 1, 1)
    return out


def first_nonzero_year(monthly: pd.Series) -> int:
    """First calendar year whose mean monthly index is >= 1 (1% of the all-time max).

    A plain "first non-zero month" is triggered by isolated sampling noise
    (e.g. 'rizz' shows a 1 in Feb 2004), so a year must be persistently non-zero.
    """
    annual = monthly.groupby(monthly.index.year).mean()
    ok = annual[annual >= 1.0]
    return int(ok.index[0]) if len(ok) else int(annual.index[0])


def daily_to_weekly(daily: pd.Series) -> pd.Series:
    """Sum daily values into Sunday-starting weeks, dropping incomplete edge weeks."""
    weeks = to_week_start(daily.index)
    g = daily.groupby(weeks)
    s, n = g.sum(), g.count()
    return s[n == 7].astype(float)


# ---------------------------------------------------------------------------
# Clients with on-disk caching
# ---------------------------------------------------------------------------

class TrendsUnavailable(Exception):
    pass


@dataclass
class TrendsClient:
    raw_dir: Path
    min_interval: float = 10.0
    max_attempts: int = 3
    backoff: tuple = (30.0, 90.0)
    # After a refusal trendspyg pauses direct requests for 5 minutes, so a rate limit
    # gets one long cool-down instead of the short back-off. Bounded for the whole run.
    cooldown: float = 330.0
    cooldowns_left: int = 4
    _last: float = 0.0
    log: list = field(default_factory=list)

    def _throttle(self):
        wait = self.min_interval + random.uniform(0, 2) - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.time()

    def fetch(self, slug: str, query: str, timeframe: str, cache_name: str) -> dict:
        path = self.raw_dir / slug / cache_name
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        import trendspyg

        last_err = None
        for attempt in range(self.max_attempts):
            self._throttle()
            try:
                pts = trendspyg.download_google_trends_interest_over_time(
                    query, geo=GEO, timeframe=timeframe, category=0, gprop="",
                    engine="http", max_retries=2, output_format="dict",
                )
                rec = {
                    "source": "google_trends", "client": f"trendspyg {trendspyg.__version__} (engine=http)",
                    "query": query, "geo": GEO_LABEL, "timeframe": timeframe,
                    "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                    "points": pts,
                }
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(rec, separators=(",", ":")), encoding="utf-8")
                return rec
            except Exception as e:  # rate limits, network, parse errors
                last_err = f"{type(e).__name__}: {str(e)[:200]}"
                self.log.append({"query": query, "timeframe": timeframe, "attempt": attempt + 1, "error": last_err,
                                 "at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")})
                if attempt < self.max_attempts - 1:
                    if "RateLimit" in type(e).__name__ and self.cooldowns_left > 0:
                        self.cooldowns_left -= 1
                        time.sleep(self.cooldown)
                    else:
                        time.sleep(self.backoff[min(attempt, len(self.backoff) - 1)])
        raise TrendsUnavailable(last_err)


def fetch_wikimedia(raw_dir: Path, slug: str, project: str, article: str, end: dt.date) -> dict | None:
    """Daily user pageviews for one article, cached. Returns None on 404."""
    import requests

    title = article.replace(" ", "_")
    path = raw_dir / slug / f"wikimedia_{project.split('.')[1]}_{slugify(title)}_daily.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    url = (
        "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
        f"{project}/all-access/user/{quote(title, safe='')}/daily/"
        f"{WIKIMEDIA_START:%Y%m%d}/{end:%Y%m%d}"
    )
    for attempt in range(4):
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
        if r.status_code == 404:
            return None
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(5 * (attempt + 1))
            continue
        r.raise_for_status()
        items = r.json().get("items", [])
        rec = {
            "source": f"wikimedia:{project}", "article": title, "url": url,
            "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "points": [{"date": it["timestamp"][:8], "value": it["views"]} for it in items],
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rec, separators=(",", ":")), encoding="utf-8")
        time.sleep(0.5)
        return rec
    raise RuntimeError(f"Wikimedia kept failing for {project}/{title}")


# ---------------------------------------------------------------------------
# Per-term collection
# ---------------------------------------------------------------------------

def _manual_csvs(raw_dir: Path, slug: str) -> dict[str, list[pd.Series]]:
    out: dict[str, list[pd.Series]] = {"week": [], "month": []}
    d = raw_dir / slug
    if d.exists():
        for p in sorted(d.glob("*.csv")):
            gran, s = read_manual_csv(p)
            if gran in out:
                out[gran].append(s)
    return out


def collect_trends_term(client: TrendsClient, row, today: dt.date) -> dict:
    slug, query = row["slug"], row["query"]
    manual = _manual_csvs(client.raw_dir, slug)
    if manual["week"]:
        windows = [to_week_series(s) for s in manual["week"]]
        monthly = manual["month"][0] if manual["month"] else None
        origin = "manual CSV export"
    else:
        mrec = client.fetch(slug, query, "all", "trends_monthly_all.json")
        monthly = points_to_series(mrec["points"])
        if (monthly.groupby(monthly.index.year).mean() < 1.0).all():
            raise TrendsUnavailable("empty series (monthly 2004-present never averages >= 1 in any year)")
        start_year = max(2004, first_nonzero_year(monthly))
        windows = []
        for s, e in plan_windows(start_year, today):
            tf = f"{s:%Y-%m-%d} {e:%Y-%m-%d}"
            rec = client.fetch(slug, query, tf, f"trends_weekly_{s:%Y%m%d}_{e:%Y%m%d}.json")
            windows.append(to_week_series(points_to_series(rec["points"])))
        origin = "trendspyg"
    stitched, diags = stitch_windows(windows)
    if len(stitched) == 0 or (stitched > 0).mean() < MIN_NONZERO_SHARE:
        raise TrendsUnavailable(f"empty series ({(stitched > 0).mean() if len(stitched) else 0:.0%} non-zero weeks)")
    r = monthly_correlation(stitched, monthly) if monthly is not None else float("nan")
    return {
        "series": stitched, "source": "google_trends", "origin": origin,
        "windows": [f"{w.index[0].date()}..{w.index[-1].date()}" for w in windows],
        "stitch": diags, "monthly_r": r,
    }


def to_week_series(s: pd.Series) -> pd.Series:
    s = s.copy()
    s.index = to_week_start(s.index)
    return s.groupby(level=0).mean()


def collect_wikimedia_term(raw_dir: Path, row, today: dt.date) -> dict:
    tried = []
    for project, col in (("en.wiktionary", "wiktionary_title"), ("en.wikipedia", "wikipedia_title")):
        title = row.get(col, "")
        if not title:
            continue
        rec = fetch_wikimedia(raw_dir, row["slug"], project, title, today - dt.timedelta(days=1))
        if rec is None or not rec["points"]:
            tried.append(f"{project}/{title}: missing")
            continue
        daily = pd.Series(
            [float(p["value"]) for p in rec["points"]],
            index=pd.to_datetime([p["date"] for p in rec["points"]], format="%Y%m%d"),
        )
        daily = daily.reindex(pd.date_range(daily.index[0], daily.index[-1], freq="D"), fill_value=0.0)
        weekly = daily_to_weekly(daily)
        if weekly.sum() < 52 * 7:  # < ~1 view/day on average: too thin to use
            tried.append(f"{project}/{title}: too few views ({weekly.sum():.0f})")
            continue
        return {
            "series": weekly, "source": f"wikimedia:{project}", "origin": f"{project}/{rec['article']}",
            "windows": [f"{weekly.index[0].date()}..{weekly.index[-1].date()}"], "stitch": [],
            "monthly_r": float("nan"), "wikimedia_tried": tried,
        }
    raise RuntimeError(f"no usable Wikimedia article for {row['term']}: {tried}")


def collect_all(terms: pd.DataFrame, raw_dir: Path, today: dt.date | None = None,
                consecutive_fail_limit: int = 3, verbose: bool = True):
    """Collect every term. Returns (long DataFrame, per-term metadata list, client log)."""
    today = today or dt.date.today()
    client = TrendsClient(raw_dir)
    trends_dead_reason = None
    consecutive_fail = 0
    frames, meta = [], []
    for _, row in terms.iterrows():
        fallback_reason = None
        res = None
        if trends_dead_reason is None:
            try:
                res = collect_trends_term(client, row, today)
                consecutive_fail = 0
            except TrendsUnavailable as e:
                fallback_reason = f"Google Trends unavailable for this term: {e}"
                if not str(e).startswith("empty series"):
                    consecutive_fail += 1
                    if consecutive_fail >= consecutive_fail_limit:
                        trends_dead_reason = (
                            f"Google Trends client failed for {consecutive_fail} consecutive terms "
                            f"(last error: {e}); all remaining terms switched to Wikimedia"
                        )
        else:
            fallback_reason = trends_dead_reason
        if res is None:
            res = collect_wikimedia_term(raw_dir, row, today)
            res["fallback_reason"] = fallback_reason
        s = res["series"].sort_index()
        frames.append(pd.DataFrame({
            "term": row["term"], "generation": row["generation"], "week": s.index,
            "value": s.values, "source": res["source"], "source_window": res["origin"],
        }))
        m = {k: v for k, v in res.items() if k != "series"}
        m.update(term=row["term"], generation=row["generation"], query=row["query"],
                 n_weeks=int(len(s)), first_week=str(s.index[0].date()), last_week=str(s.index[-1].date()))
        meta.append(m)
        if verbose:
            print(f"{row['term']:<30} {res['source']:<24} {len(s):>5} weeks  r={m['monthly_r']:.3f}"
                  + (f"  [fallback: {fallback_reason}]" if fallback_reason else ""), flush=True)
    return pd.concat(frames, ignore_index=True), meta, client.log


def _fetch_dates(raw_dir: Path, slug: str) -> str:
    dates = set()
    for p in (raw_dir / slug).glob("*.json"):
        dates.add(json.loads(p.read_text(encoding="utf-8")).get("fetched_at", "")[:10])
    return ", ".join(sorted(d for d in dates if d))


def write_data_card(root: Path, meta: list[dict], log: list[dict]) -> None:
    terms = load_terms(root / "data" / "terms.csv").set_index("term")
    raw = root / "data" / "raw"
    lines = [
        "# Data card: weekly slang-term interest",
        "",
        "Generated by `python -m sirs.data` (see `src/sirs/data.py`).",
        "",
        "- **Unified dataset:** `data/processed/trends_weekly.parquet`, long format "
        "`term, generation, week, value, source, source_window`. `week` is the Sunday that starts the week.",
        "- **Raw responses:** `data/raw/<slug>/`, one JSON per request (never fetched twice). Manual Google "
        "Trends CSV exports dropped into `data/raw/<slug>/` take precedence over the automated client.",
        f"- **Primary source:** Google Trends, web search, all categories, geography **{GEO_LABEL}**, fetched "
        "with `trendspyg` 1.9.0 (`engine=\"http\"`, so every request goes through the configured HTTPS proxy). "
        "Each term is requested on its own. Weekly data come in overlapping 5-year windows (every 4 years, so "
        ">= 52 weeks overlap) from the term's first non-zero year; the last window ends on the fetch date. "
        "'First non-zero year' = first calendar year whose mean monthly index (2004-present series) is >= 1, "
        "because isolated sampling blips make a plain first-non-zero month meaningless. Windows are stitched by "
        "the median ratio over overlap weeks where both windows are > 0 (`<1` counts as 0.5), then rescaled to "
        "max 100. The last (partial) week is dropped.",
        "- **Check:** each stitched weekly series, averaged to months, is correlated with the term's monthly "
        "2004-present series (Pearson r; flagged when r < 0.9).",
        "- **Fallback:** Wikimedia pageviews REST API (`per-article/.../all-access/user/.../daily`, from "
        "2015-07-01), Wiktionary entry preferred, else the Wikipedia article; daily views summed to Sunday-start "
        "weeks (incomplete edge weeks dropped). Used when Trends failed after retries or returned an empty "
        "series (fewer than 10% non-zero weeks, or a monthly series that never averages >= 1 in any year). "
        "Requests send a descriptive User-Agent with the project URL.",
        "- **Never mixed:** each term's series comes from exactly one source.",
        "",
        "## Known limitations",
        "",
        "- Google Trends starts in 2004 and Wikimedia in July 2015, so Boomer and most Gen X terms show only "
        "their tail: they test the settled phase, not emergence.",
        "- Gen Alpha terms have under three years of signal.",
        "- Low-volume Trends queries are sampled by Google and noisy (see the r column).",
        "- Wikimedia pageviews (people looking a word up) and Trends (people searching) are different "
        "demand signals; values are only compared within a term.",
        "",
        "## Terms",
        "",
        "| term | generation | query | source | article / windows | weeks | range | monthly r | fetched | note |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for m in meta:
        r = m.get("monthly_r")
        r_s = "n/a" if r is None or (isinstance(r, float) and np.isnan(r)) else f"{r:.3f}" + (" (flag)" if r < 0.9 else "")
        if m["source"] == "google_trends":
            src_detail = f"{len(m['windows'])} windows"
        else:
            src_detail = m["origin"]
        note = m.get("fallback_reason") or ""
        lines.append(
            f"| {m['term']} | {m['generation']} | `{m['query']}` | {m['source']} | {src_detail} | {m['n_weeks']} | "
            f"{m['first_week']} to {m['last_week']} | {r_s} | {_fetch_dates(raw, terms.loc[m['term'], 'slug'])} | {note} |")
    lines += ["", "## Stitching diagnostics (Google Trends terms)", "",
              "| term | window | overlap weeks | overlap weeks both > 0 | ratio |", "|---|---|---|---|---|"]
    for m in meta:
        for d in m.get("stitch", []):
            lines.append(f"| {m['term']} | {d['window_start']} to {d['window_end']} | {d['overlap_weeks']} | "
                         f"{d['overlap_weeks_both_positive']} | {d['ratio']:.3f} |")
    fallbacks = [m for m in meta if m["source"] != "google_trends"]
    lines += ["", "## Wikimedia fallbacks", ""]
    if fallbacks:
        for m in fallbacks:
            lines.append(f"- **{m['term']}** ({m['origin']}): {m.get('fallback_reason')}")
    else:
        lines.append("None.")
    if log:
        lines += ["", "## Google Trends client errors (retried)", "",
                  f"{len(log)} failed attempts were logged; see `data/processed/collection_meta.json`."]
    (root / "data" / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    root = Path(__file__).resolve().parents[2]
    terms = load_terms(root / "data" / "terms.csv")
    df, meta, log = collect_all(terms, root / "data" / "raw")
    out = root / "data" / "processed"
    out.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out / "trends_weekly.parquet", index=False)
    (out / "collection_meta.json").write_text(json.dumps(
        {"geo": GEO_LABEL, "collected_on": str(dt.date.today()), "terms": meta, "trends_errors": log},
        indent=1, default=str), encoding="utf-8")
    write_data_card(root, meta, log)
    print(f"wrote {len(df)} rows for {df['term'].nunique()} terms")


if __name__ == "__main__":
    main()
