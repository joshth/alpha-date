import io
import json
import sys
from datetime import date, timedelta

from matplotlib.axes import Axes

from sirs.mcp_graph import main


def test_mcp_png_draws_distinct_stage_symbols_with_labels(monkeypatch):
    weeks = [(date(2026, 1, 1) + timedelta(days=7 * i)).isoformat() for i in range(8)]
    stages = ["emerging", "peaking", "declining", "parent_territory"]
    fit = {"term": "rizz", "weeks": weeks, "counts": [0.1] * 8,
           "fitted": {"I": [0.2] * 8}, "windowStart": weeks[0], "now": weeks[-1],
           "stageMarkers": [{"week": weeks[i], "fitted": 0.2, "stage": stage} for i, stage in enumerate(stages)]}
    calls = []
    scatter = Axes.scatter

    def record(self, *args, **kwargs):
        calls.append((kwargs.get("label"), kwargs.get("marker"), kwargs.get("color")))
        return scatter(self, *args, **kwargs)

    class Output:
        buffer = io.BytesIO()

    monkeypatch.setattr(Axes, "scatter", record)
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps(fit)))
    monkeypatch.setattr(sys, "stdout", Output())
    main()
    markers = [marker for label, marker, _ in calls if label in ["Emerging", "Peaking", "Declining", "Parent territory"]]
    assert markers == ["^", "D", "v", "s"]
    assert [color for label, _, color in calls if label in ["Emerging", "Peaking", "Declining", "Parent territory"]] == ["#0072b2", "#e69f00", "#cc79a7", "#009e73"]
    assert Output.buffer.getvalue().startswith(b"\x89PNG\r\n\x1a\n")
