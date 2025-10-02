# AI Chatbot Script Tag Integration

A comprehensive, production-ready AI chatbot widget with real-time WebSocket communication, MongoDB persistence, admin dashboards, and advanced features. Easily integrate into any website using a simple script tag.

## 🚀 Features

### Core Functionality

- **🔌 One-Click Integration**: Just add one script tag to your HTML
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **🎨 Highly Customizable**: Extensive configuration via data attributes
- **⚡ Lightweight**: Minimal impact on page load time
- **🔄 Real-time Communication**: WebSocket-based instant messaging
- **🎯 Sticky CTA**: Always visible chat button in bottom right
- **♿ Accessible**: Keyboard navigation and screen reader support

### Advanced Features

- **💬 Streaming Responses**: Real-time AI message streaming with typing effects
- **📝 Markdown Support**: Rich text formatting with markdown rendering
- **🏷️ Chat Categorization**: Organize conversations by category (support, sales, demo, etc.)
- **💾 Persistent Storage**: MongoDB integration for chat history and sessions
- **📊 Admin Dashboards**: Separate dashboards for demo and production monitoring
- **🔄 Auto-reconnection**: Automatic WebSocket reconnection with exponential backoff
- **💓 Heartbeat System**: Ping-pong mechanism for connection health monitoring
- **🎭 Thinking Indicators**: Visual feedback during AI processing
- **📱 Mobile Optimized**: Touch-friendly interface with responsive design

## 🏗️ Architecture

### Frontend Components

- **Chatbot Widget**: Embedded script with customizable UI
- **WebSocket Client**: Real-time communication with server
- **Markdown Renderer**: Rich text display for AI responses
- **Admin Dashboards**: Two separate monitoring interfaces

### Backend Infrastructure

- **Node.js Server**: Express-based HTTP and WebSocket server
- **MongoDB Database**: Persistent storage for sessions and messages
- **Groq AI Integration**: Advanced AI responses with streaming
- **Session Management**: Automatic session creation and tracking

## 🚀 Quick Start

### 1. Basic Integration

Add this script tag to your HTML:

```html
<script src="https://ai-chat-script.nakultelestock.com/ai-chatbot.js"></script>
```

### 2. Advanced Configuration

Customize the chatbot using data attributes:

```html
<script
  src="https://ai-chat-script.nakultelestock.com/ai-chatbot.js"
  data-default-message="Welcome! How can I help you?"
  data-category="support"
  data-auto-open="true"
></script>
```

## ⚙️ Configuration Options

| Attribute              | Description                       | Default                              | Type    |
| ---------------------- | --------------------------------- | ------------------------------------ | ------- |
| `data-default-message` | Welcome message shown to users    | `"Hello! How can I help you today?"` | String  |
| `data-category`        | Chat session category             | `"general"`                          | String  |
| `data-auto-open`       | Auto-open chatbot after page load | `false`                              | Boolean |

## 🎮 JavaScript API

Control the chatbot programmatically:

```javascript
// Open the chatbot
AIChatbot.open();

// Close the chatbot
AIChatbot.close();

// Toggle the chatbot
AIChatbot.toggle();

// Send a message programmatically
AIChatbot.sendMessage("Hello, how are you?");

// WebSocket management
AIChatbot.connectWebSocket();
AIChatbot.disconnectWebSocket();

// Get current session information
const sessionId = AIChatbot.getSessionId();
const wsStatus = AIChatbot.getWebSocketStatus();

// Access configuration
console.log(AIChatbot.config);

// Ping-pong system
AIChatbot.startPingPong();
AIChatbot.stopPingPong();
const lastPong = AIChatbot.getLastPongTime();
```

## 🏷️ Chat Categorization

Organize your chats by category for better management:

```html
<!-- Support page -->
<script src="ai-chatbot.js" data-category="support"></script>

<!-- Sales page -->
<script src="ai-chatbot.js" data-category="sales"></script>

<!-- General page -->
<script src="ai-chatbot.js" data-category="general"></script>

<!-- Demo page -->
<script src="ai-chatbot.js" data-category="demo"></script>
```

**Benefits:**

- Separate support tickets from sales inquiries
- Track conversation types and analytics
- Route different categories to appropriate teams
- Maintain organized chat history by purpose

## 🔌 WebSocket Communication

### Connection Flow

1. **Lazy Connection**: WebSocket connects only when user starts chat
2. **Session Management**: Automatic session creation and tracking
3. **Message Streaming**: Real-time AI response streaming
4. **Auto-reconnection**: Automatic reconnection with exponential backoff
5. **Heartbeat System**: Ping-pong mechanism for connection health

### Message Types

- `join_chat`: Initialize or join existing chat session
- `user_message`: Send user message to AI
- `ai_message_stream`: Streaming AI response chunks
- `ping/pong`: Connection health monitoring
- `error`: Error handling and user feedback

## 📊 Admin Dashboards

### Demo Dashboard (`/admin-dashboard.html`)

- **Purpose**: Monitor demo/test conversations only
- **Features**:
  - Real-time statistics for demo category
  - Session management and filtering
  - Message history with markdown rendering
  - Pagination and search functionality

### Main Dashboard (`/admin-dashboard-main.html`)

- **Purpose**: Monitor all production conversations (excluding demo)
- **Features**:
  - Comprehensive analytics across all categories
  - Advanced filtering by category, status, and search
  - Detailed session and message management
  - Performance metrics and insights

### Dashboard Features

- **📈 Real-time Statistics**: Live session and message counts
- **🔍 Advanced Filtering**: Filter by category, status, and search terms
- **📄 Pagination**: Efficient handling of large datasets
- **💬 Message Viewer**: Full conversation history with markdown support
- **📱 Responsive Design**: Works on all device sizes
- **🎨 Modern UI**: Beautiful, intuitive interface

## 🗄️ Database Schema

### ChatSession Model

```javascript
{
  _id: ObjectId,
  createdAt: Date,
  lastActivity: Date,
  isActive: Boolean,
  userAgent: String,
  url: String,
  category: String, // 'support', 'sales', 'general', 'demo'
  metadata: Object
}
```

### ChatMessage Model

```javascript
{
  _id: ObjectId,
  sessionId: ObjectId,
  type: String, // 'user', 'ai', 'system'
  message: String,
  timestamp: Date,
  metadata: Object,
  aiContext: {
    model: String,
    tokens: Number,
    processingTime: Number,
    temperature: Number
  }
}
```

## 🚀 Deployment

### 1. Server Setup

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

### 2. Environment Variables

```env
PORT=3001
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-8b-8192
MONGODB_URI=mongodb://localhost:27017/chatbot-script
```

### 3. CDN Deployment

1. **Upload Files**: Upload all files to your CDN or web server
2. **Update URLs**: Update the `data-cdn-base-url` in your script tag
3. **Configure API**: Set your API endpoint using `data-api-url`
4. **Test Integration**: Use the example.html file to test

## 📁 Project Structure

```
ai-chatbot-script-tag/
├── ai-chatbot-full.js          # Full development script
├── ai-chatbot.js               # Minified production script
├── server.js                   # Node.js server with WebSocket
├── package.json                # Dependencies and scripts
├── prompt.txt                  # AI system prompt
├── .env                        # Environment variables
├── html/
│   └── chatbot.html           # Chatbot UI template
├── styles/
│   ├── chatbot.css            # Chatbot styles
│   ├── admin-dashboard.css    # Dashboard styles
│   └── markdown-styles.css    # Markdown rendering styles
├── models/
│   ├── ChatSession.js         # Session database model
│   └── ChatMessage.js         # Message database model
├── database/
│   └── connection.js          # MongoDB connection
├── admin-dashboard.html       # Demo dashboard
├── admin-dashboard-main.html  # Main dashboard
├── example.html               # Integration example
└── test.html                  # Test page
```

## 🌐 Browser Support

- **Chrome**: 60+
- **Firefox**: 55+
- **Safari**: 12+
- **Edge**: 79+
- **Mobile**: iOS Safari 12+, Chrome Mobile 60+

## 🎨 Customization

### Styling

The chatbot uses CSS custom properties for easy theming:

```css
:root {
  --chatbot-primary-color: #667eea;
  --chatbot-secondary-color: #764ba2;
  --chatbot-background: #ffffff;
  --chatbot-text-color: #333333;
}
```

### Behavior

Modify the `CONFIG` object in `ai-chatbot-full.js`:

```javascript
const CONFIG = {
  apiUrl: "your-api-endpoint",
  websocketUrl: "your-websocket-endpoint",
  defaultMessage: "Your welcome message",
  category: "your-default-category",
  // ... other options
};
```

## 🔧 API Endpoints

### Chat Endpoints

- `POST /api/chat/create` - Create new chat session
- `GET /api/chat/:sessionId` - Get chat history

### Admin Endpoints

- `GET /api/admin/demo/stats` - Demo dashboard statistics
- `GET /api/admin/demo/sessions` - Demo sessions with pagination
- `GET /api/admin/demo/sessions/:id/messages` - Demo session messages
- `GET /api/admin/main/stats` - Main dashboard statistics
- `GET /api/admin/main/sessions` - Main sessions with pagination
- `GET /api/admin/main/sessions/:id/messages` - Main session messages

### WebSocket Endpoint

- `WS /ws` - WebSocket connection for real-time chat

## 🛠️ Development

### Build Process

```bash
# Install dependencies
npm install

# Build minified version
npm run build

# Start development server
npm start
```

### Testing

1. Open `http://localhost:3001/example.html` for basic testing
2. Open `http://localhost:3001/test.html` for advanced testing
3. Access admin dashboards at `/admin-dashboard.html` and `/admin-dashboard-main.html`

## 🐛 Troubleshooting

### Common Issues

1. **Chatbot not loading**

   - Check that CDN URLs are correct and accessible
   - Verify script tag syntax and data attributes

2. **WebSocket connection failed**

   - Ensure WebSocket server is running
   - Check firewall and proxy settings
   - Verify `data-websocket-url` configuration

3. **API errors**

   - Verify your API endpoint is working
   - Check API response format matches expected structure
   - Review server logs for detailed error messages

4. **Styling issues**
   - Ensure CSS files are loading correctly
   - Check for CSS conflicts with existing styles
   - Verify CDN base URL configuration

### Debug Mode

Enable debug logging by opening browser console. The chatbot logs initialization, WebSocket events, and error messages.

## 📈 Performance

### Optimizations

- **Lazy Loading**: WebSocket connects only when needed
- **Efficient Streaming**: 3-5 word chunks for natural typing effect
- **Database Indexing**: Optimized MongoDB queries with compound indexes
- **Connection Pooling**: Efficient database connection management
- **Memory Management**: Automatic cleanup of inactive sessions

### Monitoring

- **Real-time Metrics**: Live session and message counts
- **Performance Tracking**: Response times and connection health
- **Error Monitoring**: Comprehensive error logging and reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:

- **Issues**: Open an issue in the repository
- **Documentation**: Check the example.html and test.html files
- **Contact**: Reach out to the development team

---

**Built with ❤️ for seamless AI chatbot integration**
