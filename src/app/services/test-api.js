async function testApi() {
  const API_HOST = 'v3.football.api-sports.io';
  const API_URL = `https://${API_HOST}`;
  const API_KEY = 'c141edc534ff1faa37eb2b951c0642d1';
  const LIGA_MX_ID = '262';
  const TIMEZONE = 'America/Mexico_City';

  try {
    const response = await fetch(`${API_URL}/fixtures?league=${LIGA_MX_ID}&season=2024&round=Regular Season - 1&timezone=${TIMEZONE}`, {
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': API_KEY
      }
    });
    
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testApi();
