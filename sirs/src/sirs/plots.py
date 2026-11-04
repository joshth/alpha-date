"""Figures (saved under figures/)."""

from __future__ import annotations

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from . import GENERATIONS


def decomposition_figure(decs: dict, examples: dict[str, str], path):
    """Paper Figure 2 style: observed, trend, seasonal, residual for one term per generation."""
    fig, axes = plt.subplots(4, len(examples), figsize=(4 * len(examples), 8), sharex="col")
    for j, (gen, term) in enumerate(examples.items()):
        d = decs[term]
        for i, (name, y) in enumerate([("observed", d.value), ("trend (52-wk)", d.trend),
                                        ("seasonal", d.seasonal), ("residual", d.resid)]):
            ax = axes[i, j]
            ax.plot(d.weeks, y, lw=0.8)
            if j == 0:
                ax.set_ylabel(name)
            if i == 0:
                ax.set_title(f"{gen}: '{term}'" + ("" if d.seasonal_estimated else "\n(seasonality not estimated)"),
                             fontsize=9)
            ax.tick_params(labelsize=7)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    return fig


def heldout_figure(aligned: dict, decs: dict, split: dict, gen: str, track: str, variant: str, path):
    a = aligned[(gen, track, variant)]
    test = [(t, r) for t, r in zip(a["terms"], a["res"]) if t.term in split[gen]["test"]]
    n = len(test)
    if n == 0:
        return None
    fig, axes = plt.subplots(1, n, figsize=(3.4 * n, 2.8), squeeze=False)
    for ax, (t, r) in zip(axes[0], test):
        weeks = pd.date_range(t.start, periods=t.n, freq="7D")
        if track == "A":
            ax.plot(weeks, t.y, lw=0.7, color="0.5", label="residual [-1,1]")
            ax.plot(weeks, r["curve"], lw=1.2, color="C3", label="SIRS I(t) [-1,1]")
            ax.set_title(f"{t.term}\nDTW={r['dtw']:.1f}", fontsize=8)
        else:
            d = decs[t.term]
            trend = (d.trend - d.track_b_min) / (d.track_b_max - d.track_b_min)
            ax.plot(weeks, t.y, lw=0.7, color="0.6", label="deseasonalised [0,1]")
            ax.plot(weeks, trend, lw=1.0, color="k", ls="--", label="52-wk trend")
            ax.plot(weeks, r["curve"], lw=1.4, color="C0", label="SIRS a*I(t)+b")
            ax.set_title(f"{t.term}\nR2={r['r2']:.2f} RMSE={r['rmse']:.3f}", fontsize=8)
        ax.tick_params(labelsize=6)
        for lab in ax.get_xticklabels():
            lab.set_rotation(45)
    axes[0][0].legend(fontsize=6, loc="upper left")
    fig.suptitle(f"Track {track} ({variant}) held-out terms: {gen}", fontsize=10)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    return fig


def dtw_scatter(ev: pd.DataFrame, track: str, variant: str, path, title: str = ""):
    """Paper Figure 3 style: mean random-walk DTW (x) vs model DTW (y); filled = beats Q1."""
    g = ev[(ev["track"] == track) & (ev["variant"] == variant)]
    fig, ax = plt.subplots(figsize=(5, 5))
    for k, gen in enumerate(GENERATIONS):
        s = g[g["generation"] == gen]
        for test, marker in ((False, "o"), (True, "s")):
            ss = s[(s["set"] == "test") == test]
            full = ss[ss["beats_q1"]]
            empty = ss[~ss["beats_q1"]]
            ax.scatter(full["rw_mean"], full["model_dtw"], color=f"C{k}", marker=marker, s=22,
                       label=f"{gen} ({'test' if test else 'train'})")
            ax.scatter(empty["rw_mean"], empty["model_dtw"], facecolor="none", edgecolor=f"C{k}",
                       marker=marker, s=22)
    lim = [0, max(g["rw_mean"].max(), g["model_dtw"].max()) * 1.05]
    ax.plot(lim, lim, ":", color="k")
    ax.set_xlim(lim)
    ax.set_ylim(lim)
    ax.set_xlabel("mean DTW to 500 random walks")
    ax.set_ylabel("DTW to fitted SIRS")
    ax.set_title(title or f"Track {track} ({variant}); filled = below RW first quartile", fontsize=9)
    ax.legend(fontsize=6, ncol=2)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    return fig


def stage_example_figure(curves: dict, terms: list[str], label_fn, path=None):
    """Noise-free fitted curves coloured by stage."""
    colors = {"emerging": "C2", "peaking": "C1", "declining": "C3", "parent_territory": "C0"}
    fig, axes = plt.subplots(1, len(terms), figsize=(3.6 * len(terms), 2.8), squeeze=False,
                             layout="constrained")
    for ax, term in zip(axes[0], terms):
        c = curves[term]
        weeks = pd.date_range(c["start"], c["end"], freq="7D")
        labs = label_fn(c, weeks)
        tm = (weeks - c["onset"]).days.values / 7.0
        I = np.interp(tm, c["sim"]["t"], c["sim"]["I"], left=1e-3) / c["i_peak"]
        staged = np.isin(labs, list(colors))
        ax.plot(weeks[staged], I[staged], color="0.75", lw=1, zorder=1)
        for s, col in colors.items():
            m = labs == s
            ax.scatter(weeks[m], I[m], s=14, color=col, label=s.replace("_", " ").capitalize(),
                       edgecolors="white", linewidths=0.3, zorder=2)
        ax.set_title(f"{term} ({c['generation']})", fontsize=8)
        ax.set_ylabel("Share of peak interest", fontsize=7)
        ax.tick_params(labelsize=6)
        loc = mdates.AutoDateLocator()
        ax.xaxis.set_major_locator(loc)
        ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(loc))
        ax.grid(color="0.92", lw=0.6, zorder=0)
    fig.legend(*axes[0][0].get_legend_handles_labels(), loc="outside upper center", ncols=4, frameon=False,
               fontsize=8, markerscale=1.5)
    base_w, base_h = fig.get_size_inches()

    def _rescale(_event=None):
        w, h = fig.get_size_inches()
        # ponytail: clamp 0.85-2.5x so tiny/huge windows stay legible; widen if needed
        k = min(max(min(w / base_w, h / base_h), 0.85), 2.5)
        for ax in fig.axes:
            ax.title.set_fontsize(8 * k)
            ax.yaxis.label.set_fontsize(7 * k)
            ax.tick_params(labelsize=6 * k)
            for c in ax.collections:
                if hasattr(c, "set_sizes"):
                    c.set_sizes([14 * k * k])
            for ln in ax.lines:
                ln.set_linewidth(1 * k)
        leg = fig.legends[0]
        for t in leg.get_texts():
            t.set_fontsize(8 * k)
        for hd in leg.legend_handles:
            if hasattr(hd, "set_sizes"):
                hd.set_sizes([14 * 1.5**2 * k * k])

    fig.canvas.mpl_connect("resize_event", _rescale)
    if path is not None:
        fig.savefig(path, dpi=110)
    return fig
