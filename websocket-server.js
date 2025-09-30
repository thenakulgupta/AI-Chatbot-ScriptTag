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
const Groq = require("groq-sdk");
require("dotenv").config();

const PORT = 3001;
const WS_PORT = 3002;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Store active chat sessions
const activeChats = new Map();
const clientSockets = new Map();
const pingCounters = new Map(); // Track ping counts per connection

// Load system prompt
let systemPrompt = "";
try {
  systemPrompt = fs.readFileSync(path.join(__dirname, "prompt.txt"), "utf8");
} catch (error) {
  console.error("Error loading prompt.txt:", error);
  systemPrompt = "You are a helpful AI assistant.";
}

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
 * Load chat history from file
 */
function loadChatHistory(chatId) {
  try {
    const historyPath = path.join(__dirname, "history", `${chatId}.json`);
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading chat history for ${chatId}:`, error);
  }
  return [];
}

/**
 * Save chat history to file
 */
function saveChatHistory(chatId, messages) {
  try {
    const historyDir = path.join(__dirname, "history");
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    const historyPath = path.join(historyDir, `${chatId}.json`);
    fs.writeFileSync(historyPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error(`Error saving chat history for ${chatId}:`, error);
  }
}

/**
 * Create new chat session
 */
function createChatSession(chatId, clientSocket) {
  // Load existing history if available
  const messages = loadChatHistory(chatId);

  const chatSession = {
    id: chatId,
    socket: clientSocket,
    messages: messages,
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
 * Process AI message with streaming using Groq API
 */
async function processAIMessageStream(message, chatHistory, ws, chatId) {
  try {
    // Prepare messages for Groq API
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((msg) => ({
        role: msg.type === "user" ? "user" : "assistant",
        content: msg.message,
      })),
      { role: "user", content: message },
    ];

    // Call Groq API with streaming
    const stream = await groq.chat.completions.create({
      messages: messages,
      model: process.env.GROQ_MODEL || "llama3-8b-8192",
      stream: true,
      temperature: 0.7,
    });

    let fullResponse = "";
    let currentMessage = "";

    // Process streaming response with 10-word chunks
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;

        // Split into words and send 3-5 words at a time for typing effect
        const words = fullResponse.split(" ");
        const currentWordCount = currentMessage.split(" ").length;
        const newWordCount = words.length;

        // Send chunk when we have 3-5 new words
        if (newWordCount - currentWordCount >= 3) {
          // Send 3-5 words at a time
          const wordsToAdd = Math.min(
            3 + Math.floor(Math.random() * 3),
            newWordCount - currentWordCount
          );
          const endIndex = currentWordCount + wordsToAdd;
          currentMessage = words.slice(0, endIndex).join(" ");

          // Send streaming chunk
          ws.send(
            JSON.stringify({
              type: "ai_message_stream",
              message: currentMessage,
              isComplete: false,
              timestamp: new Date().toISOString(),
            })
          );

          // Shorter delay for typing effect (50% faster)
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    // Send final completion message
    ws.send(
      JSON.stringify({
        type: "ai_message_stream",
        message: fullResponse,
        isComplete: true,
        timestamp: new Date().toISOString(),
      })
    );

    return {
      message: fullResponse,
      timestamp: new Date().toISOString(),
      type: "ai_response",
    };
  } catch (error) {
    console.error("Groq API error:", error);

    // Fallback response
    const fallbackResponse =
      "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.";

    // Send fallback as streaming with 3-5 word chunks
    const words = fallbackResponse.split(" ");
    let currentMessage = "";

    for (let i = 0; i < words.length; i += 3 + Math.floor(Math.random() * 3)) {
      const wordsToAdd = Math.min(
        3 + Math.floor(Math.random() * 3),
        words.length - i
      );
      const endIndex = i + wordsToAdd;
      const chunkWords = words.slice(i, endIndex);
      currentMessage += (currentMessage ? " " : "") + chunkWords.join(" ");

      ws.send(
        JSON.stringify({
          type: "ai_message_stream",
          message: currentMessage,
          isComplete: endIndex >= words.length,
          timestamp: new Date().toISOString(),
        })
      );

      // Shorter delay for typing effect (50% faster)
      if (endIndex < words.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      message: fallbackResponse,
      timestamp: new Date().toISOString(),
      type: "ai_response",
    };
  }
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
      // Try to load from history file
      const historyMessages = loadChatHistory(chatId);
      if (historyMessages.length > 0) {
        // Create session from history
        const session = createChatSession(chatId, ws);
        session.messages = historyMessages;

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

  // Process with AI using streaming
  try {
    const aiResponse = await processAIMessageStream(
      messageText,
      session.messages,
      ws,
      chatId
    );

    // Add AI response to chat history
    const aiMessage = {
      id: uuidv4(),
      type: "ai",
      message: aiResponse.message,
      timestamp: aiResponse.timestamp,
    };

    session.messages.push(aiMessage);
    session.lastActivity = new Date();

    // Save updated chat history to file
    saveChatHistory(chatId, session.messages);
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
