import os
os.environ.setdefault("MPLBACKEND", "Agg")
import numpy as np
import pandas as pd
from matplotlib.collections import PathCollection

from sirs.plots import stage_example_figure

STAGES = ["emerging", "peaking", "declining", "parent_territory"]


def _curve(gen):
    t = np.arange(0, 120.0)
    return {"start": "2022-01-01", "end": "2024-01-01", "onset": pd.Timestamp("2022-01-01"),
            "sim": {"t": t, "I": np.exp(-((t - 30) / 15) ** 2)}, "i_peak": 1.0, "generation": gen}


def _labels(c, weeks):
    return np.array([STAGES[min(3, i * 4 // len(weeks))] for i in range(len(weeks))])


def _figure():
    return stage_example_figure({"a": _curve("gen_z"), "b": _curve("gen_alpha")}, ["a", "b"], _labels)


def test_stage_dots_are_large_and_drawn_over_the_curve_line():
    fig = _figure()
    for ax in fig.axes[:2]:
        dots = [c for c in ax.collections if isinstance(c, PathCollection)]
        assert dots and all(min(c.get_sizes()) >= 12 for c in dots)
        assert len(ax.lines) == 1
