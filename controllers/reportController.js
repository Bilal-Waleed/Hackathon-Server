import Report from "../models/reportModel.js";
import AiInsight from "../models/aiInsightModel.js";
import cloudinary from "../config/cloudinary.js";
import { analyzeFileWithGemini } from "../services/geminiService.js";

const parseBoolean = (v, def = false) => {
  if (v === undefined) return def;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
};

export const uploadReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      title,
      fileUrl,
      filePublicId,
      fileType, // 'pdf' | 'image'
      dateTaken,
      tags = [],
      notes = "",
      analyze = true,
    } = req.body;

    if (!title || !fileUrl || !filePublicId || !fileType || !dateTaken) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const report = await Report.create({
      userId,
      title,
      fileUrl,
      filePublicId,
      fileType,
      dateTaken: new Date(dateTaken),
      tags,
      notes,
    });

    let insight = null;
    if (parseBoolean(analyze, true)) {
      try {
        const { parsed, raw } = await analyzeFileWithGemini({ fileUrl, filePublicId, fileType, title });
        insight = await AiInsight.create({
          reportId: report._id,
          languageSummaries: parsed.languageSummaries || { en: '', roman: '' },
          highlights: parsed.highlights || [],
          doctorQuestions: parsed.doctorQuestions || [],
          dietTips: parsed.dietTips || [],
          warnings: parsed.warnings || [
            'For education and understanding only — consult your doctor for treatment.',
          ],
          rawModelResponse: raw,
        });
        report.aiInsightId = insight._id;
        await report.save();
      } catch (e) {
        console.error('Gemini analysis failed:', e.message);
      }
    }

    return res.status(201).json({ report, aiInsight: insight });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const listReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      type,
      tag,
      startDate,
      endDate,
      search,
    } = req.query;

    const q = { userId };
    if (type) q.fileType = type;
    if (tag) q.tags = { $in: [tag] };
    if (startDate || endDate) {
      q.dateTaken = {};
      if (startDate) q.dateTaken.$gte = new Date(startDate);
      if (endDate) q.dateTaken.$lte = new Date(endDate);
    }
    if (search) {
      q.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Report.find(q).sort({ dateTaken: -1 }).skip(skip).limit(Number(limit)),
      Report.countDocuments(q),
    ]);

    return res.status(200).json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const report = await Report.findOne({ _id: id, userId });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const aiInsight = report.aiInsightId
      ? await AiInsight.findById(report.aiInsightId)
      : null;

    return res.status(200).json({ report, aiInsight });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const report = await Report.findOne({ _id: id, userId });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    try {
      if (report.filePublicId) {
        await cloudinary.uploader.destroy(report.filePublicId);
      }
    } catch (e) {
      console.warn('Cloudinary delete failed:', e.message);
    }

    if (report.aiInsightId) {
      await AiInsight.findByIdAndDelete(report.aiInsightId);
    }

    await report.deleteOne();
    return res.status(200).json({ message: 'Report deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const analyzeReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const report = await Report.findOne({ _id: id, userId });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    let parsed, raw;
    try {
      const r = await analyzeFileWithGemini({
        fileUrl: report.fileUrl,
        filePublicId: report.filePublicId,
        fileType: report.fileType,
        title: report.title,
      });
      parsed = r.parsed; raw = r.raw;
    } catch (e) {
      if (String(e.message || '').includes('Gemini API 404')) {
        return res.status(502).json({ message: 'AI model unavailable for your API key. Set GEMINI_MODEL=gemini-1.5-flash-8b-latest (or flash-8b-001) in server .env and restart.' });
      }
      throw e;
    }

    let insight;
    if (report.aiInsightId) {
      insight = await AiInsight.findByIdAndUpdate(
        report.aiInsightId,
        {
          languageSummaries: parsed.languageSummaries || { en: '', roman: '' },
          highlights: parsed.highlights || [],
          doctorQuestions: parsed.doctorQuestions || [],
          dietTips: parsed.dietTips || [],
          warnings: parsed.warnings || [
            'For education and understanding only — consult your doctor for treatment.',
          ],
          rawModelResponse: raw,
        },
        { new: true }
      );
    } else {
      insight = await AiInsight.create({
        reportId: report._id,
        languageSummaries: parsed.languageSummaries || { en: '', roman: '' },
        highlights: parsed.highlights || [],
        doctorQuestions: parsed.doctorQuestions || [],
        dietTips: parsed.dietTips || [],
        warnings: parsed.warnings || [
          'For education and understanding only — consult your doctor for treatment.',
        ],
        rawModelResponse: raw,
      });
      report.aiInsightId = insight._id;
      await report.save();
    }

    return res.status(200).json({ report, aiInsight: insight });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const feedbackOnInsight = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params; // report id
    const { liked = null, comment = '' } = req.body;

    const report = await Report.findOne({ _id: id, userId });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    if (!report.aiInsightId) return res.status(400).json({ message: 'No insight to feedback' });

    const insight = await AiInsight.findById(report.aiInsightId);
    insight.feedback.push({ liked, comment, userId });
    await insight.save();

    return res.status(200).json({ message: 'Feedback recorded' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
