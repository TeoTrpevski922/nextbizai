import {
  getSettings,
  saveSettings,
  listPosts,
  generateDraft,
  publishPost,
  runScheduledPost,
  json,
  requireAdmin
} from "../lib/instagram-autopilot.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized. Enter the Autopilot admin key." });
  }

  try {
    const action = req.query?.action || (req.method === "GET" ? "dashboard" : "save");

    if (req.method === "GET" && action === "dashboard") {
      const [settings, posts] = await Promise.all([getSettings(), listPosts()]);
      return res.status(200).json({ settings, posts });
    }

    if (req.method === "POST" && action === "save") {
      const settings = await saveSettings(req.body || {});
      return res.status(200).json({ settings, message: "Settings saved." });
    }

    if (req.method === "POST" && action === "generate") {
      const post = await generateDraft();
      return res.status(201).json({ post, message: "Draft generated." });
    }

    if (req.method === "POST" && action === "publish") {
      const post = await publishPost(req.body?.post_id);
      return res.status(200).json({ post, message: "Post published." });
    }

    if (req.method === "POST" && action === "run") {
      const result = await runScheduledPost({ force: true });
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: "Unsupported method or action." });
  } catch (error) {
    console.error("Instagram Autopilot error:", error);
    return res.status(500).json({ error: error.message || "Autopilot request failed." });
  }
}
