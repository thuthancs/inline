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

## Troubleshooting

### Server won't start
- Check that the `NOTION_KEY` is correctly set in the `.env` file
- Verify the port isn't already in use by another application
- Check the server logs for error messages

### Extension can't connect to server
- Ensure the server is running on the correct port
- Check that the `API_BASE` URL in `frontend/src/api.ts` matches your server URL
- Verify Chrome's host permissions allow `http://localhost:*/*` (already configured in `manifest.json`)
- Try rebuilding the extension after changing the API URL

### Notion API errors
- Verify your Notion API key is correct
- Ensure you've shared the pages/databases with your integration (see "Getting Your Notion API Key" above)
- Check that your integration has the necessary permissions in Notion

### Extension not appearing
- Make sure you loaded the `frontend/dist` folder (not `frontend` or `frontend/src`)
- Check that the build completed successfully
- Try reloading the extension in `chrome://extensions/`

## Development

For development with hot-reload:

**Server:**
```bash
cd server
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Note: After making changes to the frontend, you'll need to rebuild (`npm run build`) and reload the extension in Chrome for changes to take effect.


# UX Flow

# Architecture

# Under Development
- [ ] Add a cache feature to show the latest destinations so users don't have to search all over again
- [ ] Add Gemini API for an "Ask" mode where users can ask questions about specific text directly in the tab without switching
- [ ] Add voice mode for adding comment





