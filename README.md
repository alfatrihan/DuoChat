
# DuoChat

**DuoChat** is a real-time, private 1-on-1 web messaging and interactive space built for seamless communication. It supports both persistent friend-based messaging and instant code-based chat rooms, complete with real-time atmospheres, custom avatars, and built-in interactive activities.

---

## Core Capabilities

### Access & Connection Modes
- **Account & Circle System:** Register a persistent account, connect with friends via username search and friend requests, and keep synced conversation histories across sessions.
- **Instant Chat Rooms:** Create or join temporary private rooms using a shareable room code without needing an account—complete with custom display names and avatar selection.

### Real-Time Messaging & Privacy
- **Instant Delivery:** Live bidirectional messaging powered by WebSockets with typing indicators, message reactions, replies, editing, and deletion for everyone.
- **Privacy Controls:** Support for disappearing (vanish) messages, tap-to-reveal spoiler formatting, and media sharing.
- **Presence & Status:** Live online indicators, custom status moods, and instant screen-shake nudges.

### Personalization & Interactive Space
- **Custom Avatar Gallery:** Minimalist flat-vector portraits categorized for personalized profiles.
- **Synced Atmospheres & Themes:** Real-time shared background weather effects alongside multiple customizable UI color themes.
- **Built-in Mini-Games:** Real-time two-player games integrated directly inside the chat interface with live score tracking.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, HTML5 Canvas
- **Backend:** Node.js, Express.js
- **Real-Time Engine:** Socket.IO
- **Storage:** JSON-based persistent storage for accounts and conversations; in-memory storage for temporary rooms
