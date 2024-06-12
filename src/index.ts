import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import connectDB from './db';
import User, { IUser } from './models/User';
import Conversation from './models/Conversation';
import bcrypt from 'bcryptjs';
import { generateToken, authenticate } from './auth';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://chat-app-five-liard.vercel.app', 
    methods: ['GET', 'POST'],
  },
});

// Подключение к MongoDB
connectDB();

app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    const token = generateToken(user);
    res.status(201).send({ user, token });
  } catch (err) {
    res.status(400).send(err);
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).send({ error: 'Invalid credentials' });
    }
    const token = generateToken(user);
    res.send({ user, token });
  } catch (err) {
    res.status(400).send(err);
  }
});

app.get('/api/users', authenticate, async (req, res) => {
  try {
    const user = req.user as IUser; // Явное указание типа
    const users = await User.find({ _id: { $ne: user._id } });
    res.send(users);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/api/conversations', authenticate, async (req, res) => {
  try {
    const user = req.user as IUser;
    const conversations = await Conversation.find({ participants: user._id }).populate('participants');
    res.send(conversations);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/conversations', authenticate, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { participantId } = req.body;
    const existingConversation = await Conversation.findOne({
      participants: { $all: [user._id, participantId] },
    });
    if (existingConversation) {
      return res.send(existingConversation);
    }
    const conversation = new Conversation({
      participants: [user._id, participantId],
    });
    await conversation.save();
    res.send(conversation);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/api/conversations/:id', authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate('participants').populate('messages.sender');
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    res.send(conversation);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const user = req.user as IUser;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).send({ error: 'Conversation not found' });
    }
    const message = {
      sender: user._id as mongoose.Types.ObjectId, // Приведение типа
      text: req.body.text,
      createdAt: new Date(),
    };
    conversation.messages.push(message);
    await conversation.save();
    io.to(req.params.id).emit('message', message);
    res.send(message);
  } catch (err) {
    res.status(500).send(err);
  }
});

let onlineUsers = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', async (userId: string) => {
    const user = await User.findById(userId);
    if (user) {
      user.isOnline = true;
      await user.save();
      onlineUsers.set(socket.id, userId);
      const users = await User.find({ isOnline: true });
      io.emit('onlineUsers', users.map((u) => u.username));
      console.log(`${user.username} joined the chat`);
    }
  });

  socket.on('message', async ({ conversationId, userId, text }) => {
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      const message = {
        sender: new mongoose.Types.ObjectId(userId),
        text,
        createdAt: new Date(),
      };
      conversation.messages.push(message);
      await conversation.save();
      io.to(conversationId).emit('message', message);
    }
  });

  socket.on('typing', async (userId: string) => {
    const user = await User.findById(userId);
    if (user) {
      socket.broadcast.emit('typing', user.username);
    }
  });

  socket.on('stopTyping', async () => {
    socket.broadcast.emit('stopTyping');
  });

  socket.on('leave', async (userId: string) => {
    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      await user.save();
      onlineUsers.delete(socket.id);
      const users = await User.find({ isOnline: true });
      io.emit('onlineUsers', users.map((u) => u.username));
      console.log(`${user.username} left the chat`);
    }
  });

  socket.on('disconnect', () => {
    const userId = onlineUsers.get(socket.id);
    if (userId) {
      User.findById(userId).then((user) => {
        if (user) {
          user.isOnline = false;
          user.save().then(() => {
            onlineUsers.delete(socket.id);
            User.find({ isOnline: true }).then((users) => {
              io.emit('onlineUsers', users.map((u) => u.username));
            });
          });
        }
      });
    }
    console.log('Client disconnected');
  });
});

