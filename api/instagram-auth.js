export default async function handler(req, res) {
  const { code, error, error_description, state } = req.query;

  if (error) {
    return res.status(400).send(`
      <h2>Instagram connection failed</h2>
      <p>${error_description || error}</p>
    `);
  }

  if (!code) {
    return res.status(400).send("Missing Instagram authorization code.");
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  const redirectUri =
    "https://nextbizai.vercel.app/api/instagram-auth";

  try {
    // 1. Exchange authorization code for short-lived token
    const tokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Instagram short token error:", tokenData);
      return res.status(400).json({
        error: "Instagram token exchange failed",
        details: tokenData
      });
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived token
    const longTokenUrl =
      "https://graph.instagram.com/access_token" +
      "?grant_type=ig_exchange_token" +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&access_token=${encodeURIComponent(shortLivedToken)}`;

    const longTokenResponse = await fetch(longTokenUrl);
    const longTokenData = await longTokenResponse.json();

    if (!longTokenResponse.ok || !longTokenData.access_token) {
      console.error("Instagram long token error:", longTokenData);
      return res.status(400).json({
        error: "Instagram long-lived token exchange failed",
        details: longTokenData
      });
    }

    const longLivedToken = longTokenData.access_token;

    // 3. Get Instagram account information
    const meResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(
        longLivedToken
      )}`
    );

    const meData = await meResponse.json();

    if (!meResponse.ok || !meData.id) {
      console.error("Instagram profile error:", meData);
      return res.status(400).json({
        error: "Could not retrieve Instagram account",
        details: meData
      });
    }

    // 4. Calculate token expiration
    const expiresIn = Number(longTokenData.expires_in || 5184000);
    const tokenExpiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    // 5. Save to Supabase
    // state will contain the ReplyoAI business_id
    const businessId = state;

    if (!businessId) {
      return res.status(400).send(
        "Missing business ID. Please start Instagram connection from ReplyoAI."
      );
    }

    const supabaseResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/instagram_accounts`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          business_id: businessId,
          instagram_user_id: String(meData.id),
          instagram_username: meData.username || null,
          access_token: longLivedToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString()
        })
      }
    );

    const supabaseData = await supabaseResponse.text();

    if (!supabaseResponse.ok) {
      console.error("Supabase Instagram save error:", supabaseData);
      return res.status(500).json({
        error: "Could not save Instagram account"
      });
    }

    return res.status(200).send(`
      <html>
        <body style="font-family:Arial;padding:40px;">
          <h2>Instagram connected successfully ✅</h2>
          <p>Account: @${meData.username || "Instagram"}</p>
          <p>You can now close this window.</p>
        </body>
      </html>
    `);

  } catch (err) {
    console.error("Instagram OAuth error:", err);

    return res.status(500).json({
      error: "Instagram connection failed"
    });
  }
}
