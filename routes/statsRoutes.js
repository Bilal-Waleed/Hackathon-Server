import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { quickStats } from '../controllers/statsController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/quick', quickStats);

export default router;
