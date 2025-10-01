/**
 * AI Chatbot Script Tag Integration
 * This script creates a chatbot widget that can be embedded on any website
 *
 * Usage: Include this script tag in your HTML:
 * <script src="https://your-cdn-url.com/ai-chatbot.js"></script>
 */

(function () {
  "use strict";

  // Configuration - can be customized via data attributes
  const CONFIG = {
    apiUrl: "http://localhost:3001/api/chat", // Default API endpoint
    websocketUrl: "ws://localhost:3002/ws", // WebSocket server URL
    defaultMessage: "Hello! How can I help you today?",
    cdnBaseUrl: "./html/", // Base URL for HTML/CSS files
    theme: "default",
    position: "bottom-right",
    autoOpen: false,
    showWelcome: true,
    useWebSocket: true, // Enable WebSocket for real-time chat
    markdownEnabled: true, // Enable markdown rendering
  };

  // Global variables
  let chatbotInitialized = false;
  let chatHistory = [];
  let isTyping = false;
  let websocket = null;
  let currentSessionId = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let pingInterval = null;
  let pongTimeout = null;
  let lastPongTime = null;
  let streamingMessageElement = null;
  let currentStreamingMessage = "";
  let isThinking = false;
  let markdownIt = null; // Markdown renderer

  /**
   * Load markdown library
   */
  function loadMarkdownLibrary() {
    return new Promise((resolve, reject) => {
      if (window.markdownit) {
        markdownIt = window.markdownit({
          html: true,
          breaks: true,
          linkify: true,
          typographer: true,
        });
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/markdown-it@14.0.0/dist/markdown-it.min.js";
      script.onload = () => {
        markdownIt = window.markdownit({
          html: true,
          breaks: true,
          linkify: true,
          typographer: true,
        });
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Render markdown to HTML
   */
  function renderMarkdown(text) {
    if (!CONFIG.markdownEnabled || !markdownIt) {
      return text;
    }
    try {
      return markdownIt.render(text);
    } catch (error) {
      console.error("Markdown rendering error:", error);
      return text;
    }
  }

  /**
   * Initialize the chatbot
   */
  async function initChatbot() {
    if (chatbotInitialized) {
      return;
    }

    // Load markdown library if enabled
    if (CONFIG.markdownEnabled) {
      try {
        await loadMarkdownLibrary();
      } catch (error) {
        console.error("Failed to load markdown library:", error);
        CONFIG.markdownEnabled = false;
      }
    }

    // Get configuration from script tag data attributes
    const scriptTag = document.querySelector('script[src*="ai-chatbot.js"]');
    if (scriptTag) {
      Object.keys(CONFIG).forEach((key) => {
        const value = scriptTag.getAttribute(
          `data-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`
        );
        if (value !== null) {
          CONFIG[key] =
            value === "true" ? true : value === "false" ? false : value;
        }
      });
    }

    // Load HTML and CSS
    loadChatbotAssets()
      .then(() => {
        setupEventListeners();

        // Initialize WebSocket if enabled
        if (CONFIG.useWebSocket) {
          initializeWebSocket();
        }

        chatbotInitialized = true;
      })
      .catch((error) => {
        // Failed to initialize chatbot
      });
  }

  /**
   * Load chatbot HTML and CSS assets
   */
  async function loadChatbotAssets() {
    try {
      // Load CSS
      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.href = `${CONFIG.cdnBaseUrl}chatbot.css`;
      document.head.appendChild(cssLink);

      // Load HTML content
      const response = await fetch(`${CONFIG.cdnBaseUrl}chatbot.html`);
      if (!response.ok) {
        throw new Error(`Failed to load chatbot HTML: ${response.status}`);
      }
      const htmlContent = await response.text();

      // Create a temporary container to parse HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;

      // Extract and append the chatbot elements
      const chatbotElements = tempDiv.querySelectorAll(
        "#chatbot-cta, #chatbot-popup, #chatbot-loading"
      );
      chatbotElements.forEach((element) => {
        document.body.appendChild(element.cloneNode(true));
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Setup event listeners for chatbot interactions
   */
  function setupEventListeners() {
    const ctaButton = document.getElementById("chatbot-cta");
    const popup = document.getElementById("chatbot-popup");
    const closeButton = document.getElementById("chatbot-close");
    const startChatBtn = document.getElementById("start-chat-btn");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const welcomeSection = document.getElementById("welcome-section");
    const chatInterface = document.getElementById("chat-interface");

    // CTA Button click
    if (ctaButton) {
      ctaButton.addEventListener("click", () => {
        toggleChatbot();
      });
    }

    // Close button click
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        closeChatbot();
      });
    }

    // Start chat button click
    if (startChatBtn) {
      startChatBtn.addEventListener("click", () => {
        startChat();
      });
    }

    // Send button click
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        sendMessage();
      });
    }

    // Enter key in input
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      // Enable/disable send button based on input
      chatInput.addEventListener("input", () => {
        sendBtn.disabled = !chatInput.value.trim();
      });
    }

    // Click outside to close
    document.addEventListener("click", (e) => {
      if (
        popup &&
        popup.classList.contains("show") &&
        !popup.contains(e.target) &&
        !ctaButton.contains(e.target)
      ) {
        closeChatbot();
      }
    });

    // Auto-open if configured
    if (CONFIG.autoOpen) {
      setTimeout(() => {
        openChatbot();
      }, 2000);
    }
  }

  /**
   * Toggle chatbot popup
   */
  function toggleChatbot() {
    const popup = document.getElementById("chatbot-popup");
    if (popup) {
      if (popup.classList.contains("show")) {
        closeChatbot();
      } else {
        openChatbot();
      }
    }
  }

  /**
   * Open chatbot popup
   */
  function openChatbot() {
    const popup = document.getElementById("chatbot-popup");
    const chatInterface = document.getElementById("chat-interface");
    if (popup && chatInterface) {
      popup.classList.add("show");
      // Focus on input if chat is active
      const chatInput = document.getElementById("chat-input");
      if (chatInput && chatInterface.style.display !== "none") {
        setTimeout(() => chatInput.focus(), 300);
      }
    }
  }

  /**
   * Close chatbot popup
   */
  function closeChatbot() {
    const popup = document.getElementById("chatbot-popup");
    if (popup) {
      popup.classList.remove("show");
    }
  }

  /**
   * Start chat session
   */
  function startChat() {
    const welcomeSection = document.getElementById("welcome-section");
    const chatInterface = document.getElementById("chat-interface");
    const chatMessages = document.getElementById("chat-messages");

    if (welcomeSection && chatInterface) {
      welcomeSection.style.display = "none";
      chatInterface.style.display = "flex";

      // Initialize WebSocket connection for this chat
      if (CONFIG.useWebSocket && !websocket) {
        initializeWebSocket();
      }

      // Add default message
      if (CONFIG.showWelcome && chatMessages) {
        addMessage(CONFIG.defaultMessage, "bot");
      }

      // Focus on input
      const chatInput = document.getElementById("chat-input");
      if (chatInput) {
        setTimeout(() => chatInput.focus(), 100);
      }
    }
  }

  /**
   * Send user message
   */
  async function sendMessage() {
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");

    if (!chatInput || !chatInput.value.trim() || isTyping) {
      return;
    }

    const message = chatInput.value.trim();
    chatInput.value = "";
    sendBtn.disabled = true;

    // Add user message to chat
    addMessage(message, "user");

    // Clean up any existing streaming message
    completeStreamingMessage();

    // Show thinking indicator
    showThinkingIndicator();

    try {
      if (
        CONFIG.useWebSocket &&
        websocket &&
        websocket.readyState === WebSocket.OPEN
      ) {
        // Send message via WebSocket
        sendWebSocketMessage(message);
      } else {
        // Fallback to API call with simulated streaming
        simulateStreamingResponse(
          "Sorry, I'm having trouble connecting. Please try again later."
        );
      }
    } catch (error) {
      hideTypingIndicator();
      addMessage(
        "Sorry, I'm having trouble connecting. Please try again later.",
        "bot"
      );
    }
  }

  /**
   * Call chat API
   */
  async function callChatAPI(message) {
    const requestBody = {
      message: message,
      history: chatHistory,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Update chat history
    chatHistory.push({
      user: message,
      bot: data.message,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 10 conversations
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }

    return data;
  }

  /**
   * Add message to chat
   */
  function addMessage(text, sender) {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;

    const messageText = document.createElement("div");

    // Render markdown for bot messages, plain text for user messages
    if (sender === "bot" && CONFIG.markdownEnabled) {
      messageText.innerHTML = renderMarkdown(text);
    } else {
      messageText.textContent = text;
    }

    messageDiv.appendChild(messageText);

    const messageTime = document.createElement("div");
    messageTime.className = "message-time";
    messageTime.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    messageDiv.appendChild(messageTime);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Create streaming message element
   */
  function createStreamingMessage() {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return null;

    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot streaming";

    const messageText = document.createElement("div");
    messageText.textContent = "";
    messageDiv.appendChild(messageText);

    const messageTime = document.createElement("div");
    messageTime.className = "message-time";
    messageTime.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    messageDiv.appendChild(messageTime);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageText;
  }

  /**
   * Update streaming message with progressive markdown rendering
   */
  function updateStreamingMessage(text) {
    if (streamingMessageElement) {
      // Render markdown for streaming messages
      if (CONFIG.markdownEnabled) {
        // Split text into lines and render completed lines as markdown
        const lines = text.split("\n");
        let renderedText = "";

        // Render all complete lines (except the last one) as markdown
        for (let i = 0; i < lines.length; i++) {
          if (i === lines.length - 1) {
            // Last line - render as plain text if it's incomplete
            renderedText += lines[i];
          } else {
            // Complete lines - render as markdown
            renderedText += renderMarkdown(lines[i] + "\n");
          }
        }

        streamingMessageElement.innerHTML = renderedText;
      } else {
        streamingMessageElement.textContent = text;
      }
      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }

  /**
   * Complete streaming message
   */
  function completeStreamingMessage() {
    if (streamingMessageElement) {
      // Final render of the complete message with markdown
      if (CONFIG.markdownEnabled) {
        streamingMessageElement.innerHTML = renderMarkdown(
          currentStreamingMessage
        );
      }
      streamingMessageElement.parentElement.classList.remove("streaming");
      streamingMessageElement = null;
      currentStreamingMessage = "";
    }
  }

  /**
   * Simulate streaming response for fallback
   */
  async function simulateStreamingResponse(text) {
    const words = text.split(" ");
    let currentText = "";

    // Change from "thinking" to "typing" when streaming starts
    if (isThinking) {
      showTypingIndicator();
    }
    streamingMessageElement = createStreamingMessage();

    for (let i = 0; i < words.length; i++) {
      const wordsToAdd = Math.random() > 0.5 ? 1 : 2;
      const endIndex = Math.min(i + wordsToAdd, words.length);
      const newWords = words.slice(i, endIndex);
      currentText += (currentText ? " " : "") + newWords.join(" ");

      updateStreamingMessage(currentText);

      i = endIndex - 1;

      // Random delay between chunks (100-300ms) - faster typing
      await new Promise((resolve) =>
        setTimeout(resolve, 100 + Math.random() * 200)
      );
    }

    hideTypingIndicator(); // Hide typing indicator when streaming is complete
    completeStreamingMessage();
  }

  /**
   * Show thinking indicator
   */
  function showThinkingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    const typingText = document.getElementById("typing-text");
    if (typingIndicator && typingText) {
      isThinking = true;
      typingIndicator.style.display = "flex";
      typingText.textContent = "🤔 AI is thinking...";
      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }

  /**
   * Show typing indicator
   */
  function showTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    const typingText = document.getElementById("typing-text");
    if (typingIndicator && typingText) {
      isTyping = true;
      typingIndicator.style.display = "flex";
      typingText.textContent = "⌨️ AI is typing...";
      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }

  /**
   * Hide typing indicator
   */
  function hideTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
      isTyping = false;
      isThinking = false;
      typingIndicator.style.display = "none";
    }
  }

  /**
   * Initialize WebSocket connection
   */
  function initializeWebSocket() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      websocket = new WebSocket(CONFIG.websocketUrl);

      websocket.onopen = () => {
        reconnectAttempts = 0;

        // Start ping-pong heartbeat
        startPingPong();

        // Join chat session
        if (currentSessionId) {
          sendWebSocketMessage({
            type: "join_chat",
            sessionId: currentSessionId,
            userAgent: navigator.userAgent,
            url: window.location.href,
          });
        } else {
          sendWebSocketMessage({
            type: "join_chat",
            userAgent: navigator.userAgent,
            url: window.location.href,
          });
        }
      };

      websocket.onmessage = (event) => {
        handleWebSocketMessage(event.data);
      };

      websocket.onclose = (event) => {
        // Stop ping-pong heartbeat
        stopPingPong();

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(() => {
            initializeWebSocket();
          }, 2000 * reconnectAttempts); // Exponential backoff
        } else {
          addMessage(
            "Connection lost. Please refresh the page to reconnect.",
            "bot"
          );
        }
      };

      websocket.onerror = (error) => {
        // WebSocket error
      };
    } catch (error) {
      // Failed to initialize WebSocket
    }
  }

  /**
   * Send WebSocket message
   */
  function sendWebSocketMessage(data) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      if (typeof data === "string") {
        // Handle string message (user input)
        websocket.send(
          JSON.stringify({
            type: "user_message",
            sessionId: currentSessionId,
            message: data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
          })
        );
      } else {
        // Handle object message (join_chat, etc.)
        websocket.send(JSON.stringify(data));
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  function handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "connected":
          break;

        case "chat_joined":
          currentSessionId = message.sessionId;

          // Load chat history if available
          if (message.messages && message.messages.length > 0) {
            const chatMessages = document.getElementById("chat-messages");
            if (chatMessages) {
              chatMessages.innerHTML = ""; // Clear existing messages
              message.messages.forEach((msg) => {
                addMessage(msg.message, msg.type);
              });
            }
          }
          break;

        case "message_received":
          break;

        case "ai_message":
          hideTypingIndicator();
          addMessage(message.message, "bot");
          break;

        case "ai_message_stream":
          // Create streaming message element if this is the first chunk
          if (!streamingMessageElement) {
            // Change from "thinking" to "typing" when streaming starts
            if (isThinking) {
              showTypingIndicator();
            }
            streamingMessageElement = createStreamingMessage();
            currentStreamingMessage = "";
          }

          // Update the streaming message
          currentStreamingMessage = message.message;
          updateStreamingMessage(currentStreamingMessage);

          // Complete the message if this is the final chunk
          if (message.isComplete) {
            hideTypingIndicator(); // Hide typing indicator when streaming is complete
            completeStreamingMessage();
          }
          break;

        case "error":
          hideTypingIndicator();
          addMessage(message.message, "bot");
          break;

        case "pong":
          // Keep-alive response
          handlePong();
          break;

        default:
          break;
      }
    } catch (error) {
      // Error parsing WebSocket message
    }
  }

  /**
   * Close WebSocket connection
   */
  function closeWebSocket() {
    if (websocket) {
      stopPingPong();
      websocket.close();
      websocket = null;
      currentSessionId = null;
    }
  }

  /**
   * Start ping-pong heartbeat
   */
  function startPingPong() {
    stopPingPong(); // Clear any existing intervals

    pingInterval = setInterval(() => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        sendPing();
      }
    }, 1000); // Send ping every 1 second
  }

  /**
   * Stop ping-pong heartbeat
   */
  function stopPingPong() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (pongTimeout) {
      clearTimeout(pongTimeout);
      pongTimeout = null;
    }
  }

  /**
   * Send ping to server
   */
  function sendPing() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      const pingData = {
        type: "ping",
        timestamp: new Date().toISOString(),
      };

      websocket.send(JSON.stringify(pingData));

      // Set timeout for pong response (5 seconds)
      pongTimeout = setTimeout(() => {
        // Force reconnection if no pong received
        if (websocket) {
          websocket.close();
        }
      }, 5000);
    }
  }

  /**
   * Handle pong response from server
   */
  function handlePong() {
    lastPongTime = new Date();

    // Clear the pong timeout
    if (pongTimeout) {
      clearTimeout(pongTimeout);
      pongTimeout = null;
    }
  }

  /**
   * Public API methods
   */
  window.AIChatbot = {
    init: initChatbot,
    open: openChatbot,
    close: closeChatbot,
    toggle: toggleChatbot,
    sendMessage: (message) => {
      const chatInput = document.getElementById("chat-input");
      if (chatInput) {
        chatInput.value = message;
        sendMessage();
      }
    },
    // WebSocket methods
    connectWebSocket: initializeWebSocket,
    disconnectWebSocket: closeWebSocket,
    getSessionId: () => currentSessionId,
    getWebSocketStatus: () => (websocket ? websocket.readyState : null),
    // Ping-pong methods
    startPingPong: startPingPong,
    stopPingPong: stopPingPong,
    getLastPongTime: () => lastPongTime,
    // Configuration
    config: CONFIG,
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
  } else {
    initChatbot();
  }
})();
