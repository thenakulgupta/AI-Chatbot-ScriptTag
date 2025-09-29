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
    apiUrl: "https://api.example.com/chat", // Default API endpoint
    defaultMessage: "Hello! How can I help you today?",
    cdnBaseUrl: "https://your-cdn-url.com/html/", // Base URL for HTML/CSS files
    theme: "default",
    position: "bottom-right",
    autoOpen: false,
    showWelcome: true,
  };

  // Global variables
  let chatbotInitialized = false;
  let chatHistory = [];
  let isTyping = false;

  /**
   * Initialize the chatbot
   */
  function initChatbot() {
    if (chatbotInitialized) {
      console.warn("Chatbot already initialized");
      return;
    }

    // Get configuration from script tag data attributes
    const scriptTag = document.querySelector('script[src*="ai-chatbot.js"]');
    if (scriptTag) {
      Object.keys(CONFIG).forEach((key) => {
        const value = scriptTag.getAttribute(
          `data-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`
        );
        if (value !== null) {
          CONFIG[key] = value;
        }
      });
    }

    // Load HTML and CSS
    loadChatbotAssets()
      .then(() => {
        setupEventListeners();
        chatbotInitialized = true;
        console.log("AI Chatbot initialized successfully");
      })
      .catch((error) => {
        console.error("Failed to initialize chatbot:", error);
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
      console.error("Error loading chatbot assets:", error);
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

    // Show typing indicator
    showTypingIndicator();

    try {
      // Call API
      const response = await callChatAPI(message);

      // Hide typing indicator
      hideTypingIndicator();

      // Add bot response
      if (response && response.message) {
        addMessage(response.message, "bot");
      } else {
        addMessage("Sorry, I encountered an error. Please try again.", "bot");
      }
    } catch (error) {
      console.error("Chat API error:", error);
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
    messageText.textContent = text;
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
   * Show typing indicator
   */
  function showTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
      isTyping = true;
      typingIndicator.style.display = "flex";
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
      typingIndicator.style.display = "none";
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
    config: CONFIG,
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
  } else {
    initChatbot();
  }
})();
