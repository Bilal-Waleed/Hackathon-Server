import express from "express";
import { Login, Register, VerifyOTP , ForgetPassword, ResetPassword, UserCheck} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", Register);
router.post("/login", Login);
router.post("/verify-otp", VerifyOTP);
router.post("/forget-password", ForgetPassword);
router.post("/reset-password", ResetPassword);
router.get("/user", authMiddleware, UserCheck);

export default router;