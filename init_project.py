#!/usr/bin/env python3
"""
Скрипт инициализации проекта NITI Social Network
Запустите этот скрипт перед первым запуском приложения
"""

import os
import secrets
import sys


def create_directories():
    """Создает необходимые директории"""
    dirs = [
        'static/uploads/avatars',
        'logs',
        'instance'
    ]
    
    for directory in dirs:
        os.makedirs(directory, exist_ok=True)
        print(f"✓ Создана директория: {directory}")
    
    # Создаем .gitkeep для пустых директорий
    gitkeep_dirs = ['static/uploads/avatars', 'logs']
    for directory in gitkeep_dirs:
        gitkeep_path = os.path.join(directory, '.gitkeep')
        if not os.path.exists(gitkeep_path):
            open(gitkeep_path, 'a').close()


def create_env_file():
    """Создает .env файл с безопасным SECRET_KEY"""
    if os.path.exists('.env'):
        print("⚠ Файл .env уже существует. Пропускаю...")
        return
    
    # Генерируем случайный SECRET_KEY
    secret_key = secrets.token_hex(32)
    
    env_content = f"""# Конфигурация NITI Social Network
# ВАЖНО: Не коммитьте этот файл в Git!

# Секретный ключ для Flask (сгенерирован автоматически)
SECRET_KEY={secret_key}

# База данных
DATABASE_URI=sqlite:///social_network.db

# Настройки окружения
FLASK_ENV=development
DEBUG=False

# Настройки загрузки файлов
MAX_CONTENT_LENGTH=4194304
UPLOAD_FOLDER=static/uploads/avatars

# Rate limiting (запросов в час)
RATELIMIT_LOGIN=5
RATELIMIT_REGISTER=3
RATELIMIT_POST=30
RATELIMIT_SEARCH=60
"""
    
    with open('.env', 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print("✓ Создан файл .env с безопасным SECRET_KEY")


def check_dependencies():
    """Проверяет установлены ли зависимости"""
    try:
        import flask
        import flask_sqlalchemy
        import flask_wtf
        import flask_migrate
        import flask_limiter
        from PIL import Image
        from dotenv import load_dotenv
        print("✓ Все зависимости установлены")
        return True
    except ImportError as e:
        print(f"✗ Не хватает зависимостей: {e}")
        print("\nУстановите их командой:")
        print("  pip install -r requirements.txt")
        return False


def init_database():
    """Инициализирует базу данных"""
    try:
        print("\nИнициализация базы данных...")
        
        # Проверяем существует ли уже папка migrations
        if os.path.exists('migrations'):
            print("⚠ Папка migrations уже существует")
            response = input("Хотите переинициализировать БД? (y/N): ")
            if response.lower() != 'y':
                print("Пропускаю инициализацию БД")
                return
            
            # Удаляем старую БД и миграции
            import shutil
            if os.path.exists('social_network.db'):
                os.remove('social_network.db')
            shutil.rmtree('migrations')
        
        # Инициализируем миграции
        os.system('flask db init')
        print("✓ Инициализированы миграции")
        
        # Создаем первую миграцию
        os.system('flask db migrate -m "Initial migration"')
        print("✓ Создана начальная миграция")
        
        # Применяем миграции
        os.system('flask db upgrade')
        print("✓ База данных создана и готова к работе")
        
    except Exception as e:
        print(f"✗ Ошибка при инициализации БД: {e}")


def print_success():
    """Выводит сообщение об успешной инициализации"""
    print("\n" + "="*60)
    print("🎉 Проект успешно инициализирован!")
    print("="*60)
    print("\nТеперь вы можете запустить приложение:")
    print("  python app.py")
    print("\nПриложение будет доступно по адресу:")
    print("  http://127.0.0.1:5000")
    print("\nДля production деплоя смотрите README.md и SECURITY.md")
    print("="*60 + "\n")


def main():
    """Основная функция"""
    print("\n" + "="*60)
    print("NITI Social Network - Инициализация проекта")
    print("="*60 + "\n")
    
    # Проверяем зависимости
    if not check_dependencies():
        sys.exit(1)
    
    # Создаем директории
    print("\n1. Создание директорий...")
    create_directories()
    
    # Создаем .env файл
    print("\n2. Создание конфигурации...")
    create_env_file()
    
    # Инициализируем БД
    print("\n3. Инициализация базы данных...")
    response = input("Инициализировать базу данных сейчас? (Y/n): ")
    if response.lower() != 'n':
        init_database()
    else:
        print("Пропущено. Запустите позже вручную:")
        print("  flask db init")
        print("  flask db migrate -m 'Initial migration'")
        print("  flask db upgrade")
    
    # Финальное сообщение
    print_success()


if __name__ == '__main__':
    main()
