import os
import imghdr
from PIL import Image
from werkzeug.utils import secure_filename
from datetime import datetime
from flask import current_app, url_for
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def allowed_file(filename):
    """Проверяет допустимость расширения файла"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']


def validate_image(file_stream):
    """
    Проверяет, что файл действительно является изображением
    Возвращает (True, None) или (False, error_message)
    """
    try:
        # Сохраняем позицию
        file_stream.seek(0)
        
        # Проверяем тип файла по заголовку
        header = file_stream.read(512)
        file_stream.seek(0)
        file_type = imghdr.what(None, header)
        
        if file_type not in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            return False, "Файл не является допустимым изображением"
        
        # Пробуем открыть через Pillow
        try:
            img = Image.open(file_stream)
            img.verify()  # Проверяем целостность
            file_stream.seek(0)  # Возвращаем позицию
            
            # Проверяем размеры (защита от decompression bomb)
            if img.size[0] * img.size[1] > 178956970:  # ~178 мегапикселей
                return False, "Изображение слишком большое"
                
            return True, None
            
        except Exception as e:
            return False, f"Ошибка при обработке изображения: {str(e)}"
            
    except Exception as e:
        return False, f"Ошибка при валидации файла: {str(e)}"


def save_avatar(file, username):
    """
    Безопасно сохраняет аватар пользователя
    Возвращает (filename, None) или (None, error_message)
    """
    try:
        # Проверяем расширение
        if not file or not allowed_file(file.filename):
            return None, "Недопустимый формат файла"
        
        # Валидируем содержимое
        is_valid, error = validate_image(file.stream)
        if not is_valid:
            return None, error
        
        # Генерируем безопасное имя файла
        ext = file.filename.rsplit('.', 1)[1].lower()
        timestamp = int(datetime.utcnow().timestamp())
        filename = f"{secure_filename(username)}_{timestamp}.{ext}"
        
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        
        # Открываем и обрабатываем изображение
        img = Image.open(file.stream)
        
        # Конвертируем в RGB (для JPEG)
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        
        # Удаляем EXIF данные (приватность)
        data = list(img.getdata())
        image_without_exif = Image.new(img.mode, img.size)
        image_without_exif.putdata(data)
        
        # Создаем thumbnail
        image_without_exif.thumbnail((400, 400), Image.Resampling.LANCZOS)
        
        # Сохраняем
        image_without_exif.save(filepath, 'JPEG', quality=85, optimize=True)
        
        return filename, None
        
    except Exception as e:
        return None, f"Ошибка при сохранении файла: {str(e)}"


def delete_avatar(filename):
    """Безопасно удаляет файл аватара"""
    if not filename or filename == 'default_avatar.png':
        return
    
    try:
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        # Проверяем, что путь находится в разрешенной директории
        if not filepath.startswith(current_app.config['UPLOAD_FOLDER']):
            return
        
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        current_app.logger.error(f"Ошибка при удалении аватара {filename}: {e}")


def get_avatar_url(user):
    """Возвращает URL аватара пользователя"""
    if user.avatar and user.avatar != 'default_avatar.png':
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], user.avatar)
        if os.path.exists(filepath):
            return url_for('static', filename=f'uploads/avatars/{user.avatar}')
    
    # Возвращаем SVG placeholder
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='50' font-size='40' fill='white' text-anchor='middle' dy='.3em'%3E" + user.username[0].upper() + "%3C/text%3E%3C/svg%3E"


def get_recommended_posts(current_user, all_posts):
    """AI-рекомендации постов на основе интересов и контента"""
    if not current_user.interests:
        return all_posts  # если нет интересов — обычный фид
    
    # Подготавливаем тексты: интересы пользователя + контент постов
    user_text = ' '.join(current_user.interests)
    post_texts = [post.content for post in all_posts]
    
    if not post_texts:
        return []
    
    # TF-IDF векторизация
    vectorizer = TfidfVectorizer()
    vectors = vectorizer.fit_transform([user_text] + post_texts)
    
    # Cosine similarity
    similarities = cosine_similarity(vectors[0:1], vectors[1:])[0]
    
    # Сортируем посты по similarity
    sorted_indices = np.argsort(similarities)[::-1]
    recommended_posts = [all_posts[i] for i in sorted_indices if similarities[i] > 0.1]  # порог 0.1
    
    return recommended_posts

def get_bubbles(recommended_posts):
    """Группировка постов в 'пузыри' по ключевым словам (простая версия)"""
    from collections import defaultdict
    bubbles = defaultdict(list)
    
    for post in recommended_posts:
        # Простой 'тэг' — первое слово поста (можно улучшить NLTK)
        tag = post.content.split()[0] if post.content.split() else 'other'
        bubbles[tag].append(post)
    
    return dict(bubbles)