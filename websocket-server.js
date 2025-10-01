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
const {
  connectToDatabase,
  disconnectFromDatabase,
} = require("./database/connection");
const ChatSession = require("./models/ChatSession");
const ChatMessage = require("./models/ChatMessage");
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
 * Load chat history from MongoDB
 */
async function loadChatHistory(sessionId) {
  try {
    const messages = await ChatMessage.getChatHistory(sessionId);
    return messages.map((msg) => ({
      id: msg._id.toString(),
      type: msg.type,
      message: msg.message,
      timestamp: msg.timestamp.toISOString(),
    }));
  } catch (error) {
    console.error(`Error loading chat history for ${sessionId}:`, error);
    return [];
  }
}

/**
 * Save message to MongoDB
 */
async function saveMessage(sessionId, messageData) {
  try {
    const message = new ChatMessage({
      sessionId: sessionId,
      type: messageData.type,
      message: messageData.message,
      timestamp: new Date(messageData.timestamp),
      metadata: messageData.metadata || {},
    });

    await message.save();
    return message;
  } catch (error) {
    console.error(`Error saving message for ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Create or update chat session in MongoDB
 */
async function createOrUpdateChatSession(sessionId, userAgent = "", url = "") {
  try {
    let session;

    if (sessionId) {
      // Update existing session
      session = await ChatSession.findByIdAndUpdate(
        sessionId,
        {
          lastActivity: new Date(),
          isActive: true,
          userAgent,
          url,
        },
        { new: true }
      );
    } else {
      // Create new session
      session = new ChatSession({
        lastActivity: new Date(),
        isActive: true,
        userAgent,
        url,
      });
      await session.save();
    }

    return session;
  } catch (error) {
    console.error(
      `Error creating/updating chat session for ${sessionId}:`,
      error
    );
    throw error;
  }
}

/**
 * Create new chat session
 */
async function createChatSession(
  sessionId,
  clientSocket,
  userAgent = "",
  url = ""
) {
  try {
    // Create or update session in MongoDB
    const dbSession = await createOrUpdateChatSession(
      sessionId,
      userAgent,
      url
    );
    const actualSessionId = dbSession._id.toString();

    // Load existing history if available
    const messages = await loadChatHistory(actualSessionId);

    const chatSession = {
      id: actualSessionId,
      socket: clientSocket,
      messages: messages,
      createdAt: dbSession.createdAt,
      lastActivity: dbSession.lastActivity,
    };

    activeChats.set(actualSessionId, chatSession);
    clientSockets.set(clientSocket, actualSessionId);

    return chatSession;
  } catch (error) {
    console.error(`Error creating chat session for ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get chat session by ID
 */
function getChatSession(sessionId) {
  return activeChats.get(sessionId);
}

/**
 * Remove chat session
 */
async function removeChatSession(sessionId) {
  const session = activeChats.get(sessionId);
  if (session) {
    clientSockets.delete(session.socket);
    activeChats.delete(sessionId);

    // Mark session as inactive in MongoDB
    try {
      await ChatSession.findByIdAndUpdate(sessionId, {
        isActive: false,
        lastActivity: new Date(),
      });
    } catch (error) {
      console.error(
        `Error marking session as inactive for ${sessionId}:`,
        error
      );
    }
  }
}

/**
 * Process AI message with streaming using Groq API
 */
async function processAIMessageStream(message, chatHistory, ws, sessionId) {
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
    const {
      type,
      sessionId,
      message: messageText,
      timestamp,
      userAgent,
      url,
    } = data;

    switch (type) {
      case "join_chat":
        handleJoinChat(ws, sessionId, userAgent, url);
        break;

      case "user_message":
        handleUserMessage(ws, sessionId, messageText, timestamp);
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
async function handleJoinChat(ws, sessionId, userAgent = "", url = "") {
  try {
    if (!sessionId) {
      // Create new chat session
      const session = await createChatSession(null, ws, userAgent, url);

      ws.send(
        JSON.stringify({
          type: "chat_joined",
          sessionId: session.id,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      // Join existing chat session
      const session = getChatSession(sessionId);
      if (session) {
        // Update socket reference
        session.socket = ws;
        clientSockets.set(ws, sessionId);

        ws.send(
          JSON.stringify({
            type: "chat_joined",
            sessionId: sessionId,
            messages: session.messages,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        // Try to load from MongoDB
        const historyMessages = await loadChatHistory(sessionId);
        if (historyMessages.length > 0) {
          // Create session from history
          const session = await createChatSession(
            sessionId,
            ws,
            userAgent,
            url
          );
          session.messages = historyMessages;

          ws.send(
            JSON.stringify({
              type: "chat_joined",
              sessionId: session.id,
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
  } catch (error) {
    console.error("Error handling chat join:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to join chat session",
        timestamp: new Date().toISOString(),
      })
    );
  }
}

/**
 * Handle user message
 */
async function handleUserMessage(ws, sessionId, messageText, timestamp) {
  const session = getChatSession(sessionId);
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

  // Verify session ID matches
  if (clientSockets.get(ws) !== sessionId) {
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

  // Save user message to MongoDB
  try {
    await saveMessage(sessionId, userMessage);
    await createOrUpdateChatSession(sessionId);
  } catch (error) {
    console.error("Error saving user message:", error);
  }

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
      sessionId
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

    // Save AI message to MongoDB
    try {
      await saveMessage(sessionId, aiMessage);
      await createOrUpdateChatSession(sessionId);
    } catch (error) {
      console.error("Error saving AI message:", error);
    }
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

  ws.on("close", async () => {
    const sessionId = clientSockets.get(ws);
    if (sessionId) {
      // Don't remove chat session immediately, allow reconnection
      clientSockets.delete(ws);

      // Update last activity in MongoDB
      try {
        await createOrUpdateChatSession(sessionId);
      } catch (error) {
        console.error("Error updating session on close:", error);
      }
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
const httpServer = http.createServer(async (req, res) => {
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
    try {
      const session = new ChatSession({
        lastActivity: new Date(),
        isActive: true,
      });
      await session.save();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          sessionId: session._id.toString(),
          websocketUrl: `ws://localhost:${WS_PORT}`,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to create chat session",
        })
      );
    }
    return;
  }

  // API endpoint to get chat history
  if (pathname.startsWith("/api/chat/") && method === "GET") {
    const sessionId = pathname.split("/")[3];
    const session = getChatSession(sessionId);

    if (session) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          sessionId: sessionId,
          messages: session.messages,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
        })
      );
    } else {
      // Try to load from MongoDB
      try {
        const messages = await loadChatHistory(sessionId);
        const dbSession = await ChatSession.findById(sessionId);

        if (dbSession) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              sessionId: sessionId,
              messages: messages,
              createdAt: dbSession.createdAt,
              lastActivity: dbSession.lastActivity,
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
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to load chat history",
          })
        );
      }
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

// Initialize MongoDB connection and start servers
async function startServers() {
  try {
    // Connect to MongoDB first
    await connectToDatabase();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 AI Chatbot Server running on http://localhost:${PORT}`);
      console.log(
        `🔌 WebSocket Server running on ws://localhost:${WS_PORT}/ws`
      );
      console.log(`📝 Example page: http://localhost:${PORT}/example.html`);
      console.log(`\nTo test the chatbot:`);
      console.log(
        `1. Open http://localhost:${PORT}/example.html in your browser`
      );
      console.log(`2. Click the chatbot button in the bottom right`);
      console.log(`3. Start chatting with the AI assistant via WebSocket`);
      console.log(`\nPress Ctrl+C to stop the server`);
    });
  } catch (error) {
    console.error("❌ Failed to start servers:", error);
    process.exit(1);
  }
}

// Start the servers
startServers();

// Cleanup inactive chat sessions every 30 minutes
setInterval(async () => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

  for (const [sessionId, session] of activeChats.entries()) {
    if (now - session.lastActivity > inactiveThreshold) {
      await removeChatSession(sessionId);
    }
  }

  // Also cleanup old sessions in MongoDB
  try {
    await ChatSession.cleanupOldSessions(inactiveThreshold);
  } catch (error) {
    console.error("Error cleaning up old sessions:", error);
  }
}, 30 * 60 * 1000);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down servers...");

  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close();
  });

  // Close servers
  wss.close(async () => {
    httpServer.close(async () => {
      console.log("✅ Servers closed");

      // Disconnect from MongoDB
      await disconnectFromDatabase();

      process.exit(0);
    });
  });
});

module.exports = { httpServer, wss };
