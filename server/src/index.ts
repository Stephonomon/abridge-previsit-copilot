import app from "./app.js";
import { PORT } from "./env.js";

app.listen(PORT, () => {
  console.log(`Pre-Visit Copilot server on http://localhost:${PORT}`);
});
