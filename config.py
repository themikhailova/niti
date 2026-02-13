import os
from datetime import timedelta
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    """Базовая конфигурация"""
    
    # Секретный ключ
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    
    if SECRET_KEY == 'dev-key-please-change-in-production':
        import warnings
        warnings.warn('Используется дефолтный SECRET_KEY! Измените его в .env файле!')
    
    # База данных
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URI') or \
        'sqlite:///' + os.path.join(basedir, 'social_network.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Загрузка файлов
    UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads', 'avatars')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 4 * 1024 * 1024))  # 4MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    
    # Безопасность
    SESSION_COOKIE_SECURE = False  # True в production с HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # WTForms
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None  # Токен не истекает
    
    # Rate limiting
    RATELIMIT_STORAGE_URL = "memory://"
    RATELIMIT_STRATEGY = "fixed-window"
    
    # Пагинация
    POSTS_PER_PAGE = 20
    USERS_PER_PAGE = 20
    
    # Валидация
    MIN_USERNAME_LENGTH = 3
    MAX_USERNAME_LENGTH = 30
    MIN_PASSWORD_LENGTH = 6
    MAX_POST_LENGTH = 5000


class DevelopmentConfig(Config):
    """Конфигурация для разработки"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Конфигурация для production"""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
    
    # В production SECRET_KEY обязателен
    if Config.SECRET_KEY == 'dev-key-please-change-in-production':
        raise ValueError('В production необходим настоящий SECRET_KEY!')


class TestingConfig(Config):
    """Конфигурация для тестов"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_EXPIRE_ON_COMMIT = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
