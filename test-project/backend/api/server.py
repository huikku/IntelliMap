"""Main server module"""
from .routes import get_routes
from ..core.db import Database

def create_app():
    db = Database()
    routes = get_routes()
    return {"db": db, "routes": routes}
