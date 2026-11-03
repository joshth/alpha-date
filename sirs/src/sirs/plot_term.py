"""Plot noise-free SIRS lifecycle curves, coloured by stage, for queried terms."""
from __future__ import annotations

import argparse
import sys

import matplotlib.pyplot as plt

from . import GENERATIONS
from .exports import label_at, term_curves
from .fit import align_terms
from .pipeline import (BUDGET_MAIN, RESULTS, SPLIT_SEED, _load_json, build_term_data, decompose_all, get_params,
                       load_dataset, make_split)
from .plots import stage_example_figure


def resolve_terms(queries, known) -> tuple[list[str], list[str]]:
    """Split queries into canonical known names and unknown queries (as typed)."""
    norm = lambda s: " ".join(s.split()).lower()
    canon = {norm(k): k for k in known}
    matched, unknown = [], []
    for q in queries:
        if norm(q) in canon:
            matched.append(canon[norm(q)])
        else:
            unknown.append(q)
    return matched, unknown


def format_term_list(curves) -> str:
    """Terms grouped by generation (oldest first), each group sorted."""
    groups = []
    for gen in GENERATIONS:
        names = sorted(t for t, c in curves.items() if c["generation"] == gen)
        if names:
            groups.append("\n".join([f"{gen} ({len(names)})", *(f"  {n}" for n in names)]))
    return "\n\n".join(groups)


def track_b_curves() -> dict:
    """Noise-free Track B feedback curve per term, from the cached fits in results/fits_main.json."""
    terms, df = load_dataset()
    td = build_term_data(terms, decompose_all(df))
    split = make_split(terms, SPLIT_SEED)
    cache = _load_json(RESULTS / "fits_main.json")
    aligned = {}
    for gen in GENERATIONS:
        p = get_params(cache, SPLIT_SEED, gen, "B", "feedback", BUDGET_MAIN)
        tl = [td["B"][t] for t in split[gen]["train"] + split[gen]["test"]]
        res, extra = align_terms(p, tl, "B")
        aligned[(gen, "B", "feedback")] = {"params": p, "terms": tl, "res": res, **extra}
    return term_curves(aligned)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m sirs.plot_term", description=__doc__)
    ap.add_argument("terms", nargs="*", help='slang terms; quote multi-word terms, e.g. "goofy ahh"')
    ap.add_argument("--out", help="save a PNG here instead of opening a window")
    ap.add_argument("--list", action="store_true", help="print the available terms by generation and exit")
    args = ap.parse_args(argv)
    if not args.terms and not args.list:
        ap.error("give at least one term, or --list")
    curves = track_b_curves()
    if args.list:
        print(format_term_list(curves))
        return 0
    matched, unknown = resolve_terms(args.terms, curves)
    if unknown:
        print(f"Unknown term(s): {', '.join(unknown)}", file=sys.stderr)
        print(f"Available: {', '.join(sorted(curves))}", file=sys.stderr)
        return 1
    stage_example_figure(curves, matched, label_at, args.out)
    if args.out is None:
        plt.show()
    else:
        print(f"Saved {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
