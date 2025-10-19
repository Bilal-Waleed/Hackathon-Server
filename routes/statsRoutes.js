import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { quickStats, latest } from '../controllers/statsController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/quick', quickStats);
router.get('/latest', latest);

export default router;
