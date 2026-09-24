export default async function handler(req, res) {
  if (req.method === "POST") {
    return res.status(200).json({
      success: true
    });
  }

  return res.status(200).send("ReplyoAI Instagram deauthorize endpoint is active.");
}
