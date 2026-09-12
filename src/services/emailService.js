import "dotenv/config";
import nodemailer from "nodemailer";
console.log("📧 Mail configuration:");
console.log("MAIL_HOST:", process.env.MAIL_HOST);
console.log("MAIL_PORT:", process.env.MAIL_PORT);
console.log("MAIL_USER:", process.env.MAIL_USER);
console.log(
  "MAIL_PASSWORD:",
  process.env.MAIL_PASSWORD ? "LOADED" : "MISSING"
);
console.log("MAIL_FROM:", process.env.MAIL_FROM);

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

/**
 * Verify SMTP connection
 */
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();

    console.log("✅ Email SMTP connection successful.");

    return true;
  } catch (error) {
    console.error("❌ Email SMTP connection failed:");
    console.error(error.message);

    return false;
  }
};

/**
 * Send email
 */
export const sendEmail = async ({
  to,
  subject,
  text,
  html,
}) => {
  if (!to) {
    throw new Error("Recipient email address is required.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  const mailOptions = {
    from:
      process.env.MAIL_FROM ||
      process.env.MAIL_USER,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log(
      `📧 Email sent successfully to ${to}. Message ID: ${info.messageId}`
    );

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`);
    console.error(error.message);

    throw error;
  }
};

export default {
  sendEmail,
  verifyEmailConnection,
};