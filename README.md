# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Quo extension webhook

This project includes a Supabase Edge Function webhook for the Quo/OpenPhone Chrome extension:

- Function name: `extension-quo-lead-webhook`
- Hosted endpoint: `https://<your-supabase-project-ref>.supabase.co/functions/v1/extension-quo-lead-webhook`
- Expected CRM route alias: `POST /api/extension/quo-lead-webhook`

Required secrets:

- `EXTENSION_WEBHOOK_TOKEN`
- `EXTENSION_ALLOWED_ORIGIN`
- `SB_SERVICE_ROLE_KEY`

Behavior:

- Accepts `POST` and `OPTIONS`
- Requires `x-webhook-token`
- Validates `customer_number` and `service`
- Creates a lead in `public.leads` with `source = quo_extension` and `reference_name = Quo/OpenPhone Extension`
- Uses a recent duplicate window to avoid repeated inserts

Example curl:

```bash
curl -X POST "http://localhost:3000/api/extension/quo-lead-webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: test-token" \
  -d '{
    "source": "quo_extension",
    "customer_name": "John Smith",
    "customer_number": "+15551234567",
    "customer_address": "123 Main Street",
    "number_name": "Leadgrid Main",
    "service": "Sliding Door Repair",
    "direction": "incoming",
    "page_url": "https://app.quo.com/example",
    "created_at": "2026-06-24T10:00:00.000Z",
    "raw_extracted": {}
  }'
```

Preflight test:

```bash
curl -i -X OPTIONS "http://localhost:3000/api/extension/quo-lead-webhook" \
  -H "Origin: chrome-extension://your-extension-id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-webhook-token"
```
