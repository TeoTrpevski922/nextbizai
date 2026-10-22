const API_VERSION = "v24.0";
const DEFAULT_BUCKET = "instagram-autopilot";
const DEFAULT_PROMPT = `You are the social media creative director for Replyo AI, a Macedonian AI business automation brand.
Create one fresh Instagram feed post concept per day. Promote the real benefits of Replyo AI: fast replies to customer messages, answering FAQs 24/7, helping businesses capture leads, appointment booking support, professional websites, and Instagram management.
Write in natural Macedonian Cyrillic. Use a specific, relatable small-business pain point and a clear benefit. Rotate themes; do not repeat the same hook or concept from recent posts. Avoid exaggerated claims, fake statistics, fake testimonials, and guarantees.
Visual style: natural, modern, premium but approachable, realistic photography, authentic small-business setting, clean composition, warm neutral colors with subtle dark/navy accents. Avoid the generic AI look, excessive gradients, robots, glowing brains, clutter, tiny text, and watermarks.
Create an image that works as a 1:1 Instagram feed post. Prefer a strong visual and minimal legible Macedonian headline; do not put paragraphs of text in the image. The caption can explain the idea and end with a clear invitation to message Replyo AI.`;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function supabaseHeaders(extra = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function supabaseUrl(path) {
  return env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "") + path;
}

export function requireAdmin(req) {
  const expected = process.env.AUTOPILOT_ADMIN_KEY;
  if (!expected) return false;
  const provided = req.headers?.["x-autopilot-key"] ||
    (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  return typeof provided === "string" && provided.length > 0 && provided === expected;
}

async function db(path, options = {}) {
  const response = await fetch(supabaseUrl(path), {
    ...options,
    headers: supabaseHeaders(options.headers || {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : (data?.message || data?.hint || "Supabase request failed (" + response.status + ")"));
  }
  return data;
}

export async function getSettings() {
  const businessId = process.env.REPLYOAI_BUSINESS_ID;
  const query = businessId
    ? `?business_id=eq.${encodeURIComponent(businessId)}&select=*&limit=1`
    : "?select=*&limit=1";
  const rows = await db("/rest/v1/instagram_autopilot_settings" + query);
  return rows?.[0] || {
    business_id: businessId || "",
    brand_name: "Replyo AI",
    instructions: DEFAULT_PROMPT,
    timezone: "Europe/Skopje",
    schedule_time: "19:00",
    posts_per_day: 1,
    enabled: false
  };
}

export async function saveSettings(input) {
  const current = await getSettings();
  const businessId = String(input.business_id || current.business_id || process.env.REPLYOAI_BUSINESS_ID || "").trim();
  if (!businessId) throw new Error("Add the ReplyoAI business_id before saving.");
  const row = {
    business_id: businessId,
    brand_name: String(input.brand_name || "Replyo AI").slice(0, 100),
    instructions: String(input.instructions || DEFAULT_PROMPT).slice(0, 12000),
    timezone: "Europe/Skopje",
    schedule_time: String(input.schedule_time || "19:00"),
    posts_per_day: 1,
    enabled: input.enabled === true || input.enabled === "true",
    updated_at: new Date().toISOString()
  };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.schedule_time)) throw new Error("Schedule time must be HH:MM.");
  const rows = await db("/rest/v1/instagram_autopilot_settings?on_conflict=business_id&select=*", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row)
  });
  return rows?.[0] || row;
}

export async function listPosts() {
  return await db("/rest/v1/instagram_autopilot_posts?select=id,status,topic,caption,image_url,instagram_media_id,published_at,created_at,error_message&order=created_at.desc&limit=20");
}

async function openAI(path, body) {
  const response = await fetch("https://api.openai.com/v1/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + env("OPENAI_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed (" + response.status + ")");
  return data;
}

async function createCaption(instructions, recentPosts) {
  const recent = recentPosts.slice(0, 8).map(p => p.topic || p.caption || "").join("\n- ");
  const response = await openAI("responses", {
    model: process.env.AUTOPILOT_TEXT_MODEL || "gpt-4.1-mini",
    instructions: "Create one original Instagram post for Replyo AI in natural Macedonian Cyrillic. Return only valid JSON with keys topic, headline, caption, hashtags, image_prompt. Caption should be concise, useful, human, have a clear CTA to send a DM to Replyo AI, and contain no unsupported claims. hashtags must be an array of 4 to 8 strings. headline should be short enough for a graphic. image_prompt must describe a polished realistic square Instagram image; include the headline in Macedonian only if it can be rendered cleanly, otherwise leave negative space for text overlay. Do not repeat recent concepts. Avoid AI clichés.",
    input: "Brand instructions:\n" + instructions + "\n\nRecent post concepts to avoid:\n- " + (recent || "None yet") + "\n\nCreate today's post."
  });
  const text = response.output_text || response.output?.flatMap(x => x.content || []).find(x => x.type === "output_text")?.text;
  if (!text) throw new Error("The caption model returned no text.");
  const cleaned = text.trim().replace(/^\x60{3}(?:json)?/i, "").replace(/\x60{3}$/i, "").trim();
  const result = JSON.parse(cleaned);
  if (!result.topic || !result.caption || !result.image_prompt) throw new Error("Generated post is missing required fields.");
  return {
    topic: String(result.topic).slice(0, 200),
    headline: String(result.headline || result.topic).slice(0, 140),
    caption: String(result.caption).slice(0, 2200),
    hashtags: Array.isArray(result.hashtags) ? result.hashtags.slice(0, 10).map(String) : [],
    image_prompt: String(result.image_prompt).slice(0, 4000)
  };
}

async function createAndUploadImage(instructions, imagePrompt) {
  const prompt = "Create a high-quality, realistic square Instagram feed creative for Replyo AI. Brand guidance: " + instructions.slice(0, 5000) + "\nVisual brief: " + imagePrompt + "\nOutput: clean, modern, authentic small-business marketing, no watermarks, no fake UI text, no logos other than simple text 'Replyo AI' if suitable. Prefer a visual metaphor and leave breathing room. 1024x1024.";
  const data = await openAI("images/generations", {
    model: process.env.AUTOPILOT_IMAGE_MODEL || "gpt-image-1",
    prompt,
    size: "1024x1024",
    quality: "medium"
  });
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image model returned no image data.");
  const bytes = Buffer.from(b64, "base64");
  const bucket = process.env.AUTOPILOT_STORAGE_BUCKET || DEFAULT_BUCKET;
  const path = "replyo-ai/" + new Date().toISOString().slice(0, 10) + "-" + crypto.randomUUID() + ".png";
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const upload = await fetch(base + "/storage/v1/object/" + bucket + "/" + path, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "image/png",
      "x-upsert": "false"
    },
    body: bytes
  });
  if (!upload.ok) throw new Error("Supabase Storage upload failed: " + await upload.text());
  return base + "/storage/v1/object/public/" + bucket + "/" + path;
}

async function getInstagramAccount() {
  const settings = await getSettings();
  const businessId = settings.business_id || process.env.REPLYOAI_BUSINESS_ID;
  if (!businessId) throw new Error("ReplyoAI business_id is not configured.");
  const rows = await db("/rest/v1/instagram_accounts?business_id=eq." + encodeURIComponent(businessId) + "&select=instagram_user_id,instagram_username,access_token,token_expires_at&limit=1");
  const account = rows?.[0];
  if (!account?.instagram_user_id || !account?.access_token) throw new Error("No Instagram account is connected to this ReplyoAI business. Connect it first.");
  if (account.token_expires_at && Date.parse(account.token_expires_at) < Date.now() + 5 * 60 * 1000) {
    throw new Error("Instagram access token is expired or about to expire. Reconnect the Instagram account.");
  }
  return account;
}

async function createPostRow(post, imageUrl) {
  const settings = await getSettings();
  const hashtags = post.hashtags.map(tag => tag.startsWith("#") ? tag : "#" + tag.replace(/^#+/, ""));
  const caption = [post.caption, hashtags.join(" ")].filter(Boolean).join("\n\n");
  const rows = await db("/rest/v1/instagram_autopilot_posts?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      business_id: settings.business_id,
      status: "draft",
      topic: post.topic,
      headline: post.headline,
      caption,
      image_url: imageUrl,
      image_prompt: post.image_prompt
    })
  });
  if (!rows?.[0]) throw new Error("Could not save the generated post.");
  return rows[0];
}

export async function generateDraft() {
  const [settings, recent] = await Promise.all([getSettings(), listPosts()]);
  const content = await createCaption(settings.instructions || DEFAULT_PROMPT, recent);
  const imageUrl = await createAndUploadImage(settings.instructions || DEFAULT_PROMPT, content.image_prompt);
  return await createPostRow(content, imageUrl);
}

export async function publishPost(postId) {
  if (!postId) throw new Error("Missing post_id.");
  const rows = await db("/rest/v1/instagram_autopilot_posts?id=eq." + encodeURIComponent(postId) + "&select=*&limit=1");
  const post = rows?.[0];
  if (!post) throw new Error("Post not found.");
  if (post.status === "published" || post.instagram_media_id) throw new Error("This post has already been published.");
  if (!post.image_url || !post.caption) throw new Error("Post is missing an image or caption.");
  const account = await getInstagramAccount();
  const base = "https://graph.instagram.com/" + API_VERSION + "/" + encodeURIComponent(account.instagram_user_id);
  const params = new URLSearchParams({
    image_url: post.image_url,
    caption: post.caption,
    access_token: account.access_token
  });
  const createResponse = await fetch(base + "/media", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const container = await createResponse.json();
  if (!createResponse.ok || !container.id) throw new Error("Instagram media container failed: " + JSON.stringify(container));
  const publishResponse = await fetch(base + "/media_publish", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: container.id, access_token: account.access_token })
  });
  const published = await publishResponse.json();
  if (!publishResponse.ok || !published.id) throw new Error("Instagram publish failed: " + JSON.stringify(published));
  const updated = await db("/rest/v1/instagram_autopilot_posts?id=eq." + encodeURIComponent(postId), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "published",
      instagram_media_id: String(published.id),
      published_at: new Date().toISOString(),
      error_message: null
    })
  });
  return updated?.[0] || { ...post, status: "published", instagram_media_id: String(published.id) };
}

export async function runScheduledPost({ force = false } = {}) {
  const settings = await getSettings();
  if (!settings.enabled && !force) return { skipped: true, reason: "Autopilot is paused." };
  if (!force) {
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: settings.timezone || "Europe/Skopje",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(new Date());
    if (local !== (settings.schedule_time || "19:00")) return { skipped: true, reason: "Not the configured local publishing time.", local_time: local };
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone || "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const published = await db("/rest/v1/instagram_autopilot_posts?status=eq.published&published_at=gte." + encodeURIComponent(today + "T00:00:00") + "&select=id&limit=1");
    if (published?.length) return { skipped: true, reason: "Today's post is already published." };
  }
  const draft = await generateDraft();
  const published = await publishPost(draft.id);
  return { skipped: false, post: published, message: "Daily post generated and published." };
}

export function json(res, status, body) {
  return res.status(status).json(body);
}
