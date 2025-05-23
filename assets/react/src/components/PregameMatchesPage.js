import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PregameMatchesPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const sport = searchParams.get('sport') || 'soccer';
  const filter = searchParams.get('filter') || 'today';
  const leagues = searchParams.getAll('leagues');
  
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, [sport, filter, leagues.join(',')]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sport: sport,
        filter: filter
      });
      
      leagues.forEach(league => {
        params.append('leagues', league);
      });
      
      const response = await fetch(`/api/pregame/matches?${params}`);
      const data = await response.json();
      setMatches(data.matches || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const filterLabel = (filterKey) => {
    const labels = {
      'one_hour': '1 Hour',
      'three_hours': '3 Hours', 
      'six_hours': '6 Hours',
      'twelve_hours': '12 Hours',
      'today': 'Today',
      'all': 'All'
    };
    return labels[filterKey] || 'Unknown';
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(',', '');
    } catch (error) {
      return 'Unknown';
    }
  };

  const getHomeAwayOdds = (markets) => {
    if (!markets || !markets.home_away) return { home: null, away: null };
    
    const homeOdd = markets.home_away.find(o => o.name === 'Home');
    const awayOdd = markets.home_away.find(o => o.name === 'Away');
    
    return {
      home: homeOdd ? homeOdd.value : null,
      away: awayOdd ? awayOdd.value : null
    };
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          Matches for {sport.charAt(0).toUpperCase() + sport.slice(1)} - {filterLabel(filter)}
        </h1>
        <button
          onClick={() => navigate(`/pregame/${sport}?filter=${filter}`)}
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
        >
          Back to {sport.charAt(0).toUpperCase() + sport.slice(1)}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">Loading matches...</div>
          </div>
        ) : matches.length === 0 ? (
          <p className="text-gray-500">No matches available for the selected sport, filter, or leagues.</p>
        ) : (
          matches.map((countryData, countryIndex) => (
            <div key={`${countryData.country}-${countryIndex}`} className="mb-6">
              <h2 className="text-xl font-semibold mb-2 text-gray-900">{countryData.country}</h2>
              {countryData.leagues.map((leagueData, leagueIndex) => (
                <div key={`${leagueData.league}-${leagueIndex}`} className="mb-4">
                  <h3 className="text-lg font-medium mb-2 text-gray-800">{leagueData.league}</h3>
                  
                  {/* Group matches by start time */}
                  {(() => {
                    const matchesByTime = leagueData.matches.reduce((acc, match) => {
                      const timeKey = match.start_time;
                      if (!acc[timeKey]) acc[timeKey] = [];
                      acc[timeKey].push(match);
                      return acc;
                    }, {});
                    
                    return Object.entries(matchesByTime).map(([startTime, timeMatches]) => (
                      <div key={startTime} className="mb-4">
                        <h4 className="text-md font-medium mb-2 text-gray-700">
                          {formatDateTime(parseInt(startTime))}
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          {timeMatches.map((match, matchIndex) => {
                            const { home, away } = getHomeAwayOdds(match.markets);
                            return (
                              <button
                                key={`${match.match_id}-${matchIndex}`}
                                onClick={() => {
                                  const params = new URLSearchParams({
                                    sport: sport,
                                    filter: filter
                                  });
                                  leagues.forEach(league => {
                                    params.append('leagues', league);
                                  });
                                  navigate(`/pregame/match/${sport}/${match.match_id}?${params}`);
                                }}
                                className="block bg-gray-50 p-3 rounded shadow hover:bg-gray-100 transition text-left w-full"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-gray-800">
                                      {match.team1_name} vs {match.team2_name}
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Home</p>
                                      <p className="font-medium text-gray-800">
                                        {home ? home.toFixed(2) : '-'}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Away</p>
                                      <p className="font-medium text-gray-800">
                                        {away ? away.toFixed(2) : '-'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()} 
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PregameMatchesPage;