import json
import os
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")
import pytest

from sirs.fit_term import fit_term

# Vendored test split of exports/aura_fixtures.json (the TypeScript scorer's fixtures).
FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "aura-fixtures-test.json"
CASES = json.loads(FIXTURES.read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_fit_term_stage_matches_the_fixture_stage(case):
    assert fit_term(case["term"], case["now"][:10])["stage"] == case["stage"]
