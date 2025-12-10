from datetime import timedelta, timezone, datetime
from fastapi import FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
import jwt
from pwdlib import PasswordHash
from passlib.context import CryptContext
from pydantic import BaseModel
from database import add_user, get_user_by_email, get_session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


app = FastAPI()
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)
SECRET_KEY = "c4b0c92f3d173b5fc2ea9adcc7b8a4be4d85965a2f3d8b0c52ef76b49c2be7fd"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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
    email: str
    password: str
class SpotifyLinkBody(BaseModel):
    spotify_refresh_token: str

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
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = get_user_by_email(session, email)
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
    existing_user = get_user_by_email(session, form_data.email)
    print("password:", form_data.password)
    hashed_password = pwd_context.hash(form_data.password)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )
    user = add_user(session, form_data.email, hashed_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed",
        )
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {"email": form_data.email, "access_token": access_token, "token_type": "bearer"}

@app.post("/api/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session = Depends(get_session),):
    user = get_user_by_email(session, form_data.username)
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    if not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
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




