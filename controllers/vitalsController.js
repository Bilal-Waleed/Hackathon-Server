import Vitals from "../models/vitalsModel.js";
import VitalsInsight from "../models/vitalsInsightModel.js";
import { analyzeVitalsWithGemini } from "../services/geminiService.js";

export const addVital = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type,
      values = {},
      notes = "",
      date,
      systolic,
      diastolic,
      sugar,
      sugarType, // fasting | random
      height,
      weight,
      spo2,
      heartRate,
      timeOfDay,
      frequency,
    } = req.body;

    if (!date) return res.status(400).json({ message: "date is required" });

    // Infer type if not provided
    let inferredType = type;
    const hasBP = systolic !== undefined || diastolic !== undefined || (values && (values.systolic !== undefined || values.diastolic !== undefined));
    const hasSugar = sugar !== undefined || (values && values.value !== undefined && String(type).toLowerCase() === 'sugar');
    const hasWeight = weight !== undefined || (values && values.value !== undefined && String(type).toLowerCase() === 'weight');
    if (!inferredType) {
      if (hasBP) inferredType = 'bp';
      else if (hasSugar) inferredType = 'sugar';
      else if (hasWeight) inferredType = 'weight';
      else inferredType = 'other';
    }

    // Build values map retaining backward compat
    const vals = { ...values };
    if (hasBP) {
      if (systolic !== undefined) vals.systolic = Number(systolic);
      if (diastolic !== undefined) vals.diastolic = Number(diastolic);
    }
    if (sugar !== undefined) vals.value = Number(sugar);
    if (weight !== undefined && inferredType === 'weight') vals.value = Number(weight);

    const doc = await Vitals.create({
      userId,
      type: inferredType,
      values: vals,
      notes,
      date: new Date(date),
      systolic: systolic !== undefined ? Number(systolic) : undefined,
      diastolic: diastolic !== undefined ? Number(diastolic) : undefined,
      sugar: sugar !== undefined ? Number(sugar) : undefined,
      sugarType: sugarType || undefined,
      height: height !== undefined ? Number(height) : undefined,
      weight: weight !== undefined ? Number(weight) : undefined,
      spo2: spo2 !== undefined ? Number(spo2) : undefined,
      heartRate: heartRate !== undefined ? Number(heartRate) : undefined,
      timeOfDay: timeOfDay || undefined,
      frequency: frequency || undefined,
    });

    return res.status(201).json({ vital: doc });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const listVitals = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, startDate, endDate, type } = req.query;

    const q = { userId };
    if (type) q.type = type;
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = new Date(startDate);
      if (endDate) q.date.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Vitals.find(q).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      Vitals.countDocuments(q),
    ]);

    return res.status(200).json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const analyzeVital = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const vital = await Vitals.findOne({ _id: id, userId });
    if (!vital) return res.status(404).json({ message: 'Vital not found' });

    // Construct values payload prioritizing explicit fields
    const values = {
      type: vital.type,
      systolic: vital.systolic,
      diastolic: vital.diastolic,
      sugar: vital.sugar,
      sugarType: vital.sugarType,
      height: vital.height,
      weight: vital.weight,
      spo2: vital.spo2,
      heartRate: vital.heartRate,
      timeOfDay: vital.timeOfDay,
      frequency: vital.frequency,
      ...vital.values,
    };

    let parsed, raw;
    try {
      const r = await analyzeVitalsWithGemini({ values, title: 'Vitals Analysis' });
      parsed = r.parsed; raw = r.raw;
    } catch (e) {
      if (String(e.message || '').includes('Gemini API 404')) {
        return res.status(502).json({ message: 'AI model unavailable for your API key. Set GEMINI_MODEL=gemini-1.5-flash-8b-latest (or flash-8b-001) in server .env and restart.' });
      }
      throw e;
    }

    let insight;
    if (vital.insightId) {
      insight = await VitalsInsight.findByIdAndUpdate(
        vital.insightId,
        {
          languageSummaries: parsed.languageSummaries || { en: '', roman: '' },
          assessment: parsed.assessment || '',
          alerts: parsed.alerts || [],
          advice: parsed.advice || [],
          followupQuestions: parsed.followupQuestions || [],
          rawModelResponse: raw,
        },
        { new: true }
      );
    } else {
      insight = await VitalsInsight.create({
        vitalId: vital._id,
        languageSummaries: parsed.languageSummaries || { en: '', roman: '' },
        assessment: parsed.assessment || '',
        alerts: parsed.alerts || [],
        advice: parsed.advice || [],
        followupQuestions: parsed.followupQuestions || [],
        rawModelResponse: raw,
      });
      vital.insightId = insight._id;
      await vital.save();
    }

    return res.status(200).json({ vital, insight });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
