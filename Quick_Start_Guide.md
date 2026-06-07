# Social Media Platform - Quick Start Guide

## 🚀 5-Minute Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional)

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/yourusername/social-media-ai.git
cd social-media-ai

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your credentials
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:password@localhost/social_media
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

### Step 2: Database Setup

```bash
# Create database
createdb social_media

# Run migrations
npm run migrate

# Seed sample data
npm run seed
```

### Step 3: Start Services

```bash
# Option A: Docker Compose (recommended)
docker-compose up -d

# Option B: Manual
# Terminal 1: PostgreSQL
psql social_media

# Terminal 2: Redis
redis-server

# Terminal 3: Backend
cd backend
npm run dev

# Terminal 4: Frontend
cd frontend
npm run dev
```

### Step 4: Access the App

- Frontend: http://localhost:3000
- API Docs: http://localhost:5000/api/docs
- Admin Panel: http://localhost:3000/admin

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (React)                         │
│  ┌──────────────────────────────────────────────────────────────┐
│  │ Feed | Profile | Notifications | AI Assistant              │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
        ┌───────────▼────────┐  ┌───▼──────────────┐
        │  REST API          │  │  WebSocket       │
        │  (Express)         │  │  (Socket.io)     │
        │  Port: 5000        │  │  Port: 5001      │
        └───────────┬────────┘  └───┬──────────────┘
                    │                │
        ┌───────────┴────────────────┴──────────┐
        │                                        │
   ┌────▼──────┐  ┌──────────┐  ┌────────────┐
   │ PostgreSQL│  │  Redis   │  │  S3/CDN    │
   │  (Main DB)│  │ (Cache)  │  │  (Files)   │
   └────┬──────┘  └──────────┘  └────────────┘
        │
   ┌────▼──────────────────────────────────────┐
   │  Background Jobs (Bull Queue)              │
   │  - Content Moderation                     │
   │  - Recommendations                        │
   │  - Trend Analysis                         │
   │  - Notifications                          │
   └────┬──────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────┐
   │  AI Agent (Claude API)                     │
   │  - Smart content analysis                 │
   │  - Personalized recommendations           │
   │  - Safety monitoring                      │
   │  - Trend detection                        │
   └────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
social-media-ai/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js          # Authentication endpoints
│   │   │   ├── posts.js         # Post CRUD
│   │   │   ├── comments.js      # Comments
│   │   │   ├── users.js         # User profiles
│   │   │   ├── feed.js          # Feed generation
│   │   │   ├── notifications.js # Notifications
│   │   │   └── ai.js            # AI agent endpoints
│   │   ├── services/
│   │   │   ├── aiClient.js      # Claude API wrapper
│   │   │   ├── contentModeration.js
│   │   │   ├── recommendations.js
│   │   │   ├── smartReplies.js
│   │   │   ├── trendAnalysis.js
│   │   │   ├── userSafety.js
│   │   │   ├── database.js
│   │   │   ├── cache.js
│   │   │   └── queue.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── errorHandler.js
│   │   │   ├── validation.js
│   │   │   └── rateLimit.js
│   │   ├── models/
│   │   │   └── schemas.js
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── email.js
│   │   │   └── validators.js
│   │   └── app.js              # Express app
│   ├── migrations/             # Database migrations
│   ├── seeds/                  # Sample data
│   ├── tests/                  # Unit & integration tests
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Feed.jsx
│   │   │   ├── Post.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Notifications.jsx
│   │   │   ├── AIPanel.jsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useFeed.js
│   │   │   ├── useSocket.js
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── api.js         # API client
│   │   │   └── websocket.js   # WebSocket client
│   │   ├── store/             # State management
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

## 🔧 Configuration Examples

### PostgreSQL Connection

```javascript
// backend/src/services/database.js
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
```

### Redis Connection

```javascript
// backend/src/services/cache.js
import redis from 'redis';

const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

client.on('error', (err) => console.log('Redis Error:', err));

await client.connect();

export default client;
```

### WebSocket Setup

```javascript
// backend/src/app.js
import { Server } from 'socket.io';

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT token
  next();
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
```

---

## 🧪 Testing

### Unit Tests

```bash
# Backend
cd backend
npm run test

# Frontend
cd ../frontend
npm run test
```

### Integration Tests

```bash
# Test API endpoints
npm run test:integration

# Test real-time features
npm run test:websocket
```

### Load Testing

```bash
# Test with 1000 concurrent users
npm run test:load
```

---

## 📈 Performance Monitoring

### Access Monitoring Dashboard

```
http://localhost:3000/admin/metrics
```

### Key Metrics to Monitor

| Metric | Target | Tool |
|--------|--------|------|
| API Response Time | <200ms | Datadog |
| Database Query Time | <100ms | pgAdmin |
| Real-time Latency | <500ms | Socket.io |
| Page Load Time | <2s | Lighthouse |
| Uptime | 99.9% | Uptime Robot |

---

## 🔐 Security Checklist

- [ ] Enable HTTPS/TLS
- [ ] Set secure JWT secrets
- [ ] Enable CORS properly
- [ ] Rate limiting enabled
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens configured
- [ ] Password hashing (bcrypt)
- [ ] Database backups scheduled
- [ ] API key rotation
- [ ] Environment variables secured
- [ ] Secrets manager configured

---

## 📚 API Quick Reference

### Authentication
```bash
# Register
POST /api/auth/register
Body: { username, email, password }

# Login
POST /api/auth/login
Body: { email, password }
Response: { token, user }
```

### Posts
```bash
# Get feed
GET /api/posts?limit=20&offset=0
Headers: { Authorization: Bearer <token> }

# Create post
POST /api/posts
Body: { content, images }
Headers: { Authorization: Bearer <token> }

# Like post
POST /api/posts/:id/like
Headers: { Authorization: Bearer <token> }
```

### AI Features
```bash
# Get recommendations
GET /api/ai/recommend
Headers: { Authorization: Bearer <token> }

# Get smart replies
GET /api/ai/smart-replies/:postId
Headers: { Authorization: Bearer <token> }

# Analyze trends
GET /api/ai/trends?window=24h
Headers: { Authorization: Bearer <token> }
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is in use
lsof -i :5000

# Check database connection
npm run test:db

# Check Redis connection
redis-cli ping
```

### Database migration fails
```bash
# Reset migrations
npm run migrate:reset

# Run migrations step by step
npm run migrate:up
```

### Real-time updates not working
```bash
# Check WebSocket connection
# Open browser console: 
// socket.connected // should be true

# Check Socket.io logs
DEBUG=socket.io npm run dev
```

### AI API errors
```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Test API directly
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{...}'
```

---

## 🚀 Deployment

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Deploy
railway up
```

### Deploy to Render

```bash
# Push to GitHub
git push origin main

# Connect GitHub to Render
# - Create new Web Service
# - Connect repository
# - Set environment variables
# - Deploy!
```

### Docker Deployment

```bash
# Build images
docker-compose build

# Push to registry
docker tag social-media:latest your-registry/social-media:latest
docker push your-registry/social-media:latest

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml
```

---

## 📊 Database Schema Relationships

```
users (PK: id)
  ├── posts (FK: user_id)
  │   ├── comments (FK: post_id)
  │   │   └── likes (FK: comment_id)
  │   └── likes (FK: post_id)
  ├── follows (FK: follower_id, following_id)
  ├── notifications (FK: user_id, from_user_id)
  └── ai_interactions (FK: user_id)

posts
  ├── comments (FK: post_id, user_id)
  ├── likes (FK: post_id, user_id)
  └── content_flags (FK: post_id)
```

---

## 🎓 Learning Resources

### Frontend
- [React Documentation](https://react.dev)
- [Socket.io Client Guide](https://socket.io/docs/v4/client-api/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Backend
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Docs](https://www.postgresql.org/docs/current/)
- [Redis Documentation](https://redis.io/docs/)

### AI Integration
- [Claude API Docs](https://docs.anthropic.com)
- [Prompt Engineering](https://docs.anthropic.com/claude/docs/build-with-claude)

### DevOps
- [Docker Guide](https://docs.docker.com/get-started/)
- [Kubernetes Basics](https://kubernetes.io/docs/concepts/overview/what-is-kubernetes/)

---

## 💬 Getting Help

- **Docs**: https://docs.yourdomain.com
- **Discord Community**: https://discord.gg/yourdomain
- **GitHub Issues**: https://github.com/yourdomain/issues
- **Email Support**: support@yourdomain.com

---

## 📝 Commits & Branching

```bash
# Create feature branch
git checkout -b feature/user-profiles

# Make changes and commit
git add .
git commit -m "feat: add user profile page"

# Push to remote
git push origin feature/user-profiles

# Create Pull Request on GitHub
```

### Commit Message Format
```
feat: add new feature
fix: fix a bug
docs: update documentation
style: code style changes
refactor: restructure code
perf: performance improvements
test: add tests
chore: update dependencies
```

---

## 🎉 Next Steps

1. ✅ Complete initial setup
2. ✅ Run database migrations
3. ✅ Start frontend & backend
4. ✅ Create user account
5. ✅ Test creating posts
6. ✅ Verify AI features work
7. ✅ Set up monitoring
8. ✅ Deploy to production

---

## 📞 Support

For detailed documentation, visit: `/docs`
For API reference, visit: `/api/docs`
For issues, check: `Issues` tab on GitHub

Good luck building! 🚀

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainer**: Your Team
