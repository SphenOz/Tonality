from typing import Annotated
from sqlmodel import SQLModel, Field, Session, create_engine, select
from sqlalchemy.exc import IntegrityError

class Users (SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    spotify_refresh_token: str
    username: str | None = Field(index=True, unique=True)
    password_hash: str

DATABASE_URL = "mysql+pymysql://root:2994@localhost:3306/tonality"
engine = create_engine(DATABASE_URL)

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
    except IntegrityError:
        session.rollback()
        return None  # or re-raise a custom error
    session.refresh(user)
    return user


create_db_and_tables()
