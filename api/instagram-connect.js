export default async function handler(req, res) {
  const businessId = req.query.business_id;

  if (!businessId) {
    return res.status(400).send("Missing business_id.");
  }

 const clientId = "1396330425251232";

  const redirectUri =
    "https://nextbizai.vercel.app/api/instagram-auth";

  const scopes = [
    "instagram_business_basic",
    "instagram_business_manage_messages",
    "instagram_business_manage_comments"
  ].join(",");

  const instagramUrl =
    "https://www.instagram.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(businessId)}`;

  return res.redirect(302, instagramUrl);
}
