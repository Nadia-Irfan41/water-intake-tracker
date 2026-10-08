const path = require("path");
const express = require("express");
const cors = require("cors");

const pool = require("./db");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", authRoutes);

// Local development only: `npm start` serves the frontend too, so http://localhost:5000 works.
// On Vercel the frontend is served as static files and this file is loaded by api/index.js instead.
if (require.main === module) {
  app.use(express.static(path.join(__dirname, "..", "frontend")));
}

app.get("/", (req, res) => {
  res.send("Water Intake Tracker Backend is running!");
});

// Vercel imports the app; locally (`node server.js`) we start a normal HTTP server.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  pool.init().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
