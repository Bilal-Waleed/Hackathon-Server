import express from "express";
import dns from "dns";
import connectDB from "./config/db.js";
import userRoute from "./routes/userRoute.js";
import cors from "cors";
import reportRoutes from "./routes/reportRoutes.js";
import vitalsRoutes from "./routes/vitalsRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";

const app = express();
dns.setDefaultResultOrder('ipv4first');
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use("/api", userRoute);
app.use("/api/reports", reportRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/files", fileRoutes);

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});