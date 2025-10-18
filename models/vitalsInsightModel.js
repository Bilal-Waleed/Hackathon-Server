import mongoose from "mongoose";

const vitalsInsightSchema = new mongoose.Schema(
  {
    vitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Vitals", required: true, index: true },
    languageSummaries: {
      en: { type: String, default: "" },
      roman: { type: String, default: "" },
    },
    assessment: { type: String, default: "" },
    alerts: [
      {
        key: String,
        status: { type: String, enum: ["high", "low", "normal", "unknown"], default: "unknown" },
        reason: String,
      },
    ],
    advice: { type: [String], default: [] },
    followupQuestions: { type: [String], default: [] },
    rawModelResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const VitalsInsight = mongoose.model("VitalsInsight", vitalsInsightSchema);
export default VitalsInsight;
