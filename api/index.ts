// Vercel serverless entry — wraps the Express app. All /api/* traffic is
// rewritten here (see vercel.json); the app's own routes match the full path.
import app from "../server/src/app.js";

export default app;
