import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    secure: true,
    auth: {
        user: `${process.env.EMAIL_USER}`,
        pass: `${process.env.EMAIL_PASS}`,
    },
});

const sendOTPVerificationEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `${process.env.EMAIL_USER}`,
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Hey ${name},</h2>
        <p>Thanks for signing up! To verify your email, please use the following OTP:</p>
        <h3 style="color: #007bff; font-size: 24px; text-align: center;">${otp}</h3>
        <p>This OTP is valid for 10 minutes. Please enter it to complete the verification process.</p>
        <p>If you didn’t request this, you can ignore this email.</p>
        <p>Cheers,<br>The Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, name, resetLink) => {
  const mailOptions = {
    from: `${process.env.EMAIL_USER}`,
    to: email,
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. You can reset it using the link below:</p>
        <p><a href="${resetLink}" style="color: #007bff; text-decoration: none;">Reset Password</a></p>
        <p>This link will expire in 1 hour. If you didn’t request a password reset, just ignore this email.</p>
        <p>Take care,<br>The Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export { sendOTPVerificationEmail, sendPasswordResetEmail };
