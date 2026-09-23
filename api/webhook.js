import webpush from "web-push";

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
Ти си AI асистент за Davor Cut, берберски салон во Скопје.

ВАЖНО:
- Секогаш одговарај само на македонски јазик.
- Секогаш користи кирилица.
- Одговорите нека бидат кратки, природни и пријателски.
- Не кажувај работно време.
- Не измислувај информации.
- Не закажувај термин самостојно.
- Не потврдувај дека има слободен термин ако тоа не е проверено од човек.

ЦЕНОВНИК:
- Шишање: 400 денари
- Шишање со брада: 500 денари
- Брада: 200 денари
- Миење: 50 денари
- Дизајн: 100 денари

ПРАВИЛА:

Ако клиентот праша за цена, одговори со точната цена од ценовникот.

Ако клиентот праша дали има слободен термин, НЕ кажувај дали има или нема термин.

Одговори:
„Ќе провериме и ќе ви пишеме за кратко. 😊“

Ако клиентот праша нешто за термин, достапност или нешто што треба да го провери берберот, кажи дека ќе провериме и ќе му пишеме за кратко.

Ако клиентот праша за работно време, не кажувај конкретно време. Одговори:
„Ќе ви пишеме за кратко со информација. 😊“

Ако клиентот праша нешто што не е во овие информации, не измислувај одговор. Кажи:
„Ќе провериме и ќе ви пишеме за кратко. 😊“
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
  openaiData.output
    ?.flatMap(item => item.content || [])
    ?.find(item => item.type === "output_text")
    ?.text ||
  "Ќе провериме и ќе ви пишеме за кратко. 😊";

console.log("OpenAI reply:", reply);

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

      // =========================
      // PUSH NOTIFICATION
      // =========================

      const needsBarber =
        reply.includes("Ќе провериме") ||
        reply.includes("Ќе ви пишеме");

      if (needsBarber) {
        try {
          webpush.setVapidDetails(
            "mailto:hello@replyoai.com",
            "BGyIKFnz2WOV2V1ZJEsCRiwZyPePNu4EqrkcWhinbSSkrDsMR-i5mskqBeVWArud7dDHDCDJN3hKgfaOMMS1z4Q",
            process.env.VAPID_PRIVATE_KEY
          );

          const supabaseResponse = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`,
            {
              method: "GET",
              headers: {
                "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
              }
            }
          );

          const subscriptions = await supabaseResponse.json();

          console.log(
            "Push subscriptions:",
            JSON.stringify(subscriptions)
          );

          if (Array.isArray(subscriptions)) {
            for (const row of subscriptions) {
              try {
                const subscription =
                  typeof row.subscription === "string"
                    ? JSON.parse(row.subscription)
                    : row.subscription;

                await webpush.sendNotification(
                  subscription,
                  JSON.stringify({
                    title: "ReplyoAI",
                    body: `Новa порака од клиент: ${messageText}`
                  })
                );

                console.log("Push notification sent successfully.");
              } catch (pushError) {
                console.error(
                  "Push send error:",
                  pushError
                );
              }
            }
          }
        } catch (pushSetupError) {
          console.error(
            "Push setup error:",
            pushSetupError
          );
        }
      }

      return res.status(200).send("EVENT_RECEIVED");

    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(200).send("EVENT_RECEIVED");
    }
  }

  return res.status(405).send("Method Not Allowed");
}
