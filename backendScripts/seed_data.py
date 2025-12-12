"""
Seed script to populate database with sample data for testing
Run this after the database is created to add sample communities and polls
"""
import os
from datetime import datetime, timedelta
from sqlmodel import Session
from backendScripts.database import (
    engine, Community, Poll, PollOption, 
    create_db_and_tables
)

def seed_communities():
    """Create sample communities"""
    communities = [
        Community(
            name="Indie Lovers",
            description="For fans of indie rock, indie pop, and alternative music",
            member_count=128,
            icon_name="musical-notes"
        ),
        Community(
            name="Lo-Fi Chill",
            description="Relaxing lo-fi beats and chill vibes",
            member_count=256,
            icon_name="headset"
        ),
        Community(
            name="Hip-Hop Heads",
            description="Classic and modern hip-hop discussion",
            member_count=342,
            icon_name="mic"
        ),
        Community(
            name="Electronic Music",
            description="EDM, house, techno, and electronic beats",
            member_count=189,
            icon_name="radio"
        ),
    ]
    return communities

def seed_polls(communities):
    """Create sample polls for communities"""
    # Find indie community
    indie_community = next((c for c in communities if c.name == "Indie Lovers"), None)
    
    if not indie_community:
        return []
    
    # Create a sample poll
    poll = Poll(
        community_id=indie_community.id,
        title="Best Indie Album of the Year?",
        description="Vote for your favorite indie album released this year!",
        ends_at=datetime.utcnow() + timedelta(days=3),
        is_active=True
    )
    
    return [poll]

def seed_poll_options(polls):
    """Create sample poll options"""
    if not polls:
        return []
    
    poll = polls[0]
    options = [
        PollOption(
            poll_id=poll.id,
            song_name="The Modern Age",
            artist_name="The Strokes",
            votes=24
        ),
        PollOption(
            poll_id=poll.id,
            song_name="Mr. Brightside",
            artist_name="The Killers",
            votes=31
        ),
        PollOption(
            poll_id=poll.id,
            song_name="Float On",
            artist_name="Modest Mouse",
            votes=18
        ),
        PollOption(
            poll_id=poll.id,
            song_name="Take Me Out",
            artist_name="Franz Ferdinand",
            votes=15
        ),
    ]
    return options

def run_seed():
    """Run all seed functions"""
    print("Creating database tables...")
    create_db_and_tables()
    
    with Session(engine) as session:
        print("Seeding communities...")
        communities = seed_communities()
        for community in communities:
            session.add(community)
        session.commit()
        
        # Refresh to get IDs
        for community in communities:
            session.refresh(community)
        
        print("Seeding polls...")
        polls = seed_polls(communities)
        for poll in polls:
            session.add(poll)
        session.commit()
        
        # Refresh to get poll IDs
        for poll in polls:
            session.refresh(poll)
        
        print("Seeding poll options...")
        options = seed_poll_options(polls)
        for option in options:
            session.add(option)
        session.commit()
        
        print("✅ Database seeded successfully!")
        print(f"Created {len(communities)} communities")
        print(f"Created {len(polls)} polls")
        print(f"Created {len(options)} poll options")

if __name__ == "__main__":
    run_seed()
