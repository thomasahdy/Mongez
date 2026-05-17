# Testing Guide: Mongez Notification Platform

Since the system is event-driven and background-processed, follow these steps to verify each layer of the infrastructure.

## 1. Verify the Transactional Outbox (The "Zero-Loss" Layer)
**Goal:** Ensure that creating an entity also creates a background event.

1.  **Action:** Create a new task via API (`POST /tasks`).
2.  **Verify DB:** Check the `OutboxEvent` table in Prisma Studio or via SQL.
    ```sql
    SELECT * FROM "OutboxEvent" ORDER BY "occurredAt" DESC LIMIT 1;
    ```
3.  **Verify Relay Logs:** Look at your terminal. You should see:
    `[OutboxRelayService] Relaying 1 events to BullMQ...`
    `[OutboxRelayService] Successfully processed 1 events.`

---

## 2. Test "Online" Delivery (WebSocket Instant)
**Goal:** Verify that active users get notifications immediately without emails.

1.  **Action:** Open a WebSocket tester (or your frontend) and connect to `ws://localhost:3000/ws`.
2.  **Authenticate:** Ensure you send the JWT token in `auth` or headers.
3.  **Heartbeat:** Emit a `heartbeat` event from the client.
4.  **Trigger:** Assign a task to that user.
5.  **Verify Logs:** 
    `[NotificationProcessor] User <ID> is ONLINE. Routing to WebSocket only.`
6.  **Verify Client:** The client should receive a `notification:received` event.

---

## 3. Test "Offline" Aggregation (The Digest Engine)
**Goal:** Verify that offline users aren't spammed with emails, but get a single summary.

1.  **Action:** Ensure the user has no active WebSocket connection (wait 60 seconds for the heartbeat to expire).
2.  **Trigger Multiple:** Quickly create 3-4 comments on a task mentioning that user.
3.  **Verify Logs:** 
    `[NotificationProcessor] User <ID> is OFFLINE. Queuing for aggregation.`
4.  **Verify Redis:** Check the aggregation list in Redis:
    ```bash
    redis-cli LRANGE "digest:<userId>:task:<taskId>" 0 -1
    ```
5.  **Wait 5 Minutes:** (Or temporarily change `delay` in `notification.processor.ts` to `30000` for 30s testing).
6.  **Verify Digest:** You should see a single log:
    `[NotificationProcessor] Processing digest for group digest:...`
    `[EmailChannel] [MOCK EMAIL] Title: 4 updates on task...`

---

## 4. Verify API & Multi-Tenancy
**Goal:** Ensure users can only see notifications for the current space.

1.  **Action:** `GET /notifications?spaceId=<SPACE_A_ID>`
2.  **Verify:** Should return notifications belonging to Space A.
3.  **Action:** `GET /notifications?spaceId=<SPACE_B_ID>`
4.  **Verify:** Should return different notifications or empty if none exist in Space B.

---

## 🚀 Quick Troubleshooting
*   **Events not picking up?** Ensure Redis is running and `OutboxRelayService` cron is enabled.
*   **Always offline?** Check the `heartbeat` logic in `RealtimeGateway`.
*   **Duplicate notifications?** Check the `idempotency:notification:<id>` keys in Redis.
