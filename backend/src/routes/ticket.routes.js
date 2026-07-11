const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');
const shopController = require('../controllers/shop.controller');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Client ---
router.post('/', requireAuth, ticketController.createTicket);
router.get('/me', requireAuth, ticketController.getMyTickets);
router.get('/me/:ticketId', requireAuth, ticketController.getMyTicketDetail);
router.post('/me/:ticketId/messages', requireAuth, ticketController.addMyMessage);

// --- Vendeur ---
router.use('/manage/:shopId', requireAuth, shopController.loadShop, requireShopOwnerOrAdmin);
router.get('/manage/:shopId', ticketController.getShopTickets);
router.get('/manage/:shopId/:ticketId', ticketController.getShopTicketDetail);
router.post('/manage/:shopId/:ticketId/messages', ticketController.addSellerMessage);
router.patch('/manage/:shopId/:ticketId/status', ticketController.updateTicketStatus);

module.exports = router;
