import fetch from 'node-fetch';

const API_KEY = 'c141edc534ff1faa37eb2b951c0642d1';
const LIGA_MX_ID = '262';
const CURRENT_SEASON = '2024';

async function testAPI() {
    // Testing current tournament matches (Apertura 2024)
    const params = new URLSearchParams({
        league: LIGA_MX_ID,
        season: CURRENT_SEASON,
        from: '2024-12-01',
        to: '2024-12-15',
        timezone: 'America/Mexico_City',
        status: 'NS-TBD-1H-HT-2H-FT'
    });
    
    const url = `https://v3.football.api-sports.io/fixtures?${params}`;
    console.log('Testing URL:', url);
    
    try {
        const response = await fetch(url, {
            headers: {
                'x-apisports-key': API_KEY
            }
        });
        
        const data = await response.json();
        
        if (data.response) {
            console.log('\nTotal matches found:', data.response.length);
            
            // Group matches by round
            const matchesByRound = {};
            data.response.forEach(match => {
                const round = match.league.round;
                if (!matchesByRound[round]) {
                    matchesByRound[round] = [];
                }
                matchesByRound[round].push(match);
            });
            
            // Show matches by round
            Object.entries(matchesByRound).forEach(([round, matches]) => {
                console.log(`\n=== ${round} (${matches.length} matches) ===`);
                matches.forEach(match => {
                    console.log('\nMatch Details:');
                    console.log('Date:', match.fixture.date);
                    console.log('Status:', match.fixture.status.long);
                    console.log('Teams:', `${match.teams.home.name} vs ${match.teams.away.name}`);
                    console.log('Score:', `${match.goals.home ?? '-'} - ${match.goals.away ?? '-'}`);
                    console.log('Status Code:', match.fixture.status.short);
                });
            });
        }

        console.log('\nAPI Status:');
        console.log('Remaining requests:', response.headers.get('x-ratelimit-remaining'));
        console.log('Request limit per day:', response.headers.get('x-ratelimit-limit'));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testAPI();
