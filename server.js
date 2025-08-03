// server.js

// Import the necessary tools
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // This loads your .env file secrets

// Create the server application
const app = express();

// Set up middleware to handle JSON and serve static files from the 'public' folder
app.use(express.json());
app.use(express.static('public'));

// Define constants for your API key and the IBM URLs
const IBM_API_KEY = process.env.IBM_API_KEY;
const PROJECT_ID = process.env.PROJECT_ID; // You'll need to add this to your .env file
const IAM_URL = 'https://iam.cloud.ibm.com/identity/token';

// Updated to use the correct watsonx.ai endpoint format with required version parameter
const WATSONX_URL = 'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29';

/**
 * Asynchronously gets a temporary IAM access token from IBM Cloud.
 * @returns {Promise<string>} A promise that resolves to the access token.
 */
async function getIAMToken() {
    try {
        console.log('Requesting IAM token...');
        const response = await axios.post(
            IAM_URL,
            `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${IBM_API_KEY}`,
            { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000 // 15 second timeout
            }
        );
        console.log('IAM token obtained successfully');
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting IAM token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Create your server's endpoint that the frontend will call
app.post('/api/chat', async (req, res) => {
    console.log('Received chat request:', req.body);
    
    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            console.log('Empty message received');
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }

        // Check if API key and project ID are configured
        if (!IBM_API_KEY) {
            console.error('IBM_API_KEY not found in environment variables');
            return res.status(500).json({ error: 'Server configuration error: API key missing' });
        }

        if (!PROJECT_ID) {
            console.error('PROJECT_ID not found in environment variables');
            return res.status(500).json({ error: 'Server configuration error: Project ID missing. Please add PROJECT_ID to your .env file' });
        }

        console.log('Getting IAM token...');
        const token = await getIAMToken();

        // Updated payload for IBM Watsonx.ai text generation with correct model
        const payload = {
            "input": `Human: ${userMessage}\n\nAssistant: I'm LearnMate, your AI learning coach. I'm here to help you with educational planning, finding resources, and answering questions about learning and development.`,
            "parameters": {
                "decoding_method": "greedy",
                "max_new_tokens": 500,
                "temperature": 0.7,
                "stop_sequences": ["Human:", "\n\nHuman:"]
            },
            "model_id": "ibm/granite-3-3-8b-instruct", // Updated to use correct Granite 3.3 model
            "project_id": PROJECT_ID
        };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        console.log('Sending request to IBM Watsonx.ai...');
        console.log('URL:', WATSONX_URL);
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const aiResponse = await axios.post(WATSONX_URL, payload, { 
            headers,
            timeout: 45000 // 45 second timeout for AI response
        });

        console.log('Received response from IBM Watsonx.ai:', JSON.stringify(aiResponse.data, null, 2));
        
        // IBM Watsonx.ai returns response in this format:
        // { results: [{ generated_text: "response text" }] }
        let responseText = '';
        if (aiResponse.data.results && aiResponse.data.results.length > 0) {
            responseText = aiResponse.data.results[0].generated_text;
            // Clean up the response to remove the input prompt
            responseText = responseText.replace(/^Human:.*?Assistant:\s*/, '').trim();
        }

        // Format response to match your frontend expectations
        const formattedResponse = {
            choices: [{
                index: 0,
                message: {
                    content: responseText || "I'm sorry, I couldn't generate a response. Please try again.",
                    role: "assistant"
                }
            }]
        };

        res.json(formattedResponse);

    } catch (error) {
        console.error("Error communicating with IBM Watsonx.ai:");
        
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            console.error('Response headers:', error.response.headers);
            
            res.status(error.response.status).json({ 
                error: "Failed to get response from AI",
                details: error.response.data,
                status: error.response.status
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received - this could be:');
            console.error('1. Network connectivity issue');
            console.error('2. Firewall blocking the request');
            console.error('3. IBM service temporarily unavailable');
            console.error('4. Incorrect endpoint URL');
            console.error('Request details:', {
                url: WATSONX_URL,
                method: 'POST',
                timeout: '45 seconds'
            });
            
            res.status(500).json({ 
                error: "Connection timeout - unable to reach IBM Watsonx.ai service",
                suggestion: "Please check your internet connection and try again"
            });
        } else {
            // Something happened in setting up the request
            console.error('Request setup error:', error.message);
            res.status(500).json({ 
                error: "Failed to set up request to AI service",
                details: error.message
            });
        }
    }
});

// Alternative endpoint using different supported models
app.post('/api/chat-v2', async (req, res) => {
    console.log('Trying alternative endpoint with different model...');
    
    try {
        const userMessage = req.body.message;
        const token = await getIAMToken();

        // Try with Llama model as alternative
        const payload = {
            "input": `You are LearnMate, an AI learning coach. Help the user with their learning question: ${userMessage}`,
            "parameters": {
                "decoding_method": "greedy",
                "max_new_tokens": 400,
                "temperature": 0.7
            },
            "model_id": "meta-llama/llama-3-8b-instruct", // Alternative Llama model
            "project_id": PROJECT_ID
        };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const aiResponse = await axios.post(WATSONX_URL, payload, { 
            headers,
            timeout: 30000
        });

        const responseText = aiResponse.data.results?.[0]?.generated_text || "I'm having trouble generating a response.";
        
        const formattedResponse = {
            choices: [{
                index: 0,
                message: {
                    content: responseText,
                    role: "assistant"
                }
            }]
        };

        res.json(formattedResponse);

    } catch (error) {
        console.error('Alternative endpoint also failed:', error.message);
        res.status(500).json({ 
            error: "Both primary and alternative endpoints failed",
            details: error.response?.data || error.message
        });
    }
});

// Third alternative endpoint with smaller Granite model
app.post('/api/chat-v3', async (req, res) => {
    console.log('Trying third alternative with smaller Granite model...');
    
    try {
        const userMessage = req.body.message;
        const token = await getIAMToken();

        const payload = {
            "input": `You are LearnMate, an AI learning coach. Help the user with their learning question: ${userMessage}`,
            "parameters": {
                "decoding_method": "greedy",
                "max_new_tokens": 400,
                "temperature": 0.7
            },
            "model_id": "ibm/granite-3-3-2b-instruct", // Smaller Granite 3.3 model
            "project_id": PROJECT_ID
        };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const aiResponse = await axios.post(WATSONX_URL, payload, { 
            headers,
            timeout: 30000
        });

        const responseText = aiResponse.data.results?.[0]?.generated_text || "I'm having trouble generating a response.";
        
        const formattedResponse = {
            choices: [{
                index: 0,
                message: {
                    content: responseText,
                    role: "assistant"
                }
            }]
        };

        res.json(formattedResponse);

    } catch (error) {
        console.error('Third alternative endpoint also failed:', error.message);
        res.status(500).json({ 
            error: "All endpoints failed",
            details: error.response?.data || error.message
        });
    }
});

// Add a health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: {
            hasApiKey: !!IBM_API_KEY,
            hasProjectId: !!PROJECT_ID,
            nodeVersion: process.version,
            endpoints: {
                primary: WATSONX_URL,
                alternative: `https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29`
            },
            supportedModels: [
                "ibm/granite-3-3-8b-instruct",
                "ibm/granite-3-3-2b-instruct", 
                "meta-llama/llama-3-8b-instruct"
            ]
        }
    });
});

// Test endpoint to verify IBM connection and available models
app.get('/api/test-connection', async (req, res) => {
    try {
        console.log('Testing IBM connection...');
        const token = await getIAMToken();
        
        res.json({
            success: true,
            message: 'Successfully obtained IAM token',
            tokenExists: !!token,
            endpoints: {
                iam: IAM_URL,
                watsonx: WATSONX_URL
            },
            recommendedModels: [
                "ibm/granite-3-3-8b-instruct (primary)",
                "ibm/granite-3-3-2b-instruct (smaller/faster)",
                "meta-llama/llama-3-8b-instruct (alternative)"
            ]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// Add CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Start the server and listen for requests on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running! Open your browser to http://localhost:${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`Connection test available at: http://localhost:${PORT}/api/test-connection`);
    console.log('Environment check:');
    console.log('- IBM_API_KEY configured:', !!IBM_API_KEY);
    console.log('- PROJECT_ID configured:', !!PROJECT_ID);
    console.log('- Node.js version:', process.version);
    console.log('');
    console.log('API Endpoints:');
    console.log('- Primary: /api/chat (Granite 3.3 8B Instruct model)');
    console.log('- Alternative 1: /api/chat-v2 (Llama 3 8B Instruct model)');
    console.log('- Alternative 2: /api/chat-v3 (Granite 3.3 2B Instruct model)');
    console.log('');
    console.log('Supported Models:');
    console.log('- ibm/granite-3-3-8b-instruct (recommended)');
    console.log('- ibm/granite-3-3-2b-instruct (smaller/faster)');
    console.log('- meta-llama/llama-3-8b-instruct (alternative)');
    
    if (!PROJECT_ID) {
        console.log('');
        console.log('⚠️  WARNING: PROJECT_ID not found in .env file!');
        console.log('   Add PROJECT_ID=your_watsonx_project_id to your .env file');
        console.log('   You can find this in your IBM Watsonx.ai project settings');
    }
});