import AnalyticsService from './Analytics';
import axios from 'axios';

interface AgentMessage {
    message: {
        text: string;
    };
    user : {
        id: string
    }
}

interface AgentResponse {
    response: string;
}

export class AgentService {
    private readonly webhookUrl: string;

    constructor() {
        this.webhookUrl = 'https://wagent.gitnasr.com/webhook';
    }

    /**
     * Sends a message to the agent webhook and returns the response
     * @param message The message text to send to the agent
     * @returns The agent's response
     * @throws Error if the request fails
     */
    async sendMessage(message: string,userId: string): Promise<string> {
        try {
            const payload: AgentMessage = {
                message: {
                    text: message
                },
                user: { 
                      "id":userId
                }
            };

            const response = await axios.post<AgentResponse>(this.webhookUrl, payload);
            return response.data.response;
        } catch (error) {
            // Track the error in analytics
            AnalyticsService.trackEvent('agent_error', 'system', {
                error: error instanceof Error ? error.message : 'Unknown error',
                message: message,
                timestamp: new Date().toISOString()
            });

            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to send message to agent: ${error.message}`);
            }
            throw new Error('An unexpected error occurred while sending message to agent');
        }
    }
}
