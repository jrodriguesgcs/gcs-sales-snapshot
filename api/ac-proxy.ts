const handler = async (req: any, res: any) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint } = req.query;
  const AC_API_URL = process.env.AC_API_URL;
  const AC_API_TOKEN = process.env.AC_API_TOKEN;

  if (!AC_API_URL || !AC_API_TOKEN) {
    return res.status(500).json({ error: 'API configuration missing' });
  }

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Endpoint parameter required' });
  }

  try {
    const url = `${AC_API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Api-Token': AC_API_TOKEN,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('ActiveCampaign proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch from ActiveCampaign' });
  }
};

module.exports = handler;