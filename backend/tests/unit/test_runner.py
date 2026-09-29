"""run_game, ScriptedAgent, GameLog serialisation, replay and divergence reporting."""

import json
from pathlib import Path

from arena.engine.orders import CountryOrders, HostInput
from arena.engine.play import load_script, main
from arena.engine.rules import load_rules
from arena.engine.runner import (
    Agent,
    GameLog,
    IdleAgent,
    ScriptedAgent,
    diff_states,
    replay,
    run_game,
)
from arena.engine.scenario import load_scenario
from tests.conftest import REPO_ROOT

RULES = load_rules("v1.0", REPO_ROOT / "rules")


def _game() -> GameLog:
    initial = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    agents: dict[str, Agent] = {
        "russia": ScriptedAgent(
            {
                1: CountryOrders(nuclear_tech=True),
                2: CountryOrders(bombs=2, invest=["moscow"]),
                3: CountryOrders(strikes=["paris", "nice"]),
            }
        ),
        "france": ScriptedAgent(
            {1: CountryOrders(shields=["paris"]), 2: CountryOrders(sanctions=["russia"])}
        ),
        "usa": IdleAgent(),
    }
    return run_game(
        initial,
        RULES,
        agents,
        seed=42,
        scenario_id="equal",
        rounds=3,
        host=lambda r, _s: HostInput(laugh_winner="dprk" if r == 1 else None),
    )


def test_run_game_records_every_round() -> None:
    log = _game()
    assert [r.round for r in log.rounds] == [1, 2, 3]
    assert log.final_state.round == 4
    assert log.rules_version == "1.0.0" and log.seed == 42
    assert log.final_state.find_city("nice")[1].destroyed
    assert not log.final_state.find_city("paris")[1].destroyed  # shield absorbed
    assert log.final_state.country("dprk").laugh == 20
    assert log.rounds[1].orders.for_country("france").sanctions == ["russia"]


def test_log_round_trips_through_json() -> None:
    log = _game()
    again = GameLog.model_validate_json(log.model_dump_json())
    assert again == log
    assert again.rounds[1].events[0].type  # events came back as concrete classes


def test_replay_of_own_log_is_clean() -> None:
    assert replay(_game()) == []


def test_replay_reports_divergence_with_path() -> None:
    log = _game()
    log.rounds[1].state_after.country("usa").budget += 1
    diffs = replay(log)
    # round 2: engine gives 1 less than the tampered record; round 3 replays *from* the
    # tampered record and gives 1 more than the untouched round-3 record. Nothing else.
    assert [(d.round, d.path) for d in diffs] == [
        (2, "countries[usa].budget"),
        (3, "countries[usa].budget"),
    ]
    assert diffs[0].recorded == diffs[0].replayed + 1  # type: ignore[operator]
    assert diffs[1].recorded == diffs[1].replayed - 1  # type: ignore[operator]


def test_diff_states_paths() -> None:
    a = _game().final_state
    b = a.model_copy(deep=True)
    b.ecology -= 1
    b.find_city("moscow")[1].shield = True
    assert sorted(p for p, _, _ in diff_states(a, b)) == [
        "countries[russia].cities[moscow].shield",
        "ecology",
    ]


def test_agents_for_unknown_country_rejected() -> None:
    import pytest

    initial = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    with pytest.raises(ValueError, match="atlantis"):
        run_game(initial, RULES, {"atlantis": IdleAgent()}, seed=0)


def test_cli_script_play_and_replay(tmp_path: Path, capsys: object) -> None:
    script = tmp_path / "orders.yaml"
    script.write_text(
        "1:\n  russia: {invest: [moscow, moscow]}\n  host: {laugh_winner: iran}\n"
        "2:\n  usa: {eco_programs: 1}\n",
        encoding="utf-8",
    )
    scripts, hosts = load_script(script)
    assert scripts["russia"][1].invest == ["moscow", "moscow"] and hosts[1].laugh_winner == "iran"

    out = tmp_path / "game.json"
    assert (
        main(
            [
                "--scenario",
                "equal",
                "--orders",
                str(script),
                "--rounds",
                "2",
                "--out",
                str(out),
                "--quiet",
            ]
        )
        == 0
    )
    data = json.loads(out.read_text(encoding="utf-8"))
    assert len(data["rounds"]) == 2
    assert main(["--replay", str(out)]) == 0
