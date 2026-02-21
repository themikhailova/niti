import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, g, session, send_from_directory
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect

from config import config
from models import db, User


def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__, static_folder='static')

    app.config.from_object(config[config_name])

    # CSRF только для non-API роутов; API использует сессии
    csrf = CSRFProtect(app)

    # CORS для dev (vite на :5173 → flask на :5000)
    CORS(app,
         origins=["http://localhost:5173", "http://127.0.0.1:5173"],
         supports_credentials=True)

    db.init_app(app)
    migrate = Migrate(app, db)

    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri=app.config['RATELIMIT_STORAGE_URL']
    )

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs('logs', exist_ok=True)

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

    # ── Загружаем текущего пользователя ──────────────────────────────
    @app.before_request
    def load_current_user():
        g.current_user = None
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
            if user:
                g.current_user = user
            else:
                session.clear()

    # ── Регистрируем API blueprints ───────────────────────────────────
    from api import api_bp
    # В config.py или app.py
    app.config['WTF_CSRF_CHECK_DEFAULT'] = False
    app.register_blueprint(api_bp)

    # Отключаем CSRF для всех /api/* роутов
    csrf.exempt(api_bp)

    # ── Error handlers ────────────────────────────────────────────────
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
        return jsonify({'error': 'Файл слишком большой (максимум 4MB)'}), 413

    # ── Production: отдаём React SPA ─────────────────────────────────
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
