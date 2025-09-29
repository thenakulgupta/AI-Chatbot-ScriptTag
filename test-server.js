/**
 * Simple test server for AI Chatbot
 * This server provides a mock API endpoint for testing the chatbot
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3000;

// Mock responses for testing
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

const server = http.createServer((req, res) => {
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

  // Mock chat API endpoint
  if (pathname === "/api/chat" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        console.log("Chat request:", data.message);

        // Simulate API delay
        setTimeout(() => {
          const randomResponse =
            mockResponses[Math.floor(Math.random() * mockResponses.length)];

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: randomResponse,
              status: "success",
              timestamp: new Date().toISOString(),
            })
          );
        }, 1000 + Math.random() * 2000); // 1-3 second delay
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "Invalid request format",
            status: "error",
          })
        );
      }
    });
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

server.listen(PORT, () => {
  console.log(`🚀 AI Chatbot Test Server running on http://localhost:${PORT}`);
  console.log(`📝 Example page: http://localhost:${PORT}/example.html`);
  console.log(`🤖 Mock API endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`\nTo test the chatbot:`);
  console.log(`1. Open http://localhost:${PORT}/example.html in your browser`);
  console.log(`2. Click the chatbot button in the bottom right`);
  console.log(`3. Start chatting with the mock AI assistant`);
  console.log(`\nPress Ctrl+C to stop the server`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down test server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
