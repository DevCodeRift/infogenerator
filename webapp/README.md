# InfoGenerator Webapp

A real-time screenshot monitoring and analysis webapp built with Next.js for the InfoGenerator Go application.

## Features

- **Real-time Screenshot Receiving**: Accepts screenshots from the Go application via HTTP API
- **Student Session Management**: Track multiple student sessions simultaneously
- **Live Dashboard**: View active sessions and screenshot counts in real-time
- **Summary Generation**: Generate analysis summaries for completed sessions
- **Student Name Input**: Add student names to sessions when convenient
- **Session History**: View and manage completed monitoring sessions

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Add your Vercel Blob storage token to `.env.local`

3. Run development server:
   ```bash
   npm run dev
   ```

4. Update your Go application's `config.json`:
   ```json
   {
     "webapp_url": "http://localhost:3000"
   }
   ```

## Deployment to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard:
   - `BLOB_READ_WRITE_TOKEN`: Your Vercel Blob storage token

4. Update your Go application's config with the deployed URL:
   ```json
   {
     "webapp_url": "https://your-app.vercel.app"
   }
   ```

## API Endpoints

- `POST /api/screenshots` - Receive screenshots from Go application
- `POST /api/sessions` - Create/update sessions
- `GET /api/sessions` - List all sessions
- `PUT /api/sessions` - Update session details
- `POST /api/generate-summary` - Generate session analysis

## Go Application Integration

Update your Go application's `config.json`:

```json
{
  "webapp_url": "https://your-vercel-app.vercel.app",
  "data_dir": "sessions",
  "screenshot_settings": {
    "quality": 80,
    "compress": true,
    "max_file_size": 5
  }
}
```

The Go application will automatically send screenshots to the webapp when `webapp_url` is configured.

## Workflow

1. Start the webapp (either locally or deployed)
2. Configure the Go application with the webapp URL
3. Run the Go application to start capturing screenshots
4. View sessions in real-time on the webapp dashboard
5. Enter student names when convenient
6. Generate summaries and timelapses for completed sessions