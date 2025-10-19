import Report from "../models/reportModel.js";
import Vitals from "../models/vitalsModel.js";

export const quickStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [reportCount, vitalsCount, firstReport, firstVital] = await Promise.all([
      Report.countDocuments({ userId }),
      Vitals.countDocuments({ userId }),
      Report.findOne({ userId }).sort({ dateTaken: 1 }).select({ dateTaken: 1 }).lean(),
      Vitals.findOne({ userId }).sort({ date: 1 }).select({ date: 1 }).lean(),
    ]);

    const candidates = [];
    if (req.user?.createdAt) candidates.push(new Date(req.user.createdAt));
    if (firstReport?.dateTaken) candidates.push(new Date(firstReport.dateTaken));
    if (firstVital?.date) candidates.push(new Date(firstVital.date));

    const start = candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : new Date();
    const ms = Date.now() - start.getTime();
    const daysActive = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));

    return res.status(200).json({ reports: reportCount, vitals: vitalsCount, daysActive });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
