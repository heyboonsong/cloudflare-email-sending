# Cloudflare Email Sending Worker

A Cloudflare Worker for sending emails using functional programming principles with fp-ts.

## Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- Cloudflare account with Workers enabled
- Cloudflare CLI (Wrangler) installed

## Installation

```bash
# Install dependencies
yarn install
```

## How to Run

### Development Mode

Start the local development server:

```bash
yarn dev
```

This will start the worker on `http://localhost:8787`

### Type Checking

Verify TypeScript types without building:

```bash
yarn type-check
```

## How to Test

### Manual Testing with cURL

Once the development server is running, you can test the email endpoint:

```bash
# Test sending an email
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "from": "sender@yourdomain.com",
    "subject": "Test Email",
    "html": "<h1>Hello World</h1>",
    "text": "Hello World"
  }'
```

### Test Validation Errors

```bash
# Test with missing fields (should return 400 error)
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "to": "invalid-email",
    "from": "sender@yourdomain.com"
  }'
```

```bash
# Test with wrong HTTP method (should return 405 error)
curl -X GET http://localhost:8787
```

### Expected Responses

**Success (200):**
```json
{
  "success": true,
  "id": "message-id-here"
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Validation failed: to: to must be a valid email address, subject: subject field is required..."
}
```

**Method Not Allowed (405):**
```json
{
  "success": false,
  "error": "Method not allowed"
}
```

## Deployment

### Deploy to Cloudflare Workers

```bash
yarn deploy
```

This will deploy your worker to Cloudflare's edge network.

## Configuration

The worker uses Cloudflare's Email Workers binding. Make sure to:

1. Configure your domain with Cloudflare Email Routing
2. Set up the `SEND_EMAIL` binding in `wrangler.jsonc`
3. Verify your sending domain in Cloudflare dashboard

## Project Structure

```
src/
  index.ts          # Main worker entry point with functional architecture
wrangler.jsonc      # Cloudflare Workers configuration
package.json        # Dependencies and scripts
tsconfig.json       # TypeScript configuration
```

## Architecture

This project uses functional programming principles:

- **fp-ts** for handling effects and errors with `Either` and `TaskEither`
- **Pure functions** for validation and transformation logic
- **Side effects** wrapped in TaskEither for testability
- **Type-safe** error handling without exceptions

## Email Request Format

```typescript
interface EmailRequest {
  to: string          // Required: recipient email
  from: string        // Required: sender email
  subject: string     // Required: email subject
  html?: string       // Optional: HTML content
  text?: string       // Optional: plain text content
}
```

At least one of `html` or `text` must be provided.
