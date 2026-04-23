import random
from datetime import datetime, timedelta
from faker import Faker

from app import create_app
from models import db, User, Post, Board, Tag, MoodEnum, VisibilityEnum

fake = Faker()
app = create_app('development')

# ─────────────────────────────────────────────────────────────
# IMAGE POOLS
# ─────────────────────────────────────────────────────────────

UNSPLASH_BASE = [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    "https://images.unsplash.com/photo-1492724441997-5dc865305da7",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
    "https://images.unsplash.com/photo-1519125323398-675f0ddb6308",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b",
    "https://images.unsplash.com/photo-1520975928316-5f8b7b5a1b6a",
]

TAG_IMAGES = {
    "art": [
        "https://images.unsplash.com/photo-1547891654-e66ed7ebb968",
        "https://images.unsplash.com/photo-1526498460520-4c246339dccb",
    ],
    "travel": [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
    ],
    "food": [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
        "https://images.unsplash.com/photo-1551218808-94e220e084d2",
    ],
    "music": [
        "https://images.unsplash.com/photo-1511379938547-c1f69419868d",
        "https://images.unsplash.com/photo-1516280440614-37939bbacd81",
    ],
    "coding": [
        "https://images.unsplash.com/photo-1518770660439-4636190af475",
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c",
    ],
    "photo": [
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
    ],
}

MOODS = list(MoodEnum)

# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def random_image():
    base = random.choice(UNSPLASH_BASE)
    return base + "?auto=format&fit=crop&w=800&q=80"


def maybe_cover(tags, empty_prob=0.35):
    """
    35% досок без обложки
    """
    if random.random() < empty_prob:
        return None

    for t in tags:
        if t in TAG_IMAGES:
            return random.choice(TAG_IMAGES[t]) + "?auto=format&fit=crop&w=800&q=80"

    return random_image()


BOARD_THEMES = [
    ("Dreamscapes", ["art", "travel"]),
    ("Urban Stories", ["photo", "travel"]),
    ("Late Night Coding", ["coding"]),
    ("Food Diary", ["food"]),
    ("Sound Waves", ["music"]),
    ("Visual Poetry", ["art", "photo"]),
    ("Digital Nomads", ["travel", "coding"]),
    ("Street Moments", ["photo"]),
    ("Minimal Thoughts", ["art"]),
    ("Cafe Vibes", ["food", "music"]),
    ("Code & Coffee", ["coding", "food"]),
    ("City Lights", ["travel"]),
    ("Creative Flow", ["art", "music"]),
    ("Hidden Places", ["travel"]),
    ("Silent Frames", ["photo"]),
    ("Indie Mood", ["music"]),
    ("Dev Journal", ["coding"]),
    ("Taste Atlas", ["food"]),
    ("Abstract World", ["art"]),
    ("Weekend Escape", ["travel"]),
]

# ─────────────────────────────────────────────────────────────
# MAIN SEED
# ─────────────────────────────────────────────────────────────

def run():
    with app.app_context():
        print("🔥 SEED START")

        # ───────── USERS ─────────
        users = []
        for i in range(50):
            username = f"user_{i}"
            user = User.query.filter_by(username=username).first()

            if not user:
                user = User(
                    username=username,
                    email=f"{username}@test.com",
                    bio=fake.sentence(),
                )
                user.set_password("123456")
                db.session.add(user)

            users.append(user)

        db.session.flush()
        print("👥 users:", len(users))

        # ───────── TAGS ─────────
        tags_pool = ["art", "photo", "coding", "travel", "food", "music"]

        tag_objs = {}
        for t in tags_pool:
            tag = Tag.query.filter_by(name=t).first()
            if not tag:
                tag = Tag(name=t)
                db.session.add(tag)
            tag_objs[t] = tag

        db.session.flush()

        # ───────── POSTS ─────────
        posts = []
        for i in range(200):
            user = random.choice(users)

            post = Post(
                content=fake.text(),
                title=fake.sentence(),
                mood=random.choice(MOODS),
                visibility=VisibilityEnum.public,
                user_id=user.id,
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                image_url=random_image() if random.random() > 0.35 else None
            )

            post.tags = random.sample(list(tag_objs.values()), k=random.randint(1, 3))

            db.session.add(post)
            posts.append(post)

        db.session.flush()
        print("📝 posts:", len(posts))

        # ───────── BOARDS (existing + NEW 20 thematic) ─────────
        boards = []

        # старые доски
        for i in range(20):
            board = Board(
                name=fake.catch_phrase(),
                description=fake.text(max_nb_chars=120),
                tags=random.sample(tags_pool, k=3),
                is_public=True,
                creator_id=random.choice(users).id,
                cover_image=maybe_cover(random.sample(tags_pool, k=2)),
                post_count=0,
                followers_count=random.randint(0, 40),
            )
            db.session.add(board)
            boards.append(board)

        db.session.flush()

        # ───────── 20 THEMATIC BOARDS ─────────
        for _ in range(20):
            name, tags = random.choice(BOARD_THEMES)

            board = Board(
                name=f"{name} {fake.word().capitalize()}",
                description=fake.text(max_nb_chars=120),
                tags=tags,
                is_public=True,
                creator_id=random.choice(users).id,
                cover_image=maybe_cover(tags),
                post_count=0,
                followers_count=random.randint(0, 50),
            )

            db.session.add(board)
            boards.append(board)

        db.session.flush()
        print("📦 boards:", len(boards))

        # ───────── ASSIGN POSTS TO BOARDS ─────────
        for board in boards:
            amount = random.choice([0, 5, 10, 20, 50])
            selected = random.sample(posts, k=min(amount, len(posts)))

            for p in selected:
                p.board_id = board.id

            board.post_count = len(selected)

        # ───────── FOLLOWERS ─────────
        for board in boards:
            followers = random.sample(users, k=random.randint(0, 30))
            board.followers_count = len(followers)

        db.session.commit()

        print("✅ SEED DONE")


if __name__ == "__main__":
    run()