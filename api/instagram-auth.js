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

  const appId = "1396330425251232";
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = "https://nextbizai.vercel.app/api/instagram-auth";

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

    // 2. Exchange short-lived token for long-lived token.
    // This endpoint must be called with POST and form-encoded parameters.
    const longTokenResponse = await fetch(
      "https://graph.instagram.com/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: appSecret,
          access_token: shortLivedToken
        })
      }
    );

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
      `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(longLivedToken)}`
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
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 5. Save to Supabase
    const businessId = state;

    if (!businessId) {
      return res.status(400).send(
        "Missing business ID. Please start Instagram connection from ReplyoAI."
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Check whether this Instagram account is already connected
    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/instagram_accounts?instagram_user_id=eq.${encodeURIComponent(String(meData.id))}&select=business_id,instagram_username`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    const existingAccounts = await existingResponse.json();

    if (!existingResponse.ok) {
      console.error("Instagram account lookup error:", existingAccounts);
      return res.status(500).send("Could not verify Instagram account.");
    }

    if (existingAccounts.length > 0) {
      const existing = existingAccounts[0];

      if (existing.business_id !== businessId) {
        console.error(
          "Instagram account already belongs to another business:",
          existing.instagram_username
        );
        return res.status(409).send(
          "This Instagram account is already connected to another business. Please verify the Instagram profile you authorized."
        );
      }

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/instagram_accounts?instagram_user_id=eq.${encodeURIComponent(String(meData.id))}&business_id=eq.${encodeURIComponent(businessId)}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            instagram_username: meData.username || null,
            access_token: longLivedToken,
            token_expires_at: tokenExpiresAt,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!updateResponse.ok) {
        console.error("Instagram account update error:", await updateResponse.text());
        return res.status(500).send("Could not update Instagram account.");
      }
    } else {
      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/instagram_accounts`,
        {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
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

      if (!insertResponse.ok) {
        console.error("Instagram account insert error:", await insertResponse.text());
        return res.status(500).send("Could not save Instagram account.");
      }
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
