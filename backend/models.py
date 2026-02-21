from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import re

db = SQLAlchemy()

# Таблица для подписок (many-to-many)
follows = db.Table('follows',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)


class User(db.Model):
    """Модель пользователя"""
    __tablename__ = 'user'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(255), nullable=True, default='default_avatar.png')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    interests = db.Column(db.JSON, nullable=True, default=list)  # список тэгов, e.g. ["музыка", "спорт"]
    
    # Денормализованные счетчики для производительности
    followers_count = db.Column(db.Integer, default=0, nullable=False)
    following_count = db.Column(db.Integer, default=0, nullable=False)
    posts_count = db.Column(db.Integer, default=0, nullable=False)
    
    # Relationships
    posts = db.relationship('Post', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    following = db.relationship('User',
                                secondary=follows,
                                primaryjoin=(follows.c.follower_id == id),
                                secondaryjoin=(follows.c.followed_id == id),
                                backref=db.backref('followers', lazy='dynamic'),
                                lazy='dynamic')
    
    def set_password(self, password):
        """Хеширует и сохраняет пароль"""
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')
    
    def check_password(self, password):
        """Проверяет пароль"""
        return check_password_hash(self.password_hash, password)
    
    def is_following(self, user):
        """Проверяет, подписан ли на пользователя"""
        return self.following.filter(follows.c.followed_id == user.id).count() > 0
    
    def follow(self, user):
        """Подписаться на пользователя"""
        if not self.is_following(user) and user != self:
            self.following.append(user)
            self.following_count += 1
            user.followers_count += 1
            return True
        return False
    
    def unfollow(self, user):
        """Отписаться от пользователя"""
        if self.is_following(user):
            self.following.remove(user)
            self.following_count -= 1
            user.followers_count -= 1
            return True
        return False
    
    @staticmethod
    def validate_username(username):
        """Валидация username"""
        if not username or len(username) < 3:
            return False, "Имя пользователя должно содержать минимум 3 символа"
        if len(username) > 30:
            return False, "Имя пользователя слишком длинное (максимум 30 символов)"
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return False, "Имя пользователя может содержать только буквы, цифры и подчеркивание"
        return True, None
    
    @staticmethod
    def validate_password(password):
        """Валидация пароля"""
        if not password or len(password) < 6:
            return False, "Пароль должен содержать минимум 6 символов"
        if len(password) > 128:
            return False, "Пароль слишком длинный"
        return True, None
    
    def __repr__(self):
        return f'<User {self.username}>'


class Post(db.Model):
    """Модель поста"""
    __tablename__ = 'post'
    
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    
    @staticmethod
    def validate_content(content):
        """Валидация контента поста"""
        if not content or not content.strip():
            return False, "Пост не может быть пустым"
        if len(content) > 5000:
            return False, "Пост слишком длинный (максимум 5000 символов)"
        return True, None
    
    def __repr__(self):
        return f'<Post {self.id} by {self.user_id}>'
