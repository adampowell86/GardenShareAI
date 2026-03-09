import "./env.js";
import app from "./app.js";

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));
