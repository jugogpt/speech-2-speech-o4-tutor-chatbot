# Sparqit Speech-to-Speech Chatbot

> **Author:** Hugo Sanchez

---

## Overview

Sparqit is a real-time, speech-to-speech chatbot powered by OpenAI's o4 model (GPT-4o). It enables natural, voice-driven conversations with an AI agent, featuring live transcription, audio synthesis, and a friendly, educational persona. The system is designed for both web and local relay operation, keeping your API key secure and supporting custom server logic.

---

## Features

- **Speech-to-Speech Chat:** Talk to the AI and get spoken responses in real time.
- **OpenAI o4 Model Integration:** Uses GPT-4o for advanced conversational intelligence.
- **Live Transcription & Synthesis:** Converts your speech to text and AI responses back to audio.
- **Customizable Personality:** Friendly, educational, and interactive (see `conversation_config.js`).
- **Local Relay Server:** Optionally proxy API requests to hide your OpenAI key and add custom logic.
- **Audio Visualization:** Real-time waveform/frequency bars for both input and output.
- **Rich UI:** Modern, responsive interface with avatars, toggles, and action buttons.
- **Math & Science Support:** AI can render formulas and derivations using MathML and KaTeX.

---

## How It Works

### Architecture

- **Frontend (Next.js/React):**
  - Handles UI, audio recording/playback, and real-time interaction.
  - Communicates with OpenAI (directly or via relay server).
  - Visualizes conversation, events, and audio.
- **Relay Server (Node.js):**
  - Proxies WebSocket traffic to OpenAI, keeping your API key secure.
  - Can be extended for custom server-side logic.
- **Audio Pipeline:**
  - Uses browser APIs and custom worklets for recording, processing, and playback.
  - Visualizes audio using frequency analysis and waveform rendering.
- **Contextual Memory & Tools:**
  - AI can store/retrieve memory, fetch weather, and inject context from a local document index.

---

## Setup & Running

### Prerequisites
- Node.js (v18+ recommended)
- npm
- OpenAI API key for relay server

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root for the relay server:
```
OPENAI_API_KEY=your-openai-key-here
PORT=8081 # (optional, default 8081)
```

### 3. Start the Local Relay Server (Optional, Recommended)
```bash
npm run relay
```
This will proxy requests to OpenAI and keep your API key out of the browser.

### 4. Run the Frontend
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) to use the chatbot.

### 5. (Optional) Generate Document Index for Contextual Memory
If you want the AI to use local documents for context:
```bash
npm run generate
```

---

## Directory & File Guide

### Top-Level
- `README.md` — **(Hugo Sanchez)** This file.
- `package.json` — **(Hugo Sanchez)** Project metadata, dependencies, and scripts.
- `next.config.mjs` — **(Hugo Sanchez)** Next.js configuration.
- `tsconfig.json` — **(Hugo Sanchez)** TypeScript configuration.
- `tailwind.config.ts` — **(Hugo Sanchez)** Tailwind CSS configuration.
- `postcss.config.mjs` — **(Hugo Sanchez)** PostCSS configuration.
- `public/` — **(Hugo Sanchez)** Static assets (images, HTML entrypoint).
- `cache/` — **(Hugo Sanchez)** Stores document index and vector data for context retrieval.

### Frontend (`src/`)
- `App.tsx` — **(Hugo Sanchez)** Main app wrapper, renders the ConsolePage.
- `App.scss` — **(Hugo Sanchez)** App-level styles.
- `index.css` — **(Hugo Sanchez)** Base CSS for the app.
- `styles/globals.css` — **(Hugo Sanchez)** Global Tailwind and CSS variables.
- `reportWebVitals.ts` — **(Hugo Sanchez)** Web Vitals performance reporting.
- `setupTests.ts` — **(Hugo Sanchez)** Test setup for Jest/React Testing Library.
- `react-app-env.d.ts` — **(Hugo Sanchez)** TypeScript environment types.

#### Components (`src/components/`)
- `button/Button.tsx` — **(Hugo Sanchez)** Reusable button component.
- `button/Button.scss` — **(Hugo Sanchez)** Button styles.
- `toggle/Toggle.tsx` — **(Hugo Sanchez)** Toggle switch component.
- `toggle/Toggle.scss` — **(Hugo Sanchez)** Toggle styles.
- `Map.tsx` — **(Hugo Sanchez)** Wrapper for dynamic map loading.
- `MapComponent.tsx` — **(Hugo Sanchez)** Leaflet map display with marker and popup.
- `Map.scss` — **(Hugo Sanchez)** Map styles.

#### Pages (`src/pages/`)
- `index.tsx` — **(Hugo Sanchez)** Main entry page, renders the App.
- `_app.tsx` — **(Hugo Sanchez)** Next.js custom App for global styles.
- `ConsolePage.tsx` — **(Hugo Sanchez)** Main chatbot UI and logic (avatar, audio, events, conversation, controls).
- `ConsolePage.scss` — **(Hugo Sanchez)** Styles for the ConsolePage.
- `api/context.ts` — **(Hugo Sanchez)** API route for injecting context from local document index.
- `engine/` — **(Hugo Sanchez)** Document indexing and retrieval for context-aware AI.
  - `generate.ts` — Generates vector index from documents.
  - `index.ts` — Loads the vector index for retrieval.
  - `loader.ts` — Loads documents from the data directory.
  - `settings.ts` — Configures LLM/embedding models.
  - `shared.ts` — Shared constants (e.g., cache dir).

#### Utilities (`src/utils/`)
- `conversation_config.js` — **(Hugo Sanchez)** System prompt and AI personality config.
- `wav_renderer.ts` — **(Hugo Sanchez)** Audio waveform/frequency visualization.

#### Audio Tools (`src/lib/wavtools/`)
- `index.js` — **(Hugo Sanchez)** Exports audio utilities.
- `lib/wav_recorder.js` — **(Hugo Sanchez)** Audio recording utility (browser, worklet-based).
- `lib/wav_stream_player.js` — **(Hugo Sanchez)** Audio playback utility (browser, worklet-based).
- `lib/wav_packer.js` — **(Hugo Sanchez)** Packs audio data into WAV format.
- `lib/analysis/audio_analysis.js` — **(Hugo Sanchez)** Frequency analysis for visualization.
- `lib/analysis/constants.js` — **(Hugo Sanchez)** Frequency/note constants for analysis.
- `lib/worklets/audio_processor.js` — **(Hugo Sanchez)** Audio recording worklet (browser thread).
- `lib/worklets/stream_processor.js` — **(Hugo Sanchez)** Audio playback worklet (browser thread).

#### Relay Server (`relay-server/`)
- `index.js` — **(Hugo Sanchez)** Entry point for the relay server.
- `lib/relay.js` — **(Hugo Sanchez)** WebSocket relay logic for proxying OpenAI traffic.

---

## Technology Stack
- **Frontend:** Next.js, React, TypeScript, SCSS, Tailwind CSS, Leaflet, KaTeX
- **Backend/Relay:** Node.js, WebSocket, dotenv
- **AI/LLM:** OpenAI GPT-4o (o4), llamaindex for document context
- **Audio:** Web Audio API, custom worklets, browser APIs

---

## Scripts
- `npm run dev` — Start frontend in development mode
- `npm run build` — Build frontend for production
- `npm run start` — Start frontend in production
- `npm run relay` — Start the local relay server
- `npm run generate` — Generate document index for context
- `npm run format` — Check code formatting
- `npm run format:write` — Auto-format code

---

## Credits
- **Project by Hugo Sanchez**
- Uses OpenAI, llamaindex, Leaflet, KaTeX, and more (see `package.json`)

---

## Contributing & Troubleshooting
- PRs and issues welcome!
- If you encounter audio or API issues, check browser permissions and relay server logs.
- For context injection, ensure you have generated the document index (`npm run generate`).
- For custom AI behavior, edit `src/utils/conversation_config.js`.

---

## License
This project is for educational and research purposes. See `package.json` for license details. 