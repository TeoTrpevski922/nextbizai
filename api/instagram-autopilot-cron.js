import { runScheduledPost } from "../lib/instagram-autopilot.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers?.authorization || "";
  if (!expected || authorization !== "Bearer " + expected) {
    return res.status(401).json({ error: "Unauthorized cron request." });
  }
  try {
    const result = await runScheduledPost();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Instagram Autopilot scheduled run failed:", error);
    return res.status(500).json({ error: error.message || "Scheduled run failed." });
  }
}
