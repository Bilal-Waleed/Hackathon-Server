import { userLoginSchema, userRegisterSchema } from "../schema/userSchema.js";
import User from "../models/userModel.js";
import { sendOTPVerificationEmail, sendPasswordResetEmail } from "../controllers/emailController.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const Register = async (req, res) => {
    try{
        const checkSchema = userRegisterSchema.safeParse(req.body);
        if(!checkSchema.success){
            return res.status(400).json({message: checkSchema.error.issues[0].message});
        }
        const {name, email, cnic, password} = checkSchema.data;
        
        const existEmail = await User.findOne({email});
        if(existEmail){
            return res.status(400).json({message: "Email already exists"});
        }
        const existCnic = await User.findOne({cnic});
        if(existCnic){
            return res.status(400).json({message: "CNIC already exists"});
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const otp = generateOTP();

        const newUser = new User({name, email, cnic, password: hashedPassword, isAdmin: false, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`, otp, isVerified: false});
        await newUser.save();
        res.status(201).json({message: "User registered successfully", user: newUser});

        await sendOTPVerificationEmail(email, name, otp);

    }catch(error){
        return res.status(500).json({message: error.message});
    }
};

const VerifyOTP = async (req , res) => {
    try{
        const {email, otp} = req.body;
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({message: "User not found"});
        }
        if(user.otp !== otp){
            return res.status(400).json({message: "Invalid OTP"});
        }
        user.otp = "";
        user.isVerified = true;
        await user.save();

        res.status(200).json({message: "OTP verified successfully"});

        }catch(error){
            return res.status(500).json({message: "OTP verification failed" || error.message});
        }
}

const Login = async (req, res) => {
    try{
        const checkSchema = userLoginSchema.safeParse(req.body);
        if(!checkSchema.success){
            return res.status(400).json({message: checkSchema.error.issues[0].message});
        }
        const {email, password} = checkSchema.data;

        const user = await User.findOne({email});
        if(!user){
            return res.status(401).json({message: "Invalid email or password"});
        }

        if(!user.isVerified){
            return res.status(401).json({message: "Please verify your OTP before logging in"});
        }

        if(!user.password){
            return res.status(401).json({message: "Invalid email or password"});
        }

        const isvalidpassword = await bcrypt.compare(password, user.password);
        if(!isvalidpassword){
            return res.status(401).json({message: "Invalid email or password"});
        }

        const token = jwt.sign(
            {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                avatar: user.avatar,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d",
            }   
        )
        
        res.status(200).json({message: "Login successful", user, token, userId: user._id.toString()});

    }catch(error){
        return res.status(500).json({message: error.message});
    }
};

const ForgetPassword = async (req, res) => {
    try{
        const {email} = req.body;
        const user = await User.findOne({email});
        if(!user){
            return res.status(401).json({message: "User not found"});
        }
        const resetToken = jwt.sign(
            {
                UserId: user._id.toString(),
                email: user.email,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h",
            }
        )
        const resetPasswordUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
        await sendPasswordResetEmail(user.email, user.name, resetPasswordUrl);
        res.status(200).json({message: "Password reset email sent successfully"});
        
    }catch(error){
        return res.status(500).json({message: error.message});
    }
};

const ResetPassword = async (req, res) => {
    try {
        const {token, password} = req.body;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.UserId);
        if(!user){
            return res.status(401).json({message: "User not found"});
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user.password = hashedPassword;
        await user.save();
        res.status(200).json({message: "Password reset successful"});
    } catch (error) {
        return res.status(500).json({message: error.message});
    }
}

const UserCheck = async (req, res) => {
    try{
        return res.status(200).json({message: "User fetch successfully ", user: req.user});
        }catch(error){
            return res.status(500).json({message: error.message});
        }
}


export {Register, Login, VerifyOTP, ForgetPassword, ResetPassword, UserCheck};
