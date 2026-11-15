import io
import json
import os
os.environ.setdefault("MPLBACKEND", "Agg")
import numpy as np
import pandas as pd
import pytest

KEYS = {"term", "generation", "modelVersion", "now", "weeks", "counts", "fitted", "r", "delta", "stage",
        "confidence", "peakWeek", "windowStart"}
WEEKS = [d.date().isoformat() for d in pd.date_range(end="2026-11-09", periods=26, freq="7D")]
RISING = (100 / (1 + np.exp(-(np.arange(26) - 15) / 3))).round(2).tolist()


def _stdin(monkeypatch, weeks, counts):
    import sys
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps({"weeks": weeks, "counts": counts})))


@pytest.fixture(scope="module")
def rising():
    from sirs.fit_term import fit_counts
    return fit_counts("  Skibidi Rizz ", WEEKS, RISING)


def test_rising_series_has_contract_keys_and_lengths(rising):
    assert set(rising) == KEYS
    assert rising["term"] == "Skibidi Rizz" and rising["generation"] == "gen_alpha"
    assert rising["modelVersion"]
    assert rising["weeks"] == WEEKS and rising["now"] == WEEKS[-1]
    assert len(rising["counts"]) == 26
    for k in ("I", "S", "R", "Gamma"):
        assert len(rising["fitted"][k]) == 26
    json.dumps(rising)


def test_counts_are_minmax_rescaled_to_unit_interval_like_termdata_y(rising):
    from sirs.decompose import rescale
    assert rising["counts"] == pytest.approx(rescale(np.array(RISING), 0.0, 1.0).tolist())
    assert min(rising["counts"]) == 0 and max(rising["counts"]) == 1


def test_rising_series_is_emerging_or_peaking_with_sane_r(rising):
    assert rising["stage"] in {"emerging", "peaking"}
    assert 0 <= rising["r"] <= 1.5
    assert 0 <= rising["confidence"] <= 1
    assert rising["peakWeek"] in WEEKS
    assert rising["windowStart"] == (pd.Timestamp(WEEKS[-1]) - pd.Timedelta(days=180)).date().isoformat()


def test_flat_series_does_not_crash_and_has_zero_confidence():
    from sirs.fit_term import fit_counts
    out = fit_counts("flat term", WEEKS, [5.0] * 26)
    assert out["stage"] in {None, "parent_territory"}
    assert out["confidence"] == 0.0


def test_all_zero_series_raises_value_error():
    from sirs.fit_term import fit_counts
    with pytest.raises(ValueError):
        fit_counts("dead term", WEEKS, [0.0] * 26)


def test_cli_counts_reads_stdin_and_prints_fit_counts(capsys, monkeypatch):
    from sirs.fit_term import fit_counts, main
    _stdin(monkeypatch, WEEKS, RISING)
    assert main(["Some Synthetic Term", "--json", "--counts"]) == 0
    lines = capsys.readouterr().out.strip().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == json.loads(json.dumps(fit_counts("Some Synthetic Term", WEEKS, RISING)))


def test_cli_counts_all_zero_prints_no_data_error_and_returns_1(capsys, monkeypatch):
    from sirs.fit_term import main
    _stdin(monkeypatch, WEEKS, [0] * 26)
    assert main(["Some Synthetic Term", "--json", "--counts"]) == 1
    assert json.loads(capsys.readouterr().out) == {"error": "no_data", "term": "Some Synthetic Term"}


def test_counts_flag_wins_over_terms_csv_term(capsys, monkeypatch):
    from sirs.fit_term import main
    _stdin(monkeypatch, WEEKS, RISING)
    assert main(["bussin", "--json", "--counts"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["generation"] == "gen_alpha" and out["weeks"] == WEEKS
