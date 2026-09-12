import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";
import { verifyEmailConnection } from "./services/emailService.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    await verifyEmailConnection();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();