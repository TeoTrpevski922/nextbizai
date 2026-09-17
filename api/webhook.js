export default async function handler(req, res) {
  // Meta webhook verification
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
      mode === "subscribe" &&
      token === process.env.INSTAGRAM_VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Forbidden");
  }

  // Receive Instagram messages
  if (req.method === "POST") {
    try {
      const body = req.body;

      console.log(
        "Instagram webhook event:",
        JSON.stringify(body)
      );

      const entry = body?.entry?.[0];
      const messaging = entry?.messaging?.[0];

      const senderId = messaging?.sender?.id;
      const messageText = messaging?.message?.text;

      // Ignore events that are not text messages
      if (!senderId || !messageText) {
        return res.status(200).send("EVENT_RECEIVED");
      }

      // Ask OpenAI
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-5.6-luna",
            instructions: `
You are the AI customer assistant for Davor Cut, a barber shop in Skopje.

Business:
- Name: Davor Cut
- Location: Staj Kisla Voda
- Working hours: 10:00 - 20:00

Services:
- Шишање: 400 ден
- Шишање + миење: 450 ден
- Шишање + брада: 450 ден
- Шишање + миење + брада: 500 ден

Rules:
- Answer naturally and professionally.
- Always answer in the same language as the customer.
- Keep answers short and friendly.
- Do not invent prices, services or availability.
- If the customer asks about booking, help them collect the date and preferred time.
`,
            input: messageText
          })
        }
      );

      const openaiData = await openaiResponse.json();

      if (!openaiResponse.ok) {
        console.error("OpenAI error:", openaiData);
        return res.status(200).send("EVENT_RECEIVED");
      }

      const reply =
        openaiData.output_text ||
        "Извини, моментално не можам да одговорам.";

      // Send reply back to Instagram
      const instagramResponse = await fetch(
        `https://graph.instagram.com/v24.0/17841420437644177/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            recipient: {
              id: senderId
            },
            message: {
              text: reply
            }
          })
        }
      );

      const instagramData = await instagramResponse.json();

      console.log(
        "Instagram send response:",
        JSON.stringify(instagramData)
      );

      return res.status(200).send("EVENT_RECEIVED");

    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(200).send("EVENT_RECEIVED");
    }
  }

  return res.status(405).send("Method Not Allowed");
}
