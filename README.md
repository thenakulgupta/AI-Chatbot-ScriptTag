# AI Chatbot Script Tag Integration

A lightweight, customizable AI chatbot widget that can be easily integrated into any website using a simple script tag.

## Features

- 🚀 **Easy Integration**: Just add one script tag to your HTML
- 📱 **Responsive Design**: Works perfectly on desktop and mobile devices
- 🎨 **Customizable**: Configurable via data attributes
- ⚡ **Lightweight**: Minimal impact on page load time
- 🔄 **Real-time Chat**: Smooth animations and typing indicators
- 🎯 **Sticky CTA**: Always visible chat button in bottom right
- 🔧 **API Ready**: Built-in API integration for your backend
- ♿ **Accessible**: Keyboard navigation and screen reader support

## Quick Start

### 1. Basic Integration

Add this script tag to your HTML:

```html
<script src="https://your-cdn-url.com/ai-chatbot.js"></script>
```

### 2. Advanced Configuration

Customize the chatbot using data attributes:

```html
<script
  src="https://your-cdn-url.com/ai-chatbot.js"
  data-api-url="https://your-api.com/chat"
  data-default-message="Welcome! How can I help you?"
  data-cdn-base-url="https://your-cdn-url.com/html/"
  data-auto-open="true"
></script>
```

## Configuration Options

| Attribute              | Description                       | Default                              |
| ---------------------- | --------------------------------- | ------------------------------------ |
| `data-api-url`         | Your chat API endpoint            | `https://api.example.com/chat`       |
| `data-default-message` | Welcome message shown to users    | `"Hello! How can I help you today?"` |
| `data-cdn-base-url`    | Base URL for HTML/CSS assets      | `https://your-cdn-url.com/html/`     |
| `data-auto-open`       | Auto-open chatbot after page load | `false`                              |
| `data-show-welcome`    | Show welcome section initially    | `true`                               |

## JavaScript API

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

// Access configuration
console.log(AIChatbot.config);
```

## API Integration

### Request Format

The chatbot sends POST requests to your API with this structure:

```json
{
  "message": "User's message",
  "history": [
    {
      "user": "Previous user message",
      "bot": "Previous bot response",
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "userAgent": "Browser user agent",
  "url": "Current page URL"
}
```

### Response Format

Your API should return responses in this format:

```json
{
  "message": "Bot's response message",
  "status": "success"
}
```

### Example API Endpoint (Node.js/Express)

```javascript
app.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    // Process the message with your AI service
    const response = await processMessage(message, history);

    res.json({
      message: response,
      status: "success",
    });
  } catch (error) {
    res.status(500).json({
      message: "Sorry, I encountered an error. Please try again.",
      status: "error",
    });
  }
});
```

## File Structure

```
ai-chatbot-script-tag/
├── ai-chatbot.js          # Main script file
├── html/
│   ├── chatbot.html       # Chatbot UI template
│   └── chatbot.css        # Chatbot styles
├── example.html           # Integration example
└── README.md             # This file
```

## Deployment

1. **Upload Files**: Upload all files to your CDN or web server
2. **Update URLs**: Update the `data-cdn-base-url` in your script tag
3. **Configure API**: Set your API endpoint using `data-api-url`
4. **Test Integration**: Use the example.html file to test

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Customization

### Styling

The chatbot uses CSS custom properties for easy theming. You can override styles by adding CSS after the chatbot loads:

```css
:root {
  --chatbot-primary-color: #your-color;
  --chatbot-secondary-color: #your-secondary-color;
}
```

### Behavior

Modify the `CONFIG` object in `ai-chatbot.js` to change default behavior:

```javascript
const CONFIG = {
  apiUrl: "your-api-endpoint",
  defaultMessage: "Your welcome message",
  // ... other options
};
```

## Troubleshooting

### Common Issues

1. **Chatbot not loading**: Check that the CDN URLs are correct and accessible
2. **API errors**: Verify your API endpoint is working and returns the expected format
3. **Styling issues**: Ensure the CSS file is loading correctly

### Debug Mode

Enable debug logging by opening browser console. The chatbot logs initialization and error messages.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions, please open an issue in the repository or contact the development team.
