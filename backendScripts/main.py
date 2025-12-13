import os
import asyncio
import json
from datetime import datetime, timedelta, timezone

from backendScripts.seed_data import run_seed

_PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
_DOTENV_PATHS = [
    os.path.join(_PROJECT_ROOT, ".env"),
    os.path.join(_PROJECT_ROOT, "backendScripts", ".env"),
]


def _load_env_file_fallback(dotenv_path: str, *, override: bool = False) -> None:
    """Load KEY=VALUE pairs from a .env file into os.environ.

    This is a minimal fallback in case python-dotenv isn't installed.
    It will not override environment variables that are already set.
    """

    try:
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if not key:
                    continue
                if override:
                    os.environ[key] = value
                else:
                    os.environ.setdefault(key, value)
    except FileNotFoundError:
        return


try:
    from dotenv import load_dotenv

    # Load .env from project root; allow backendScripts/.env to override root .env
    for i, path in enumerate(_DOTENV_PATHS):
        if os.path.exists(path):
            load_dotenv(dotenv_path=path, override=True)
except Exception:
    # dotenv is optional at runtime; env vars can be set by the shell/host.
    for i, path in enumerate(_DOTENV_PATHS):
        _load_env_file_fallback(path, override=True)

from fastapi import Depends, FastAPI, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from typing import Annotated
import httpx
import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from backendScripts.database import (
    add_user, create_db_and_tables, get_session, get_user_by_username,
    get_user_friends, add_friend, remove_friend,
    get_user_communities, get_all_communities, join_community, leave_community,
    get_active_polls, get_poll_with_options, vote_on_poll,
    update_listening_activity, get_friends_listening_activity,
    Users, Community, Poll, PollOption, CommunityMembership, Friendship, ListeningActivity
)
from fastapi.middleware.cors import CORSMiddleware


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
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "5256000"))


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


BCRYPT_MAX_PASSWORD_BYTES = 72


def _validate_password_length(password: str) -> None:
    """bcrypt only uses the first 72 bytes of the password.

    passlib's bcrypt handler raises ValueError for longer secrets.
    """
    if len(password.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password too long (bcrypt max is 72 bytes). Use a shorter password.",
        )


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
    _validate_password_length(form_data.password)
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
    _validate_password_length(form_data.password)
    user = get_user_by_username(session, form_data.username)
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
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

@app.post("/api/disconnect_spotify")
async def disconnect_spotify(session=Depends(get_session), user=Depends(get_current_user)):
    """Disconnect Spotify account - clears refresh token and cached access tokens"""
    print(f"Disconnecting Spotify for user: {user.username} (id={user.id})")
    
    # Clear from cache
    if user.id in _access_token_cache:
        print(f"Removing user {user.id} from access_token_cache")
        del _access_token_cache[user.id]
    
    # Reload user from current session to ensure attachment and freshness
    db_user = session.get(Users, user.id)
    if not db_user:
        print(f"User {user.id} not found in session")
        raise HTTPException(status_code=404, detail="User not found")
        
    # Clear from database
    print(f"Clearing spotify_refresh_token for user {db_user.username}")
    db_user.spotify_refresh_token = None
    db_user.spotify_display_name = None
    db_user.spotify_profile_image_url = None
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    print(f"User {db_user.username} spotify_refresh_token is now: {db_user.spotify_refresh_token}")
    
    # Also clear any listening activity
    statement = select(ListeningActivity).where(ListeningActivity.user_id == user.id)
    activities = session.exec(statement).all()
    print(f"Deleting {len(activities)} listening activity records for user {user.username}")
    for activity in activities:
        session.delete(activity)
    session.commit()
    
    return {"message": "Spotify account disconnected successfully"}

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
    from backendScripts.database import Users
    
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

class FriendRequestByUsername(BaseModel):
    username: str

# ============= Friend Requests System =============

@app.post("/api/friends/request-by-username")
async def send_friend_request_by_username(data: FriendRequestByUsername, session=Depends(get_session), user=Depends(get_current_user)):
    """Send a friend request to another user by username"""
    username = data.username.strip().lstrip('@')  # Remove @ if present
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    # Find the target user
    target = get_user_by_username(session, username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if target allows friend requests
    if not target.allow_friend_requests:
        raise HTTPException(status_code=403, detail="User is not accepting friend requests")
    
    # Check if already friends or request pending
    statement = select(Friendship).where(
        Friendship.user_id == user.id,
        Friendship.friend_id == target.id
    )
    existing = session.exec(statement).first()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends with this user")
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Check if they already sent us a request
    statement = select(Friendship).where(
        Friendship.user_id == target.id,
        Friendship.friend_id == user.id,
        Friendship.status == "pending"
    )
    incoming = session.exec(statement).first()
    if incoming:
        raise HTTPException(status_code=400, detail="This user has already sent you a request. Accept it instead!")
    
    # Create pending friendship
    friendship = Friendship(user_id=user.id, friend_id=target.id, status="pending")
    session.add(friendship)
    session.commit()
    
    return {"message": "Friend request sent", "request_id": friendship.id, "user": {
        "id": target.id,
        "username": target.username,
        "spotify_display_name": target.spotify_display_name
    }}

@app.post("/api/friends/request/{user_id}")
async def send_friend_request(user_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Send a friend request to another user"""
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if target user exists
    target = session.get(Users, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if target allows friend requests
    if not target.allow_friend_requests:
        raise HTTPException(status_code=403, detail="User is not accepting friend requests")
    
    # Check if already friends or request pending
    statement = select(Friendship).where(
        Friendship.user_id == user.id,
        Friendship.friend_id == user_id
    )
    existing = session.exec(statement).first()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends with this user")
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Check if they already sent us a request
    statement = select(Friendship).where(
        Friendship.user_id == user_id,
        Friendship.friend_id == user.id,
        Friendship.status == "pending"
    )
    incoming = session.exec(statement).first()
    if incoming:
        raise HTTPException(status_code=400, detail="This user has already sent you a request. Accept it instead!")
    
    # Create pending friendship
    friendship = Friendship(user_id=user.id, friend_id=user_id, status="pending")
    session.add(friendship)
    session.commit()
    
    return {"message": "Friend request sent", "request_id": friendship.id}

@app.get("/api/friends/requests")
async def get_friend_requests(session=Depends(get_session), user=Depends(get_current_user)):
    """Get pending friend requests (both incoming and outgoing)"""
    # Incoming requests (others requesting to be our friend)
    statement = select(Friendship).where(
        Friendship.friend_id == user.id,
        Friendship.status == "pending"
    )
    incoming = session.exec(statement).all()
    
    # Outgoing requests (our pending requests)
    statement = select(Friendship).where(
        Friendship.user_id == user.id,
        Friendship.status == "pending"
    )
    outgoing = session.exec(statement).all()
    
    # Get user details
    incoming_details = []
    for req in incoming:
        sender = session.get(Users, req.user_id)
        if sender:
            incoming_details.append({
                "request_id": req.id,
                "user_id": sender.id,
                "username": sender.username,
                "spotify_display_name": sender.spotify_display_name,
                "spotify_profile_image_url": sender.spotify_profile_image_url,
                "created_at": req.created_at.isoformat()
            })
    
    outgoing_details = []
    for req in outgoing:
        recipient = session.get(Users, req.friend_id)
        if recipient:
            outgoing_details.append({
                "request_id": req.id,
                "user_id": recipient.id,
                "username": recipient.username,
                "spotify_display_name": recipient.spotify_display_name,
                "spotify_profile_image_url": recipient.spotify_profile_image_url,
                "created_at": req.created_at.isoformat()
            })
    
    return {
        "incoming": incoming_details,
        "outgoing": outgoing_details,
        "incoming_count": len(incoming_details)
    }

@app.get("/api/friends/requests/incoming")
async def get_incoming_requests(session=Depends(get_session), user=Depends(get_current_user)):
    """Get incoming friend requests"""
    statement = select(Friendship).where(
        Friendship.friend_id == user.id,
        Friendship.status == "pending"
    )
    requests = session.exec(statement).all()
    
    result = []
    for req in requests:
        sender = session.get(Users, req.user_id)
        if sender:
            result.append({
                "id": req.id,
                "from_user": {
                    "id": sender.id,
                    "username": sender.username,
                    "spotify_display_name": sender.spotify_display_name,
                    "spotify_profile_image_url": sender.spotify_profile_image_url
                },
                "created_at": req.created_at.isoformat()
            })
    return result

@app.get("/api/friends/requests/outgoing")
async def get_outgoing_requests(session=Depends(get_session), user=Depends(get_current_user)):
    """Get outgoing friend requests"""
    statement = select(Friendship).where(
        Friendship.user_id == user.id,
        Friendship.status == "pending"
    )
    requests = session.exec(statement).all()
    
    result = []
    for req in requests:
        recipient = session.get(Users, req.friend_id)
        if recipient:
            result.append({
                "id": req.id,
                "to_user": {
                    "id": recipient.id,
                    "username": recipient.username,
                    "spotify_display_name": recipient.spotify_display_name,
                    "spotify_profile_image_url": recipient.spotify_profile_image_url
                },
                "created_at": req.created_at.isoformat()
            })
    return result

@app.post("/api/friends/requests/{request_id}/accept")
async def accept_friend_request(request_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Accept a friend request"""
    # Find the request
    friendship = session.get(Friendship, request_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Check that this request is for us
    if friendship.friend_id != user.id:
        raise HTTPException(status_code=403, detail="This request is not for you")
    
    if friendship.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Accept the request
    friendship.status = "accepted"
    session.add(friendship)
    
    # Create reverse friendship
    reverse = Friendship(user_id=user.id, friend_id=friendship.user_id, status="accepted")
    session.add(reverse)
    session.commit()
    
    return {"message": "Friend request accepted"}

@app.post("/api/friends/requests/{request_id}/reject")
async def reject_friend_request(request_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Reject a friend request"""
    friendship = session.get(Friendship, request_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friendship.friend_id != user.id:
        raise HTTPException(status_code=403, detail="This request is not for you")
    
    if friendship.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Delete the request
    session.delete(friendship)
    session.commit()
    
    return {"message": "Friend request rejected"}

@app.delete("/api/friends/requests/{request_id}")
async def cancel_friend_request(request_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Cancel an outgoing friend request"""
    friendship = session.get(Friendship, request_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friendship.user_id != user.id:
        raise HTTPException(status_code=403, detail="This is not your request")
    
    if friendship.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    session.delete(friendship)
    session.commit()
    
    return {"message": "Friend request cancelled"}

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
    """Get all communities"""
    communities = session.exec(select(Community)).all()
    return communities

@app.get("/api/communities/my")
async def get_my_communities(session=Depends(get_session), user=Depends(get_current_user)):
    """Get communities the current user has joined"""
    communities = get_user_communities(session, user.id)
    return communities

@app.post("/api/communities/{community_id}/join")
async def join_community_endpoint(community_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Join a community"""
    community = session.get(Community, community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    # Check if already a member
    existing = session.exec(
        select(CommunityMembership).where(
            CommunityMembership.user_id == user.id,
            CommunityMembership.community_id == community_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member of this community")
    
    membership = join_community(session, user.id, community_id)
    return {"message": "Joined community successfully", "community_id": community_id}

@app.delete("/api/communities/{community_id}/leave")
async def leave_community_endpoint(community_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Leave a community"""
    success = leave_community(session, user.id, community_id)
    if not success:
        raise HTTPException(status_code=404, detail="Membership not found or not a member")
    return {"message": "Left community successfully"}

@app.get("/api/communities/{community_id}")
async def get_community(community_id: int, session=Depends(get_session)):
    """Get community details"""
    community = session.get(Community, community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community

@app.get("/api/communities/{community_id}/members")
async def get_community_members(community_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    """Get members of a community"""
    community = session.get(Community, community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    # Get all memberships
    statement = select(CommunityMembership).where(CommunityMembership.community_id == community_id)
    memberships = session.exec(statement).all()
    
    # Get user details
    members = []
    for m in memberships:
        member = session.get(Users, m.user_id)
        if member:
            # Check if this user is friend with current user
            is_friend = False
            if member.id != user.id:
                friend_check = session.exec(
                    select(Friendship).where(
                        Friendship.user_id == user.id,
                        Friendship.friend_id == member.id,
                        Friendship.status == "accepted"
                    )
                ).first()
                is_friend = friend_check is not None
            
            members.append({
                "id": member.id,
                "username": member.username,
                "spotify_display_name": member.spotify_display_name,
                "spotify_profile_image_url": member.spotify_profile_image_url,
                "is_online": member.is_online,
                "is_friend": is_friend,
                "is_self": member.id == user.id,
                "joined_at": m.joined_at.isoformat()
            })
    
    return {"members": members, "count": len(members)}

@app.get("/api/communities/{community_id}/top-songs")
async def get_community_top_songs(community_id: int, session=Depends(get_session)):
    """Get top songs in a community based on member listening activity"""
    # Get all memberships
    statement = select(CommunityMembership).where(CommunityMembership.community_id == community_id)
    memberships = session.exec(statement).all()
    member_ids = [m.user_id for m in memberships]
    
    if not member_ids:
        return {"songs": []}
    
    # Get listening activities of members
    statement = select(ListeningActivity).where(ListeningActivity.user_id.in_(member_ids))
    activities = session.exec(statement).all()
    
    # Aggregate songs by play count
    song_counts = {}
    for activity in activities:
        key = f"{activity.track_name}|{activity.artist_name}"
        if key not in song_counts:
            song_counts[key] = {
                "track_name": activity.track_name,
                "artist_name": activity.artist_name,
                "album_name": activity.album_name,
                "album_image_url": activity.album_image_url,
                "spotify_uri": activity.spotify_uri,
                "count": 0
            }
        song_counts[key]["count"] += 1
    
    # Sort by count and return top 5
    sorted_songs = sorted(song_counts.values(), key=lambda x: x["count"], reverse=True)
    return {"songs": sorted_songs[:5]}

# ============= User Profiles =============

@app.get("/api/users/{user_id}/profile")
async def get_user_profile(user_id: int, session=Depends(get_session), current_user=Depends(get_current_user)):
    """Get a user's public profile"""
    user = session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check friendship status
    is_friend = False
    pending_request = None
    if user_id != current_user.id:
        # Check if friends
        friend_check = session.exec(
            select(Friendship).where(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == user_id,
                Friendship.status == "accepted"
            )
        ).first()
        is_friend = friend_check is not None
        
        # Check for pending request
        pending_check = session.exec(
            select(Friendship).where(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == user_id,
                Friendship.status == "pending"
            )
        ).first()
        if pending_check:
            pending_request = "outgoing"
        else:
            incoming_check = session.exec(
                select(Friendship).where(
                    Friendship.user_id == user_id,
                    Friendship.friend_id == current_user.id,
                    Friendship.status == "pending"
                )
            ).first()
            if incoming_check:
                pending_request = "incoming"
    
    # Get listening activity if allowed
    listening_activity = None
    if user.show_listening_activity:
        activity = session.exec(
            select(ListeningActivity).where(ListeningActivity.user_id == user_id)
        ).first()
        if activity:
            listening_activity = {
                "track_name": activity.track_name,
                "artist_name": activity.artist_name,
                "album_name": activity.album_name,
                "album_image_url": activity.album_image_url,
                "spotify_uri": activity.spotify_uri
            }
    
    # Get communities this user is in
    statement = select(CommunityMembership).where(CommunityMembership.user_id == user_id)
    memberships = session.exec(statement).all()
    community_ids = [m.community_id for m in memberships]
    communities = []
    for cid in community_ids:
        community = session.get(Community, cid)
        if community:
            communities.append({
                "id": community.id,
                "name": community.name,
                "icon_name": community.icon_name
            })
    
    return {
        "id": user.id,
        "username": user.username,
        "spotify_display_name": user.spotify_display_name,
        "spotify_profile_image_url": user.spotify_profile_image_url,
        "is_online": user.is_online,
        "is_friend": is_friend,
        "is_self": user_id == current_user.id,
        "pending_request": pending_request,
        "allow_friend_requests": user.allow_friend_requests,
        "listening_activity": listening_activity,
        "communities": communities
    }

# ============= Spotify Data Helpers =============

def _get_spotify_client_credentials() -> tuple[str, str]:
    client_id = os.getenv("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "").strip()
    return client_id, client_secret

# Song of the Day persistence file path
_SONG_OF_DAY_CACHE_FILE = os.path.join(os.path.dirname(__file__), "song_of_day_cache.json")

def _load_song_of_day_cache() -> dict:
    """Load Song of the Day cache from file"""
    try:
        if os.path.exists(_SONG_OF_DAY_CACHE_FILE):
            with open(_SONG_OF_DAY_CACHE_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading song of day cache: {e}")
    return {"track": None, "date": None}

def _save_song_of_day_cache(cache: dict) -> None:
    """Save Song of the Day cache to file"""
    try:
        with open(_SONG_OF_DAY_CACHE_FILE, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        print(f"Error saving song of day cache: {e}")

# Global Song of the Day cache (same for all users) - loaded from file for persistence
_song_of_day_cache: dict = _load_song_of_day_cache()

async def get_spotify_client_credentials_token() -> str | None:
    """Get a Spotify access token using client credentials flow (no user auth needed)"""
    spotify_client_id, spotify_client_secret = _get_spotify_client_credentials()
    if not spotify_client_id or not spotify_client_secret:
        print("Warning: Spotify credentials not configured")
        return None
    
    import base64
    auth_header = base64.b64encode(f"{spotify_client_id}:{spotify_client_secret}".encode()).decode()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {auth_header}"
            }
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            print(f"Failed to get client credentials token: {response.status_code}")
            return None

@app.get("/api/song-of-day")
async def get_song_of_day():
    """
    Get the global Song of the Day - same for all users.
    Searches for popular tracks from various genres, cached for the entire day.
    """
    global _song_of_day_cache
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Return cached song if it's still today
    if _song_of_day_cache["date"] == today and _song_of_day_cache["track"]:
        return {"track": _song_of_day_cache["track"], "cached": True}
    
    # Fetch fresh song from Spotify Top 50 USA playlist
    access_token = await get_spotify_client_credentials_token()
    if not access_token:
        return {"track": None, "error": "Spotify credentials not configured"}
    
    # Use search API to find popular tracks (works with Client Credentials)
    # We'll search for a popular artist/genre and get their top tracks
    search_queries = [
        "genre:pop year:2024",
        "genre:hip-hop year:2024", 
        "genre:rock year:2024",
        "genre:electronic year:2024"
    ]
    
    # Use today's date to pick which genre to search
    import hashlib
    seed = int(hashlib.md5(today.encode()).hexdigest(), 16)
    query = search_queries[seed % len(search_queries)]
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/search",
            params={"q": query, "type": "track", "limit": 50, "market": "US"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            print(f"Failed to search for tracks: {response.status_code}")
            return {"track": None, "error": "Failed to fetch song of the day"}
        
        data = response.json()
        items = data.get("tracks", {}).get("items", [])
        
        if not items:
            return {"track": None, "error": "No tracks found"}
        
        # Pick a deterministic track based on today's date
        track_index = seed % len(items)
        track = items[track_index]
        
        if not track:
            return {"track": None, "error": "Invalid track data"}
        
        song_data = {
            "id": track["id"],
            "name": track["name"],
            "artist": track["artists"][0]["name"] if track.get("artists") else "Unknown",
            "album": track["album"]["name"] if track.get("album") else None,
            "album_image_url": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
            "spotify_uri": track["uri"],
            "preview_url": track.get("preview_url"),
        }
        
        # Cache for the day and persist to file
        _song_of_day_cache["track"] = song_data
        _song_of_day_cache["date"] = today
        _save_song_of_day_cache(_song_of_day_cache)
        
        return {"track": song_data, "cached": False}

# Global cache for access tokens: user_id -> (access_token, expiry_timestamp)
_access_token_cache = {}

async def get_spotify_access_token(refresh_token: str, user_id: int | None = None, session = None) -> str | None:
    """Exchange a refresh token for an access token.
    
    Uses in-memory caching to prevent excessive calls to Spotify.
    """
    # Check cache first if user_id is provided
    if user_id:
        cached = _access_token_cache.get(user_id)
        if cached:
            token, expiry = cached
            # Return cached token if it's valid (with 5 min buffer)
            if datetime.now().timestamp() < expiry - 300:
                return token

    spotify_client_id, _ = _get_spotify_client_credentials()
    if not spotify_client_id:
        print("Warning: Spotify Client ID not configured")
        return None
    
    # Prepare data for token refresh - PKCE flow only needs client_id, no client_secret
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": spotify_client_id,
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if response.status_code == 200:
            resp_data = response.json()
            access_token = resp_data.get("access_token")
            expires_in = resp_data.get("expires_in", 3600)
            
            # Cache the token
            if user_id and access_token:
                expiry = datetime.now().timestamp() + expires_in
                _access_token_cache[user_id] = (access_token, expiry)
            
            # If a new refresh token is returned, update it in DB
            new_refresh_token = resp_data.get("refresh_token")
            if new_refresh_token and user_id and session:
                try:
                    user = session.get(Users, user_id)
                    if user:
                        user.spotify_refresh_token = new_refresh_token
                        session.add(user)
                        session.commit()
                        print(f"Updated refresh token for user {user_id}")
                except Exception as e:
                    print(f"Error updating refresh token for user {user_id}: {e}")
            
            return access_token
        else:
            error_body = response.text
            print(f"Failed to refresh Spotify token: {response.status_code} - {error_body}")
            
            # Note: We do NOT auto-clear tokens here anymore to prevent race conditions
            # where parallel requests might cause one to fail and wipe the token.
            
            return None

@app.get("/api/users/{user_id}/top-tracks")
async def get_user_top_tracks(user_id: int, session=Depends(get_session), current_user=Depends(get_current_user)):
    """Get a user's top 5 tracks from Spotify"""
    user = session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.spotify_refresh_token:
        return {"tracks": [], "error": "User has not linked Spotify", "spotify_linked": False}
    
    access_token = await get_spotify_access_token(user.spotify_refresh_token, user_id, session)
    if not access_token:
        return {"tracks": [], "error": "Spotify access expired - please reconnect", "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/top/tracks",
            params={"limit": 5, "time_range": "short_term"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            return {"tracks": [], "error": f"Spotify API error: {response.status_code}"}
        
        data = response.json()
        tracks = []
        for item in data.get("items", []):
            tracks.append({
                "id": item["id"],
                "name": item["name"],
                "artist": item["artists"][0]["name"] if item["artists"] else "Unknown",
                "album": item["album"]["name"] if item.get("album") else None,
                "album_image_url": item["album"]["images"][0]["url"] if item.get("album", {}).get("images") else None,
                "spotify_uri": item["uri"]
            })
        
        return {"tracks": tracks}

@app.get("/api/users/{user_id}/top-genres")
async def get_user_top_genres(user_id: int, session=Depends(get_session), current_user=Depends(get_current_user)):
    """Get a user's top 3 genres from Spotify (based on top artists)"""
    user = session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.spotify_refresh_token:
        return {"genres": [], "error": "User has not linked Spotify", "spotify_linked": False}
    
    access_token = await get_spotify_access_token(user.spotify_refresh_token, user_id, session)
    if not access_token:
        return {"genres": [], "error": "Spotify access expired - please reconnect", "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/top/artists",
            params={"limit": 10, "time_range": "medium_term"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            return {"genres": [], "error": f"Spotify API error: {response.status_code}"}
        
        data = response.json()
        genre_counts: dict[str, int] = {}
        
        for artist in data.get("items", []):
            for genre in artist.get("genres", []):
                genre_counts[genre] = genre_counts.get(genre, 0) + 1
        
        # Sort by count and take top 3
        sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)
        top_genres = [g[0] for g in sorted_genres[:3]]
        
        return {"genres": top_genres}

# ============= Spotify Recommendations =============

@app.get("/api/spotify/recommendations")
async def get_spotify_recommendations(session=Depends(get_session), user=Depends(get_current_user)):
    """Get personalized song recommendations from Spotify based on user's top tracks"""
    if not user.spotify_refresh_token:
        return {"tracks": [], "error": "User has not linked Spotify", "spotify_linked": False}
    
    access_token = await get_spotify_access_token(user.spotify_refresh_token, user.id, session)
    if not access_token:
        return {"tracks": [], "error": "Spotify access expired - please reconnect", "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        # First get user's top tracks for seeds
        top_response = await client.get(
            "https://api.spotify.com/v1/me/top/tracks",
            params={"limit": 5, "time_range": "short_term"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        seed_tracks = []
        if top_response.status_code == 200:
            top_data = top_response.json()
            seed_tracks = [t["id"] for t in top_data.get("items", [])[:5]]
        
        if not seed_tracks:
            # Fallback to popular genres if no top tracks
            return {"tracks": [], "error": "No listening history for recommendations"}
        
        # Get recommendations based on seed tracks
        rec_response = await client.get(
            "https://api.spotify.com/v1/recommendations",
            params={
                "seed_tracks": ",".join(seed_tracks[:5]),
                "limit": 10,
                "market": "US"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if rec_response.status_code != 200:
            return {"tracks": [], "error": f"Spotify API error: {rec_response.status_code}"}
        
        rec_data = rec_response.json()
        tracks = []
        for track in rec_data.get("tracks", []):
            tracks.append({
                "id": track["id"],
                "name": track["name"],
                "artist": track["artists"][0]["name"] if track["artists"] else "Unknown",
                "album": track["album"]["name"] if track.get("album") else None,
                "album_image_url": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                "spotify_uri": track["uri"],
                "preview_url": track.get("preview_url")
            })
        
        return {"tracks": tracks}

@app.get("/api/spotify/genre-tracks")
async def get_genre_tracks(session=Depends(get_session), user=Depends(get_current_user)):
    """Get popular tracks organized by user's top genres"""
    if not user.spotify_refresh_token:
        return {"genres": [], "error": "User has not linked Spotify", "spotify_linked": False}
    
    access_token = await get_spotify_access_token(user.spotify_refresh_token, user.id, session)
    if not access_token:
        return {"genres": [], "error": "Spotify access expired - please reconnect", "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        # Get user's top artists to determine genres
        artists_response = await client.get(
            "https://api.spotify.com/v1/me/top/artists",
            params={"limit": 20, "time_range": "medium_term"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if artists_response.status_code != 200:
            return {"genres": [], "error": f"Spotify API error: {artists_response.status_code}"}
        
        artists_data = artists_response.json()
        
        # Count genres
        genre_counts: dict[str, int] = {}
        for artist in artists_data.get("items", []):
            for genre in artist.get("genres", []):
                genre_counts[genre] = genre_counts.get(genre, 0) + 1
        
        # Get top 3 genres
        sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        result_genres = []
        for genre_name, _ in sorted_genres:
            # Search for tracks in this genre
            search_response = await client.get(
                "https://api.spotify.com/v1/search",
                params={
                    "q": f"genre:{genre_name}",
                    "type": "track",
                    "limit": 5,
                    "market": "US"
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if search_response.status_code == 200:
                search_data = search_response.json()
                tracks = []
                for track in search_data.get("tracks", {}).get("items", []):
                    tracks.append({
                        "id": track["id"],
                        "name": track["name"],
                        "artist": track["artists"][0]["name"] if track["artists"] else "Unknown",
                        "album_image_url": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                        "spotify_uri": track["uri"]
                    })
                
                result_genres.append({
                    "genre": genre_name.title(),
                    "tracks": tracks
                })
        
        return {"genres": result_genres}

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

# ============= Admin / System =============

@app.post("/api/polls/generate")
async def generate_weekly_polls(
    session: Session = Depends(get_session),
    token: str = Depends(oauth2_scheme)
):
    """Generate weekly polls based on Spotify data (using user's token)"""
    genres = ["pop", "rock", "hip-hop", "indie", "r-n-b"]
    
    async with httpx.AsyncClient() as client:
        for genre in genres:
            # 1. Search for tracks in this genre
            try:
                response = await client.get(
                    "https://api.spotify.com/v1/search",
                    params={
                        "q": f"genre:{genre}",
                        "type": "track",
                        "limit": 5,
                        "market": "US"
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code != 200:
                    print(f"Failed to fetch for {genre}: {response.status_code}")
                    continue
                    
                data = response.json()
                tracks = data.get("tracks", {}).get("items", [])
                
                if not tracks:
                    continue
                    
                # 2. Find or create a community for this genre
                statement = select(Community).where(Community.name.ilike(f"%{genre}%"))
                community = session.exec(statement).first()
                
                if not community:
                    # Create a new community for this genre
                    community = Community(
                        name=f"{genre.capitalize()} Fans",
                        description=f"The place for {genre} lovers.",
                        icon_name="musical-notes"
                    )
                    session.add(community)
                    session.commit()
                    session.refresh(community)
                
                # 3. Deactivate old polls for this community
                statement = select(Poll).where(
                    Poll.community_id == community.id,
                    Poll.is_active == True
                )
                old_polls = session.exec(statement).all()
                for p in old_polls:
                    p.is_active = False
                    session.add(p)
                
                # 4. Create new poll
                new_poll = Poll(
                    community_id=community.id,
                    title=f"Weekly {genre.capitalize()} Top Picks",
                    description=f"Vote for your favorite {genre} track of the week!",
                    ends_at=datetime.utcnow() + timedelta(days=7),
                    is_active=True
                )
                session.add(new_poll)
                session.commit()
                session.refresh(new_poll)
                
                # 5. Add options
                for track in tracks:
                    option = PollOption(
                        poll_id=new_poll.id,
                        song_name=track["name"],
                        artist_name=track["artists"][0]["name"],
                        spotify_uri=track["uri"]
                    )
                    session.add(option)
                
                session.commit()
                
            except Exception as e:
                print(f"Error generating poll for {genre}: {e}")
                continue
            
    return {"message": "Polls generated successfully"}

# ============= Recent Listening & Mutual Songs =============

@app.get("/api/users/{user_id}/recent-tracks")
async def get_user_recent_tracks(user_id: int, session=Depends(get_session), current_user=Depends(get_current_user)):
    """Get a user's recently played tracks from Spotify (past week)"""
    user = session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check friendship for privacy
    is_friend = False
    if user_id != current_user.id:
        friend_check = session.exec(
            select(Friendship).where(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == user_id,
                Friendship.status == "accepted"
            )
        ).first()
        is_friend = friend_check is not None
    
    is_self = user_id == current_user.id
    
    # Only friends or self can see recent tracks
    if not is_self and not is_friend:
        return {"tracks": [], "error": "You must be friends to see recent tracks"}
    
    if not user.spotify_refresh_token:
        return {"tracks": [], "error": "User has not linked Spotify", "spotify_linked": False}
    
    access_token = await get_spotify_access_token(user.spotify_refresh_token, user_id, session)
    if not access_token:
        print(f"Failed to get Spotify access token for user {user_id} in recent-tracks")
        return {"tracks": [], "error": "Spotify access expired - please reconnect", "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/player/recently-played",
            params={"limit": 50},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            return {"tracks": [], "error": f"Spotify API error: {response.status_code}"}
        
        data = response.json()
        tracks = []
        seen_ids = set()  # Dedupe by track ID
        
        for item in data.get("items", []):
            track = item.get("track", {})
            if track["id"] in seen_ids:
                continue
            seen_ids.add(track["id"])
            
            tracks.append({
                "id": track["id"],
                "name": track["name"],
                "artist": track["artists"][0]["name"] if track["artists"] else "Unknown",
                "album": track["album"]["name"] if track.get("album") else None,
                "album_image_url": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                "spotify_uri": track["uri"],
                "played_at": item.get("played_at")
            })
        
        return {"tracks": tracks, "spotify_linked": True}

@app.get("/api/users/{user_id}/mutual-songs")
async def get_mutual_songs(user_id: int, session=Depends(get_session), current_user=Depends(get_current_user)):
    """Get mutual recently played songs between current user and another user"""
    if user_id == current_user.id:
        return {"mutual_tracks": [], "error": "Cannot compare with yourself"}
    
    user = session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check friendship
    friend_check = session.exec(
        select(Friendship).where(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == user_id,
            Friendship.status == "accepted"
        )
    ).first()
    
    if not friend_check:
        return {"mutual_tracks": [], "error": "You must be friends to compare listening"}
    
    # Check both users have Spotify linked
    if not current_user.spotify_refresh_token:
        return {"mutual_tracks": [], "error": "You haven't linked your Spotify", "spotify_linked": False}
    
    if not user.spotify_refresh_token:
        return {"mutual_tracks": [], "error": "Friend hasn't linked their Spotify", "spotify_linked": False}
    
    # Get both users' access tokens
    my_token = await get_spotify_access_token(current_user.spotify_refresh_token, current_user.id, session)
    their_token = await get_spotify_access_token(user.spotify_refresh_token, user_id, session)
    
    if not my_token or not their_token:
        error_msg = "Your Spotify access expired" if not my_token else "Friend's Spotify access expired"
        return {"mutual_tracks": [], "error": error_msg, "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        # Fetch both users' recently played tracks
        my_response, their_response = await asyncio.gather(
            client.get(
                "https://api.spotify.com/v1/me/player/recently-played",
                params={"limit": 50},
                headers={"Authorization": f"Bearer {my_token}"}
            ),
            client.get(
                "https://api.spotify.com/v1/me/player/recently-played",
                params={"limit": 50},
                headers={"Authorization": f"Bearer {their_token}"}
            )
        )
        
        if my_response.status_code != 200 or their_response.status_code != 200:
            return {"mutual_tracks": [], "error": "Failed to fetch listening history"}
        
        my_data = my_response.json()
        their_data = their_response.json()
        
        # Build set of my track IDs
        my_track_ids = set()
        my_tracks_map = {}
        for item in my_data.get("items", []):
            track = item.get("track", {})
            my_track_ids.add(track["id"])
            my_tracks_map[track["id"]] = track
        
        # Find mutual tracks
        mutual_tracks = []
        seen_ids = set()
        for item in their_data.get("items", []):
            track = item.get("track", {})
            if track["id"] in my_track_ids and track["id"] not in seen_ids:
                seen_ids.add(track["id"])
                mutual_tracks.append({
                    "id": track["id"],
                    "name": track["name"],
                    "artist": track["artists"][0]["name"] if track["artists"] else "Unknown",
                    "album": track["album"]["name"] if track.get("album") else None,
                    "album_image_url": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                    "spotify_uri": track["uri"]
                })
        
        return {"mutual_tracks": mutual_tracks}

@app.get("/api/users/{user_id}/currently-playing")
async def get_user_currently_playing(user_id: int, session=Depends(get_session), current_user=Depends(get_current_user)):
    """Get what a user is currently playing on Spotify"""
    user = session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user allows showing listening activity
    if not user.show_listening_activity:
        return {"is_playing": False, "message": "User has disabled listening activity"}
    
    if not user.spotify_refresh_token:
        return {"is_playing": False, "spotify_linked": False}
    
    access_token = await get_spotify_access_token(user.spotify_refresh_token, user_id, session)
    if not access_token:
        return {"is_playing": False, "error": "Spotify access expired", "spotify_linked": False}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code == 204:
            # Not playing anything
            return {"is_playing": False}
        
        if response.status_code != 200:
            return {"is_playing": False, "error": f"Spotify API error: {response.status_code}"}
        
        data = response.json()
        
        if not data.get("is_playing"):
            return {"is_playing": False}
        
        track = data.get("item", {})
        if not track:
            return {"is_playing": False}
        
        return {
            "is_playing": True,
            "track": {
                "id": track.get("id"),
                "name": track.get("name"),
                "artist": track["artists"][0]["name"] if track.get("artists") else "Unknown",
                "album": track["album"]["name"] if track.get("album") else None,
                "album_image_url": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                "spotify_uri": track.get("uri"),
                "progress_ms": data.get("progress_ms"),
                "duration_ms": track.get("duration_ms")
            }
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)




