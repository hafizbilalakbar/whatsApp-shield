// WebSocket utilities for Message Agent
const messageAgentWebSocket = {
  // Initialize WebSocket message handling
  initWebSocketHandlers: (wsRef, addLog) => {
    if (!wsRef.current) return;
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS Message Agent Message:', data.type, data);
        
        switch (data.type) {
          case 'MESSAGE_RECEIVED':
            // Handle incoming message in Message Agent
            handleIncomingMessage(data);
            break;
            
          case 'MESSAGE_SENT':
            // Handle sent message confirmation
            handleSentMessage(data);
            break;
            
          case 'CONTACT_UPDATED':
            // Handle contact updates
            handleContactUpdate(data);
            break;
            
          case 'AI_RESPONDING':
            // Handle AI responding status
            addLog('AI is typing...', 'info');
            break;
            
          case 'AI_RESPONSE_RECEIVED':
            // Handle AI response received
            handleAIResponse(data);
            break;
            
          default:
            console.log('WS Message Agent unhandled type:', data.type, data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  },
  
  // Handle incoming message
  handleIncomingMessage: (data) => {
    const { from, message, timestamp, conversationId } = data;
    
    // Dispatch custom event for Message Agent to handle
    const event = new CustomEvent('messageAgent-incoming-message', {
      detail: { from, message, timestamp, conversationId }
    });
    window.dispatchEvent(event);
  },
  
  // Handle sent message
  handleSentMessage: (data) => {
    const { messageId, status, timestamp, conversationId } = data;
    
    // Dispatch custom event for Message Agent to handle
    const event = new CustomEvent('messageAgent-sent-message', {
      detail: { messageId, status, timestamp, conversationId }
    });
    window.dispatchEvent(event);
  },
  
  // Handle contact update
  handleContactUpdate: (data) => {
    const { contact, conversationId } = data;
    
    // Dispatch custom event for Message Agent to handle
    const event = new CustomEvent('messageAgent-contact-update', {
      detail: { contact, conversationId }
    });
    window.dispatchEvent(event);
  },
  
  // Handle AI response
  handleAIResponse: (data) => {
    const { message, timestamp, conversationId, confidence } = data;
    
    // Dispatch custom event for Message Agent to handle
    const event = new CustomEvent('messageAgent-ai-response', {
      detail: { message, timestamp, conversationId, confidence }
    });
    window.dispatchEvent(event);
  },
  
  // Send a message via WebSocket
  sendMessage: (wsRef, message, conversationId, mode = 'manual') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
    
    const payload = {
      type: 'SEND_MESSAGE',
      message,
      conversationId,
      mode,
      timestamp: new Date().toISOString()
    };
    
    wsRef.current.send(JSON.stringify(payload));
    return true;
  },
  
  // Update contact status
  updateContact: (wsRef, contact, conversationId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot update contact');
      return false;
    }
    
    const payload = {
      type: 'UPDATE_CONTACT',
      contact,
      conversationId,
      timestamp: new Date().toISOString()
    };
    
    wsRef.current.send(JSON.stringify(payload));
    return true;
  }
};

export default messageAgentWebSocket;
