from flask import Blueprint

api_bp = Blueprint('api', __name__, url_prefix='/api')

from . import auth, posts, users  # noqa: F401, E402
