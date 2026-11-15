import json
import os
os.environ.setdefault("MPLBACKEND", "Agg")
import numpy as np
import pandas as pd
import pytest

from sirs.exports import label_at, state_at, window_change
from sirs.plot_term import track_b_curves

KEYS = {"term", "generation", "modelVersion", "now", "weeks", "counts", "fitted", "r", "delta", "stage",
        "confidence", "peakWeek", "windowStart"}


@pytest.fixture(scope="module")
def curves():
    return track_b_curves()


@pytest.fixture(scope="module")
def bussin():
    from sirs.fit_term import fit_term
    return fit_term("bussin")


def test_result_has_the_contract_keys_and_types(bussin):
    assert set(bussin) == KEYS
    assert bussin["term"] == "bussin" and bussin["generation"] == "gen_z"
    assert isinstance(bussin["modelVersion"], str) and bussin["modelVersion"]
    assert set(bussin["fitted"]) == {"I", "S", "R", "Gamma"}
    json.dumps(bussin)  # JSON-ready


def test_term_is_resolved_case_and_space_insensitively():
    from sirs.fit_term import fit_term
    assert fit_term("  Goofy   AHH ")["term"] == "goofy ahh"


def test_weeks_are_weekly_oldest_first_and_every_series_matches(bussin, curves):
    c = curves["bussin"]
    weeks = pd.to_datetime(bussin["weeks"])
    assert len(weeks) == c["n"]
    assert weeks[0] == c["start"] and weeks[-1] == c["end"]
    assert (np.diff(weeks.values) == np.timedelta64(7, "D")).all()
    assert len(bussin["counts"]) == len(weeks)
    for k in ("I", "S", "R", "Gamma"):
        assert len(bussin["fitted"][k]) == len(weeks)


def test_fitted_states_come_from_state_at_with_r_as_the_remainder(bussin, curves):
    c = curves["bussin"]
    weeks = pd.to_datetime(bussin["weeks"])
    _, S, I_share, G = state_at(c, weeks)
    f = bussin["fitted"]
    assert f["S"] == pytest.approx(S)
    assert f["Gamma"] == pytest.approx(G)
    assert f["R"] == pytest.approx(1 - S - I_share)
    assert min(f["S"]) >= 0 and max(f["S"]) <= 1
    assert min(f["R"]) >= 0 and max(f["R"]) <= 1


def test_now_defaults_to_last_week_and_r_delta_stage_follow_exports(bussin, curves):
    c = curves["bussin"]
    now = pd.Timestamp(bussin["now"])
    assert bussin["now"] == bussin["weeks"][-1] == c["end"].date().isoformat()
    _, I, I_prev = window_change(c, now)
    assert bussin["r"] == pytest.approx(float(I[0]) / c["i_peak"])
    assert bussin["delta"] == pytest.approx(float((I[0] - I_prev[0]) / c["i_peak"]))
    want = str(label_at(c, now)[0])
    assert bussin["stage"] == (None if want == "pre_emergence" else want)
    assert bussin["windowStart"] == (now - pd.Timedelta(days=180)).date().isoformat()


def test_confidence_is_alignment_r2_clipped_and_peak_week_is_argmax_of_fitted_I(bussin):
    y, I = np.array(bussin["counts"]), np.array(bussin["fitted"]["I"])
    r2 = 1 - ((y - I) ** 2).sum() / ((y - y.mean()) ** 2).sum()
    assert 0 <= bussin["confidence"] <= 1
    assert bussin["confidence"] == pytest.approx(min(max(r2, 0.0), 1.0))
    assert bussin["peakWeek"] == bussin["weeks"][int(I.argmax())]


def test_explicit_now_moves_now_window_and_stage(curves):
    from sirs.fit_term import fit_term
    c = curves["goofy ahh"]
    out = fit_term("goofy ahh", now="2019-07-18")
    assert out["now"] == "2019-07-18" and out["windowStart"] == "2019-01-19"
    _, I, I_prev = window_change(c, pd.Timestamp("2019-07-18"))
    assert out["r"] == pytest.approx(float(I[0]) / c["i_peak"])
    assert out["delta"] == pytest.approx(float((I[0] - I_prev[0]) / c["i_peak"]))
    want = str(label_at(c, pd.Timestamp("2019-07-18"))[0])
    assert out["stage"] == (None if want == "pre_emergence" else want)
    assert out["stage"] in {None, "emerging", "peaking", "declining", "parent_territory"}


def test_unknown_term_raises_lookup_error():
    from sirs.fit_term import fit_term
    with pytest.raises(LookupError):
        fit_term("zzznotaterm")


def test_cli_prints_one_json_line_equal_to_fit_term(capsys, bussin):
    from sirs.fit_term import main
    assert main(["bussin", "--json"]) == 0
    lines = capsys.readouterr().out.strip().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == json.loads(json.dumps(bussin))


def test_cli_unknown_term_prints_no_data_error_and_returns_1(capsys):
    from sirs.fit_term import main
    assert main(["zzznotaterm", "--json"]) == 1
    assert json.loads(capsys.readouterr().out) == {"error": "no_data", "term": "zzznotaterm"}


def test_cli_batch_fits_many_terms_with_one_shared_dataset_and_synthetic_fallback(capsys, monkeypatch):
    from sirs.fit_term import fit_counts, fit_term, main
    weeks = [d.date().isoformat() for d in pd.date_range(end="2026-11-13", periods=26, freq="7D")]
    counts = list(range(26))
    payload = {"terms": ["bussin", "new synthetic"],
               "counts": {"new synthetic": {"weeks": weeks, "counts": counts}}}
    monkeypatch.setattr("sys.stdin", __import__("io").StringIO(json.dumps(payload)))

    assert main(["--batch", "--json", "--now", "2026-11-13"]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["bussin"] == fit_term("bussin", "2026-11-13")
    assert output["new synthetic"] == fit_counts("new synthetic", weeks, counts, now="2026-11-13")
