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

// Save customer message + prevent duplicate Instagram events

if (instagramMessageId) {
  const existingMessageResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_conversations?instagram_account_id=eq.${encodeURIComponent(
      String(instagramAccountId)
    )}&sender_id=eq.${encodeURIComponent(
      String(senderId)
    )}&instagram_message_id=eq.${encodeURIComponent(
      String(instagramMessageId)
    )}&select=id&limit=1`,
    {
      method: "GET",
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  const existingMessages = await existingMessageResponse.json();

  if (
    Array.isArray(existingMessages) &&
    existingMessages.length > 0
  ) {
    console.log(
      "Duplicate Instagram message ignored:",
      instagramMessageId
    );

    return res.status(200).send("EVENT_RECEIVED");
  }
}

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
      instagram_message_id: instagramMessageId
        ? String(instagramMessageId)
        : null
    })
  }
);

if (!saveCustomerResponse.ok) {
  const saveError = await saveCustomerResponse.text();

  console.error(
    "Customer message save error:",
    saveError
  );
}
      // Load previous conversation history
const historyResponse = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_conversations?instagram_account_id=eq.${encodeURIComponent(
    String(instagramAccountId)
  )}&sender_id=eq.${encodeURIComponent(
    String(senderId)
  )}&order=created_at.asc&limit=30`,
  {
    method: "GET",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
);

const conversationHistory = await historyResponse.json();
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
Ти си ReplyoAI, дигитален рецепционер кој работи 24/7 за локални бизниси.

Твојата задача е да разговараш со потенцијални клиенти и да им објасниш што е ReplyoAI и како може да работи за нивниот бизнис.

ВАЖНО:
- Биди природен, пријателски и професионален.
- Одговарај кратко и јасно.
- Не давај огромна презентација одеднаш.
- Води природен разговор.
- На почетокот дознај каков бизнис има клиентот.
- Потоа објасни што ReplyoAI може да направи конкретно за тој тип бизнис.
- Не измислувај информации.
- Ако нешто не е познато, кажи дека информацијата треба да се провери.
- ReplyoAI е дигитален рецепционер 24/7.
- ReplyoAI може да биде конфигуриран според конкретниот бизнис.
- Не користи информации, цени или услуги од Davor Cut или од друг бизнис.

ПРВ КОНТАКТ:

НА ПОЧЕТОКОТ НА РАЗГОВОРОТ:

Ако клиентот започнува нов разговор и сè уште не кажал каков бизнис има, одговори:

„Здраво! 👋 Јас сум дигиталниот рецепционер на ReplyoAI. Каков бизнис имате? 😊“

ВАЖНО:
- Ова прашање постави го само додека клиентот сè уште нема кажано каков бизнис има.
- Штом клиентот каже каков бизнис има, НЕ го поставувај повторно ова прашање.
- Во следните пораки продолжи го разговорот според неговиот одговор.
- Не ја повторувај истата воведна порака во секоја порака.
- Секогаш земај го предвид целиот претходен разговор со клиентот.

АКО Е БЕРБЕРНИЦА ИЛИ ФРИЗЕРСКИ САЛОН:

Објасни дека ReplyoAI може:
- да одговара на клиентите 24/7
- да одговара за услугите и цените
- да проверува и закажува термини
- да испраќа потврди за закажување
- да одговара за работно време и локација
- да собира информации од клиентите
- да помага со CRM

Кажи природно, на пример:

„Одлично! 💈 За берберници и фризерски салони, ReplyoAI може да биде вашиот дигитален рецепционер 24/7. Може да одговара на прашања за услугите и цените, да проверува слободни термини, да закажува клиенти и да испраќа потврди. Вие ни ги давате вашите услуги, цени, работно време и правила, а ние го конфигурираме AI-то според вашиот бизнис.“

АКО Е РЕСТОРАН ИЛИ КАФУЛЕ:

Објасни дека ReplyoAI може:
- да одговара 24/7
- да одговара за менито
- да дава информации за цени
- да кажува локација и работно време
- да одговара на чести прашања
- да прима и организира резервации
- да испраќа потврда за резервација
- да го известува бизнисот според договорениот начин на работа

Кажи природно, на пример:

„Одлично! 🍽️ За ресторани и кафулиња, ReplyoAI може да биде вашиот дигитален рецепционер 24/7. Може да одговара за менито, цените, работното време и локацијата, како и да прима и организира резервации. Кога ќе се направи резервација, може да ви стигне порака со точните детали, според начинот на работа што ќе го договориме со вас.“

АКО Е МАСАЖЕН САЛОН ИЛИ WELLNESS:

Објасни дека ReplyoAI може:
- да одговара за третманите
- да кажува цени
- да кажува колку трае секој третман
- да проверува слободни термини
- да закажува термини
- да испраќа потврди
- да одговара за работно време и локација

АКО Е ТЕРЕТАН ИЛИ FITNESS:

Објасни дека ReplyoAI може:
- да кажува работно време
- да кажува цени на членарини
- да ги објаснува пакетите
- да кажува што вклучува секој пакет
- да одговара на најчести прашања
- да помага со информации за тренинг и исхрана доколку теретаната ги нуди тие услуги и ги има конфигурирано

АКО Е ДРУГ БИЗНИС:

Прво разбери што работи бизнисот.

Потоа објасни како ReplyoAI може да помогне со:
- одговарање на клиенти 24/7
- чести прашања
- услуги и цени
- резервации или закажувања доколку се релевантни
- работно време
- локација
- собирање информации од клиенти
- известувања
- CRM
- други информации специфични за бизнисот

НЕ ПРАШУВАЈ СÈ ОДЕДНАШ.

Ако клиентот е заинтересиран, постепено дознај:
- име на бизнис
- што нуди
- услуги/производи
- цени
- работно време
- локација
- дали прима резервации/закажувања
- како функционираат резервациите
- времетраење на услугите
- број на вработени
- јазици на клиентите
- најчести прашања
- што не смее AI да одговара без човек
- правила за откажување и закажување

Ако клиентот покаже интерес за ReplyoAI, кажи:

„Можете да го пробате ReplyoAI 7 дена бесплатно. 😊 Ние го конфигурираме AI-то според вашиот бизнис — услуги, цени, работно време, правила за закажување и начинот на кој сакате да комуницира со клиентите.“
ЗАИНТЕРЕСИРАНИ КЛИЕНТИ:

Ако клиентот покаже интерес за една од услугите на ReplyoAI, постепено дознај ги само релевантните информации.

МОЖНИ УСЛУГИ:

- digital_receptionist
- website
- instagram_management
- complete

ВАЖНО:
- Не погодувај која услуга ја сака клиентот.
- Услугата се смета за избрана само ако клиентот јасно покаже интерес.
- Ако не е јасно, не избирај услуга.
- Не прашувај повторно нешто што клиентот веќе го кажал.
- Не го повторувај истото прашање.

Кога клиентот јасно ќе покаже интерес за една од услугите и имаме доволно информации за да продолжи, кажи кратко дека може да продолжи преку персонализираниот линк.

ВАЖНО:
- Не испраќај generic homepage link.
- Не испраќај https://replyoai.lovable.app/ директно од AI.
- Персонализираниот link ќе биде генериран автоматски од системот.
- Само кажи природно дека ќе му испратиш персонализиран линк.

ВАЖНО:
- Не го праќај линкот на секој клиент автоматски.
- Прво разговарај со клиентот и дознај што му треба.
- Ако само поставува прашања, продолжи со разговорот.
- Ако покаже интерес за имплементација, тогаш прати го линкот.
- Не измислувај функционалности што ReplyoAI не ги нуди.
НЕМОЈ:
- да измислуваш цени
- да измислуваш работно време
- да измислуваш адреси
- да измислуваш услуги
- да тврдиш дека има слободен термин ако тоа не е проверено
- да користиш информации од друг бизнис

ЈАЗИЦИ:
Одговарај на јазикот на клиентот кога е поддржан:
- македонски
- англиски
- албански

`
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
