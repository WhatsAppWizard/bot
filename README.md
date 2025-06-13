
# WhatsAppWizard

A Node.js application that allows users to download media from YouTube, Instagram, Twitter, and TikTok using WhatsApp and create stickers from images.

[![Build Docker Image](https://github.com/gitnasr/WhatsAppWizard/actions/workflows/docker-build.yml/badge.svg)](https://github.com/gitnasr/WhatsAppWizard/actions/workflows/docker-build.yml)
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/gitnasr/WhatsAppWizard/releases/tag/v1.2.0)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)

WhatsAppWizard empowers users to easily download online content and create personalized stickers directly through WhatsApp, enhancing their messaging experience.

## Table of Contents
1. [Key Features ✨](#key-features-)
2. [Demo/Screenshots 📸](#demoscreenshots-)
3. [Technology Stack 🛠️](#technology-stack-)
4. [Getting Started 🚀](#getting-started-)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Configuration](#configuration)
    - [Running the Project](#running-the-project)
5. [Usage Examples 💡](#usage-examples-)
6. [Project Structure 📁](#project-structure-)
7. [Contributing 🤝](#contributing-)
9. [Deployment 🚀](#deployment-)
10. [API Documentation 📚](#api-documentation-)
11. [Roadmap 🗺️](#roadmap-)
12. [Support & Contact 💬](#support--contact-)
13. [License 📄](#license-)
14. [Acknowledgments 🙏](#acknowledgments-)

## Key Features ✨

-   **Media Downloading**: Download videos and images from YouTube, Instagram, TikTok, Twitter, and Facebook directly via WhatsApp by simply sending a link.
-   **Sticker Creation**: Create personalized WhatsApp stickers from any image sent to the bot.
-   **Telegram Bot**:  System administrators can monitor the server, manage broadcast messages, and handle unread chats.
-   **Rate Limiting**: Implemented to prevent abuse and ensure fair usage of the bot.
-   **Analytics**: Track usage and errors using PostHog to improve the bot's functionality and user experience.
-   **Agent Service**: Integrated with an agent to provide automated responses and support to users

## Demo/Screenshots 📸

TODO: Add demo links, screenshots, or GIFs showcasing the bot's features and usage.

## Technology Stack 🛠️

-   **Languages**:
    -   TypeScript
-   **Frameworks**:
    -   Node.js
    -   Express.js
    -   whatsapp-web.js
    -   Telegraf
-   **Tools**:
    -   npm
    -   Docker
    -   Prisma
    -   PM2
    -   Eslint
-   **Services**:
    -   PostgreSQL
    -   Redis
    -   Telegram Bot API
    -   SnapSaver API
    -   nayan-video-downloader API
    -   PostHog

## Getting Started 🚀

### Prerequisites

-   Node.js (version 18 or higher)
-   Docker and Docker Compose (optional, for containerized deployment)
-   A Telegram bot token and chat ID (required for admin notifications)
-   Redis instance, A postgres instance (required)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/gitnasr/WhatsAppWizard.git
    cd WhatsAppWizard
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Create a `.env` file based on the `.env.example` template and fill in the required values:
    ```bash
    cp .env.example .env
    ```

2.  Edit the `.env` file with your configuration:
    ```
    POSTGRES_DB=whatsappwizard
    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=whatsapp123

    BOT_TOKEN=your_telegram_bot_token_here
    CHAT_ID=your_telegram_chat_id_here

    POSTHOG_API_KEY=
    POSTHOG_HOST=

    PGADMIN_EMAIL=admin@whatsappwizard.local
    PGADMIN_PASSWORD=admin123
    ```

### Running the Project

#### Development

1.  Start the development server:
    ```bash
    npm run dev
    ```

2.  Alternatively, using Docker Compose for development:
    ```bash
    docker-compose -f docker-compose.dev.yml up --build
    ```

#### Production

1.  Build the application:
    ```bash
    npm run build
    ```
    or with docker
     ```bash
       docker-compose up --build
    ```

2. if not using docker:  Start built application
    ```bash
    npm start
    ```
**Using Docker:**

1.  Build and run the Docker container:
    ```bash
    docker-compose up --build
    ```

## Usage Examples 💡

1.  Send a YouTube link to the WhatsApp bot:

    ```
    https://www.youtube.com/watch?v=dQw4w9WgXcQ
    ```

2.  Send an image to the bot to create a sticker.

3.  Send any message to the agent
   ```
   Tell me a joke
   ```

## Project Structure 📁

```
WhatsAppWizard/
├── .github/workflows/         # GitHub Actions workflows
├── .dockerignore               # Files to ignore in Docker builds
├── .env.example                # Example environment variables
├── ecosystem.config.js        # PM2 configuration file
├── nodemon.json                # Nodemon configuration file
├── package.json                # Project dependencies and scripts
├── prisma/                     # Prisma database schema
│   └── schema.prisma           # Prisma schema definition
├── src/                        # Source code
│   ├── errors/                 # Custom error classes
│   ├── routes/                 # Express routes
│   ├── services/               # Application services
│   ├── types/                  # TypeScript types
│   └── index.ts                # Main application entry point
├── tsconfig.json               # TypeScript configuration file
├── docker-compose.yml          # Docker Compose configuration
```

## Contributing 🤝

We welcome contributions to WhatsAppWizard! Please follow these guidelines:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with descriptive messages.
4.  Submit a pull request.

## Deployment 🚀

Deploying to Production:

1. **Build the Docker image**

  ```bash
  docker build -t whatsapp-wizard .
  ```
2.  **Push the Image**
  Push the built image to a container registry like Docker Hub:
  ```bash
  docker tag whatsapp-wizard:latest YOUR_DOCKERHUB_USERNAME/whatsapp-wizard:latest
  docker push YOUR_DOCKERHUB_USERNAME/whatsapp-wizard:latest
  ```
3.  **Deploy to your server**
  Pull and start the Docker image on Your Server:
```bash
    docker pull YOUR_DOCKERHUB_USERNAME/whatsapp-wizard:latest
    docker run -d -p 3000:3000 <IMAGE_ID>
```
4. **Using docker compose**
 *  **Configure environment variables**: Pass environment variables required to configure the server.
   *  **Set up reverse proxy (Nginx)**: Configure Nginx as a reverse proxy to route traffic to containers.

## API Documentation 📚

TODO: Add a link to detailed API documentation if applicable.

## Roadmap 🗺️

-   [ ] Implement additional media download sources.
-   [ ] Enhance sticker customization options.
-   [ ] Improve error handling and logging.
-   [ ] Add support for multiple languages.

## Support & Contact 💬

For support, questions, or feature requests, please:

-   Open an issue on GitHub:  TODO: Add link to issues section
-   Contact me via: https://github.com/gitnasr

## License 📄

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- SnapSaver for the free API.
-  nayan-video-downloader for providing  free API

```
