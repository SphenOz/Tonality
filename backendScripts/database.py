import os
from dotenv import load_dotenv
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Session, create_engine, select, Relationship
from sqlalchemy.exc import IntegrityError

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:2994@localhost:3306/tonality",
)
engine = create_engine(DATABASE_URL)

class Users (SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    spotify_refresh_token: str | None = Field(default=None)
    username: str | None = Field(index=True, unique=True)
    password_hash: str
    
    # Privacy & Status settings
    is_online: bool = Field(default=True)
    show_listening_activity: bool = Field(default=True)
    allow_friend_requests: bool = Field(default=True)
    
    # Spotify profile info
    spotify_display_name: str | None = Field(default=None)
    spotify_profile_image_url: str | None = Field(default=None)

class Friendship(SQLModel, table=True):
    """Represents a friend relationship between two users"""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    friend_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="accepted")  # pending, accepted, blocked

class Community(SQLModel, table=True):
    """Music communities that users can join"""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: str | None = Field(default=None)
    member_count: int = Field(default=0)
    icon_name: str = Field(default="musical-notes")  # Ionicons name
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CommunityMembership(SQLModel, table=True):
    """Links users to communities they've joined"""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    community_id: int = Field(foreign_key="community.id", index=True)
    joined_at: datetime = Field(default_factory=datetime.utcnow)

class Poll(SQLModel, table=True):
    """Community polls for voting on songs"""
    id: int | None = Field(default=None, primary_key=True)
    community_id: int = Field(foreign_key="community.id", index=True)
    title: str
    description: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ends_at: datetime
    is_active: bool = Field(default=True)

class PollOption(SQLModel, table=True):
    """Songs/options in a poll"""
    id: int | None = Field(default=None, primary_key=True)
    poll_id: int = Field(foreign_key="poll.id", index=True)
    song_name: str
    artist_name: str
    spotify_uri: str | None = Field(default=None)
    votes: int = Field(default=0)

class PollVote(SQLModel, table=True):
    """Track user votes on polls"""
    id: int | None = Field(default=None, primary_key=True)
    poll_id: int = Field(foreign_key="poll.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    option_id: int = Field(foreign_key="polloption.id", index=True)
    voted_at: datetime = Field(default_factory=datetime.utcnow)

class ListeningActivity(SQLModel, table=True):
    """Track what users are currently listening to"""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, unique=True)
    track_name: str
    artist_name: str
    album_name: str | None = Field(default=None)
    album_image_url: str | None = Field(default=None)
    spotify_uri: str | None = Field(default=None)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

def get_user_by_username(session: Session, username: str) -> Users | None:
    statement = select(Users).where(Users.username == username)
    results = session.exec(statement)
    return results.first()

def add_user(session: Session, username: str, password_hash: str) -> Users | None:
    user = Users(username=username, password_hash=password_hash)
    session.add(user)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        print(f"Error adding user: {e}")
        return None  # or re-raise a custom error
    session.refresh(user)
    return user

# Friends Management
def get_user_friends(session: Session, user_id: int):
    """Get all friends for a user"""
    statement = select(Friendship).where(Friendship.user_id == user_id, Friendship.status == "accepted")
    friendships = session.exec(statement).all()
    friend_ids = [f.friend_id for f in friendships]
    if not friend_ids:
        return []
    statement = select(Users).where(Users.id.in_(friend_ids))
    return session.exec(statement).all()

def add_friend(session: Session, user_id: int, friend_id: int) -> Friendship | None:
    """Create a friendship between two users"""
    friendship = Friendship(user_id=user_id, friend_id=friend_id)
    session.add(friendship)
    # Also add reverse friendship
    reverse = Friendship(user_id=friend_id, friend_id=user_id)
    session.add(reverse)
    try:
        session.commit()
        session.refresh(friendship)
        return friendship
    except IntegrityError:
        session.rollback()
        return None

def remove_friend(session: Session, user_id: int, friend_id: int) -> bool:
    """Remove friendship between two users"""
    statement = select(Friendship).where(
        Friendship.user_id == user_id, 
        Friendship.friend_id == friend_id
    )
    friendship = session.exec(statement).first()
    if friendship:
        session.delete(friendship)
        # Also remove reverse
        statement = select(Friendship).where(
            Friendship.user_id == friend_id, 
            Friendship.friend_id == user_id
        )
        reverse = session.exec(statement).first()
        if reverse:
            session.delete(reverse)
        session.commit()
        return True
    return False

# Communities Management
def get_user_communities(session: Session, user_id: int):
    """Get all communities a user has joined"""
    statement = select(CommunityMembership).where(CommunityMembership.user_id == user_id)
    memberships = session.exec(statement).all()
    community_ids = [m.community_id for m in memberships]
    if not community_ids:
        return []
    statement = select(Community).where(Community.id.in_(community_ids))
    return session.exec(statement).all()

def get_all_communities(session: Session):
    """Get all available communities"""
    statement = select(Community)
    return session.exec(statement).all()

def join_community(session: Session, user_id: int, community_id: int) -> CommunityMembership | None:
    """Add user to a community"""
    membership = CommunityMembership(user_id=user_id, community_id=community_id)
    session.add(membership)
    try:
        session.commit()
        # Increment member count
        statement = select(Community).where(Community.id == community_id)
        community = session.exec(statement).first()
        if community:
            community.member_count += 1
            session.add(community)
            session.commit()
        session.refresh(membership)
        return membership
    except IntegrityError:
        session.rollback()
        return None

def leave_community(session: Session, user_id: int, community_id: int) -> bool:
    """Remove user from a community"""
    statement = select(CommunityMembership).where(
        CommunityMembership.user_id == user_id,
        CommunityMembership.community_id == community_id
    )
    membership = session.exec(statement).first()
    if membership:
        session.delete(membership)
        # Decrement member count
        statement = select(Community).where(Community.id == community_id)
        community = session.exec(statement).first()
        if community:
            community.member_count = max(0, community.member_count - 1)
            session.add(community)
        session.commit()
        return True
    return False

# Polls Management
def get_active_polls(session: Session, community_id: int | None = None):
    """Get active polls, optionally filtered by community"""
    statement = select(Poll).where(Poll.is_active == True)
    if community_id:
        statement = statement.where(Poll.community_id == community_id)
    return session.exec(statement).all()

def get_poll_with_options(session: Session, poll_id: int):
    """Get a poll with its options"""
    poll = session.get(Poll, poll_id)
    if not poll:
        return None
    statement = select(PollOption).where(PollOption.poll_id == poll_id)
    options = session.exec(statement).all()
    return {"poll": poll, "options": options}

def vote_on_poll(session: Session, user_id: int, poll_id: int, option_id: int) -> PollVote | None:
    """Cast a vote on a poll option"""
    # Check if user already voted
    statement = select(PollVote).where(
        PollVote.user_id == user_id,
        PollVote.poll_id == poll_id
    )
    existing_vote = session.exec(statement).first()
    
    if existing_vote:
        # Update existing vote
        old_option = session.get(PollOption, existing_vote.option_id)
        if old_option:
            old_option.votes -= 1
            session.add(old_option)
        existing_vote.option_id = option_id
        session.add(existing_vote)
    else:
        # Create new vote
        vote = PollVote(user_id=user_id, poll_id=poll_id, option_id=option_id)
        session.add(vote)
        existing_vote = vote
    
    # Increment vote count on option
    option = session.get(PollOption, option_id)
    if option:
        option.votes += 1
        session.add(option)
    
    try:
        session.commit()
        session.refresh(existing_vote)
        return existing_vote
    except IntegrityError:
        session.rollback()
        return None

# Listening Activity
def update_listening_activity(session: Session, user_id: int, track_name: str, 
                              artist_name: str, album_name: str | None = None,
                              album_image_url: str | None = Field(default=None),
                              spotify_uri: str | None = Field(default=None)):
    """Update what a user is currently listening to"""
    statement = select(ListeningActivity).where(ListeningActivity.user_id == user_id)
    activity = session.exec(statement).first()
    
    if activity:
        activity.track_name = track_name
        activity.artist_name = artist_name
        activity.album_name = album_name
        activity.album_image_url = album_image_url
        activity.spotify_uri = spotify_uri
        activity.updated_at = datetime.utcnow()
    else:
        activity = ListeningActivity(
            user_id=user_id,
            track_name=track_name,
            artist_name=artist_name,
            album_name=album_name,
            album_image_url=album_image_url,
            spotify_uri=spotify_uri
        )
    
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity

def get_friends_listening_activity(session: Session, user_id: int):
    """Get what friends are currently listening to"""
    friends = get_user_friends(session, user_id)
    friend_ids = [f.id for f in friends]
    
    if not friend_ids:
        return []
    
    statement = select(ListeningActivity).where(ListeningActivity.user_id.in_(friend_ids))
    activities = session.exec(statement).all()
    
    # Join with user info
    result = []
    for activity in activities:
        statement = select(Users).where(Users.id == activity.user_id)
        user = session.exec(statement).first()
        if user and user.show_listening_activity:
            result.append({
                "user": user,
                "activity": activity
            })
    
    return result
