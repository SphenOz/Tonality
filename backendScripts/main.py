from datetime import timedelta, timezone, datetime
from fastapi import FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
import jwt
from pwdlib import PasswordHash
from database import add_user, get_user_by_username, get_session

app = FastAPI()
SECRET_KEY = "c4b0c92f3d173b5fc2ea9adcc7b8a4be4d85965a2f3d8b0c52ef76b49c2be7fd"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class registerData:
    username: str
    password: str

@app.get("/")
async def read_root():
    return {"Hello": "World"}

@app.post("/register")
async def register(form_data: registerData = Depends(), session=Depends(get_session)):
    existing_user = get_user_by_username(session, form_data.username)
    if existing_user:
        return {"error": "User already exists"}
    hashed_password = PasswordHash.hash(form_data.password)
    user = add_user(session, form_data.username, hashed_password)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed",
        )
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"username": form_data.username, "access_token": access_token, "token_type": "bearer"}

@app.get("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if authenticate_user(form_data.username, form_data.password):
        return {"access_token": form_data.username, "token_type": "bearer"} #Spotify Refresh Token + User Access Token

def authenticate_user(username: str, password: str, session = Depends(get_session)):
    user = get_user_by_username(session, username)
    if not user:
        return False
    if not PasswordHash.verify(password, user.password_hash):
        return False
    return True

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt