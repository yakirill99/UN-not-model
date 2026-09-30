"""End-to-end smoke test against a running server: every role, every guard, a whole game.

    just smoke                                   # against http://localhost:8000
    uv run python -m arena.smoke --base http://arena.example.org

Creates a game, joins as host and two humans, checks that the wrong role gets 403,
bad codes 404, bad orders 422, a double resolve 409; plays all rounds with random
legal orders for the humans; finally asserts the exported log replays with no
divergence. Exit code 0 = everything works.
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass
class Report:
    checks: list[tuple[str, bool, str]] = field(default_factory=list)

    def ok(self, name: str, cond: bool, detail: str = "") -> None:
        self.checks.append((name, cond, detail))
        print(f"  {'✓' if cond else '✗'} {name}" + (f"  ({detail})" if detail and not cond else ""))

    @property
    def failed(self) -> list[str]:
        return [n for n, ok, _ in self.checks if not ok]


class Session:
    """One actor (host or country) with its own cookie jar."""

    def __init__(self, base: str, name: str) -> None:
        self.name = name
        self.http = httpx.Client(base_url=base, timeout=30)

    def join(self, code: str) -> httpx.Response:
        return self.http.post("/api/auth/join", json={"code": code})

    def get(self, path: str, params: dict[str, Any] | None = None) -> httpx.Response:
        return self.http.get(path, params=params)

    def post(self, path: str, **kw: Any) -> httpx.Response:
        return self.http.post(path, **kw)

    def put(self, path: str, **kw: Any) -> httpx.Response:
        return self.http.put(path, **kw)


def random_orders(space: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    """A random legal order from an ActionSpace, spending at most ~80% of the budget."""
    a = space["actions"]
    left = int(space["budget"] * 0.8)
    orders: dict[str, Any] = {
        "invest": [],
        "shields": [],
        "strikes": [],
        "sanctions": [],
        "aid": {},
    }
    inv = a["invest"]
    for _ in range(rng.randint(0, 3)):
        if inv["available"] and inv["targets"] and left >= inv["cost"]:
            orders["invest"].append(rng.choice(inv["targets"]))
            left -= inv["cost"]
    if a["eco_program"]["available"] and left >= a["eco_program"]["cost"] and rng.random() < 0.3:
        orders["eco_programs"] = 1
        left -= a["eco_program"]["cost"]
    sh = a["shield"]
    if sh["available"] and sh["targets"] and left >= sh["cost"] and rng.random() < 0.3:
        orders["shields"].append(rng.choice(sh["targets"]))
        left -= sh["cost"]
    nt = a["nuclear_tech"]
    if nt["available"] and left >= nt["cost"] and rng.random() < 0.2:
        orders["nuclear_tech"] = True
        left -= nt["cost"]
    bomb = a["bomb"]
    if bomb["available"] and left >= bomb["cost"] and rng.random() < 0.5:
        orders["bombs"] = 1
        left -= bomb["cost"]
    st = a["strike"]
    if st["available"] and st["targets"] and rng.random() < 0.5:
        orders["strikes"].append(rng.choice(st["targets"]))
    sa = a["sanction"]
    if sa["available"] and sa["targets"] and rng.random() < 0.2:
        orders["sanctions"].append(rng.choice(sa["targets"]))
    return orders


def run(base: str, seed: int, scenario: str) -> Report:
    r = Report()
    rng = random.Random(seed)
    anon = Session(base, "anon")

    print("health")
    r.ok("GET /healthz 200", anon.get("/healthz").status_code == 200)
    ready = anon.get("/readyz")
    r.ok("GET /readyz 200 (database reachable)", ready.status_code == 200, ready.text)

    print("create game")
    body = {
        "scenario": scenario,
        "seed": seed,
        "mode": "playtest",
        "title": f"smoke {seed}",
        "bots": [
            {"country_id": "dprk", "bot": "aggressor"},
            {"country_id": "iran", "bot": "economist"},
            {"country_id": "france", "bot": "random"},
        ],
    }
    resp = anon.post("/api/games", json=body)
    r.ok("POST /api/games 201", resp.status_code == 201, resp.text[:200])
    if resp.status_code != 201:
        return r
    game = resp.json()
    gid = game["id"]
    codes = {p["country_id"]: p["join_code"] for p in game["players"]}
    r.ok("codes for every country", all(codes.values()) and game["host_code"])
    r.ok("no session -> 403", anon.get(f"/api/games/{gid}").status_code == 403)

    print("join")
    host, usa, russia = Session(base, "host"), Session(base, "usa"), Session(base, "russia")
    r.ok("wrong code -> 404", host.join("HOST-NOPE00").status_code == 404)
    r.ok("bot code -> 409", host.join(codes["dprk"]).status_code == 409)
    r.ok("host joins", host.join(game["host_code"]).status_code == 200)
    r.ok("usa joins (lowercase code)", usa.join(codes["usa"].lower()).status_code == 200)
    r.ok("russia joins", russia.join(codes["russia"]).status_code == 200)
    me = host.get("/api/auth/me").json()
    r.ok("host /me role=host", me.get("role") == "host")
    r.ok("usa /me country=usa", usa.get("/api/auth/me").json().get("country_id") == "usa")

    print("guards")
    info_player = usa.get(f"/api/games/{gid}").json()
    r.ok(
        "player sees no codes",
        info_player["host_code"] is None
        and all(p["join_code"] is None for p in info_player["players"]),
    )
    r.ok("host sees codes", host.get(f"/api/games/{gid}").json()["host_code"] == game["host_code"])
    r.ok("player cannot read state", usa.get(f"/api/games/{gid}/state").status_code == 403)
    r.ok("player cannot resolve", usa.post(f"/api/games/{gid}/rounds/1/resolve").status_code == 403)
    r.ok(
        "host cannot submit orders",
        host.put(f"/api/games/{gid}/orders", json={}).status_code == 403,
    )
    r.ok("host has no observation", host.get(f"/api/games/{gid}/observation").status_code == 403)
    obs = usa.get(f"/api/games/{gid}/observation").json()
    leak = [o for o in obs["others"] if "budget" in o or "bombs" in o] + [
        c for o in obs["others"] for c in o["cities"] if "development" in c or "shield" in c
    ]
    r.ok("observation hides foreign secrets", obs["me"]["id"] == "usa" and not leak)
    bad = usa.put(f"/api/games/{gid}/orders", json={"invest": ["moscow"], "bombs": 1})
    r.ok("bad orders -> 422 with errors[]", bad.status_code == 422 and bad.json().get("errors"))
    other = anon.post("/api/games", json=body).json()
    stranger = Session(base, "stranger")
    stranger.join(other["host_code"])
    r.ok("token of another game -> 403", stranger.get(f"/api/games/{gid}").status_code == 403)

    print("play")
    rounds_total = game["rounds_total"]
    for n in range(1, rounds_total + 1):
        for s in (usa, russia):
            space = s.get(f"/api/games/{gid}/action-space").json()
            put = s.put(f"/api/games/{gid}/orders", json=random_orders(space, rng))
            r.ok(f"round {n}: {s.name} orders accepted", put.status_code == 204, put.text[:200])
        status = host.get(f"/api/games/{gid}/round").json()
        r.ok(
            f"round {n}: host sees submissions",
            status["submitted"].get("usa") is True and status["submitted"].get("dprk") is True,
        )
        winner = rng.choice(list(codes))
        r.ok(
            f"round {n}: laugh set",
            host.post(
                f"/api/games/{gid}/rounds/{n}/laugh", params={"country_id": winner}
            ).status_code
            == 204,
        )
        res = host.post(f"/api/games/{gid}/rounds/{n}/resolve")
        r.ok(f"round {n}: resolved", res.status_code == 200, res.text[:200])
        r.ok(
            f"round {n}: double resolve -> 409",
            host.post(f"/api/games/{gid}/rounds/{n}/resolve").status_code == 409,
        )
        ev = usa.get(f"/api/games/{gid}/events", params={"round": n}).json()
        r.ok(
            f"round {n}: player events have no foreign private events",
            all(e["actor"] in ("usa", None) or e["type"] == "sanction_applied" for e in ev),
        )

    print("finish")
    final = host.get(f"/api/games/{gid}/state").json()
    r.ok("game finished after all rounds", final["round"] == rounds_total + 1)
    r.ok("orders closed", usa.put(f"/api/games/{gid}/orders", json={}).status_code == 409)
    log = host.get(f"/api/games/{gid}/log").json()
    r.ok("log has every round", len(log.get("rounds", [])) == rounds_total)
    replay = host.get(f"/api/games/{gid}/replay").json()
    r.ok("replay has no divergence", replay == [], str(replay)[:300])
    standings = sorted(((c["id"], c["cities"]) for c in final["countries"]), key=lambda x: x[0])
    print(
        "  final:",
        ", ".join(
            f"{cid} {sum(c['life_level'] for c in cities) / len(cities) / 100:.1f}%"
            for cid, cities in standings
        ),
    )
    return r


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="arena.smoke", description=__doc__)
    p.add_argument("--base", default="http://localhost:8000")
    p.add_argument("--seed", type=int, default=int(time.time()) % 10_000)
    p.add_argument("--scenario", default="smolny")
    args = p.parse_args(argv)
    print(f"smoke against {args.base}, seed {args.seed}, scenario {args.scenario}")
    try:
        report = run(args.base, args.seed, args.scenario)
    except httpx.HTTPError as exc:
        print(f"cannot reach {args.base}: {exc}")
        return 2
    n_ok = sum(1 for _, ok, _ in report.checks if ok)
    print(f"\n{n_ok}/{len(report.checks)} checks passed")
    if report.failed:
        print("FAILED:", ", ".join(report.failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
