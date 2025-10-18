import mongoose from "mongoose";

const privacySchema = new mongoose.Schema(
  {
    shared: { type: Boolean, default: false },
    shareToken: { type: String, default: null },
    shareExpiresAt: { type: Date, default: null },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    filePublicId: { type: String, required: true },
    fileType: { type: String, enum: ["pdf", "image"], required: true },
    dateTaken: { type: Date, required: true },
    tags: [{ type: String }],
    notes: { type: String, default: "" },
    aiInsightId: { type: mongoose.Schema.Types.ObjectId, ref: "AiInsight", default: null },
    privacy: { type: privacySchema, default: () => ({}) },
  },
  { timestamps: true }
);

reportSchema.index({ userId: 1, dateTaken: -1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
