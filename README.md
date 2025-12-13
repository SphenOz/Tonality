# Tonality

**A social music ecosystem** that bridges your listening habits with your social circle. Tonality extends your Spotify experience by adding a layer of community interaction, allowing you to connect with friends, join genre-based communities, and discover music through social signals rather than just algorithms.

## 🏗️ System Architecture

Tonality is built as a modern, distributed mobile application with a clear separation of concerns:

### 📱 Frontend (Mobile App)
Built with **React Native** and **Expo**, providing a native experience on both iOS and Android.
- **Navigation**: Uses file-based routing with `expo-router`.
- **State Management**: React Context API for global state (Authentication, Theme, Spotify Session).
- **UI/UX**: Custom design system with adaptive theming (Light/Dark/System) and safe-area handling.

### ⚡ Backend (API)
Powered by **FastAPI (Python)**, chosen for its high performance and native async support.
- **API Layer**: RESTful endpoints serving the mobile client.
- **Spotify Proxy**: Handles complex Spotify interactions, token management, and caching to optimize rate limits.
- **Business Logic**: Manages social graphs (friendships), community interactions, and recommendation algorithms.

### 💾 Data Layer
- **Database**: **SQLModel** (combining SQLAlchemy and Pydantic) provides a robust ORM layer.
  - Currently configured for **SQLite** for easy local development (zero-config).
  - Scalable to **MySQL/PostgreSQL** for production.
- **Data Models**:
  - *Users & Auth*: Secure credential storage and Spotify token management.
  - *Social Graph*: Bidirectional friendships and friend requests.
  - *Communities*: Groups, memberships, and active polls.
  - *Activity*: Real-time listening history and caching.

## 🎵 Key Features

### 🤝 Social Discovery
- **Real-time Activity**: See what your friends are listening to right now.
- **Friend Management**: Send and accept friend requests to build your circle.
- **Profile Insights**: View your friends' top artists and listening habits.

### 🌍 Communities & Engagement
- **Genre Communities**: Join groups like "Indie Lovers", "Hip Hop Heads", or "Lo-Fi Chill".
- **Interactive Polls**: Vote on "Song of the Week" or "Best New Album" within communities.
- **Discussion**: Connect with users who share your specific music taste.

### 🎧 Enhanced Music Experience
- **Smart Recommendations**:
  - *For Everyone*: Trending tracks across popular genres.
  - *For You*: Personalized recommendations based on your short, medium, and long-term listening history.
  - *Fallback System*: Intelligent fallbacks ensure you always get music suggestions, even with a new account.
- **Spotify Integration**: Seamlessly link your account to sync data and control playback.

### 🔒 Privacy & Control
- **Granular Privacy**: Toggle your online status and listening activity visibility.
- **Data Control**: Full control over your account data and Spotify connection.
- **Secure Auth**: Industry-standard JWT authentication and bcrypt password hashing.

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Spotify Developer Account (for OAuth)

### Backend Setup (FastAPI)

1. **Install dependencies**

```bash
cd Tonality
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. **Start the server**

```bash
# The server will automatically create the SQLite database and seed it with initial data
python3 -m backendScripts.main
```

Health check: `http://localhost:8000/docs`

### Frontend Setup (Expo)

1. **Install dependencies**

```bash
cd Tonality/Tonality
npm install
```

2. **Start the app**

```bash
npx expo start
```

3. **Connect**: Scan the QR code with Expo Go (Android) or Camera (iOS).

---

*Built with ❤️ for music lovers.*

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
