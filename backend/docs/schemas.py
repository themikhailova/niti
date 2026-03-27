"""Pydantic схемы для Swagger документации."""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ── Общие схемы ──────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Схема ошибки."""
    error: str = Field(..., description="Текст ошибки")
    errors: Optional[List[dict]] = Field(None, description="Детали ошибок")


# ── Аутентификация ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Запрос на вход."""
    identifier: str = Field(..., description="Email или имя пользователя")
    password: str = Field(..., description="Пароль")


class RegisterRequest(BaseModel):
    """Запрос на регистрацию."""
    email: str = Field(..., description="Email")
    username: str = Field(..., description="Имя пользователя")
    password: str = Field(..., description="Пароль")


class AuthResponse(BaseModel):
    """Ответ с токенами."""
    user: dict = Field(..., description="Данные пользователя")
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field("bearer", description="Тип токена")


# ── Посты ───────────────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    """Создание поста."""
    content: Optional[str] = Field(None, description="Текст поста")
    title: Optional[str] = Field(None, description="Заголовок")
    mood: Optional[str] = Field(
        None, 
        description="Настроение",
        examples=["joyful", "calm", "reflective", "energetic", "melancholic", "inspired"]
    )
    visibility: str = Field("public", description="Видимость", examples=["public", "private"])
    tags: List[str] = Field(default_factory=list, description="Теги")
    board_id: Optional[int] = Field(None, description="ID доски")
    postType: str = Field("text", description="Тип поста", examples=["text", "image", "mixed"])
    imageUrl: Optional[str] = Field(None, description="URL изображения")


class PostResponse(BaseModel):
    """Ответ с постом."""
    id: str
    author: dict
    sourceBoard: Optional[dict]
    content: dict
    engagement: dict
    timestamp: str
    created_at: str
    mood: Optional[str]
    visibility: str
    tags: List[str]
    is_own: bool


# ── Доски ───────────────────────────────────────────────────────────────────

class BoardCreate(BaseModel):
    """Создание доски."""
    name: str = Field(..., description="Название доски")
    description: str = Field("", description="Описание")
    tags: List[str] = Field(default_factory=list, description="Теги")
    isPublic: bool = Field(True, description="Публичная доска")
    coverImage: Optional[str] = Field(None, description="URL обложки")
    post_ids: List[int] = Field(default_factory=list, description="ID постов для добавления")


class BoardResponse(BaseModel):
    """Ответ с доской."""
    id: str
    name: str
    description: str
    coverImage: str
    tags: List[str]
    isPublic: bool
    followers: int
    postCount: int
    collaborators: int
    isFollowing: bool
    createdAt: Optional[str]
    creator: dict


# ── Комментарии ────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    """Создание комментария."""
    content: str = Field(..., description="Текст комментария")


class CommentResponse(BaseModel):
    """Ответ с комментарием."""
    id: int
    content: str
    created_at: str
    updated_at: Optional[str]
    post_id: int
    author: dict
    is_own: bool


# ── Реакции ────────────────────────────────────────────────────────────────

class ReactionToggle(BaseModel):
    """Постановка/снятие реакции."""
    type: str = Field(..., description="Тип реакции", examples=["like", "love", "laugh", "sad", "wow", "fire"])


class ReactionResponse(BaseModel):
    """Ответ с реакцией."""
    added: bool
    type: str
    reactions: List[dict]


# ── Пользователи ────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    """Обновление профиля."""
    username: Optional[str] = Field(None, description="Имя пользователя")
    bio: Optional[str] = Field(None, description="Bio")