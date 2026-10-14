# WhatsApp Business Marketing Platform — Induio

A full-stack web application for sending WhatsApp marketing messages (text, images, videos) to customers imported via Excel, with a real-time inbox for receiving replies — deployed to Vercel.

---

## User Review Required

> [!IMPORTANT]
> **Facebook Developer App & WhatsApp Business Account required before starting.**
> You must have:
> - A **Meta Developer account** at [developers.facebook.com](https://developers.facebook.com)
> - A **WhatsApp Business Account (WABA)** linked to a verified Facebook Business
> - A **permanent access token** (System User token from Meta Business Manager)
> - A **Phone Number ID** (visible in the WhatsApp > Getting Started panel)
> - A **WhatsApp Business Account ID (WABA ID)**
>
> The app will ask you to enter these credentials in a **Settings** page — they are stored in environment variables on Vercel and are **never exposed to the browser**.

> [!WARNING]
> **WhatsApp template messages (HSM) are required for outbound messages to customers who haven't messaged you first (cold outreach/marketing).**
> - You must pre-approve message templates in Meta Business Manager before sending.
> - You can send free-form messages only **within 24 hours** of the customer's last message to you.

> [!NOTE]
> **Database:** We'll use **Neon (free PostgreSQL)** connected via the `@neondatabase/serverless` driver. You will need to sign up at [neon.tech](https://neon.tech) and get a connection string — it's free.

---

## Proposed Changes

The project will use **Vanilla HTML/CSS/JS** for the frontend, and **Vercel Serverless Functions (Node.js)** for the backend, similar to your portfolio project.

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS (Vanilla), JS (ES6 Modules) |
| Backend API | Vercel Serverless Functions (`api/` directory) |
| Database | Neon PostgreSQL (free tier) via `@neondatabase/serverless` |
| File Storage | Octokit (to commit to `uploads/` folder in GitHub) + Meta Cloud API |
| Excel Parsing | `xlsx` (SheetJS) — runs server-side |
| Hosting | Vercel |

---

### Component 1 — DB Schema (Neon PostgreSQL)

```sql
-- Customers imported from Excel
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All messages sent/received
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  direction TEXT CHECK (direction IN ('outbound', 'inbound')),
  type TEXT CHECK (type IN ('text', 'image', 'video', 'template')),
  content TEXT,          -- text body or caption
  media_url TEXT,        -- URL or uploaded media URL
  wa_message_id TEXT,    -- WhatsApp message ID from Meta
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign log for bulk sends
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT,
  message_type TEXT,
  content TEXT,
  media_url TEXT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Component 2 — Backend API (Vercel Functions)

All routes live under the `/api` directory.

#### Templates
*   `api/templates.js` - `GET` to fetch approved templates from Meta Business Account.

#### Customers
*   `api/customers.js` - `GET` (list), `POST` (add single), `DELETE` (remove).
*   `api/customers-import.js` - `POST` to parse uploaded Excel and insert into Neon.

#### Messages & Media
*   `api/messages.js` - `GET` to fetch conversation history for a customer.
*   `api/send-message.js` - `POST` to send free-form or template messages to a customer.
*   `api/upload-media.js` - `POST` to handle media. **(Option B Implementation)**:
    1. Uploads the file to Meta's servers via WhatsApp Media API to get a `media_id`.
    2. Uploads the file to your GitHub repository's `uploads/` folder via Octokit, so you retain local control over the content.
    3. Returns both the Meta `media_id` and the local Github path.
*   `api/broadcast.js` - `POST` to send campaigns/broadcasts.

#### Webhooks
*   `api/webhook.js` - `GET` (Meta verification) and `POST` (incoming messages / delivery receipts).

---

### Component 3 — Frontend UI (Vanilla JS/HTML/CSS)

Clean, light, responsive dashboard using a multi-page or SPA approach with vanilla Javascript.

#### `index.html` (Dashboard & Navigation)
- Sidebar navigation for all sections.
- Stats: Total customers, messages sent today.

#### `customers.html` (or a section within `index.html`)
- Table of all customers.
- **Upload Excel** button to bulk import.
- Add/Delete single customers.

#### `templates.html`
- List of synced templates from Meta.
- Preview template layout.
- (Note: Creating new templates usually requires the Meta Business Manager, but we can display the approved ones here to use in campaigns).

#### `send.html`
- Select recipients: All / Specific.
- Select Message Type: Text, Template, Image, Video.
- If Image/Video: File upload area (which hits `/api/upload-media` to save to Github & Meta, then uses `media_id` to send).
- **Send Broadcast** button.

#### `inbox.html`
- Chat-style thread per customer to view replies and send manual responses.

#### `app.css` & `app.js`
- Core styling (responsive, simple layout).
- Frontend logic for making `fetch` calls to the `/api/*` endpoints.

---

### Component 4 — Environment Variables

Requires setting the following in `.env` and Vercel Dashboard:
```env
# Meta / WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# Neon Database
DATABASE_URL=

# GitHub (for storing uploads)
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
```

---

## Fix Plan: Meta WhatsApp Template Broadcasting & Media Attachment

### Problem Analysis
1. **Media-Header Template Failure (`(#100) Invalid parameter`)**:
   - Templates like `vinayaka_chavithi` have a `HEADER` of format `IMAGE` (or `VIDEO`/`DOCUMENT`).
   - In `app.js`, selecting `type === 'template'` hid `#bc-media-group`, preventing users from attaching media.
   - `media_id` was ignored when `type === 'template'`, sending template requests without header components to Meta API, causing Meta to reject them with `(#100) Invalid parameter` or `(#132012) Format mismatch`.
2. **Body Parameter Misalignment (`1 sent, 0 failed` but not delivered)**:
   - Templates created in Meta use `parameter_format: "NAMED"` (e.g. `customer_name`) or `"POSITIONAL"`.
   - The backend tried a blind fallback loop where static templates (without parameters) succeeded at the HTTP level but failed delivery asynchronously because Meta expected `customer_name`.
   - POSITIONAL parameters sent to NAMED templates triggered `(#100) Invalid parameter: Parameter name is missing or empty`.

---

## Proposed Solution

### 1. Backend Updates (`api/broadcast.js` & `api/send-message.js`)
- Implement metadata-aware template component builder (`buildTemplatePayload`):
  - Query Meta WABA template schema (`GET /message_templates?name=...`).
  - **Header component**: Automatically attach `{ type: "header", parameters: [{ type: format, [format]: mediaObj }] }` using provided `media_id` (or fallback sample header handle).
  - **Body component**: Inspect `parameter_format` (`NAMED` vs `POSITIONAL`). For `NAMED` format, send `{ type: "text", parameter_name: "customer_name", text: custName }`. For `POSITIONAL`, send `{ type: "text", text: custName }`.
  - Omit components parameter if the template requires no parameters.

### 2. Frontend Updates (`app.js`)
- **Dynamic Media Input for Templates**:
  - When switching to `template` or changing `#bc-template`, check if selected template requires a media header (`IMAGE`, `VIDEO`, `DOCUMENT`).
  - Display `#bc-media-group` automatically if media is required, with updated helper label ("Attach Template Header IMAGE (Required by Meta)").
  - On submit, upload/extract `media_id` and pass `media_type` & `media_id` to `/api/broadcast`.
- **Inbox Template Sending**:
  - Update `btn-inbox-send-template` to handle media header attachments if selected template has a media header.

---

## Verification Plan

### Automated / Script Testing
- Run node script calling `api/broadcast.js` logic with:
  1. `vinayaka_chavithi` (Image header + Named body parameter).
  2. `welcome_manaswini` (Text header + Named body parameter).
  3. `hello_world` (Static template without parameters).
- Verify Meta API returns `message_status: "accepted"`.

### Manual UI Verification
- Select `vinayaka_chavithi` in Broadcast modal -> Confirm media upload box appears.
- Send broadcast -> Confirm progress modal displays success and message arrives on recipient WhatsApp device.

