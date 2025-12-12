import os
from datetime import datetime, timedelta, timezone

from seed_data import run_seed

try:
    from dotenv import load_dotenv

    # Load .env from project root
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
except Exception:
    # dotenv is optional at runtime; env vars can be set by the shell/host.
    pass

from fastapi import Depends, FastAPI, HTTPException, status
import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from database import (
    add_user, create_db_and_tables, get_session, get_user_by_username,
    get_user_friends, add_friend, remove_friend,
    get_user_communities, get_all_communities, join_community,
    get_active_polls, get_poll_with_options, vote_on_poll,
    update_listening_activity, get_friends_listening_activity,
    Users, Community, Poll, PollOption
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


app = FastAPI()
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)
SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "dev-only-change-me",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


@app.on_event("startup")
def _startup() -> None:
    run_seed()

origins = [
    "http://localhost:19006",  # Expo web
    "http://localhost:5173",   # Vite (if you use it)
    "*",                       # or be permissive in dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # or ["*"] for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class registerData(BaseModel):
    username: str
    password: str

class SpotifyLinkBody(BaseModel):
    spotify_refresh_token: str

class UserSettingsUpdate(BaseModel):
    is_online: bool | None = None
    show_listening_activity: bool | None = None
    allow_friend_requests: bool | None = None

class ListeningActivityUpdate(BaseModel):
    track_name: str
    artist_name: str
    album_name: str | None = None
    album_image_url: str | None = None
    spotify_uri: str | None = None

class VoteRequest(BaseModel):
    option_id: int


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = get_user_by_username(session, username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found",
        )
    return user

@app.get("/api/")
async def read_root():
    return {"Hello": "World"}

@app.post("/api/register")
async def register(form_data: registerData, session=Depends(get_session)):
    print("Registering user:", form_data)
    existing_user = get_user_by_username(session, form_data.username)
    print("password:", form_data.password)
    hashed_password = pwd_context.hash(form_data.password)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists",
        )
    user = add_user(session, form_data.username, hashed_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed",
        )
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {"username": form_data.username, "access_token": access_token, "token_type": "bearer"}

@app.post("/api/login")
async def login(form_data: registerData, session = Depends(get_session),):
    user = get_user_by_username(session, form_data.username)
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )
    if not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )
    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    if user.spotify_refresh_token:
        return {"access_token": token, "token_type": "bearer", "spotify_refresh_token": user.spotify_refresh_token}
    return {"access_token": token, "token_type": "bearer"} #Spotify Refresh Token + User Access Token

@app.put("/api/link_spotify")
async def link_spotify(spotify_body: SpotifyLinkBody, session=Depends(get_session), token: str = Depends(oauth2_scheme), user=Depends(get_current_user)):
    user.spotify_refresh_token = spotify_body.spotify_refresh_token
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"message": "Spotify account linked successfully"}

# ============= User Settings & Privacy =============

@app.get("/api/user/settings")
async def get_user_settings(user=Depends(get_current_user)):
    """Get current user's privacy and status settings"""
    return {
        "is_online": user.is_online,
        "show_listening_activity": user.show_listening_activity,
        "allow_friend_requests": user.allow_friend_requests
    }

@app.put("/api/user/settings")
async def update_user_settings(settings: UserSettingsUpdate, session=Depends(get_session), user=Depends(get_current_user)):
    """Update user privacy and status settings"""
    if settings.is_online is not None:
        user.is_online = settings.is_online
    if settings.show_listening_activity is not None:
        user.show_listening_activity = settings.show_listening_activity
    if settings.allow_friend_requests is not None:
        user.allow_friend_requests = settings.allow_friend_requests
    
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"message": "Settings updated successfully"}

@app.delete("/api/user/account")
async def delete_account(session=Depends(get_session), user=Depends(get_current_user)):
    """Delete user account (placeholder - implement full cascade deletion)"""
    # TODO: Delete all user data including friendships, votes, etc.
    session.delete(user)
    session.commit()
    return {"message": "Account deleted successfully"}

# ============= Friends Management =============

@app.get("/api/users/search")
async def search_users(q: str, session=Depends(get_session), user=Depends(get_current_user)):
    """Search for users by username"""
    from sqlmodel import select
    from database import Users
    
    if len(q) < 2:
        return []
    
    # Search for users whose username contains the query (case-insensitive)
    statement = select(Users).where(Users.username.ilike(f"%{q}%")).where(Users.id != user.id)
    results = session.exec(statement).all()
    
    # Get current user's friend IDs to mark who is already a friend
    current_friends = get_user_friends(session, user.id)
    friend_ids = {f.id for f in current_friends}
    
    return [{
        "id": u.id,
        "username": u.username,
        "spotify_display_name": u.spotify_display_name,
        "spotify_profile_image_url": u.spotify_profile_image_url,
        "is_friend": u.id in friend_ids
    } for u in results[:10]]  # Limit to 10 results

@app.post("/api/friends/add-by-username")
async def add_friend_by_username(data: dict, session=Depends(get_session), user=Depends(get_current_user)):
    """Add a friend by username"""
    username = data.get("username", "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    # Find the user
    friend = get_user_by_username(session, username)
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    if friend.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
    
    # Check if already friends
    existing_friends = get_user_friends(session, user.id)
    if any(f.id == friend.id for f in existing_friends):
        raise HTTPException(status_code=400, detail="Already friends with this user")
    
    friendship = add_friend(session, user.id, friend.id)
    if not friendship:
        raise HTTPException(status_code=400, detail="Failed to add friend")
    
    return {"message": "Friend added successfully", "friend_id": friend.id}

@app.get("/api/friends")
async def get_friends(session=Depends(get_session), user=Depends(get_current_user)):
    """Get list of current user's friends"""
    friends = get_user_friends(session, user.id)
    return [{
        "id": friend.id,
        "username": friend.username,
        "is_online": friend.is_online,
        "spotify_display_name": friend.spotify_display_name,
        "spotify_profile_image_url": friend.spotify_profile_image_url
    } for friend in friends]

@app.post("/api/friends/{friend_id}")
async def add_friend_endpoint(friend_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Add a friend"""
    if friend_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
    
    friendship = add_friend(session, user.id, friend_id)
    if not friendship:
        raise HTTPException(status_code=400, detail="Failed to add friend")
    return {"message": "Friend added successfully"}

@app.delete("/api/friends/{friend_id}")
async def remove_friend_endpoint(friend_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Remove a friend"""
    success = remove_friend(session, user.id, friend_id)
    if not success:
        raise HTTPException(status_code=404, detail="Friendship not found")
    return {"message": "Friend removed successfully"}

@app.get("/api/friends/activity")
async def get_friends_activity(session=Depends(get_session), user=Depends(get_current_user)):
    """Get what friends are currently listening to"""
    activities = get_friends_listening_activity(session, user.id)
    return [{
        "user": {
            "id": item["user"].id,
            "username": item["user"].username,
            "spotify_display_name": item["user"].spotify_display_name,
            "spotify_profile_image_url": item["user"].spotify_profile_image_url,
            "is_online": item["user"].is_online
        },
        "activity": {
            "track_name": item["activity"].track_name,
            "artist_name": item["activity"].artist_name,
            "album_name": item["activity"].album_name,
            "album_image_url": item["activity"].album_image_url,
            "started_at": item["activity"].started_at.isoformat(),
            "updated_at": item["activity"].updated_at.isoformat()
        }
    } for item in activities]

@app.post("/api/user/listening")
async def update_listening(activity: ListeningActivityUpdate, session=Depends(get_session), user=Depends(get_current_user)):
    """Update what the user is currently listening to"""
    if not user.show_listening_activity:
        raise HTTPException(status_code=403, detail="Listening activity is disabled")
    
    updated = update_listening_activity(
        session, user.id,
        activity.track_name, activity.artist_name,
        activity.album_name, activity.album_image_url, activity.spotify_uri
    )
    return {"message": "Listening activity updated"}

# ============= Communities =============

@app.get("/api/communities")
async def get_communities(session=Depends(get_session)):
    """Get all available communities"""
    communities = get_all_communities(session)
    return [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "member_count": c.member_count,
        "icon_name": c.icon_name
    } for c in communities]

@app.get("/api/communities/my")
async def get_my_communities(session=Depends(get_session), user=Depends(get_current_user)):
    """Get communities the user has joined"""
    communities = get_user_communities(session, user.id)
    return [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "member_count": c.member_count,
        "icon_name": c.icon_name
    } for c in communities]

@app.post("/api/communities/{community_id}/join")
async def join_community_endpoint(community_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Join a community"""
    membership = join_community(session, user.id, community_id)
    if not membership:
        raise HTTPException(status_code=400, detail="Failed to join community")
    return {"message": "Joined community successfully"}

# ============= Polls =============

@app.get("/api/polls/active")
async def get_active_polls_endpoint(community_id: int | None = None, session=Depends(get_session)):
    """Get active polls, optionally filtered by community"""
    polls = get_active_polls(session, community_id)
    return [{
        "id": p.id,
        "community_id": p.community_id,
        "title": p.title,
        "description": p.description,
        "ends_at": p.ends_at.isoformat(),
        "is_active": p.is_active
    } for p in polls]

@app.get("/api/polls/{poll_id}")
async def get_poll(poll_id: int, session=Depends(get_session)):
    """Get a specific poll with its options"""
    poll_data = get_poll_with_options(session, poll_id)
    if not poll_data:
        raise HTTPException(status_code=404, detail="Poll not found")
    
    return {
        "poll": {
            "id": poll_data["poll"].id,
            "title": poll_data["poll"].title,
            "description": poll_data["poll"].description,
            "ends_at": poll_data["poll"].ends_at.isoformat()
        },
        "options": [{
            "id": opt.id,
            "song_name": opt.song_name,
            "artist_name": opt.artist_name,
            "votes": opt.votes
        } for opt in poll_data["options"]]
    }

@app.post("/api/polls/{poll_id}/vote")
async def vote_on_poll_endpoint(poll_id: int, vote_data: VoteRequest, session=Depends(get_session), user=Depends(get_current_user)):
    """Vote on a poll"""
    vote = vote_on_poll(session, user.id, poll_id, vote_data.option_id)
    if not vote:
        raise HTTPException(status_code=400, detail="Failed to vote")
    return {"message": "Vote recorded successfully"}




