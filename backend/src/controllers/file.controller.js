const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// --- Gestion vendeur ---

async function uploadProductFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const relativePath = path.join('products', req.params.productId, req.file.filename);

    const { rows } = await db.query(
      `INSERT INTO product_files (product_id, file_name, storage_path, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.productId, req.file.originalname, relativePath, req.file.mimetype, req.file.size]
    );

    return res.status(201).json({ file: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listProductFiles(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM product_files WHERE product_id = $1 ORDER BY created_at DESC',
      [req.params.productId]
    );
    return res.json({ files: rows });
  } catch (err) {
    next(err);
  }
}

async function deleteProductFile(req, res, next) {
  try {
    const { fileId } = req.params;
    const { rows } = await db.query('SELECT * FROM product_files WHERE id = $1 AND product_id = $2', [fileId, req.params.productId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fichier introuvable.' });
    }

    const { UPLOAD_ROOT } = require('../config/upload');
    const fullPath = path.join(UPLOAD_ROOT, '..', rows[0].storage_path);
    fs.unlink(fullPath, () => {}); // best-effort, on ne bloque pas sur une erreur disque

    await db.query('DELETE FROM product_files WHERE id = $1', [fileId]);
    return res.json({ message: 'Fichier supprimé.' });
  } catch (err) {
    next(err);
  }
}

// --- Téléchargement sécurisé (client) ---

async function downloadFile(req, res, next) {
  try {
    const { token } = req.params;

    const { rows } = await db.query(
      `SELECT dl.*, pf.storage_path, pf.file_name, pf.mime_type
       FROM download_links dl
       JOIN product_files pf ON pf.id = dl.product_file_id
       WHERE dl.token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lien de téléchargement invalide.' });
    }

    const link = rows[0];

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Ce lien de téléchargement a expiré.' });
    }
    if (link.download_count >= link.max_downloads) {
      return res.status(410).json({ error: 'Nombre maximum de téléchargements atteint pour ce lien.' });
    }

    const { UPLOAD_ROOT } = require('../config/upload');
    const fullPath = path.join(UPLOAD_ROOT, '..', link.storage_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Fichier introuvable sur le serveur.' });
    }

    await db.query('UPDATE download_links SET download_count = download_count + 1 WHERE id = $1', [link.id]);

    return res.download(fullPath, link.file_name);
  } catch (err) {
    next(err);
  }
}

/**
 * Liste les liens de téléchargement disponibles pour une commande du client connecté.
 * Utilisé par la page de détail de commande côté client.
 */
async function getDownloadsForOrder(req, res, next) {
  try {
    const { orderId } = req.params;

    const { rows } = await db.query(
      `SELECT dl.token, dl.download_count, dl.max_downloads, dl.expires_at, pf.file_name, oi.id AS order_item_id
       FROM download_links dl
       JOIN product_files pf ON pf.id = dl.product_file_id
       JOIN order_items oi ON oi.id = dl.order_item_id
       WHERE oi.order_id = $1 AND dl.user_id = $2`,
      [orderId, req.user.id]
    );

    return res.json({ downloads: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadProductFile,
  listProductFiles,
  deleteProductFile,
  downloadFile,
  getDownloadsForOrder,
};
