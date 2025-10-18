import mongoose from "mongoose";

const vitalsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["bp", "sugar", "weight", "other"], required: false },
    systolic: { type: Number },
    diastolic: { type: Number },
    sugar: { type: Number },
    sugarType: { type: String, enum: ["fasting", "random"], default: undefined },
    height: { type: Number },
    weight: { type: Number },
    spo2: { type: Number },
    heartRate: { type: Number },
    timeOfDay: { type: String },
    frequency: { type: String },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, default: "" },
    date: { type: Date, required: true },
    insightId: { type: mongoose.Schema.Types.ObjectId, ref: "VitalsInsight" },
  },
  { timestamps: true }
);

vitalsSchema.index({ userId: 1, date: -1 });

const Vitals = mongoose.model("Vitals", vitalsSchema);
export default Vitals;
