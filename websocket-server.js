/**
 * WebSocket Server for AI Chatbot
 * Handles real-time chat with unique chat IDs and message verification
 */

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { v4: uuidv4 } = require("uuid");

const PORT = 3001;
const WS_PORT = 3002;

// Store active chat sessions
const activeChats = new Map();
const clientSockets = new Map();
const pingCounters = new Map(); // Track ping counts per connection

// Mock AI responses for testing
const mockResponses = [
  "Hello! I'm your AI assistant. How can I help you today?",
  "That's an interesting question! Let me help you with that.",
  "I understand what you're asking. Here's what I think...",
  "Great question! Based on what you've told me, I'd suggest...",
  "I'm here to help! Could you provide a bit more detail?",
  "That's a common concern. Here are some things to consider...",
  "I appreciate you sharing that with me. Let me offer some guidance...",
  "Based on my knowledge, I can help you with that. Here's what I recommend...",
];

// MIME types
const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Generate unique chat ID
 */
function generateChatId() {
  return `chat_${uuidv4()}`;
}

/**
 * Create new chat session
 */
function createChatSession(chatId, clientSocket) {
  const chatSession = {
    id: chatId,
    socket: clientSocket,
    messages: [],
    createdAt: new Date(),
    lastActivity: new Date(),
  };

  activeChats.set(chatId, chatSession);
  clientSockets.set(clientSocket, chatId);

  return chatSession;
}

/**
 * Get chat session by ID
 */
function getChatSession(chatId) {
  return activeChats.get(chatId);
}

/**
 * Remove chat session
 */
function removeChatSession(chatId) {
  const session = activeChats.get(chatId);
  if (session) {
    clientSockets.delete(session.socket);
    activeChats.delete(chatId);
  }
}

/**
 * Process AI message (mock implementation)
 */
async function processAIMessage(message, chatHistory) {
  // Simulate AI processing delay
  await new Promise((resolve) =>
    setTimeout(resolve, 1000 + Math.random() * 2000)
  );

  // Get random response
  const response =
    mockResponses[Math.floor(Math.random() * mockResponses.length)];

  return {
    message: response,
    timestamp: new Date().toISOString(),
    type: "ai_response",
  };
}

/**
 * Handle WebSocket message
 */
function handleWebSocketMessage(ws, message) {
  try {
    const data = JSON.parse(message);
    const { type, chatId, message: messageText, timestamp } = data;

    switch (type) {
      case "join_chat":
        handleJoinChat(ws, chatId);
        break;

      case "user_message":
        handleUserMessage(ws, chatId, messageText, timestamp);
        break;

      case "ping":
        // Track ping count for this connection
        const currentCount = pingCounters.get(ws) || 0;
        pingCounters.set(ws, currentCount + 1);

        // Respond with pong immediately
        ws.send(
          JSON.stringify({
            type: "pong",
            timestamp: new Date().toISOString(),
            originalPingTime: data.timestamp,
            pingCount: currentCount + 1,
          })
        );
        break;
    }
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Invalid message format",
        timestamp: new Date().toISOString(),
      })
    );
  }
}

/**
 * Handle chat join
 */
function handleJoinChat(ws, chatId) {
  if (!chatId) {
    // Create new chat session
    const newChatId = generateChatId();
    const session = createChatSession(newChatId, ws);

    ws.send(
      JSON.stringify({
        type: "chat_joined",
        chatId: newChatId,
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    // Join existing chat session
    const session = getChatSession(chatId);
    if (session) {
      // Update socket reference
      session.socket = ws;
      clientSockets.set(ws, chatId);

      ws.send(
        JSON.stringify({
          type: "chat_joined",
          chatId: chatId,
          messages: session.messages,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Chat session not found",
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

/**
 * Handle user message
 */
async function handleUserMessage(ws, chatId, messageText, timestamp) {
  const session = getChatSession(chatId);
  if (!session) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Chat session not found",
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Verify chat ID matches
  if (clientSockets.get(ws) !== chatId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Invalid chat session",
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Add user message to chat history
  const userMessage = {
    id: uuidv4(),
    type: "user",
    message: messageText,
    timestamp: timestamp || new Date().toISOString(),
  };

  session.messages.push(userMessage);
  session.lastActivity = new Date();

  // Send user message confirmation
  ws.send(
    JSON.stringify({
      type: "message_received",
      messageId: userMessage.id,
      timestamp: new Date().toISOString(),
    })
  );

  // Process with AI
  try {
    const aiResponse = await processAIMessage(messageText, session.messages);

    // Add AI response to chat history
    const aiMessage = {
      id: uuidv4(),
      type: "ai",
      message: aiResponse.message,
      timestamp: aiResponse.timestamp,
    };

    session.messages.push(aiMessage);
    session.lastActivity = new Date();

    // Send AI response
    ws.send(
      JSON.stringify({
        type: "ai_message",
        messageId: aiMessage.id,
        message: aiMessage.message,
        timestamp: aiMessage.timestamp,
      })
    );
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Sorry, I encountered an error processing your message.",
        timestamp: new Date().toISOString(),
      })
    );
  }
}

/**
 * Handle WebSocket connection
 */
function handleWebSocketConnection(ws, req) {
  ws.on("message", (message) => {
    handleWebSocketMessage(ws, message);
  });

  ws.on("close", () => {
    const chatId = clientSockets.get(ws);
    if (chatId) {
      // Don't remove chat session immediately, allow reconnection
      clientSockets.delete(ws);
    }

    // Clean up ping counter
    const pingCount = pingCounters.get(ws);
    if (pingCount) {
      pingCounters.delete(ws);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "Connected to AI Chatbot WebSocket",
      timestamp: new Date().toISOString(),
    })
  );
}

// Create HTTP server for static files and API
const httpServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint to create new chat session
  if (pathname === "/api/chat/create" && method === "POST") {
    const chatId = generateChatId();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        chatId: chatId,
        websocketUrl: `ws://localhost:${WS_PORT}`,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // API endpoint to get chat history
  if (pathname.startsWith("/api/chat/") && method === "GET") {
    const chatId = pathname.split("/")[3];
    const session = getChatSession(chatId);

    if (session) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          chatId: chatId,
          messages: session.messages,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Chat session not found",
        })
      );
    }
    return;
  }

  // Serve static files
  let filePath = pathname === "/" ? "/example.html" : pathname;
  filePath = path.join(__dirname, filePath);

  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head><title>404 Not Found</title></head>
            <body>
              <h1>404 - File Not Found</h1>
              <p>The requested file ${pathname} was not found.</p>
              <p><a href="/">Go back to example page</a></p>
            </body>
          </html>
        `);
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({
  port: WS_PORT,
  path: "/ws",
});

wss.on("connection", handleWebSocketConnection);

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 AI Chatbot Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server running on ws://localhost:${WS_PORT}/ws`);
  console.log(`📝 Example page: http://localhost:${PORT}/example.html`);
  console.log(`\nTo test the chatbot:`);
  console.log(`1. Open http://localhost:${PORT}/example.html in your browser`);
  console.log(`2. Click the chatbot button in the bottom right`);
  console.log(`3. Start chatting with the AI assistant via WebSocket`);
  console.log(`\nPress Ctrl+C to stop the server`);
});

// Cleanup inactive chat sessions every 30 minutes
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

  for (const [chatId, session] of activeChats.entries()) {
    if (now - session.lastActivity > inactiveThreshold) {
      removeChatSession(chatId);
    }
  }
}, 30 * 60 * 1000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down servers...");

  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close();
  });

  // Close servers
  wss.close(() => {
    httpServer.close(() => {
      console.log("✅ Servers closed");
      process.exit(0);
    });
  });
});

module.exports = { httpServer, wss };
