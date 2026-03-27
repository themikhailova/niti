"""Swagger документация с использованием существующих Pydantic моделей."""
import inspect
from flask_swagger_ui import get_swaggerui_blueprint
from flask import jsonify

# Импортируем существующие модели из API
from api.auth import RegisterSchema, LoginSchema
from api.posts import CreatePostSchema, UpdatePostSchema
from api.boards import CreateBoardSchema, UpdateBoardSchema
from api.comments import CreateCommentSchema, UpdateCommentSchema
from api.reactions import ReactSchema
from api.users import UpdateProfileSchema


def _get_schema_properties(schema_class):
    """Извлекает свойства из Pydantic модели."""
    if not hasattr(schema_class, 'model_fields'):
        return {}
    
    properties = {}
    for name, field in schema_class.model_fields.items():
        field_info = {
            "type": _get_python_type(field.annotation),
            "description": field.description or "",
        }
        
        # Добавляем enum если есть
        if hasattr(field.annotation, '__origin__') and field.annotation.__origin__ is list:
            field_info["type"] = "array"
            if hasattr(field.annotation, '__args__'):
                field_info["items"] = {"type": _get_python_type(field.annotation.__args__[0])}
        
        # Добавляем примеры
        if field.examples:
            field_info["example"] = field.examples[0]
        
        properties[name] = field_info
    
    return properties


def _get_python_type(annotation):
    """Преобразует Python тип в OpenAPI тип."""
    if annotation is str:
        return "string"
    elif annotation is int:
        return "integer"
    elif annotation is bool:
        return "boolean"
    elif annotation is float:
        return "number"
    elif annotation is dict:
        return "object"
    elif annotation is list:
        return "array"
    elif hasattr(annotation, '__origin__') and annotation.__origin__ is list:
        return "array"
    elif annotation is None:
        return "null"
    else:
        return "string"


def _get_required_fields(schema_class):
    """Возвращает список обязательных полей."""
    if not hasattr(schema_class, 'model_fields'):
        return []
    
    required = []
    for name, field in schema_class.model_fields.items():
        if field.is_required():
            required.append(name)
    return required


def _get_model_schema(schema_class, description=""):
    """Создаёт OpenAPI схему из Pydantic модели."""
    return {
        "type": "object",
        "description": description,
        "properties": _get_schema_properties(schema_class),
        "required": _get_required_fields(schema_class),
    }


def setup_swagger(app):
    """Настройка Swagger UI."""
    
    # ── Swagger UI ───────────────────────────────────────────────────────────
    SWAGGER_URL = '/api/docs'
    API_URL = '/api/swagger.json'
    
    swaggerui_blueprint = get_swaggerui_blueprint(
        SWAGGER_URL,
        API_URL,
        config={
            'app_name': "NITI API",
            'doc_expansion': 'list',
            'default_model_expand_depth': 3,
        }
    )
    app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)
    
    # ── Swagger спецификация ─────────────────────────────────────────────────
    @app.route('/api/swagger.json')
    def swagger_json():
        """Возвращает OpenAPI спецификацию."""
        
        spec = {
            "openapi": "3.0.2",
            "info": {
                "title": "NITI API",
                "version": "1.0.0",
                "description": "API для контент-ориентированной социальной сети NITI",
                "contact": {
                    "name": "Команда NITI",
                    "email": "support@niti.ru"
                }
            },
            "servers": [
                {
                    "url": "/api",
                    "description": "API сервер"
                }
            ],
            "components": {
                "securitySchemes": {
                    "bearerAuth": {
                        "type": "http",
                        "scheme": "bearer",
                        "bearerFormat": "JWT",
                        "description": "JWT токен, полученный при входе"
                    }
                },
                "schemas": {
                    # Auth schemas
                    "RegisterRequest": _get_model_schema(
                        RegisterSchema, 
                        "Регистрация нового пользователя"
                    ),
                    "LoginRequest": _get_model_schema(
                        LoginSchema,
                        "Вход в систему (email или username)"
                    ),
                    "AuthResponse": {
                        "type": "object",
                        "properties": {
                            "user": {"type": "object", "description": "Данные пользователя"},
                            "access_token": {"type": "string", "description": "JWT access token"},
                            "refresh_token": {"type": "string", "description": "JWT refresh token"},
                            "token_type": {"type": "string", "description": "Тип токена", "example": "bearer"}
                        }
                    },
                    
                    # Post schemas
                    "PostCreate": _get_model_schema(
                        CreatePostSchema,
                        "Создание нового поста"
                    ),
                    "PostUpdate": _get_model_schema(
                        UpdatePostSchema,
                        "Обновление поста"
                    ),
                    
                    # Board schemas
                    "BoardCreate": _get_model_schema(
                        CreateBoardSchema,
                        "Создание новой доски"
                    ),
                    "BoardUpdate": _get_model_schema(
                        UpdateBoardSchema,
                        "Обновление доски"
                    ),
                    
                    # Comment schemas
                    "CommentCreate": _get_model_schema(
                        CreateCommentSchema,
                        "Создание комментария"
                    ),
                    "CommentUpdate": _get_model_schema(
                        UpdateCommentSchema,
                        "Обновление комментария"
                    ),
                    
                    # Reaction schemas
                    "ReactionToggle": _get_model_schema(
                        ReactSchema,
                        "Постановка/снятие реакции"
                    ),
                    
                    # User schemas
                    "ProfileUpdate": _get_model_schema(
                        UpdateProfileSchema,
                        "Обновление профиля"
                    ),
                    
                    # Common
                    "ErrorResponse": {
                        "type": "object",
                        "properties": {
                            "error": {"type": "string", "description": "Текст ошибки"},
                            "errors": {"type": "array", "items": {"type": "object"}, "description": "Детали ошибок"}
                        }
                    }
                }
            },
            "paths": {
                # ── Auth ─────────────────────────────────────────────────────
                "/auth/register": {
                    "post": {
                        "summary": "Регистрация",
                        "description": "Создание нового аккаунта",
                        "tags": ["auth"],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/RegisterRequest"}
                                }
                            }
                        },
                        "responses": {
                            "201": {"description": "Пользователь создан"},
                            "400": {"description": "Ошибка валидации"},
                            "422": {"description": "Неверные данные"}
                        }
                    }
                },
                "/auth/login": {
                    "post": {
                        "summary": "Вход",
                        "description": "Вход по email или username",
                        "tags": ["auth"],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/LoginRequest"}
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Успешный вход"},
                            "401": {"description": "Неверные учетные данные"}
                        }
                    }
                },
                "/auth/logout": {
                    "post": {
                        "summary": "Выход",
                        "description": "Инвалидация токена",
                        "tags": ["auth"],
                        "security": [{"bearerAuth": []}],
                        "responses": {
                            "200": {"description": "Успешный выход"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                "/auth/refresh": {
                    "post": {
                        "summary": "Обновить токен",
                        "description": "Получить новый access token",
                        "tags": ["auth"],
                        "security": [{"bearerAuth": []}],
                        "responses": {
                            "200": {"description": "Новый access token"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                "/auth/me": {
                    "get": {
                        "summary": "Текущий пользователь",
                        "description": "Получить данные текущего пользователя",
                        "tags": ["auth"],
                        "security": [{"bearerAuth": []}],
                        "responses": {
                            "200": {"description": "Данные пользователя"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                
                # ── Posts ────────────────────────────────────────────────────
                "/posts": {
                    "post": {
                        "summary": "Создать пост",
                        "description": "Создаёт новый пост с текстом, изображением или смешанным контентом",
                        "tags": ["posts"],
                        "security": [{"bearerAuth": []}],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/PostCreate"}
                                }
                            }
                        },
                        "responses": {
                            "201": {"description": "Пост создан"},
                            "401": {"description": "Не авторизован"},
                            "404": {"description": "Доска не найдена"}
                        }
                    }
                },
                "/posts/feed": {
                    "get": {
                        "summary": "Лента постов",
                        "description": "Получить ленту постов с рекомендациями",
                        "tags": ["posts"],
                        "parameters": [
                            {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                            {"name": "mode", "in": "query", "schema": {"type": "string", "enum": ["balanced", "interests", "content", "serendipity"], "default": "balanced"}}
                        ],
                        "responses": {
                            "200": {"description": "Список постов"}
                        }
                    }
                },
                "/posts/me": {
                    "get": {
                        "summary": "Мои посты",
                        "description": "Получить посты текущего пользователя",
                        "tags": ["posts"],
                        "security": [{"bearerAuth": []}],
                        "responses": {
                            "200": {"description": "Список постов"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                "/posts/{post_id}": {
                    "get": {
                        "summary": "Получить пост",
                        "description": "Получить один пост по ID",
                        "tags": ["posts"],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {
                            "200": {"description": "Пост найден"},
                            "404": {"description": "Пост не найден"}
                        }
                    },
                    "put": {
                        "summary": "Обновить пост",
                        "description": "Обновить существующий пост",
                        "tags": ["posts"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/PostUpdate"}
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Пост обновлён"},
                            "403": {"description": "Нет доступа"},
                            "404": {"description": "Пост не найден"}
                        }
                    },
                    "delete": {
                        "summary": "Удалить пост",
                        "description": "Удалить свой пост",
                        "tags": ["posts"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {
                            "200": {"description": "Пост удалён"},
                            "403": {"description": "Нет доступа"},
                            "404": {"description": "Пост не найден"}
                        }
                    }
                },
                "/posts/{post_id}/image": {
                    "post": {
                        "summary": "Загрузить изображение",
                        "description": "Загрузить или сменить изображение поста",
                        "tags": ["posts"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "multipart/form-data": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "image": {"type": "string", "format": "binary", "description": "Файл изображения"}
                                        }
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Изображение загружено"},
                            "400": {"description": "Недопустимый формат"},
                            "413": {"description": "Файл слишком большой"}
                        }
                    }
                },
                
                # ── Boards ───────────────────────────────────────────────────
                "/boards": {
                    "get": {
                        "summary": "Публичные доски",
                        "description": "Список публичных досок (для сайдбара)",
                        "tags": ["boards"],
                        "parameters": [
                            {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 10}}
                        ],
                        "responses": {"200": {"description": "Список досок"}}
                    },
                    "post": {
                        "summary": "Создать доску",
                        "description": "Создать новую доску",
                        "tags": ["boards"],
                        "security": [{"bearerAuth": []}],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/BoardCreate"}
                                }
                            }
                        },
                        "responses": {
                            "201": {"description": "Доска создана"},
                            "400": {"description": "Название уже существует"}
                        }
                    }
                },
                "/boards/me": {
                    "get": {
                        "summary": "Мои доски",
                        "description": "Получить все свои доски",
                        "tags": ["boards"],
                        "security": [{"bearerAuth": []}],
                        "responses": {"200": {"description": "Список досок"}}
                    }
                },
                "/boards/{board_id}": {
                    "get": {
                        "summary": "Получить доску",
                        "description": "Получить доску по ID",
                        "tags": ["boards"],
                        "parameters": [
                            {"name": "board_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {
                            "200": {"description": "Доска найдена"},
                            "404": {"description": "Доска не найдена"}
                        }
                    },
                    "put": {
                        "summary": "Обновить доску",
                        "description": "Обновить существующую доску",
                        "tags": ["boards"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "board_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/BoardUpdate"}
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Доска обновлена"},
                            "403": {"description": "Нет доступа"},
                            "404": {"description": "Доска не найдена"}
                        }
                    },
                    "delete": {
                        "summary": "Удалить доску",
                        "description": "Удалить доску (посты отвязываются)",
                        "tags": ["boards"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "board_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {
                            "200": {"description": "Доска удалена"},
                            "403": {"description": "Нет доступа"},
                            "404": {"description": "Доска не найдена"}
                        }
                    }
                },
                "/boards/{board_id}/follow": {
                    "post": {
                        "summary": "Подписаться на доску",
                        "tags": ["boards"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "board_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {"200": {"description": "Подписка оформлена"}}
                    }
                },
                "/boards/{board_id}/unfollow": {
                    "post": {
                        "summary": "Отписаться от доски",
                        "tags": ["boards"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "board_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {"200": {"description": "Отписка выполнена"}}
                    }
                },
                
                # ── Comments ─────────────────────────────────────────────────
                "/posts/{post_id}/comments": {
                    "get": {
                        "summary": "Комментарии к посту",
                        "tags": ["comments"],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}},
                            {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                            {"name": "per_page", "in": "query", "schema": {"type": "integer", "default": 20}}
                        ],
                        "responses": {"200": {"description": "Список комментариев"}}
                    },
                    "post": {
                        "summary": "Добавить комментарий",
                        "tags": ["comments"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/CommentCreate"}
                                }
                            }
                        },
                        "responses": {
                            "201": {"description": "Комментарий добавлен"},
                            "401": {"description": "Не авторизован"},
                            "404": {"description": "Пост не найден"}
                        }
                    }
                },
                "/comments/{comment_id}": {
                    "put": {
                        "summary": "Редактировать комментарий",
                        "tags": ["comments"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "comment_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/CommentUpdate"}
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Комментарий обновлён"},
                            "403": {"description": "Нет доступа"},
                            "404": {"description": "Комментарий не найден"}
                        }
                    },
                    "delete": {
                        "summary": "Удалить комментарий",
                        "tags": ["comments"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "comment_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {
                            "200": {"description": "Комментарий удалён"},
                            "403": {"description": "Нет доступа"},
                            "404": {"description": "Комментарий не найден"}
                        }
                    }
                },
                
                # ── Reactions ────────────────────────────────────────────────
                "/posts/{post_id}/react": {
                    "post": {
                        "summary": "Поставить/убрать реакцию",
                        "description": "Toggle-логика: если реакция есть — удаляем, нет — добавляем",
                        "tags": ["reactions"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/ReactionToggle"}
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Реакция обновлена"},
                            "401": {"description": "Не авторизован"},
                            "404": {"description": "Пост не найден"}
                        }
                    }
                },
                "/posts/{post_id}/reactions": {
                    "get": {
                        "summary": "Статистика реакций",
                        "description": "Получить счётчики всех типов реакций для поста",
                        "tags": ["reactions"],
                        "parameters": [
                            {"name": "post_id", "in": "path", "required": True, "schema": {"type": "integer"}}
                        ],
                        "responses": {
                            "200": {"description": "Счётчики реакций"},
                            "404": {"description": "Пост не найден"}
                        }
                    }
                },
                
                # ── Users ────────────────────────────────────────────────────
                "/users/{username}": {
                    "get": {
                        "summary": "Профиль пользователя",
                        "description": "Получить публичный профиль пользователя",
                        "tags": ["users"],
                        "parameters": [
                            {"name": "username", "in": "path", "required": True, "schema": {"type": "string"}}
                        ],
                        "responses": {
                            "200": {"description": "Профиль пользователя"},
                            "404": {"description": "Пользователь не найден"}
                        }
                    }
                },
                "/users/me": {
                    "get": {
                        "summary": "Мой профиль",
                        "description": "Получить данные текущего пользователя",
                        "tags": ["users"],
                        "security": [{"bearerAuth": []}],
                        "responses": {
                            "200": {"description": "Данные пользователя"},
                            "401": {"description": "Не авторизован"}
                        }
                    },
                    "put": {
                        "summary": "Обновить профиль",
                        "description": "Обновить имя пользователя или bio",
                        "tags": ["users"],
                        "security": [{"bearerAuth": []}],
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/ProfileUpdate"}
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Профиль обновлён"},
                            "400": {"description": "Имя уже занято"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                "/users/me/avatar": {
                    "post": {
                        "summary": "Загрузить аватар",
                        "tags": ["users"],
                        "security": [{"bearerAuth": []}],
                        "requestBody": {
                            "required": True,
                            "content": {
                                "multipart/form-data": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "avatar": {"type": "string", "format": "binary", "description": "Файл аватара"}
                                        }
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {"description": "Аватар загружен"},
                            "400": {"description": "Недопустимый формат"},
                            "413": {"description": "Файл слишком большой"}
                        }
                    },
                    "delete": {
                        "summary": "Удалить аватар",
                        "description": "Сброс на дефолтный аватар",
                        "tags": ["users"],
                        "security": [{"bearerAuth": []}],
                        "responses": {
                            "200": {"description": "Аватар удалён"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                "/users/search": {
                    "get": {
                        "summary": "Поиск пользователей",
                        "tags": ["users"],
                        "parameters": [
                            {"name": "q", "in": "query", "required": True, "schema": {"type": "string"}, "description": "Поисковый запрос"}
                        ],
                        "responses": {
                            "200": {"description": "Список пользователей"},
                            "401": {"description": "Не авторизован"}
                        }
                    }
                },
                "/users/{username}/follow": {
                    "post": {
                        "summary": "Подписаться на пользователя",
                        "tags": ["users"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "username", "in": "path", "required": True, "schema": {"type": "string"}}
                        ],
                        "responses": {
                            "200": {"description": "Подписка оформлена"},
                            "400": {"description": "Нельзя подписаться на себя"},
                            "401": {"description": "Не авторизован"},
                            "404": {"description": "Пользователь не найден"}
                        }
                    }
                },
                "/users/{username}/unfollow": {
                    "post": {
                        "summary": "Отписаться от пользователя",
                        "tags": ["users"],
                        "security": [{"bearerAuth": []}],
                        "parameters": [
                            {"name": "username", "in": "path", "required": True, "schema": {"type": "string"}}
                        ],
                        "responses": {
                            "200": {"description": "Отписка выполнена"},
                            "401": {"description": "Не авторизован"},
                            "404": {"description": "Пользователь не найден"}
                        }
                    }
                },
                "/users/{username}/followers": {
                    "get": {
                        "summary": "Подписчики пользователя",
                        "tags": ["users"],
                        "parameters": [
                            {"name": "username", "in": "path", "required": True, "schema": {"type": "string"}},
                            {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}}
                        ],
                        "responses": {
                            "200": {"description": "Список подписчиков"},
                            "404": {"description": "Пользователь не найден"}
                        }
                    }
                },
                "/users/{username}/following": {
                    "get": {
                        "summary": "Подписки пользователя",
                        "tags": ["users"],
                        "parameters": [
                            {"name": "username", "in": "path", "required": True, "schema": {"type": "string"}},
                            {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}}
                        ],
                        "responses": {
                            "200": {"description": "Список подписок"},
                            "404": {"description": "Пользователь не найден"}
                        }
                    }
                },
                "/users/{username}/boards": {
                    "get": {
                        "summary": "Доски пользователя",
                        "tags": ["users"],
                        "parameters": [
                            {"name": "username", "in": "path", "required": True, "schema": {"type": "string"}}
                        ],
                        "responses": {
                            "200": {"description": "Список досок"},
                            "404": {"description": "Пользователь не найден"}
                        }
                    }
                }
            }
        }
        
        return spec