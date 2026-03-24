import os
import imghdr
from PIL import Image
from werkzeug.utils import secure_filename
from datetime import datetime
from flask import current_app, url_for
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import random
from sqlalchemy import text


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
        file_stream.seek(0)
        header = file_stream.read(512)
        file_stream.seek(0)
        file_type = imghdr.what(None, header)
        
        if file_type not in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            return False, "Файл не является допустимым изображением"
        
        try:
            img = Image.open(file_stream)
            img.verify()
            file_stream.seek(0)
            
            if img.size[0] * img.size[1] > 178956970:
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
        if not file or not allowed_file(file.filename):
            return None, "Недопустимый формат файла"
        
        is_valid, error = validate_image(file.stream)
        if not is_valid:
            return None, error
        
        ext = file.filename.rsplit('.', 1)[1].lower()
        timestamp = int(datetime.utcnow().timestamp())
        filename = f"{secure_filename(username)}_{timestamp}.{ext}"
        
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        
        img = Image.open(file.stream)
        
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        
        data = list(img.getdata())
        image_without_exif = Image.new(img.mode, img.size)
        image_without_exif.putdata(data)
        
        image_without_exif.thumbnail((400, 400), Image.Resampling.LANCZOS)
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
    
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233b82f6'/%3E%3Ctext x='50' y='50' font-size='40' fill='white' text-anchor='middle' dy='.3em'%3E" + user.username[0].upper() + "%3C/text%3E%3C/svg%3E"


class RecommendationEngine:
    """
    AI-рекомендательная система на основе TF-IDF и cosine similarity
    """
    
    @staticmethod
    def get_recommended_posts(current_user, all_posts, mode='balanced'):
        """
        Получить рекомендованные посты
        
        Args:
            current_user: текущий пользователь
            all_posts: список всех постов
            mode: режим рекомендаций
                - 'interests': только на основе интересов
                - 'content': на основе контента постов
                - 'balanced': комбинированный (по умолчанию)
                - 'serendipity': случайные открытия
        
        Returns:
            список отсортированных постов
        """
        if not all_posts:
            return []
        
        # Режим случайных открытий
        if mode == 'serendipity':
            return RecommendationEngine._serendipity_mode(all_posts)
        
        # Если нет интересов, возвращаем в хронологическом порядке
        if not current_user.interests or not isinstance(current_user.interests, list):
            return all_posts
        
        # Подготовка данных
        user_interests_text = ' '.join(current_user.interests)
        post_contents = [post.content for post in all_posts]
        
        if mode == 'interests':
            return RecommendationEngine._interests_mode(
                user_interests_text, post_contents, all_posts
            )
        elif mode == 'content':
            return RecommendationEngine._content_mode(
                current_user, post_contents, all_posts
            )
        else:  # balanced
            return RecommendationEngine._balanced_mode(
                user_interests_text, post_contents, all_posts, current_user
            )
    
    @staticmethod
    def _interests_mode(user_interests_text, post_contents, all_posts):
        """Рекомендации только на основе интересов пользователя"""
        try:
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            vectors = vectorizer.fit_transform([user_interests_text] + post_contents)
            similarities = cosine_similarity(vectors[0:1], vectors[1:])[0]
            
            # Сортируем по similarity
            sorted_indices = np.argsort(similarities)[::-1]
            
            # Возвращаем посты с similarity > 0.05
            recommended = [
                all_posts[i] for i in sorted_indices 
                if similarities[i] > 0.05
            ]
            
            # Если ничего не подошло, возвращаем top 20% постов
            if not recommended:
                top_n = max(1, len(all_posts) // 5)
                return [all_posts[i] for i in sorted_indices[:top_n]]
            
            return recommended
            
        except Exception as e:
            current_app.logger.error(f"Ошибка в interests_mode: {e}")
            return all_posts
    
    @staticmethod
    def _content_mode(current_user, post_contents, all_posts):
        """Рекомендации на основе контента прочитанных постов"""
        # Получаем последние 10 постов пользователя как профиль
        user_posts = current_user.posts.order_by('created_at desc').limit(10).all()
        
        if not user_posts:
            return all_posts
        
        try:
            user_profile_text = ' '.join([p.content for p in user_posts])
            
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            vectors = vectorizer.fit_transform([user_profile_text] + post_contents)
            similarities = cosine_similarity(vectors[0:1], vectors[1:])[0]
            
            sorted_indices = np.argsort(similarities)[::-1]
            
            return [all_posts[i] for i in sorted_indices if similarities[i] > 0.1]
            
        except Exception as e:
            current_app.logger.error(f"Ошибка в content_mode: {e}")
            return all_posts
    
    @staticmethod
    def _balanced_mode(user_interests_text, post_contents, all_posts, current_user):
        """Комбинированный режим: интересы + контент + свежесть"""
        try:
            # 1. Рассчитываем similarity по интересам
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            vectors = vectorizer.fit_transform([user_interests_text] + post_contents)
            interest_similarities = cosine_similarity(vectors[0:1], vectors[1:])[0]
            
            # 2. Рассчитываем similarity по контенту пользователя
            user_posts = current_user.posts.order_by(text('created_at desc')).limit(10).all()
            content_similarities = np.zeros(len(all_posts))
            
            if user_posts:
                user_profile_text = ' '.join([p.content for p in user_posts])
                vectors2 = vectorizer.fit_transform([user_profile_text] + post_contents)
                content_similarities = cosine_similarity(vectors2[0:1], vectors2[1:])[0]
            
            # 3. Рассчитываем фактор свежести (экспоненциальный decay)
            now = datetime.utcnow()
            freshness_scores = []
            for post in all_posts:
                hours_old = (now - post.created_at).total_seconds() / 3600
                # Экспоненциальный decay: новые посты важнее
                freshness = np.exp(-hours_old / 24)  # decay за 24 часа
                freshness_scores.append(freshness)
            
            freshness_scores = np.array(freshness_scores)
            
            # 4. Комбинируем скоры (weighted sum)
            combined_scores = (
                0.4 * interest_similarities +  # 40% интересы
                0.3 * content_similarities +   # 30% контент
                0.3 * freshness_scores         # 30% свежесть
            )
            
            # 5. Сортируем по комбинированному скору
            sorted_indices = np.argsort(combined_scores)[::-1]
            
            # Возвращаем посты с минимальным порогом
            threshold = 0.1
            recommended = [
                all_posts[i] for i in sorted_indices 
                if combined_scores[i] > threshold
            ]
            
            if not recommended:
                return [all_posts[i] for i in sorted_indices[:len(all_posts)//2]]
            
            return recommended
            
        except Exception as e:
            current_app.logger.error(f"Ошибка в balanced_mode: {e}")
            return all_posts
    
    @staticmethod
    def _serendipity_mode(all_posts):
        """Режим случайных открытий - перемешиваем посты"""
        shuffled = list(all_posts)
        random.shuffle(shuffled)
        return shuffled
    
    @staticmethod
    def get_filter_bubbles(posts):
        """
        Группирует посты в 'фильтрующие пузыри' по схожести контента
        
        Returns:
            dict: {bubble_name: [posts]}
        """
        if not posts or len(posts) < 3:
            return {'all': posts}
        
        try:
            # TF-IDF векторизация
            vectorizer = TfidfVectorizer(
                max_features=50,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            post_contents = [p.content for p in posts]
            vectors = vectorizer.fit_transform(post_contents)
            
            # Простая кластеризация: similarity matrix
            similarity_matrix = cosine_similarity(vectors)
            
            # Группируем посты с similarity > 0.3
            bubbles = {}
            used_posts = set()
            bubble_id = 0
            
            for i in range(len(posts)):
                if i in used_posts:
                    continue
                
                # Находим похожие посты
                similar_indices = [
                    j for j in range(len(posts))
                    if similarity_matrix[i][j] > 0.3 and j not in used_posts
                ]
                
                if similar_indices:
                    bubble_name = f"Тема {bubble_id + 1}"
                    bubbles[bubble_name] = [posts[j] for j in similar_indices]
                    used_posts.update(similar_indices)
                    bubble_id += 1
            
            # Оставшиеся посты в отдельный пузырь
            remaining = [posts[i] for i in range(len(posts)) if i not in used_posts]
            if remaining:
                bubbles['Разное'] = remaining
            
            return bubbles if bubbles else {'all': posts}
            
        except Exception as e:
            current_app.logger.error(f"Ошибка в get_filter_bubbles: {e}")
            return {'all': posts}
