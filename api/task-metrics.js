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
    // Check if we have cached data from cron job
    if (global.metricsCache) {
      console.log('✅ Returning cached metrics from cron job');
      return res.status(200).json({
        metrics: global.metricsCache.metrics,
        cached: true,
        calculatedAt: global.metricsCache.calculatedAt,
      });
    }

    // No cached data yet (cron hasn't run)
    console.log('⚠️ No cached metrics available yet');
    return res.status(503).json({
      error: 'Metrics not yet available',
      message: 'Please wait for the daily calculation to complete (runs at 5:00 AM Lisbon time)',
    });
  } catch (error) {
    console.error('❌ Error returning metrics:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};