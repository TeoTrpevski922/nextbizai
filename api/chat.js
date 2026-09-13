export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const businessContext = `
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
- Answer customers naturally and professionally.
- Always answer in the same language as the customer.
- If the customer asks about a service price, use only the prices above.
- If the customer asks about working hours, use 10:00 - 20:00.
- Do not invent services, prices, availability or bookings.
- At this stage you cannot create bookings yet.
- If the customer wants to book an appointment, tell them that you can help them with the booking once they choose a date and time.
- Keep answers short and friendly, like a real barber shop assistant.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: businessContext,
        input: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed"
      });
    }

    return res.status(200).json({
      reply: data.output_text || "Извини, не успеав да одговорам."
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
