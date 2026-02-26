from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData
from werkzeug.security import generate_password_hash, check_password_hash
import re

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
db = SQLAlchemy(metadata=MetaData(naming_convention=convention))

# ── Подписки на пользователей (many-to-many) ─────────────────
follows = db.Table('follows',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

# ── Подписки на доски (many-to-many) ─────────────────────────
board_followers = db.Table('board_followers',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('board_id', db.Integer, db.ForeignKey('board.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

# ── Коллабораторы досок (many-to-many) ───────────────────────
board_collaborators = db.Table('board_collaborators',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('board_id', db.Integer, db.ForeignKey('board.id'), primary_key=True)
)


class User(db.Model):
    """Модель пользователя"""
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(255), nullable=True, default='default_avatar.png')
    bio = db.Column(db.String(300), nullable=True, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interests = db.Column(db.JSON, nullable=True, default=list)

    # Денормализованные счётчики
    followers_count = db.Column(db.Integer, default=0, nullable=False)
    following_count = db.Column(db.Integer, default=0, nullable=False)
    posts_count = db.Column(db.Integer, default=0, nullable=False)

    # Relationships
    posts = db.relationship('Post', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    boards = db.relationship('Board', backref='creator', lazy='dynamic',
                             foreign_keys='Board.creator_id', cascade='all, delete-orphan')

    following = db.relationship('User',
                                secondary=follows,
                                primaryjoin=(follows.c.follower_id == id),
                                secondaryjoin=(follows.c.followed_id == id),
                                backref=db.backref('followers', lazy='dynamic'),
                                lazy='dynamic')

    followed_boards = db.relationship('Board',
                                      secondary=board_followers,
                                      backref=db.backref('follower_users', lazy='dynamic'),
                                      lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_following(self, user):
        return self.following.filter(follows.c.followed_id == user.id).count() > 0

    def is_following_board(self, board):
        return self.followed_boards.filter(board_followers.c.board_id == board.id).count() > 0

    def follow(self, user):
        if not self.is_following(user) and user != self:
            self.following.append(user)
            self.following_count += 1
            user.followers_count += 1
            return True
        return False

    def unfollow(self, user):
        if self.is_following(user):
            self.following.remove(user)
            self.following_count -= 1
            user.followers_count -= 1
            return True
        return False

    def follow_board(self, board):
        if not self.is_following_board(board):
            self.followed_boards.append(board)
            board.followers_count += 1
            return True
        return False

    def unfollow_board(self, board):
        if self.is_following_board(board):
            self.followed_boards.remove(board)
            board.followers_count = max(0, board.followers_count - 1)
            return True
        return False

    @staticmethod
    def validate_username(username):
        if not username or len(username) < 3:
            return False, "Имя пользователя должно содержать минимум 3 символа"
        if len(username) > 30:
            return False, "Имя пользователя слишком длинное (максимум 30 символов)"
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return False, "Имя пользователя может содержать только буквы, цифры и подчеркивание"
        return True, None

    @staticmethod
    def validate_password(password):
        if not password or len(password) < 6:
            return False, "Пароль должен содержать минимум 6 символов"
        if len(password) > 128:
            return False, "Пароль слишком длинный"
        return True, None

    def __repr__(self):
        return f'<User {self.username}>'


class Board(db.Model):
    """Модель доски (коллекции постов по теме)"""
    __tablename__ = 'board'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True, default='')
    cover_image = db.Column(db.String(255), nullable=True)
    tags = db.Column(db.JSON, nullable=True, default=list)       # ["дизайн", "минимализм"]
    is_public = db.Column(db.Boolean, default=True, nullable=False)

    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Денормализованные счётчики
    followers_count = db.Column(db.Integer, default=0, nullable=False)
    post_count = db.Column(db.Integer, default=0, nullable=False)

    # Коллабораторы
    collaborators = db.relationship('User', secondary=board_collaborators,
                                    backref=db.backref('collaborating_boards', lazy='dynamic'),
                                    lazy='dynamic')

    # Посты в доске
    posts = db.relationship('Post', backref='board', lazy='dynamic',
                            foreign_keys='Post.board_id', cascade='all, delete-orphan')

    @property
    def collaborators_count(self):
        return self.collaborators.count() + 1  # +1 создатель

    @staticmethod
    def validate_name(name):
        if not name or not name.strip():
            return False, "Название доски не может быть пустым"
        if len(name) > 100:
            return False, "Название слишком длинное (максимум 100 символов)"
        return True, None

    def __repr__(self):
        return f'<Board {self.name}>'


class Post(db.Model):
    """Модель поста"""
    __tablename__ = 'post'

    # Типы постов
    TYPE_TEXT = 'text'
    TYPE_IMAGE = 'image'
    TYPE_MIXED = 'mixed'

    id = db.Column(db.Integer, primary_key=True)

    # Тип и содержимое
    post_type = db.Column(db.String(10), nullable=False, default='text')  # text | image | mixed
    content = db.Column(db.Text, nullable=True)       # текстовая часть
    title = db.Column(db.String(200), nullable=True)  # заголовок (опционально)
    image_url = db.Column(db.String(500), nullable=True)  # URL картинки

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    board_id = db.Column(db.Integer, db.ForeignKey('board.id'), nullable=True, index=True)

    @staticmethod
    def validate_content(content, post_type='text', image_url=None):
        if post_type in (Post.TYPE_TEXT, Post.TYPE_MIXED):
            if not content or not content.strip():
                return False, "Текст поста не может быть пустым"
            if len(content) > 5000:
                return False, "Пост слишком длинный (максимум 5000 символов)"
        if post_type in (Post.TYPE_IMAGE, Post.TYPE_MIXED):
            if not image_url:
                return False, "Для image/mixed поста необходима картинка"
        return True, None

    def __repr__(self):
        return f'<Post {self.id} [{self.post_type}] by {self.user_id}>'