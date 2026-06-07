import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import Route Handlers
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import userRoutes from './routes/users.js';
import feedRoutes from './routes/feed.js';
import aiRoutes from './routes/ai.js';
import poseRoutes from './routes/poses.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend Vite development
app.use(cors({
  origin: '*', // In development, allow any source or specify http://localhost:5173
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const uploadsDir = path.resolve('./uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Set up WebSocket server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Bind socket instance globally to express app
app.set('io', io);

// WebSocket event orchestrator
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Room Joiner (for selective events, like specific comment feeds)
  socket.on('join:post', (postId) => {
    socket.join(`post:${postId}`);
    console.log(`👤 Client ${socket.id} joined post comments room: ${postId}`);
  });

  socket.on('leave:post', (postId) => {
    socket.leave(`post:${postId}`);
    console.log(`👤 Client ${socket.id} left post comments room: ${postId}`);
  });

  // Typing Indicators
  socket.on('typing:start', ({ postId, username }) => {
    socket.to(`post:${postId}`).emit('typing:status', { postId, username, isTyping: true });
  });

  socket.on('typing:stop', ({ postId, username }) => {
    socket.to(`post:${postId}`).emit('typing:status', { postId, username, isTyping: false });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Mount Express API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/poses', poseRoutes);

// Serve frontend static assets if built
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendBuildDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendBuildDir)) {
  app.use(express.static(frontendBuildDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendBuildDir, 'index.html'));
    }
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server exception:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SocialAI Server successfully launched on http://localhost:${PORT}`);
});
