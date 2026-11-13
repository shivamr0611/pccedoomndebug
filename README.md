# UPI Checkout

The checkout creates a real, fixed ₹50 UPI payment intent for the UPI ID in `payment-config.json`. Scanning the QR or opening the UPI link can initiate a real transfer after the payer confirms it in their UPI app. Verify the payee and amount in that app before approving.

The site does not collect UPI PINs, OTPs, passwords, or bank credentials. It does not receive payment callbacks and cannot verify whether a transfer succeeded; it never reports success or issues a receipt. The Transactions page contains only clearly labeled historical demo samples and does not track payable transfers. `payment-config.json` is public client configuration, not a secret.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The UPI QR and **Open UPI app** link are configured for ₹50 to `shivamsrevankar@oksbi`.

## WhatsApp payment flow

With the existing WhatsApp backend configured, payment questions get a reply in the user's language. If they ask to pay, the bot explains the recipient and amount and asks for 👍 before sending a payable QR. A further 👍 is recorded as the guest reporting that they paid; the bot says the transfer is pending staff verification and does not mark it as verified. The QR prompts a real UPI transfer; the bot cannot verify it.

Configure `backend/whatsapp/.env` locally (ignored by Git) with the existing `GROQ_API_KEY` and Supabase settings, then run:

```sh
npm run dev:whatsapp
```

Pair the WhatsApp Web client using its terminal QR. For voice messages, the backend transcribes the original language and sends the transcript through the same language-aware reply flow, so replies stay in the guest's language. Set a newly rotated `SARVAM_API_KEY` locally. Never share API keys in chat.

## Supabase setup

Apply `supabase/migrations/20261113020000_knowledge_base_items.sql` and `supabase/migrations/20261113030000_room_bookings.sql` to the configured Supabase project. Room occupancy is stored per room and date; no booking rows means all rooms are unoccupied. Then serve the admin UI and start the WhatsApp backend:

```sh
cd UI && python3 -m http.server 8081
# In another terminal, from the project root:
npm run dev:whatsapp
```

Open `http://127.0.0.1:8081/knowledge_base/code.html`. Add, edit, disable, or delete entries there; the data is persisted in Supabase and enabled entries are fetched for each WhatsApp message. Use **Test retrieval** to preview the current entries. The old sample room, policy, and FAQ values were removed rather than treated as verified property information.

## Checks

```sh
npm test
npm run build
```
