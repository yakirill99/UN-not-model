"""Order models: CountryOrders, HostInput, OrderBook.

Orders are *intent*: what a country asked for. Whether they are affordable or legal
is decided by the engine (budget system, actions.legal_actions), which emits
``OrderRejected`` events instead of raising.
"""

from __future__ import annotations

from pydantic import Field, model_validator

from arena.engine.state import ArenaModel


class CountryOrders(ArenaModel):
    invest: list[str] = Field(
        default_factory=list, description="Own city ids; repeat an id to invest several times"
    )
    eco_programs: int = Field(default=0, ge=0)
    nuclear_tech: bool = False
    bombs: int = Field(default=0, ge=0)
    strikes: list[str] = Field(default_factory=list, description="Foreign city ids")
    shields: list[str] = Field(default_factory=list, description="Own city ids")
    sanctions: list[str] = Field(default_factory=list, description="Country ids")
    aid: dict[str, int] = Field(default_factory=dict, description="Country id -> amount")

    @model_validator(mode="after")
    def _positive_aid(self) -> CountryOrders:
        bad = {k: v for k, v in self.aid.items() if v <= 0}
        if bad:
            raise ValueError(f"aid amounts must be positive: {bad}")
        return self

    @property
    def is_empty(self) -> bool:
        return not (
            self.invest
            or self.eco_programs
            or self.nuclear_tech
            or self.bombs
            or self.strikes
            or self.shields
            or self.sanctions
            or self.aid
        )


class HostInput(ArenaModel):
    laugh_winner: str | None = Field(default=None, description="Country id chosen by the host")


class OrderBook(ArenaModel):
    orders: dict[str, CountryOrders] = Field(
        default_factory=dict, description="Country id -> orders"
    )
    host: HostInput = Field(default_factory=HostInput)

    def for_country(self, country_id: str) -> CountryOrders:
        """Orders of a country; a country that submitted nothing has empty orders."""
        return self.orders.get(country_id, CountryOrders())
