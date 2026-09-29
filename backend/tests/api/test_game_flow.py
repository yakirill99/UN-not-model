"""A whole game through the HTTP API: codes, roles, secrecy, orders, resolve, finish."""

from typing import Any

from httpx import AsyncClient


async def _create(client: AsyncClient, **kw: object) -> dict[str, Any]:
    body = {
        "scenario": "equal",
        "seed": 3,
        "bots": [{"country_id": c, "bot": "economist"} for c in ("iran", "dprk")],
    }
    body.update(kw)
    r = await client.post("/api/games", json=body)
    assert r.status_code == 201, r.text
    data: dict[str, Any] = r.json()
    return data


async def _join(client: AsyncClient, code: str) -> dict[str, Any]:
    r = await client.post("/api/auth/join", json={"code": code})
    assert r.status_code == 200, r.text
    data: dict[str, Any] = r.json()
    return data


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_create_and_codes(client: AsyncClient) -> None:
    g = await _create(client)
    assert g["host_code"].startswith("HOST-") and len(g["players"]) == 5
    assert all(p["join_code"] for p in g["players"])
    r = await client.get(f"/api/games/{g['id']}")
    assert r.status_code == 403  # no token


async def test_roles_and_secrecy_through_the_api(client: AsyncClient) -> None:
    g = await _create(client)
    gid = g["id"]
    host = await _join(client, g["host_code"])
    usa_code = next(p["join_code"] for p in g["players"] if p["country_id"] == "usa")
    usa = await _join(client, usa_code)
    H, U = _bearer(host["token"]), _bearer(usa["token"])
    assert usa["principal"] == {"game_id": gid, "role": "player", "country_id": "usa"}

    # the player sees no codes and no foreign secrets
    info = (await client.get(f"/api/games/{gid}", headers=U)).json()
    assert info["host_code"] is None and all(p["join_code"] is None for p in info["players"])
    obs = (await client.get(f"/api/games/{gid}/observation", headers=U)).json()
    assert obs["me"]["id"] == "usa" and "budget" in obs["me"]
    for other in obs["others"]:
        assert "budget" not in other and "bombs" not in other and "nuclear_tech" not in other
        assert all("development" not in c and "shield" not in c for c in other["cities"])
    # host-only endpoints
    assert (await client.get(f"/api/games/{gid}/state", headers=U)).status_code == 403
    assert (await client.post(f"/api/games/{gid}/rounds/1/resolve", headers=U)).status_code == 403
    assert (await client.get(f"/api/games/{gid}/state", headers=H)).status_code == 200
    # player-only endpoints
    assert (await client.get(f"/api/games/{gid}/observation", headers=H)).status_code == 403
    # a token for another game is useless here
    g2 = await _create(client)
    other = await _join(client, g2["host_code"])
    assert (
        await client.get(f"/api/games/{gid}", headers=_bearer(other["token"]))
    ).status_code == 403
    # the cookie works too
    assert (await client.get("/api/auth/me")).json()["role"] == "host"  # last join set the cookie


async def test_orders_validation_and_full_game(client: AsyncClient) -> None:
    g = await _create(client)
    gid = g["id"]
    H = _bearer((await _join(client, g["host_code"]))["token"])
    U = _bearer(
        (
            await _join(
                client, next(p["join_code"] for p in g["players"] if p["country_id"] == "usa")
            )
        )["token"]
    )

    bad = await client.put(
        f"/api/games/{gid}/orders", headers=U, json={"invest": ["moscow"], "bombs": 2}
    )
    assert bad.status_code == 422
    reasons = {(e["action"], e["reason"]) for e in bad.json()["errors"]}
    assert ("invest", "invalid_target") in reasons and ("bomb", "requires_nuclear_tech") in reasons
    assert (
        await client.put(f"/api/games/{gid}/orders", headers=U, json={"invest": ["washington"] * 2})
    ).status_code == 204
    st = (await client.get(f"/api/games/{gid}/round", headers=H)).json()
    assert st["round"] == 1 and st["submitted"] == {
        "dprk": True,
        "france": False,
        "iran": True,
        "russia": False,
        "usa": True,
    }
    st_player = (await client.get(f"/api/games/{gid}/round", headers=U)).json()
    assert st_player["submitted"] == {"usa": True}  # players see only themselves

    assert (
        await client.post(
            f"/api/games/{gid}/rounds/1/laugh", headers=H, params={"country_id": "usa"}
        )
    ).status_code == 204
    r = await client.post(f"/api/games/{gid}/rounds/1/resolve", headers=H)
    assert r.status_code == 200 and r.json()["next_round"] == 2
    assert (
        await client.post(f"/api/games/{gid}/rounds/1/resolve", headers=H)
    ).status_code == 409  # double click
    obs = (await client.get(f"/api/games/{gid}/observation", headers=U)).json()
    assert obs["round"] == 2 and obs["me"]["laugh"] == 20
    assert any(e["type"] == "laugh_awarded" for e in obs["news"])
    ev_host = (await client.get(f"/api/games/{gid}/events", headers=H, params={"round": 1})).json()
    ev_player = (
        await client.get(f"/api/games/{gid}/events", headers=U, params={"round": 1})
    ).json()
    assert len(ev_host) > len(ev_player)
    assert all(e["actor"] in ("usa", None) or e["type"] in ("sanction_applied",) for e in ev_player)

    for n in range(2, 7):
        r = await client.post(f"/api/games/{gid}/rounds/{n}/resolve", headers=H)
        assert r.status_code == 200, r.text
    assert r.json()["finished"] and r.json()["next_round"] is None
    assert (await client.put(f"/api/games/{gid}/orders", headers=U, json={})).status_code == 409
    final = (await client.get(f"/api/games/{gid}/state", headers=H)).json()
    assert final["round"] == 7


async def test_rules_endpoints(client: AsyncClient) -> None:
    versions = (await client.get("/api/rules")).json()
    assert "v1.0" in versions and "experiments/v1.0-cheap-eco" in versions
    rules = (await client.get("/api/rules/experiments/v1.0-cheap-eco")).json()
    assert rules["actions"]["eco_program"]["cost"] == 100 and rules["params"]["rounds"] == 6
    assert (await client.get("/api/rules/v9.9")).status_code == 404
    assert (await client.get("/api/rules/schema")).json()["title"] == "RuleSet"


async def test_openapi_is_complete(client: AsyncClient) -> None:
    paths = set((await client.get("/openapi.json")).json()["paths"])
    for p in (
        "/api/auth/join",
        "/api/games",
        "/api/games/{game_id}/observation",
        "/api/games/{game_id}/action-space",
        "/api/games/{game_id}/orders",
        "/api/games/{game_id}/rounds/{number}/resolve",
        "/api/rules/schema",
    ):
        assert p in paths, p
