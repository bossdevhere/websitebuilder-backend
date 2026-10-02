import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import apiRouter from "./routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/api", apiRouter);

// Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[SERVER] websitebuilder-backend running on port ${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
});
