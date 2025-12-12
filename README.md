# Tonality

**A social music sharing platform** for people who obsess over playlists. Connect with friends, discover communities, vote on polls, and share what you're listening to.

## 🎵 Features

### Core Features
- **User Authentication**: Secure JWT-based auth with bcrypt password hashing
- **Spotify Integration**: OAuth 2.0 PKCE flow for Spotify account linking
- **Theme System**: Dark/Light/System adaptive themes with Spotify green accent

### Social Features
- **Friends**: Add/remove friends, see what they're listening to in real-time
- **Communities**: Join music communities (Indie Lovers, Lo-Fi Chill, etc.)
- **Polls**: Vote on community polls for best songs/albums
- **Listening Activity**: Share your current track with friends

### Privacy Controls
- Toggle online status visibility
- Control listening activity sharing
- Manage friend request permissions
- Account deletion option

## 🏗️ Architecture

Local dev has two parts:

1) **FastAPI Backend** (`backendScripts/`) + MySQL database
2) **Expo React Native App** (`Tonality/`)

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- Spotify Developer Account (for OAuth)

### Backend Setup (FastAPI)

1. **Install dependencies**

```bash
cd /Users/prashamsheth/Desktop/Tonality
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. **Configure environment**

```bash
cp backendScripts/.env.example backendScripts/.env
```

Edit `backendScripts/.env`:
```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@localhost:3306/tonality
JWT_SECRET_KEY=your-secret-key-change-in-production
```

3. **Setup database**

```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE tonality;"

# Run migrations and seed sample data
python3 -m backendScripts.seed_data
```

4. **Start the server**

```bash
uvicorn backendScripts.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `http://localhost:8000/api/`

### Frontend Setup (Expo)

1. **Install dependencies**

```bash
cd /Users/prashamsheth/Desktop/Tonality/Tonality
npm install
```

2. **Configure environment**

```bash
cp .env.example .env.local
```

Edit `Tonality/.env.local`:
```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:8000
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=exp://localhost:8081
```

**Note**: Use your machine's local IP (not `localhost`) so mobile devices can reach the backend.

3. **Start Expo**

```bash
npx expo start
```

Scan QR code with Expo Go app (iOS/Android) or press `w` for web.

## 📚 API Documentation

### Authentication
- `POST /api/register` - Create new account
- `POST /api/login` - Login with credentials
- `PUT /api/link_spotify` - Link Spotify account

### User Settings
- `GET /api/user/settings` - Get privacy settings
- `PUT /api/user/settings` - Update privacy settings
- `DELETE /api/user/account` - Delete account
- `POST /api/user/listening` - Update listening activity

### Friends
- `GET /api/friends` - Get friends list
- `POST /api/friends/{id}` - Add friend
- `DELETE /api/friends/{id}` - Remove friend
- `GET /api/friends/activity` - Get friends' listening activity

### Communities
- `GET /api/communities` - List all communities
- `GET /api/communities/my` - Get joined communities
- `POST /api/communities/{id}/join` - Join community

### Polls
- `GET /api/polls/active` - Get active polls
- `GET /api/polls/{id}` - Get poll details
- `POST /api/polls/{id}/vote` - Vote on poll

## 🗄️ Database Schema

### Users
- Profile info, Spotify tokens
- Privacy settings (online status, listening activity, friend requests)

### Friendships
- Bidirectional friend relationships

### Communities
- Music communities with member counts

### Polls & Votes
- Community polls with song options
- User votes tracking

### Listening Activity
- Real-time track sharing

## 🎨 Design System

**Color Palette**:
- Background: `#05060A` (Deep Black)
- Accent: `#1DB954` (Spotify Green)
- Surface: Context-aware grays

**Navigation**:
- Community → Friends → Home → Profile

## 🔒 Security

- Passwords hashed with bcrypt
- JWT tokens with configurable expiration
- CORS middleware for API protection
- Spotify OAuth 2.0 PKCE flow

## 📱 Mobile Support

Built with React Native + Expo for:
- iOS (Expo Go / TestFlight)
- Android (Expo Go / APK)
- Web (limited support)

## 🛠️ Tech Stack

**Backend**:
- FastAPI (Python)
- SQLModel/SQLAlchemy (ORM)
- MySQL (Database)
- PyJWT (Authentication)
- Passlib + Bcrypt (Password hashing)

**Frontend**:
- React Native + Expo
- Expo Router (File-based routing)
- TypeScript
- Expo AuthSession (OAuth)
- Expo SecureStore (Token storage)

## 📝 Development Notes

### Backend Structure
```
backendScripts/
├── __init__.py
├── main.py          # FastAPI app + endpoints
├── database.py      # SQLModel models + helpers
└── seed_data.py     # Sample data seeding
```

### Frontend Structure
```
Tonality/
├── app/
│   ├── (tabs)/      # Tab navigation screens
│   │   ├── community.tsx
│   │   ├── friends.tsx  
│   │   ├── index.tsx     # Home
│   │   └── profile.tsx
│   ├── index.tsx    # Auth/Login screen
│   └── _layout.tsx
├── context/         # Auth & Theme contexts
└── hooks/          # Spotify auth hooks
```

## 🐛 Troubleshooting

### Backend Issues

**MySQL Connection Failed**
- Ensure MySQL is running: `mysql.server start` (macOS) or `sudo systemctl start mysql` (Linux)
- Verify credentials in `backendScripts/.env`
- Check database exists: `mysql -u root -p -e "SHOW DATABASES;"`

**Import Errors**
- Activate virtual environment: `source .venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`

**Port Already in Use**
- Change port: `uvicorn backendScripts.main:app --port 8001`
- Or kill existing process: `lsof -ti:8000 | xargs kill -9`

### Frontend Issues

**Can't Connect to Backend**
- Use your local IP (not `localhost`) in `EXPO_PUBLIC_API_BASE_URL`
- Get IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
- Ensure phone and computer are on same WiFi network
- Check backend is running: `curl http://YOUR_IP:8000/api/`

**Spotify OAuth Fails**
- Add redirect URI to Spotify Dashboard
- Check console for exact redirect URI being used
- Format: `exp://localhost:8081` or `myapp://spotify-auth`

**Theme Not Working**
- Clear Expo cache: `npx expo start -c`
- Check `ThemeContext` is wrapping app in `_layout.tsx`

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make changes and test locally
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`

## 📄 License

This is a prototype project for educational purposes.

## 🎉 Acknowledgments

- Spotify Web API
- FastAPI framework
- Expo & React Native community
