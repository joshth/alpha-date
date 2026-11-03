import os
os.environ.setdefault("MPLBACKEND", "Agg")
from sirs.plot_term import resolve_terms

known = ["bussin", "goofy ahh", "no cap"]


def test_resolve_terms_matches_case_and_spacing_to_canonical_names():
    assert resolve_terms(["Bussin", "  goofy   AHH "], known) == (["bussin", "goofy ahh"], [])


def test_resolve_terms_reports_unknown_queries_as_typed():
    assert resolve_terms(["no cap", "Skibidi"], known) == (["no cap"], ["Skibidi"])


def test_track_b_curves_builds_every_term_from_the_cached_fits():
    from sirs.plot_term import track_b_curves
    curves = track_b_curves()
    assert curves["bussin"]["generation"] == "gen_z"
    assert curves["goofy ahh"]["generation"] == "gen_alpha"
    assert curves["bussin"]["i_peak"] > 0
    assert len(curves) >= 70


def test_main_saves_one_panel_per_queried_term(tmp_path):
    import matplotlib.pyplot as plt
    from sirs.plot_term import main
    out = tmp_path / "chart.png"
    assert main(["bussin", "Goofy  Ahh", "--out", str(out)]) == 0
    assert out.exists()
    assert len(plt.gcf().axes) == 2


def test_main_lists_available_terms_and_exits_1_for_unknown_term(capsys):
    from sirs.plot_term import main
    assert main(["zzznotaterm"]) == 1
    printed = capsys.readouterr()
    text = printed.out + printed.err
    assert "zzznotaterm" in text
    assert "bussin" in text


def test_format_term_list_groups_sorted_terms_under_each_generation():
    from sirs.plot_term import format_term_list
    curves = {"rizz": {"generation": "gen_z"}, "goofy ahh": {"generation": "gen_alpha"},
              "bussin": {"generation": "gen_z"}}
    assert format_term_list(curves) == "gen_z (2)\n  bussin\n  rizz\n\ngen_alpha (1)\n  goofy ahh"


def test_main_list_prints_terms_by_generation_and_exits_0(capsys):
    from sirs.plot_term import main
    assert main(["--list"]) == 0
    out = capsys.readouterr().out
    assert out.index("gen_z (") < out.index("gen_alpha (")
    assert "  bussin" in out
    assert "  goofy ahh" in out
