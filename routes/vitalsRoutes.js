import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { addVital, listVitals, analyzeVital } from '../controllers/vitalsController.js';

const router = express.Router();

router.use(authMiddleware);
router.post('/', addVital);
router.get('/', listVitals);
router.post('/:id/analyze', analyzeVital);

export default router;
