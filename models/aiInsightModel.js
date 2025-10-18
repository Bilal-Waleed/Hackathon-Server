import mongoose from "mongoose";

const aiInsightSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true },
    languageSummaries: {
      en: { type: String, default: "" },
      roman: { type: String, default: "" },
    },
    highlights: [
      {
        key: String,
        value: String,
        flag: { type: String, enum: ["high", "low", "normal", "unknown"], default: "unknown" },
      },
    ],
    doctorQuestions: [{ type: String }],
    dietTips: [{ type: String }],
    warnings: [{ type: String }],
    rawModelResponse: { type: mongoose.Schema.Types.Mixed },
    feedback: [
      {
        liked: { type: Boolean, default: null },
        comment: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true }
);

const AiInsight = mongoose.model("AiInsight", aiInsightSchema);
export default AiInsight;
