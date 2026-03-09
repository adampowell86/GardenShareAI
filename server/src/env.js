import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

if (process.env.NODE_ENV === "test") {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "test-secret";
  }
  if (!process.env.CLIENT_ORIGIN) {
    process.env.CLIENT_ORIGIN = "http://localhost:5173";
  }
}
