
# WhatsAppWizard 🧙‍♂️

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
<!-- Add other relevant badges here if you set them up (e.g., build status, code coverage) -->

**Download media and create stickers directly through WhatsApp!**

WhatsAppWizard is a Node.js application that turns your WhatsApp account into a powerful media tool. Send a link from popular platforms, and the bot will download and send back the video or image. You can also send an image to have it instantly converted into a WhatsApp sticker.

**🔗 Check out the demo:** [https://wwz.gitnasr.com](https://wwz.gitnasr.com/)

## ✨ Features

*   **📱 WhatsApp Integration:** Interact directly with the bot via WhatsApp messages.
*   **🔗 Multi-Platform Downloads:** Download videos and images from:
    *   Facebook
    *   Instagram
    *   TikTok
    *   YouTube
    *   Twitter
*   **🖼️ Sticker Creation:** Send an image to the bot, and it will automatically convert and send it back as a WhatsApp sticker.
*   **🚀 Background Processing:** Download tasks are handled in the background using a job queue (`bullmq`), ensuring the bot remains responsive.
*   **⚙️ Admin Controls (via Telegram):**
    *   Receive WhatsApp login QR codes directly in a private Telegram chat.
    *   Get status updates (authentication, connection status, errors).
    *   Basic commands for broadcasting messages (optional).
*   **📊 Analytics:** Track usage patterns, downloads, errors, and system events using PostHog.
*   **🛡️ Rate Limiting:** Basic protection against spam by limiting requests per user within a time window.
*   **💾 Persistent Storage:** Uses PostgreSQL database (via Prisma ORM) to store user information, download history, sticker usage, and error logs.

## 🛠️ Technical Deep Dive

WhatsAppWizard is built with a focus on modularity and robustness. Here's a look under the hood:

*   **Core Engine:** `whatsapp-web.js` library is used to automate WhatsApp Web in a headless browser session, enabling message listening and interaction.
*   **Asynchronous Workflow:** Heavy tasks like downloading media are offloaded to a `bullmq` job queue backed by Redis. This prevents the main WhatsApp event loop from being blocked, ensuring the bot stays responsive even during downloads.
    *   The `QueueService` manages adding download jobs.
    *   A dedicated `Worker` processes these jobs, calling the `DownloadService`.
    *   Events (`DownloadCompleted`, `DownloadFailed`) are emitted by the queue service and handled by the `WhatsApp` service to send results back to the user.
*   **Service-Oriented Design:** Functionality is broken down into distinct services (`WhatsApp`, `Download`, `Queue`, `Telegram`, `Database`, `Analytics`, `Config`, `RateLimiter`, `Files`). This promotes separation of concerns and makes the codebase easier to manage and extend.
*   **Download Strategy:**
    *   The `DownloadService` first attempts to detect the platform from the URL.
    *   It then routes the request to the appropriate platform-specific downloader method.
    *   It utilizes libraries like `snapsaver-downloader` for some platforms and custom logic (like external APIs via `axios`) for others (YouTube, Twitter).
    *   Downloaded media is temporarily saved to disk (`public/media/`) before being sent via WhatsApp and then deleted.
*   **Database Layer:** Prisma ORM provides type-safe database access to a PostgreSQL database. The **Repository Pattern** is used (`UserRepository`, `DownloadRepository`, `StickerRepository`, `ErrorRepository`) to abstract database logic from the main services.
*   **Configuration Management:** Environment variables (`.env` file) are used for sensitive information and settings. A `ConfigService` provides a centralized way to access configuration values like paths, Puppeteer options, and API keys.
*   **Admin & Monitoring:**
    *   `Telegraf` library powers the Telegram bot interface for essential admin tasks like QR code delivery and status alerts.
    *   A simple Express.js server provides a `/api/health` endpoint to check the status of the WhatsApp connection and the download queue size.
*   **Error Handling:** Custom error classes (`FacebookError`, etc.) are used for specific download issues. Failures in the download queue are caught, logged to the database (`Errors` model), and a user-friendly message is sent back via WhatsApp.
*   **Singleton Pattern:** Used for services like `QueueService`, `TelegramService`, and `Database` to ensure only one instance exists throughout the application.

## 🚀 Tech Stack

*   **Runtime:** Node.js
*   **Language:** TypeScript
*   **Job Queue:** `bullmq`, `ioredis` (Redis client)
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **Web Framework (for Health Check):** Express.js
*   **Telegram Bot:** `telegraf`
*   **Analytics:** `posthog-node`

## ⚙️ Getting Started

### Prerequisites

*   Node.js (v16 or later recommended)
*   npm or yarn
*   PostgreSQL Database server
*   Redis server
*   A dedicated Telegram Bot Token and Chat ID (for admin notifications)
*   PostHog API Key and Host (optional, for analytics)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/gitnasr/WhatsAppWizard.git
    cd WhatsAppWizard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory and add the following variables:

    ```dotenv
    # Database
    DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

    # Redis
    REDIS_URL="redis://HOST:PORT" # e.g., redis://127.0.0.1:6379

    # Telegram Admin Bot
    BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
    CHAT_ID="YOUR_TELEGRAM_CHAT_ID" # The chat ID where the bot will send messages

    # PostHog Analytics (Optional)
    POSTHOG_API_KEY="YOUR_POSTHOG_API_KEY"
    POSTHOG_HOST="YOUR_POSTHOG_HOST_URL" # e.g., https://app.posthog.com

    # Node Environment (optional, defaults handled)
    # NODE_ENV=development # or production
    # PORT=3000 # Port for the health check API
    ```
    *Replace placeholders with your actual credentials.*

4.  **Set up the Database:**
    Run Prisma migrations to create the necessary tables in your PostgreSQL database.
    ```bash
    npx prisma migrate dev --name init
    ```

5.  **Generate Prisma Client:**
    Ensure the Prisma client is generated based on your schema.
    ```bash
    npx prisma generate
    ```

### Running the Application

1.  **Development Mode:**
    Uses `ts-node` for running TypeScript directly and `nodemon` for automatic restarts on file changes.
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    *On the first run, a QR code will be generated and saved as `public/qrcodes/qr-code.png`. It will also be sent to your configured Telegram chat. Scan this QR code using WhatsApp on your phone (Linked Devices > Link a device).*

2.  **Production Mode:**
    First, build the JavaScript files from TypeScript, then start the application.
    ```bash
    # 1. Build the project
    npm run build
    # or
    yarn build

    # 2. Start the application
    npm start
    # or
    yarn start
    ```
    *Follow the same QR code scanning process as in development if it's the first run or authentication is lost.*


## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/gitnasr/WhatsAppWizard/issues).

## 📜 License

This project is licensed under the ISC License - see the LICENSE file (implied by `package.json`) for details.

---
*Disclaimer: Use this tool responsibly. Automating WhatsApp accounts may be against their Terms of Service. The developers are not responsible for any consequences of using this software.*
