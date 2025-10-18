import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { getSignedParams, extractPdfPages, composePdfFromTag, listPages } from '../controllers/fileController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/signed-params', getSignedParams);
router.post('/extract-pdf-pages', extractPdfPages);
router.post('/compose-pdf', composePdfFromTag);
router.get('/pages', listPages);

export default router;
