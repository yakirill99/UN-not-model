"""Application services: the only place that combines the engine with the database.

API routers call services; services call the engine and the ORM. Services never
import FastAPI, so they can be driven from scripts, tests and the WebSocket layer.
"""
