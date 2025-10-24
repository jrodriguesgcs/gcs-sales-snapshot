module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const AC_API_URL = process.env.AC_API_URL;
    const AC_API_TOKEN = process.env.AC_API_TOKEN;

    console.log('Environment check:', {
      hasUrl: !!AC_API_URL,
      hasToken: !!AC_API_TOKEN,
      urlLength: AC_API_URL?.length,
      tokenLength: AC_API_TOKEN?.length
    });

    if (!AC_API_URL || !AC_API_TOKEN) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'API configuration missing',
        details: {
          hasUrl: !!AC_API_URL,
          hasToken: !!AC_API_TOKEN
        }
      });
    }

    // Simple test: just try to fetch users
    console.log('Testing API connection...');
    const testUrl = `${AC_API_URL}/api/3/users?limit=1`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Api-Token': AC_API_TOKEN,
        'Accept': 'application/json',
      },
    });

    console.log('API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      return res.status(500).json({ 
        error: 'API test failed',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('API Test successful');

    return res.status(200).json({
      success: true,
      message: 'API connection working',
      userCount: data.users?.length || 0,
      test: true
    });

  } catch (error) {
    console.error('❌ Handler error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};