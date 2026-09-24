export default async function handler(req, res) {
  if (req.method === "POST") {
    return res.status(200).json({
      url: "https://nextbizai.vercel.app/privacy.html",
      confirmation_code: "replyoai-data-deletion"
    });
  }

  return res.status(200).send("ReplyoAI Instagram data deletion endpoint is active.");
}
