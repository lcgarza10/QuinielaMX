import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

async function testApi() {
  const API_HOST = 'v3.football.api-sports.io';
  const API_URL = `https://${API_HOST}`;
  const API_KEY = 'c141edc534ff1faa37eb2b951c0642d1';
  const LIGA_MX_ID = '262';
  const TIMEZONE = 'America/Mexico_City';

  const headers = new HttpHeaders()
    .set('x-rapidapi-host', API_HOST)
    .set('x-rapidapi-key', API_KEY);

  const params = new HttpParams()
    .set('league', LIGA_MX_ID)
    .set('season', '2024')
    .set('round', 'Regular Season - 1')
    .set('timezone', TIMEZONE);

  try {
    const response = await fetch(`${API_URL}/fixtures`, {
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': API_KEY
      },
      params: params
    });
    
    const data = await response.json();
    console.log('API Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testApi();
