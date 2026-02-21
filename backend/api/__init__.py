from flask import Blueprint

api_bp = Blueprint('api', __name__, url_prefix='/api')

from .auth import auth_bp
from .posts import posts_bp
from .users import users_bp
from .search import search_bp

api_bp.register_blueprint(auth_bp, url_prefix='/auth')
api_bp.register_blueprint(posts_bp, url_prefix='/posts')
api_bp.register_blueprint(users_bp, url_prefix='/users')
api_bp.register_blueprint(search_bp, url_prefix='/search')
