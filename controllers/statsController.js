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

export const latest = async (req, res) => {
  try {
    const userId = req.user._id;
    const [bp, sugar, weight, report] = await Promise.all([
      Vitals.findOne({ userId, type: { $regex: /^bp$/i } })
        .sort({ date: -1 })
        .select({ values: 1, systolic: 1, diastolic: 1, date: 1 })
        .lean(),
      Vitals.findOne({ userId, type: { $regex: /^sugar$/i } })
        .sort({ date: -1 })
        .select({ values: 1, sugar: 1, sugarType: 1, date: 1 })
        .lean(),
      Vitals.findOne({ userId, type: { $regex: /^weight$/i } })
        .sort({ date: -1 })
        .select({ values: 1, weight: 1, date: 1 })
        .lean(),
      Report.findOne({ userId })
        .sort({ dateTaken: -1 })
        .select({ title: 1, fileType: 1, fileUrl: 1, dateTaken: 1 })
        .lean(),
    ]);

    const lastBP = bp ? {
      systolic: (bp.values?.systolic ?? bp.systolic ?? null),
      diastolic: (bp.values?.diastolic ?? bp.diastolic ?? null),
      date: bp.date,
    } : null;

    const lastSugar = sugar ? {
      value: (sugar.values?.value ?? sugar.sugar ?? null),
      sugarType: sugar.sugarType ?? null,
      date: sugar.date,
    } : null;

    const lastWeight = weight ? {
      value: (weight.values?.value ?? weight.weight ?? null),
      date: weight.date,
    } : null;

    const lastReport = report ? {
      id: report._id,
      title: report.title,
      fileType: report.fileType,
      fileUrl: report.fileUrl,
      dateTaken: report.dateTaken,
    } : null;

    // Determine last activity (latest of vitals vs report)
    let lastVital = null;
    const vitalsWithType = [
      bp ? { _id: bp._id, type: 'bp', date: bp.date, values: bp.values, systolic: bp.systolic, diastolic: bp.diastolic } : null,
      sugar ? { _id: sugar._id, type: 'sugar', date: sugar.date, values: sugar.values, sugarType: sugar.sugarType, sugar: sugar.sugar } : null,
      weight ? { _id: weight._id, type: 'weight', date: weight.date, values: weight.values, weight: weight.weight } : null,
    ].filter(Boolean);
    if (vitalsWithType.length) {
      lastVital = vitalsWithType.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
    }

    let lastActivity = null;
    const reportTime = lastReport?.dateTaken ? new Date(lastReport.dateTaken).getTime() : 0;
    const vitalTime = lastVital?.date ? new Date(lastVital.date).getTime() : 0;
    if (reportTime || vitalTime) {
      if (reportTime >= vitalTime) {
        lastActivity = { type: 'report', id: lastReport.id, date: lastReport.dateTaken, label: lastReport.title };
      } else {
        let label = '';
        if (lastVital.type === 'bp') label = `${(lastVital.values?.systolic ?? lastVital.systolic ?? '-')} / ${(lastVital.values?.diastolic ?? lastVital.diastolic ?? '-')}`;
        if (lastVital.type === 'sugar') label = `${(lastVital.values?.value ?? lastVital.sugar ?? '-')} mg/dL`;
        if (lastVital.type === 'weight') label = `${(lastVital.values?.value ?? lastVital.weight ?? '-')} kg`;
        lastActivity = { type: 'vital', id: lastVital._id, subtype: lastVital.type, date: lastVital.date, label };
      }
    }

    return res.status(200).json({ lastBP, lastSugar, lastWeight, lastReport, lastActivity });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
