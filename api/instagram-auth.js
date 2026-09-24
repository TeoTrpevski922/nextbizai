export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`
      <h2>Instagram connection failed</h2>
      <p>${error_description || error}</p>
    `);
  }

  if (!code) {
    return res.status(400).send("Missing Instagram authorization code.");
  }

  return res.status(200).send(`
    <html>
      <body style="font-family:Arial;padding:40px;">
        <h2>Instagram authorization received ✅</h2>
        <p>ReplyoAI successfully received the authorization.</p>
      </body>
    </html>
  `);
}
