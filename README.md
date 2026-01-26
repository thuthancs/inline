<div align="center">
  <img src="https://github.com/user-attachments/assets/feae16ca-ffc4-4666-950a-ead7e49cc1e4" width="600" alt="image_icon">
</div>
<br />
<p align="center">
  <a href="#demo">Demo</a> &nbsp;•&nbsp;
  <a href="#why-inline">Why inline?</a> &nbsp;•&nbsp;
  <a href="#ux-flow">UX Flow</a> &nbsp;•&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;•&nbsp;
  <a href="#roadmap">Roadmap</a>
</p>



# Demo
<p align="center">
  https://www.loom.com/share/38832d4660e44e34bc7862d5b41ec258
</p>

# Why inline?
As someone who reads online most of the time, I find the **current reading flow annoying and requires too much switching**. 
When I read, I want to engage AND save information so that I can revisit it later. 
Now, all of my data lives in Notion, and whenever I read a research paper or something that requires serious attention, I need to open a split view, copy from one tab, paste it into Notion, and open another tab, like Claude or ChatGPT, to ask follow-up questions. 
I was thinking about how I can automate this process so that my online reading experience is more seamless while ensuring the right information is saved to my knowledge base. And this is why **inline** was born :)

# Setup

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Chrome browser** (for loading the extension)
- **Notion API key** - [Get one here](https://www.notion.so/my-integrations)

## Getting Your Notion API Key

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Give it a name (e.g., "Inline Extension")
4. Select the workspace where you want to save content
5. Click **"Submit"** to create the integration
6. Copy the **"Internal Integration Token"** - you'll need this for the `NOTION_KEY` environment variable
7. **Important**: Share the pages/databases you want to use with this integration:
   - Open the Notion page or database you want to use
   - Click the **"..."** menu in the top right
   - Select **"Add connections"** or **"Connections"**
   - Find and select your integration

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd inline
```

### 2. Set Up the Server

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `server` directory:
   ```bash
   touch .env
   ```

4. Add your Notion API key to the `.env` file:
   ```env
   NOTION_KEY=your_notion_api_key_here
   PORT=64707
   ```
   
   > **Note**: The default port is `3000`, but the frontend expects `64707`. You can change the port in the frontend's `api.ts` file if needed.

5. Build the server:
   ```bash
   npm run build
   ```

6. Start the server:
   ```bash
   # For development (with auto-reload):
   npm run dev
   
   # For production:
   npm start
   ```
   
   The server should now be running on `http://localhost:64707` (or the port you specified).

### 3. Set Up the Frontend (Chrome Extension)

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```
   
   This will create a `dist` folder with the compiled extension files.

4. **Optional**: If you need to change the server URL (if your server runs on a different port or host), edit `frontend/src/api.ts`:
   ```typescript
   export const API_BASE = "http://localhost:64707"; // Change this to your server URL
   ```
   
   Then rebuild:
   ```bash
   npm run build
   ```

### 4. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in the top right)
3. Click **"Load unpacked"**
4. Select the `frontend/dist` folder from the project directory
5. The extension should now appear in your extensions list

### 5. Verify the Setup

1. Make sure the server is running (you should see it listening on the configured port)
2. Click the extension icon in Chrome to open the side panel
3. Try searching for a Notion page or database
4. If everything is set up correctly, you should see your Notion pages/databases in the search results

## Development

For development with hot-reload:

**Server:**
```bash
cd server
npm run dev
```

Note: After making changes to the frontend, you'll need to rebuild (`npm run build`) and reload the extension in Chrome for changes to take effect.


# Architecture

## Overview

Inline is a Chrome extension that enables seamless saving of web content to Notion. The architecture consists of three main components:

1. **Chrome Extension (Frontend)** - React-based UI and content scripts that interact with web pages
2. **Express.js Server (Backend)** - API server that handles Notion API interactions
3. **Notion API** - External service for reading and writing data

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Content Script (content.ts)                         │   │
│  │  - Detects text selection                            │   │
│  │  - Shows tooltip with Save/Comment buttons           │   │
│  │  - Handles PDF pages with special logic              │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ chrome.runtime.sendMessage                │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │  Service Worker (sw.ts)                              │   │
│  │  - Message routing                                   │   │
│  │  - API calls to backend                              │   │
│  │  - Storage management                                │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ HTTP requests                             │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │  Side Panel (popup/App.tsx)                          │   │
│  │  - React UI for destination selection                │   │
│  │  - Search and browse Notion pages/databases          │   │
│  │  - Property form for database entries                │   │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP (REST API)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Server (server.ts)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes:                                             │   │
│  │  - POST /search          - Search Notion             │   │
│  │  - GET  /children/:id    - Get child pages           │   │
│  │  - GET  /data-sources/:id - Get data sources         │   │
│  │  - POST /create-page     - Create new page           │   │
│  │  - PATCH /save           - Save content to page      │   │
│  │  - POST /save-with-comment - Save + comment          │   │
│  │  - POST /comment          - Add comment to block     │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ @notionhq/client                          │
└─────────────────┼───────────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   Notion API    │
         └─────────────────┘
```

## Components

### 1. Chrome Extension (Frontend)

The extension is built with **React**, **TypeScript**, and **Vite**, and consists of three main parts:

#### Content Script (`content.ts`)
- **Purpose**: Injected into every webpage to detect user interactions
- **Key Features**:
  - Monitors text selection events (`mouseup`, `selectionchange`)
  - Displays tooltip with "Save" and "Comment" buttons when text is selected
  - Handles PDF pages with special logic (clipboard-based selection)
  - Highlights selected text with optimistic UI updates
  - Manages image hover detection for saving images
- **Communication**: Sends messages to service worker via `chrome.runtime.sendMessage()`

#### Service Worker (`sw.ts`)
- **Purpose**: Background script that handles extension logic and API communication
- **Key Features**:
  - Routes messages from content script to appropriate handlers
  - Makes HTTP requests to the Express.js backend
  - Manages Chrome storage for destination persistence
  - Handles extension lifecycle (opens side panel on icon click)
  - Implements retry logic and timeout handling

#### Side Panel (`popup/App.tsx`)
- **Purpose**: React-based UI for managing Notion destinations
- **Key Features**:
  - Search interface for finding Notion pages, databases, and data sources
  - Nested hierarchy display (page → database → data source)
  - Destination selection and persistence
  - Property form for database entries (supports text, number, select, date, url types)
  - Create child pages directly from the UI

### 2. Express.js Server (Backend)

Built with **Express.js** and **TypeScript**, the server acts as a proxy between the extension and Notion API.

#### API Routes

- **`POST /search`** - Searches Notion for pages and data sources matching a query
- **`GET /children/:pageId`** - Retrieves child pages of a given page
- **`GET /data-sources/:databaseId`** - Retrieves data sources connected to a database
- **`GET /data-source/:dataSourceId`** - Gets details of a specific data source
- **`POST /create-page`** - Creates a new Notion page with optional properties
- **`PATCH /save`** - Appends content (text as quote blocks + images) to a Notion page
- **`POST /save-with-comment`** - Combined endpoint that saves content and adds a comment in one request
- **`POST /comment`** - Adds a comment to a specific block

#### Services

- **`notionClient.ts`** - Initializes and exports the Notion API client
- **`imageUpload.ts`** - Handles image uploads to Notion (converts images to base64 and creates image blocks)

### 3. Data Flow

#### Saving Text Highlight

1. User selects text on a webpage
2. Content script detects selection and shows tooltip
3. User clicks "Save" button
4. Content script sends `SAVE_HIGHLIGHT` message to service worker
5. Service worker calls `PATCH /save` endpoint with page ID and content
6. Server creates quote block in Notion page
7. Response flows back through the chain
8. Optimistic UI update shows success immediately

#### Adding Comment

1. User selects text and clicks "Comment"
2. Content script shows comment input box
3. User enters comment and submits
4. Content script sends `COMMENT_HIGHLIGHT` message
5. Service worker calls `POST /save-with-comment` (or separate `/save` + `/comment` calls)
6. Server saves content and adds comment thread
7. Success feedback shown to user

#### Selecting Destination

1. User opens side panel
2. User searches for Notion page/database
3. Frontend calls `POST /search` endpoint
4. Server queries Notion API and returns results
5. User selects a destination
6. Destination saved to `chrome.storage.local`
7. Content script listens for storage changes and updates UI visibility

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **Chrome Extension APIs** - `chrome.storage`, `chrome.runtime`, `chrome.sidePanel`

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **@notionhq/client** - Official Notion API client
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## Key Design Decisions

### 1. Optimistic UI Updates
The extension shows success feedback immediately while processing in the background, improving perceived performance.

### 2. Combined Save + Comment Endpoint
The `/save-with-comment` endpoint reduces API calls from 2 to 1, improving speed when adding comments.

### 3. PDF Support
Special handling for PDF pages since Chrome's PDF viewer doesn't expose selections via `window.getSelection()`. Uses clipboard reading and a persistent "Save Selection" button.

### 4. Shadow DOM for Tooltip
The tooltip is injected into a Shadow DOM to avoid CSS conflicts with host pages.

### 5. Extension Context Validation
Checks if extension context is still valid to handle cases where the extension was reloaded, preventing stale content script errors.

### 6. Retry Logic
Service worker implements retry logic for API calls to handle transient network issues and service worker wake-up delays.

## File Structure

```
inline/
├── frontend/
│   ├── src/
│   │   ├── cs/
│   │   │   └── content.ts          # Content script
│   │   ├── sw/
│   │   │   └── sw.ts              # Service worker
│   │   ├── popup/
│   │   │   ├── App.tsx            # Main React component
│   │   │   ├── components/       # UI components
│   │   │   └── hooks/            # Custom React hooks
│   │   ├── api.ts                # API client
│   │   └── types.ts              # TypeScript types
│   ├── public/
│   │   └── manifest.json         # Extension manifest
│   └── dist/                     # Built extension files
│
└── server/
    ├── routes/                    # API route handlers
    ├── services/                 # Business logic
    │   ├── notionClient.ts
    │   └── imageUpload.ts
    ├── helpers/                  # Utility functions
    └── server.ts                 # Express app entry point
```

# Under Development
- [ ] Add a cache feature to show the latest destinations so users don't have to search all over again
- [ ] Add Gemini API for an "Ask" mode where users can ask questions about specific text directly in the tab without switching
- [ ] Add voice mode for adding comment





