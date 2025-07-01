// pages/api/tailscale/devices.js
export default async function handler(req, res) {
  const apiKey = process.env.TAILSCALE_API_KEY; // Store your API key securely
  const tailnet = "taild030b7.ts.net"; // Your Tailscale network

  try {
    const response = await fetch(
      `https://api.tailscale.com/api/v2/tailnet/${tailnet}/devices`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch devices");
    }

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow all origins for dev
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
}