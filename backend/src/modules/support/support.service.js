/**
 * Cyborg Supermarket - Customer Support & Ticketing Service
 * Manages customer inquiries, order complaints, internal staff notes, and resolution workflows.
 */

const db = require('../../database/db');

class SupportService {
  createTicket({ customerId, orderId, category, subject, message }) {
    const ticketId = `TCK-${Date.now()}`;
    const ticketNumber = `SUP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    db.run(
      `INSERT INTO support_tickets (id, ticket_number, customer_id, order_id, category, subject, status, priority)
       VALUES (?, ?, ?, ?, ?, ?, 'OPEN', 'MEDIUM')`,
      [ticketId, ticketNumber, customerId, orderId || null, category || 'GENERAL_INQUIRY', subject]
    );

    if (message) {
      db.run(
        `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, is_internal_note)
         VALUES (?, ?, 'CUSTOMER', ?, 0)`,
        [ticketId, customerId, message]
      );
    }

    return this.getTicketById(ticketId, 'CUSTOMER', customerId);
  }

  addMessage({ ticketId, senderId, senderRole, message, isInternalNote = false }) {
    const ticket = db.queryOne('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    // Customers cannot write internal notes
    const internalFlag = (senderRole === 'CUSTOMER') ? 0 : (isInternalNote ? 1 : 0);

    db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, is_internal_note)
       VALUES (?, ?, ?, ?, ?)`,
      [ticketId, senderId, senderRole, message, internalFlag]
    );

    db.run('UPDATE support_tickets SET updated_at = datetime("now") WHERE id = ?', [ticketId]);

    return { success: true, ticketId, isInternalNote: Boolean(internalFlag) };
  }

  updateStatus({ ticketId, newStatus, actorId }) {
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED', 'ESCALATED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid ticket status: ${newStatus}`);
    }

    const resolvedAt = (newStatus === 'RESOLVED' || newStatus === 'CLOSED') ? new Date().toISOString() : null;

    db.run(
      `UPDATE support_tickets 
       SET status = ?, resolved_at = COALESCE(?, resolved_at), updated_at = datetime("now")
       WHERE id = ?`,
      [newStatus, resolvedAt, ticketId]
    );

    db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, is_internal_note)
       VALUES (?, ?, 'SYSTEM', ?, 0)`,
      [ticketId, actorId || 'System', `Status changed to ${newStatus}`]
    );

    return { ticketId, status: newStatus };
  }

  assignTicket({ ticketId, agentId }) {
    db.run(
      `UPDATE support_tickets SET assigned_to = ?, status = 'IN_PROGRESS', updated_at = datetime("now") WHERE id = ?`,
      [agentId, ticketId]
    );
    return { ticketId, assignedTo: agentId, status: 'IN_PROGRESS' };
  }

  getTicketById(ticketId, actorRole = 'CUSTOMER', actorId = null) {
    const ticket = db.queryOne('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
    if (!ticket) return null;

    // Authorization check: Customer can only view their own ticket
    if (actorRole === 'CUSTOMER' && actorId && ticket.customer_id !== actorId) {
      throw new Error('Access denied: You do not have permission to view this ticket');
    }

    // Filter messages: Customers NEVER see internal notes
    let messages = [];
    if (actorRole === 'CUSTOMER') {
      messages = db.query(
        'SELECT * FROM ticket_messages WHERE ticket_id = ? AND is_internal_note = 0 ORDER BY created_at ASC',
        [ticketId]
      );
    } else {
      messages = db.query(
        'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId]
      );
    }

    ticket.messages = messages;
    return ticket;
  }

  getTicketsByCustomer(customerId) {
    return db.query(
      'SELECT * FROM support_tickets WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );
  }

  getAllTickets({ status = null, priority = null, limit = 50 } = {}) {
    let sql = 'SELECT * FROM support_tickets WHERE 1=1';
    const params = [];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return db.query(sql, params);
  }
}

const supportService = new SupportService();
module.exports = { supportService, SupportService };
