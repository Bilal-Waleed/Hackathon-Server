import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  uploadReport,
  listReports,
  getReport,
  deleteReport,
  analyzeReport,
  feedbackOnInsight,
} from '../controllers/reportController.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/upload', uploadReport);
router.get('/', listReports);
router.get('/:id', getReport);
router.delete('/:id', deleteReport);
router.post('/:id/analyze', analyzeReport);
router.post('/:id/feedback', feedbackOnInsight);

export default router;
