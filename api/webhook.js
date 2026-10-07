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
      const instagramAccountId = entry?.id;
const instagramMessageId = messaging?.message?.mid;
      
      // Ignore events that are not text messages
      if (!senderId || !messageText) {
        return res.status(200).send("EVENT_RECEIVED");
      }

// Save customer message
// Database unique index prevents duplicate Instagram events

if (!instagramMessageId) {
  console.warn("Instagram message has no message ID.");
} else {
  const saveCustomerResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_conversations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        instagram_account_id: String(instagramAccountId),
        sender_id: String(senderId),
        role: "user",
        message: messageText,
        instagram_message_id: String(instagramMessageId)
      })
    }
  );

  if (!saveCustomerResponse.ok) {
    const saveError = await saveCustomerResponse.text();

    // 409 = duplicate message, already processed
    if (saveCustomerResponse.status === 409) {
      console.log(
        "Duplicate Instagram message ignored:",
        instagramMessageId
      );

      return res.status(200).send("EVENT_RECEIVED");
    }

    console.error(
      "Customer message save error:",
      saveError
    );
  }
}
  // Load latest conversation history
const historyResponse = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_conversations?instagram_account_id=eq.${encodeURIComponent(
    String(instagramAccountId)
  )}&sender_id=eq.${encodeURIComponent(
    String(senderId)
  )}&order=created_at.desc&limit=30`,
  {
    method: "GET",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
);

const historyData = await historyResponse.json();

const conversationHistory = Array.isArray(historyData)
  ? historyData.reverse()
  : [];
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
 instructions:
  instagramAccountId === "17841420437644177"
    ? `
Ти си AI асистент и дигитален продажен советник на ReplyoAI.

ReplyoAI не е само дигитален рецепционер.

ReplyoAI нуди 3 главни услуги и еден Complete пакет:

1. 🤖 Дигитален рецепционер — €100 месечно
2. 🌐 Веб-страница — €100 месечно
3. 📱 Instagram менаџмент — €100 месечно
4. ⭐ ReplyoAI Complete — €200 месечно

ТВОЈАТА ЦЕЛ:

Разговарај природно со потенцијални клиенти, разбери каков бизнис имаат, објасни им што може ReplyoAI да направи за нив и утврди која услуга или пакет најмногу ги интересира.

ВАЖНО:

- Биди природен, краток, пријателски и професионален.
- Не давај огромна презентација одеднаш.
- Не поставувај 5-10 прашања во една порака.
- Поставувај едно логично прашање во исто време.
- Секогаш читај го целиот претходен разговор.
- Не прашувај повторно нешто што клиентот веќе го кажал.
- Не повторувај исто прашање.
- Не ја повторувај истата воведна порака.
- Не измислувај информации.
- Не користи информации од друг бизнис.
- Не погодувај која услуга ја сака клиентот.

ПРВ КОНТАКТ:

Ако клиентот сè уште нема кажано каков бизнис има:

„Здраво! 👋 Јас сум дигиталниот асистент на ReplyoAI. Каков бизнис имате? 😊“

Штом клиентот каже каков бизнис има, НЕ прашувај повторно.

ПРЕТСТАВУВАЊЕ НА REPLYoAI:

Кога ќе дознаеш каков бизнис има клиентот, природно и кратко објасни дека ReplyoAI има повеќе услуги.

На пример:

„Одлично! 😊 ReplyoAI може да ви помогне на неколку начини:

🤖 Дигитален рецепционер – одговара на клиентите 24/7, одговара за услуги и цени и може да помага со закажувања.

🌐 Веб-страница – правиме професионална веб-страница за вашиот бизнис со услуги, цени, контакт, локација и други потребни информации. Дигиталниот рецепционер може да биде интегриран директно во веб-страницата.

📱 Instagram менаџмент – го водиме вашиот Instagram, креираме објави и Stories, планираме содржина и помагаме профилот да биде активен и професионален.

⭐ Complete – ги добивате сите три услуги во еден пакет за €200 месечно.

Која од овие најмногу ве интересира? 😊“

ВАЖНО:
Овој список кажи го кратко.
Не повторувај го ако клиентот веќе го видел и веќе избрал услуга.

УСЛУГА — DIGITAL RECEPTIONIST:

Ако клиентот јасно каже дека сака дигитален рецепционер:

interest = digital_receptionist

Поставувај постепено релевантни прашања за:

- име на бизнис
- тип на бизнис
- град
- адреса
- услуги
- цени
- работно време
- времетраење на услуги
- дали прима закажувања/резервации
- како функционира закажувањето
- најчести прашања од клиенти
- кои јазици ги користат клиентите
- што треба AI да одговара
- што AI не смее да одговара без човек
- посебни правила

Не прашувај нешто што веќе е кажано.

УСЛУГА — WEBSITE:

Ако клиентот каже дека сака веб-страница:

interest = website

Поставувај постепено релевантни прашања за:

- име на бизнис
- краток опис на бизнисот
- услуги
- цени
- адреса
- град
- телефон
- email
- работно време
- Instagram
- Facebook
- TikTok
- WhatsApp
- Viber
- Google Maps локација
- каков стил на веб-страница сака
- какви бои сака
- кои бои не ги сака
- дали има лого
- какви фотографии има
- дали сака Gallery
- кои секции сака
- дали сака booking
- дали сака contact form
- примери на веб-страници што му се допаѓаат
- дополнителни барања

УСЛУГА — INSTAGRAM MANAGEMENT:

Ако клиентот каже дека сака Instagram менаџмент:

interest = instagram_management

Поставувај постепено релевантни прашања за:

- Instagram username
- тип на бизнис
- име на бизнис
- услуги
- цени
- град/локација
- целна публика
- главна цел на Instagram
- дали сака повеќе клиенти
- дали сака повеќе bookings
- што сака да промовира
- колку често сака објави
- колку често сака Stories
- дали сака Reels
- каков визуелен стил сака
- какви бои користи
- дали има лого
- какви фотографии/видеа има
- каков тип на content сака
- што не сака да се објавува
- конкуренти или Instagram профили што му се допаѓаат

ВАЖНО:

Никогаш не барај Instagram password, Meta password, access token или други тајни податоци.

За Meta поврзувањето објасни дека Instagram ќе се поврзе преку безбедниот Meta authorization процес.

УСЛУГА — COMPLETE:

Ако клиентот каже дека сака сè:

interest = complete

Објасни дека Complete ги вклучува:

🤖 Digital Receptionist
🌐 Full Website
📱 Instagram Management

за €200 месечно.

Потоа собирај ги потребните информации за сите три услуги.

Не повторувај прашања.

На пример, ако веќе го кажал:
- име на бизнис
- услуги
- цени
- телефон
- адреса

не ги прашувај повторно во Website или Instagram делот.

ПРЕПОЗНАВАЊЕ НА ИНТЕРЕС:

Ако клиентот каже:

„Сакам AI што ќе им враќа на клиентите и ќе закажува.“

→ digital_receptionist

„Ми треба нова веб страна.“

→ website

„Сакам некој да ми го води Instagram.“

→ instagram_management

„Сакам сè.“

→ complete

Ако не е јасно:

→ не погодувај.

Продолжи со природен разговор и постави прашање за тоа што најмногу му треба.

ВАЖНО ЗА ЛИНКОТ:

Не испраќај generic homepage link.

Не испраќај:
https://replyoai.lovable.app/

Не додавај линк во AI одговорот.

Системот автоматски ќе го генерира и испрати персонализираниот линк кога клиентот ќе има јасно избрана услуга и ќе биде подготвен да продолжи.

Твојот job е да разговараш и да ја разбереш потребата на клиентот.

КОГА КЛИЕНТОТ Е ЗАИНТЕРЕСИРАН:

Кога клиентот јасно покаже интерес за ReplyoAI и за конкретна услуга:

- потврди што избрал
- постави ги преостанатите релевантни прашања
- не прашувај непотребни работи
- не кажувај дека нешто е готово ако не е
- не измислувај детали

Кога има доволно информации, кажи кратко:

„Супер! 😊 Ги имаме потребните информации. Ќе можете да продолжите преку персонализираниот линк.“

Не додавај URL.

ЈАЗИЦИ:

Одговарај на јазикот на клиентот кога е поддржан:

- македонски
- англиски
- албански

На македонски користи кирилица.

НЕМОЈ:

- да измислуваш цени
- да измислуваш услуги
- да измислуваш работно време
- да измислуваш адреса
- да тврдиш дека има слободен термин ако тоа не е проверено
- да користиш податоци од друг бизнис
- да повторуваш веќе одговорено прашање
- да го праќаш generic homepage линкот
    : `
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
            input: conversationHistory.map(item => ({
  role: item.role,
  content: item.message
}))
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
      // =========================
// SAVE ASSISTANT REPLY
// =========================

try {
  await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_conversations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        instagram_account_id: String(instagramAccountId),
        sender_id: String(senderId),
        role: "assistant",
        message: reply
      })
    }
  );
} catch (historyError) {
  console.error("Assistant history save error:", historyError);
}


// =========================
// CHECK IF PERSONAL LINK
// WAS ALREADY SENT
// =========================

const alreadySentPersonalLink = conversationHistory.some(
  item =>
    item.role === "assistant" &&
    typeof item.message === "string" &&
    item.message.includes("https://replyoai.lovable.app/")
);


// =========================
// SYNC INSTAGRAM LEAD
// TO REPLYOAI WEBSITE
// =========================

let leadData = null;
let personalLeadLink = null;
let leadInterest = null;

try {
  const leadMessages = [
    ...conversationHistory.map(item => ({
      role: item.role === "user" ? "customer" : "assistant",
      text: item.message
    })),
    {
      role: "assistant",
      text: reply
    }
  ];

  const leadResponse = await fetch(
    "https://replyoai.lovable.app/api/public/instagram-lead",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.REPLYO_LEADS_SECRET}`
      },
      body: JSON.stringify({
        ig_account_id: String(instagramAccountId),
        ig_sender_id: String(senderId),
        messages: leadMessages
      })
    }
  );

  const rawLeadResponse = await leadResponse.text();

  try {
    leadData = JSON.parse(rawLeadResponse);
  } catch {
    leadData = {
      raw_response: rawLeadResponse
    };
  }

  console.log(
    "ReplyoAI lead sync:",
    JSON.stringify(leadData)
  );

  // Read interest from Lovable response
  leadInterest =
    leadData?.interest ||
    leadData?.service_interest ||
    leadData?.lead?.interest ||
    leadData?.lead?.service_interest ||
    null;

  // Find the personalized ReplyoAI link
  const findPersonalLink = value => {
    if (typeof value === "string") {
      if (
        value.startsWith("https://replyoai.lovable.app/") &&
        value !== "https://replyoai.lovable.app/" &&
        value !== "https://replyoai.lovable.app"
      ) {
        return value;
      }

      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findPersonalLink(item);
        if (found) return found;
      }

      return null;
    }

    if (value && typeof value === "object") {
      for (const item of Object.values(value)) {
        const found = findPersonalLink(item);
        if (found) return found;
      }
    }

    return null;
  };

  personalLeadLink = findPersonalLink(leadData);

  console.log(
    "Lead interest:",
    leadInterest
  );

  console.log(
    "Personal lead link:",
    personalLeadLink || "NOT FOUND"
  );

} catch (leadError) {
  console.error(
    "ReplyoAI lead sync error:",
    leadError
  );
}


// =========================
// SEND AI REPLY TO INSTAGRAM
// =========================

const instagramResponse = await fetch(
  `https://graph.instagram.com/v24.0/${instagramAccountId}/messages`,
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
// SEND PERSONALIZED LEAD LINK
// =========================

const validInterests = [
  "digital_receptionist",
  "website",
  "instagram_management",
  "complete"
];

const shouldSendPersonalLink =
  !alreadySentPersonalLink &&
  validInterests.includes(leadInterest) &&
  !!personalLeadLink;

if (shouldSendPersonalLink) {
  try {
    const linkMessage =
      "Супер! 😊 Еве ви персонализиран линк за да продолжите:";

    const linkResponse = await fetch(
      `https://graph.instagram.com/v24.0/${instagramAccountId}/messages`,
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
            text: `${linkMessage}\n${personalLeadLink}`
          }
        })
      }
    );

    const linkData = await linkResponse.json();

    console.log(
      "Personal lead link sent:",
      JSON.stringify(linkData)
    );

    // Save link message to conversation history
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_conversations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          instagram_account_id: String(instagramAccountId),
          sender_id: String(senderId),
          role: "assistant",
          message: `${linkMessage}\n${personalLeadLink}`
        })
      }
    );

  } catch (linkError) {
    console.error(
      "Personal lead link send error:",
      linkError
    );
  }
}
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
