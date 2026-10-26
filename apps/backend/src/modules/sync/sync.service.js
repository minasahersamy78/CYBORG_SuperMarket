/**
 * Cyborg Supermarket - Cloud-Local Synchronization Service
 * Handles Delta Sync, Conflict Detection, and Outbox Ingestion
 */

const crypto = require('crypto');
const db = require('../../database/db');

const syncService = {
  getDeltaEvents(lastSyncedId = 0, limit = 100) {
    const events = db.query(`
      SELECT * FROM sync_events
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?;
    `, [lastSyncedId, limit]);

    const formatted = events.map(e => ({
      ...e,
      delta_payload: typeof e.delta_payload === 'string' ? JSON.parse(e.delta_payload) : e.delta_payload,
      synced: Boolean(e.synced)
    }));

    return {
      success: true,
      statusCode: 200,
      data: formatted,
      meta: {
        last_id: events.length > 0 ? events[events.length - 1].id : lastSyncedId,
        count: events.length
      }
    };
  },

  ingestBatch(terminalIdOrEvents, eventsOrTerminalId = []) {
    let terminalId = 'TRM-DEFAULT';
    let events = [];

    if (Array.isArray(terminalIdOrEvents)) {
      events = terminalIdOrEvents;
      terminalId = typeof eventsOrTerminalId === 'string' ? eventsOrTerminalId : 'TRM-DEFAULT';
    } else {
      terminalId = terminalIdOrEvents || 'TRM-DEFAULT';
      events = Array.isArray(eventsOrTerminalId) ? eventsOrTerminalId : [];
    }

    let processed = 0;
    let duplicates = 0;
    const errors = [];

    for (const evt of events) {
      const eventUuid = evt.event_uuid || ('evt-' + crypto.randomUUID());

      // Idempotency: Check if this event UUID was already recorded
      const existing = db.getOne('SELECT id FROM sync_events WHERE event_uuid = ? LIMIT 1;', [eventUuid]);
      if (existing) {
        duplicates++;
        continue;
      }

      try {
        // If the event represents a local offline POS order
        if (evt.entity_type === 'ORDER' && evt.delta_payload) {
          const payload = evt.delta_payload;
          const orderId = evt.entity_id || payload.id;

          const existingOrder = db.getOne('SELECT id FROM orders WHERE id = ? LIMIT 1;', [orderId]);
          if (!existingOrder) {
            db.run(`
              INSERT INTO orders (
                id, user_id, customer_name, source, status, shift_id, store_id, terminal_id,
                subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status,
                delivery_address, idempotency_key, created_at, updated_at
              ) VALUES (?, ?, ?, 'POS', 'DELIVERED', ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, datetime('now'));
            `, [
              orderId,
              payload.user_id || null,
              payload.customer_name || 'Walk-in Customer (Offline POS)',
              payload.shift_id || 'shift-cairo-001',
              payload.store_id || 1,
              terminalId,
              payload.subtotal || payload.total_amount,
              payload.tax_amount || 0,
              payload.discount_amount || 0,
              payload.total_amount,
              payload.payment_method || 'CASH',
              payload.delivery_address || 'In-store Counter',
              payload.idempotency_key || eventUuid,
              payload.created_at || new Date().toISOString()
            ]);

            // Deduct stock for items
            if (Array.isArray(payload.items)) {
              for (const it of payload.items) {
                db.run(`
                  INSERT INTO order_items (order_id, product_id, product_name_en, product_name_ar, barcode, quantity, unit_price, subtotal)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                `, [
                  orderId, it.product_id, it.name_en || '', it.name_ar || '', it.barcode || '',
                  it.quantity, it.unit_price, (it.quantity * it.unit_price)
                ]);

                db.run('UPDATE inventory SET quantity = MAX(0, quantity - ?), updated_at = datetime("now") WHERE product_id = ?;', [it.quantity, it.product_id]);
              }
            }
          }
        }

        // Record incoming event as processed
        db.run(`
          INSERT INTO sync_events (event_uuid, entity_type, entity_id, action, delta_payload, origin_terminal_id, synced)
          VALUES (?, ?, ?, ?, ?, ?, 1);
        `, [
          eventUuid,
          evt.entity_type,
          evt.entity_id,
          evt.action || 'INSERT',
          JSON.stringify(evt.delta_payload || {}),
          terminalId
        ]);

        processed++;
      } catch (err) {
        errors.push({ event_uuid: eventUuid, error: err.message });
      }
    }

    return {
      success: true,
      statusCode: 200,
      data: {
        terminal_id: terminalId,
        total_received: events.length,
        processed,
        duplicates,
        errors
      }
    };
  }
};

module.exports = syncService;
module.exports.syncService = syncService;
