import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, g, session, send_from_directory
from flask_migrate import Migrate
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect

from config import config
from models import db, User
from extensions import limiter, jwt, jwt_blacklist   # ← единственный источник


def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__, static_folder='static')
    app.config.from_object(config[config_name])

    # CSRF только для non-API роутов (API защищён JWT)
    csrf = CSRFProtect(app)

    # CORS для dev (vite :5173 → flask :5000)
    CORS(app,
         origins=["http://localhost:5173", "http://127.0.0.1:5173"],
         supports_credentials=True)

    # ── Расширения ───────────────────────────────────────────────────────────
    db.init_app(app)
    Migrate(app, db)
    limiter.init_app(app)
    jwt.init_app(app)

    # ── JWT callbacks ────────────────────────────────────────────────────────
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
        return jwt_payload.get('jti') in jwt_blacklist

    @jwt.revoked_token_loader
    def revoked_token_response(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has been revoked'}), 401

    @jwt.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_response(error):
        return jsonify({'error': 'Invalid token'}), 422

    @jwt.unauthorized_loader
    def missing_token_response(error):
        return jsonify({'error': 'Authorization token required'}), 401

    # ── Папки ────────────────────────────────────────────────────────────────
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.static_folder, 'uploads', 'posts'), exist_ok=True)
    os.makedirs('logs', exist_ok=True)

    # ── Логирование ──────────────────────────────────────────────────────────
    if not app.debug and not app.testing:
        file_handler = RotatingFileHandler(
            'logs/social_network.log', maxBytes=10240000, backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)

    # ── Сессионный пользователь (обратная совместимость) ─────────────────────
    @app.before_request
    def load_current_user():
        g.current_user = None
        if 'user_id' in session:
            user = db.session.get(User, session['user_id'])
            if user:
                g.current_user = user
            else:
                session.clear()

    # ── Blueprints ───────────────────────────────────────────────────────────
    from api import api_bp                   # импорт ЗДЕСЬ — после всех init_app
    app.config['WTF_CSRF_CHECK_DEFAULT'] = False
    app.register_blueprint(api_bp)
    csrf.exempt(api_bp)

    # ── Error handlers ────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Не найдено'}), 404

    @app.errorhandler(500)
    def server_error(e):
        db.session.rollback()
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({'error': 'Доступ запрещён'}), 403

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({'error': 'Файл слишком большой (максимум 5 MB)'}), 413

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return jsonify({'error': 'Слишком много запросов. Попробуйте позже'}), 429

    # ── Production SPA ───────────────────────────────────────────────────────
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        dist = os.path.join(app.static_folder, 'dist')
        if path and os.path.exists(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        return send_from_directory(dist, 'index.html')

    return app


app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'])