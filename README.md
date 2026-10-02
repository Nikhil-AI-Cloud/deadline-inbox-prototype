# Deadline Inbox (prototype)

Clickable front-end prototype for the CMU PM project. Mock data only: no backend, auth, or APIs.

## Run

Open `index.html` in a browser. No install or build step.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout (sidebar + main area) |
| `styles.css` | Notion-inspired styling |
| `data.js` | Mock deadlines (Canvas, Gmail, Slack, Discord). Status is derived in `app.js` from date + time. **Add real Google Doc links in `DOCUMENT_URLS` (one per task). Items sharing a `taskKey` + due date merge into one calendar event.** |
| `app.js` | Tab switching, source filter, rendering, Add info / Dismiss, calendar event popup |

## Status rules (from the MVP spec)

- **complete**: clear due date, event auto-created, source evidence shown
- **partial**: due date found but info missing, event created and flagged "Partial" with what's missing
- **backlog**: no verifiable date, no event created, never invent a date

## Not built yet

AI extraction, real integrations, persistence (state resets on reload).

## Calendar event popup

Click any calendar event to see its details, Verified/Partial status and source evidence.
`Open Task Document` only appears as a link when the task's entry in `DOCUMENT_URLS` (`data.js`) is a real `https://` URL; otherwise it shows "Task document not linked yet".
