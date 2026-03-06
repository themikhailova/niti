"""
extensions.py — синглтоны расширений Flask.

Правило проекта (как db в models.py):
  - создаём объект ЗДЕСЬ, один раз
  - инициализируем через .init_app(app) в create_app()
  - все модули импортируют отсюда

Это разрывает circular import: api/auth.py → app.py → api/__init__.py
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import JWTManager

# Limiter без app — инициализируется позже через limiter.init_app(app)
limiter = Limiter(key_func=get_remote_address)

# JWTManager без app — инициализируется через jwt.init_app(app)
jwt = JWTManager()

# Blacklist инвалидированных токенов.
# В production замените на Redis: jwt_blacklist.add → redis.sadd / redis.sismember
jwt_blacklist: set = set()