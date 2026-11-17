"""Render a fitted Aura trend as a PNG for MCP image content."""
from __future__ import annotations

import io
import json
import sys
from datetime import date

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt


def main() -> None:
    fit = json.load(sys.stdin)
    weeks = [date.fromisoformat(week) for week in fit["weeks"][-156:]]
    observed = fit["counts"][-len(weeks):]
    fitted = fit["fitted"]["I"][-len(weeks):]
    if not weeks or len(observed) != len(weeks) or len(fitted) != len(weeks):
        raise ValueError("Aura series lengths do not match")

    fig, ax = plt.subplots(figsize=(11, 4.5), layout="constrained")
    ax.axvspan(date.fromisoformat(fit["windowStart"]), date.fromisoformat(fit["now"]),
               color="#dce9f8", alpha=0.65, label="Last 180 days", zorder=0)
    ax.plot(weeks, fitted, color="#0b559f", linewidth=2.2, label="Fitted SIRS curve", zorder=2)
    ax.scatter(weeks, observed, s=15, color="#a43d1c", label="Observed search interest", zorder=3)
    ax.set(title=f"{fit['term']} — Aura search interest", ylabel="Interest (0 to 1)", xlabel="Week")
    ax.set_ylim(bottom=0)
    ax.set_xlim(weeks[0], weeks[-1])
    ax.grid(axis="y", color="#d9dfe6", linewidth=0.7)
    locator = mdates.AutoDateLocator()
    ax.xaxis.set_major_locator(locator)
    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))
    ax.legend(loc="upper right", frameon=False)
    output = io.BytesIO()
    fig.savefig(output, format="png", dpi=130, facecolor="white")
    plt.close(fig)
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()
