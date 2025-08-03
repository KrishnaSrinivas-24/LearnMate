// api/chat.js

import axios from 'axios';

// This is the serverless function handler
export default async function handler(req, res) {
    // Ensure this function only handles POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const IBM_API_KEY = process.env.IBM_API_KEY;
    const PROJECT_ID = process.env.PROJECT_ID; // Vercel gets this from your settings
    const IAM_URL = 'https://iam.cloud.ibm.com/identity/token';
    // Use your working non-streaming endpoint
    const SCORING_URL = 'https://us-south.ml.cloud.ibm.com/ml/v4/deployments/6aa5c265-8965-4028-b9bc-64027944f790/ai_service?version=2021-05-01';

    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }

        // 1. Get IAM Token
        const tokenResponse = await axios.post(
            IAM_URL,
            `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${IBM_API_KEY}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const token = tokenResponse.data.access_token;

        // 2. Prepare Payload for IBM API
        const payload = {
            project_id: PROJECT_ID, // Include Project ID if needed by the new endpoint
            messages: [{ content: userMessage, role: "user" }],
        };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        // 3. Call the IBM AI service
        const aiResponse = await axios.post(SCORING_URL, payload, { headers });

        // 4. Send the AI's reply back to the frontend
        res.status(200).json(aiResponse.data);

    } catch (error) {
        // Log the error on the server (visible in Vercel Logs)
        console.error("Error in /api/chat:", error.response ? error.response.data : error.message);
        // Send a generic error response to the client
        res.status(500).json({ error: "An internal server error occurred." });
    }
}