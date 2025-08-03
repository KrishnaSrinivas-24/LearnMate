document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const btnText = sendBtn.querySelector('.btn-text') || sendBtn;

    const sendMessage = async () => {
        const messageText = userInput.value.trim();
        if (messageText === '') return;

        // Display user's message in the chatbox
        addMessage(messageText, 'user');
        userInput.value = '';

        // Disable button while sending with loading state
        sendBtn.disabled = true;
        btnText.textContent = 'Sending...';
        sendBtn.style.opacity = '0.7';

        // Add typing indicator
        const typingIndicator = addTypingIndicator();

        try {
            console.log('Sending message:', messageText);
            
            // Send the user's message to YOUR backend server's endpoint
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Full response:', data);
            
            // Remove typing indicator
            removeTypingIndicator(typingIndicator);
            
            // IBM Watson returns response in this format:
            // { choices: [{ index: 0, message: { content: "response", role: "assistant" } }] }
            let aiReply = '';
            
            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                aiReply = data.choices[0].message.content;
            } else if (data.results && data.results[0] && data.results[0].generated_text) {
                // Fallback for other API formats
                aiReply = data.results[0].generated_text;
            } else if (data.message) {
                aiReply = data.message;
            } else {
                console.error('Unexpected response format:', data);
                aiReply = "Sorry, I received an unexpected response format.";
            }
            
            console.log('AI Reply:', aiReply);
            
            // Display AI's message in the chatbox with slight delay for natural feel
            if (aiReply) {
                setTimeout(() => {
                    addMessage(aiReply, 'bot');
                }, 300);
            } else {
                setTimeout(() => {
                    addMessage("Sorry, I couldn't generate a response. Please try again.", 'error');
                }, 300);
            }

        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator(typingIndicator);
            setTimeout(() => {
                addMessage('Oops! Something went wrong. Please try again later.', 'error');
            }, 300);
        } finally {
            // Re-enable button
            sendBtn.disabled = false;
            btnText.textContent = 'Send';
            sendBtn.style.opacity = '1';
            userInput.focus();
        }
    };

    // Helper function to add any message to the chatbox
    function addMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        // Format the text for better readability
        const formattedText = formatMessage(text);
        messageElement.innerHTML = formattedText;
        
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        return messageElement;
    }

    // Format message for better readability
    function formatMessage(text) {
        // Convert URLs to clickable links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let formatted = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: underline;">$1</a>');
        
        // Add line breaks for better readability of lists
        formatted = formatted.replace(/(\d+\.\s)/g, '<br>$1');
        formatted = formatted.replace(/^\s*\*\s/gm, '<br>• ');
        
        return formatted;
    }

    // Add typing indicator
    function addTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.classList.add('message', 'bot', 'typing-indicator');
        typingElement.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        // Add CSS for typing dots if not already added
        if (!document.querySelector('#typing-styles')) {
            const style = document.createElement('style');
            style.id = 'typing-styles';
            style.textContent = `
                .typing-indicator {
                    opacity: 0.7;
                }
                .typing-dots {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }
                .typing-dots span {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #667eea;
                    animation: typing 1.4s infinite ease-in-out;
                }
                .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0.8); opacity: 0.3; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        chatBox.appendChild(typingElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        return typingElement;
    }

    // Remove typing indicator
    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-focus input on page load
    userInput.focus();

    // Character counter for input
    userInput.addEventListener('input', () => {
        const remaining = 500 - userInput.value.length;
        if (remaining < 50) {
            if (!document.querySelector('.char-counter')) {
                const counter = document.createElement('div');
                counter.className = 'char-counter';
                counter.style.cssText = `
                    position: absolute;
                    right: 24px;
                    bottom: 80px;
                    font-size: 12px;
                    color: ${remaining < 20 ? '#e53e3e' : '#718096'};
                    background: rgba(255, 255, 255, 0.9);
                    padding: 4px 8px;
                    border-radius: 12px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                `;
                document.getElementById('chat-container').appendChild(counter);
            }
            document.querySelector('.char-counter').textContent = `${remaining} characters left`;
            document.querySelector('.char-counter').style.color = remaining < 20 ? '#e53e3e' : '#718096';
        } else {
            const counter = document.querySelector('.char-counter');
            if (counter) counter.remove();
        }
    });
});