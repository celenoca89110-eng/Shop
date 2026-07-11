const db = require('../config/db');

// --- Client ---

async function createTicket(req, res, next) {
  try {
    const { shopSlug, subject, message, orderId } = req.body;
    if (!shopSlug || !subject || !message) {
      return res.status(400).json({ error: 'Boutique, sujet et message requis.' });
    }

    const shopResult = await db.query('SELECT id FROM shops WHERE slug = $1', [shopSlug]);
    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }

    const ticketResult = await db.query(
      `INSERT INTO support_tickets (shop_id, user_id, order_id, subject, status)
       VALUES ($1,$2,$3,$4,'open') RETURNING *`,
      [shopResult.rows[0].id, req.user.id, orderId || null, subject]
    );
    const ticket = ticketResult.rows[0];

    await db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message)
       VALUES ($1,$2,'user',$3)`,
      [ticket.id, req.user.id, message]
    );

    return res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
}

async function getMyTickets(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT t.*, s.name AS shop_name, s.slug AS shop_slug
       FROM support_tickets t JOIN shops s ON s.id = t.shop_id
       WHERE t.user_id = $1 ORDER BY t.updated_at DESC`,
      [req.user.id]
    );
    return res.json({ tickets: rows });
  } catch (err) {
    next(err);
  }
}

async function getMyTicketDetail(req, res, next) {
  try {
    const { ticketId } = req.params;
    const ticketResult = await db.query(
      `SELECT t.*, s.name AS shop_name FROM support_tickets t
       JOIN shops s ON s.id = t.shop_id
       WHERE t.id = $1 AND t.user_id = $2`,
      [ticketId, req.user.id]
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    const messages = await db.query(
      `SELECT m.*, u.username FROM ticket_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
      [ticketId]
    );

    return res.json({ ticket: { ...ticketResult.rows[0], messages: messages.rows } });
  } catch (err) {
    next(err);
  }
}

async function addMyMessage(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message requis.' });

    const ticketResult = await db.query(
      'SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2',
      [ticketId, req.user.id]
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }
    if (ticketResult.rows[0].status === 'archived') {
      return res.status(400).json({ error: 'Ce ticket est archivé et ne peut plus recevoir de message.' });
    }

    await db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message) VALUES ($1,$2,'user',$3)`,
      [ticketId, req.user.id, message]
    );
    await db.query(`UPDATE support_tickets SET status = 'open' WHERE id = $1`, [ticketId]);

    return res.status(201).json({ message: 'Message envoyé.' });
  } catch (err) {
    next(err);
  }
}

// --- Vendeur ---

async function getShopTickets(req, res, next) {
  try {
    const { status } = req.query;
    const conditions = ['t.shop_id = $1'];
    const values = [req.shop.id];
    if (status) {
      conditions.push('t.status = $2');
      values.push(status);
    }

    const { rows } = await db.query(
      `SELECT t.*, u.username, u.email
       FROM support_tickets t JOIN users u ON u.id = t.user_id
       WHERE ${conditions.join(' AND ')} ORDER BY t.updated_at DESC`,
      values
    );
    return res.json({ tickets: rows });
  } catch (err) {
    next(err);
  }
}

async function getShopTicketDetail(req, res, next) {
  try {
    const { ticketId } = req.params;
    const ticketResult = await db.query(
      `SELECT t.*, u.username, u.email FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = $1 AND t.shop_id = $2`,
      [ticketId, req.shop.id]
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    const messages = await db.query(
      `SELECT m.*, u.username FROM ticket_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
      [ticketId]
    );

    return res.json({ ticket: { ...ticketResult.rows[0], messages: messages.rows } });
  } catch (err) {
    next(err);
  }
}

async function addSellerMessage(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message requis.' });

    const ticketResult = await db.query(
      'SELECT * FROM support_tickets WHERE id = $1 AND shop_id = $2',
      [ticketId, req.shop.id]
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    await db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message) VALUES ($1,$2,'seller',$3)`,
      [ticketId, req.user.id, message]
    );
    await db.query(`UPDATE support_tickets SET status = 'answered' WHERE id = $1`, [ticketId]);

    return res.status(201).json({ message: 'Réponse envoyée.' });
  } catch (err) {
    next(err);
  }
}

async function updateTicketStatus(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    if (!['open', 'answered', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const { rows } = await db.query(
      `UPDATE support_tickets SET status = $1 WHERE id = $2 AND shop_id = $3 RETURNING *`,
      [status, ticketId, req.shop.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }
    return res.json({ ticket: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTicket,
  getMyTickets,
  getMyTicketDetail,
  addMyMessage,
  getShopTickets,
  getShopTicketDetail,
  addSellerMessage,
  updateTicketStatus,
};
