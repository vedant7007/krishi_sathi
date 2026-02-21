require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();

// Connect DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true })); // Twilio webhooks send form-encoded data
app.use('/api', rateLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/advisory', require('./routes/advisory'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/schemes', require('./routes/schemes'));
app.use('/api/news', require('./routes/news'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/voice', require('./routes/voice'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'KrishiSathi API is running', timestamp: new Date() });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`KrishiSathi server running on port ${PORT}`);
});
