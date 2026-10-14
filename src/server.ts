import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import apiRouter from "./routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Parse configured CLIENT_URL(s) with fallback and localhost support
const configuredOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server-to-server, curl, Postman, health checkers)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, "");

    // 1. Explicitly configured origins (including local dev)
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // 2. Any Vercel deployment preview or production domain (*.vercel.app)
    if (/\.vercel\.app$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    // 3. Render client URL wildcard
    if (process.env.CLIENT_URL === "*") {
      return callback(null, true);
    }

    console.warn(`[CORS] Request blocked from origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
};

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Root health & status endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "websitebuilder-backend",
    message: "AI Website Builder API is active.",
    health: "/api/health",
  });
});

// Routes
app.use("/api", apiRouter);

// 404 Catch-all: always return JSON rather than Express default HTML
app.use((req, res) => {
  res.status(404).json({
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error Handler
app.use(errorHandler);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] websitebuilder-backend running on port ${PORT}`);
  console.log(`[SERVER] Health check: http://0.0.0.0:${PORT}/api/health`);
});
server.setTimeout(300000); // 5 minutes timeout for AI agent code generation

