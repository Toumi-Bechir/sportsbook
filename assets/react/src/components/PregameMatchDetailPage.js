import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const PregameMatchDetailPage = () => {
  const { sport, matchId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [betSlip, setBetSlip] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get filter and leagues from URL params (same as page 2)
  const filter = searchParams.get('filter') || 'today';
  const leagues = searchParams.getAll('leagues');

  useEffect(() => {
    fetchMatchDetails();
    fetchAllMatches();
  }, [sport, matchId, filter, leagues.join(',')]);

  const fetchAllMatches = async () => {
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
      setAllMatches(data.matches || []);
    } catch (error) {
      console.error('Error fetching all matches:', error);
      setAllMatches([]);
    }
  };

  const fetchMatchDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/pregame/match/${sport}/${matchId}`);
      const data = await response.json();
      setMatch(data.match || null);
    } catch (error) {
      console.error('Error fetching match details:', error);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp * 1000);
      return {
        date: date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        time: date.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    } catch (error) {
      return { date: 'Unknown', time: 'Unknown' };
    }
  };

  const navigateToMatch = (newMatchId) => {
    const params = new URLSearchParams({
      sport: sport,
      filter: filter
    });
    leagues.forEach(league => {
      params.append('leagues', league);
    });
    navigate(`/pregame/match/${sport}/${newMatchId}?${params}`);
  };

  const formatMatchTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  };

  const addToBetSlip = (market, option) => {
    const betSelection = {
      id: `${market.name}-${option.name}`,
      market: market.name,
      selection: option.name,
      odds: option.value,
      matchInfo: `${match.team1_name} vs ${match.team2_name}`
    };
    
    setBetSlip(prev => {
      const exists = prev.find(bet => bet.id === betSelection.id);
      if (exists) return prev;
      return [...prev, betSelection];
    });
  };

  const removeBet = (betId) => {
    setBetSlip(prev => prev.filter(bet => bet.id !== betId));
  };

  const getSportIcon = (sport) => {
    const icons = {
      soccer: '⚽',
      basket: '🏀',
      tennis: '🎾',
      baseball: '⚾',
      amfootball: '🏈',
      hockey: '🏒',
      volleyball: '🏐'
    };
    return icons[sport] || '🏆';
  };

  const getMarketCategories = () => {
    if (!match?.markets) return [];
    
    // Get all available markets dynamically
    const availableMarkets = Object.keys(match.markets);
    
    // Categorize markets based on their names
    const categories = [
      { 
        key: 'all', 
        name: '🔥 All Markets', 
        markets: availableMarkets
      },
      { 
        key: 'main', 
        name: '🎯 Match Result', 
        markets: availableMarkets.filter(m => 
          ['home_away', 'match_winner', 'double_chance'].includes(m)
        )
      },
      { 
        key: 'goals', 
        name: '⚽ Goals & Totals', 
        markets: availableMarkets.filter(m => 
          m.includes('goals') || m.includes('over_under') || m.includes('total') || m.includes('both_teams')
        )
      },
      { 
        key: 'handicap', 
        name: '📊 Handicaps', 
        markets: availableMarkets.filter(m => 
          m.includes('handicap') || m.includes('goal_line')
        )
      },
      { 
        key: 'halftime', 
        name: '⏰ Half Time', 
        markets: availableMarkets.filter(m => 
          m.includes('1st_half') || m.includes('2nd_half') || m.includes('ht_ft')
        )
      },
      { 
        key: 'score', 
        name: '🎯 Correct Score', 
        markets: availableMarkets.filter(m => 
          m.includes('correct_score')
        )
      },
      { 
        key: 'specials', 
        name: '✨ Specials', 
        markets: availableMarkets.filter(m => 
          m.includes('team_to_score') || m.includes('odd_even') || m.includes('corners')
        )
      }
    ];
    
    // Only return categories that have markets
    return categories.filter(cat => cat.markets.length > 0);
  };

  const renderMarketOptions = (marketKey, marketData) => {
    if (!marketData || !Array.isArray(marketData)) return null;

    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 capitalize">
            {marketKey.replace('_', ' ')}
          </h3>
          <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-3 py-1 rounded-full font-bold">
            {marketData.length} options
          </span>
        </div>
        
        <div className="space-y-3">
          {marketData.map((option, index) => (
            <button
              key={index}
              onClick={() => addToBetSlip({ name: marketKey }, option)}
              className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl p-4 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg group"
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg group-hover:text-yellow-300 transition-colors">
                  {option.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black bg-black bg-opacity-20 px-3 py-1 rounded-lg">
                    {option.value?.toFixed(2) || 'N/A'}
                  </span>
                  <span className="text-yellow-300 text-xl">⚡</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getFilteredMarkets = () => {
    if (!match?.markets) return {};
    
    const category = getMarketCategories().find(cat => cat.key === selectedMarket);
    if (!category) return match.markets;
    
    const filtered = {};
    category.markets.forEach(market => {
      if (match.markets[market]) {
        filtered[market] = match.markets[market];
      }
    });
    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-transparent border-t-yellow-400 rounded-full animate-spin animation-delay-150"></div>
            <div className="absolute inset-4 border-4 border-transparent border-t-pink-400 rounded-full animate-spin animation-delay-300"></div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Loading Match Details</h3>
          <p className="text-purple-200">Preparing your betting experience...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-pink-900 to-purple-900 flex items-center justify-center">
        <div className="text-center text-white p-8">
          <div className="text-6xl mb-4">😕</div>
          <h3 className="text-2xl font-bold mb-2">Match Not Found</h3>
          <p className="text-pink-200 mb-6">The match you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const matchDateTime = formatDateTime(match.start_time);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 transform skew-y-12"></div>
        <div className="absolute inset-0 bg-gradient-to-l from-blue-600 to-purple-600 transform -skew-y-12 translate-y-12"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-slate-800 to-gray-900 border-b border-purple-500/30 shadow-2xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
              >
                ← Back
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
              >
                ☰ Matches
              </button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                  <span className="text-2xl">{getSportIcon(sport)}</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Match Details</h1>
                  <p className="text-purple-200 text-sm capitalize">{sport} • Pregame</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 rounded-full text-white font-bold text-sm animate-pulse">
                🔥 Pre-match Betting
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-gradient-to-b from-slate-800 to-gray-900 border-r border-purple-500/30 shadow-2xl transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-purple-500/30">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">All Matches</h3>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-purple-300 text-sm mt-1">
              {sport.charAt(0).toUpperCase() + sport.slice(1)} • {filter === 'today' ? 'Today' : filter}
            </p>
          </div>

          {/* Matches List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {allMatches.map((country) => (
              <div key={country.country} className="space-y-3">
                <h4 className="text-sm font-semibold text-purple-300 uppercase tracking-wider border-b border-purple-500/20 pb-1">
                  {country.country}
                </h4>
                {country.leagues.map((league) => (
                  <div key={league.league} className="space-y-2">
                    <h5 className="text-xs font-medium text-blue-300 ml-2">
                      {league.league}
                    </h5>
                    {league.matches.map((sidebarMatch) => (
                      <button
                        key={sidebarMatch.match_id}
                        onClick={() => navigateToMatch(sidebarMatch.match_id)}
                        className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                          sidebarMatch.match_id === matchId 
                            ? 'bg-gradient-to-r from-purple-600/50 to-pink-600/50 border border-purple-400/50' 
                            : 'bg-slate-700/50 hover:bg-slate-600/50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-purple-300 font-medium">
                            {formatMatchTime(sidebarMatch.start_time)}
                          </span>
                          {sidebarMatch.match_id === matchId && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-white text-sm">
                          <div className="font-medium">{sidebarMatch.team1_name}</div>
                          <div className="text-gray-300">vs</div>
                          <div className="font-medium">{sidebarMatch.team2_name}</div>
                        </div>
                        {(sidebarMatch.home_odds || sidebarMatch.away_odds) && (
                          <div className="flex justify-between mt-2 text-xs">
                            {sidebarMatch.home_odds && (
                              <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded">
                                {sidebarMatch.home_odds}
                              </span>
                            )}
                            {sidebarMatch.away_odds && (
                              <span className="bg-red-600/30 text-red-300 px-2 py-1 rounded">
                                {sidebarMatch.away_odds}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="relative z-10 container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-3 space-y-8">
            {/* Match Header Card */}
            <div className="bg-gradient-to-r from-slate-800 to-gray-800 rounded-3xl p-8 border border-purple-500/30 shadow-2xl">
              <div className="text-center">
                {/* Teams */}
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
                      <span className="text-2xl font-bold text-white">{match.team1_name?.[0] || 'T1'}</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">{match.team1_name}</h2>
                    <p className="text-blue-300 text-sm">Home</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-4xl font-black text-white mb-2">VS</div>
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full">
                      <span className="text-white font-bold text-sm">{getSportIcon(sport)} {sport.toUpperCase()}</span>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
                      <span className="text-2xl font-bold text-white">{match.team2_name?.[0] || 'T2'}</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">{match.team2_name}</h2>
                    <p className="text-pink-300 text-sm">Away</p>
                  </div>
                </div>

                {/* Match Info */}
                <div className="flex items-center justify-center gap-6 text-center">
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-4 py-2 rounded-xl border border-blue-500/30">
                    <p className="text-blue-300 text-xs uppercase tracking-wide">Date</p>
                    <p className="text-white font-bold">{matchDateTime.date}</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-2 rounded-xl border border-purple-500/30">
                    <p className="text-purple-300 text-xs uppercase tracking-wide">Kick-off</p>
                    <p className="text-white font-bold">{matchDateTime.time}</p>
                  </div>
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 px-4 py-2 rounded-xl border border-green-500/30">
                    <p className="text-green-300 text-xs uppercase tracking-wide">Match ID</p>
                    <p className="text-white font-bold">#{matchId}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Categories */}
            <div className="bg-gradient-to-r from-slate-800/80 to-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                🎯 Betting Markets
              </h3>
              <div className="flex flex-wrap gap-3">
                {getMarketCategories().map(category => (
                  <button
                    key={category.key}
                    onClick={() => setSelectedMarket(category.key)}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 transform hover:scale-105 ${
                      selectedMarket === category.key
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-lg'
                        : 'bg-gradient-to-r from-slate-700 to-gray-700 text-white hover:from-slate-600 hover:to-gray-600'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Markets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(getFilteredMarkets()).map(([marketKey, marketData]) => 
                renderMarketOptions(marketKey, marketData)
              )}
            </div>
          </div>

          {/* Bet Slip Sidebar */}
          <div className="xl:col-span-1">
            <div className="sticky top-8">
              <div className="bg-gradient-to-br from-slate-800 to-gray-900 rounded-2xl border border-purple-500/30 shadow-2xl">
                {/* Bet Slip Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      🎫 Bet Slip
                    </h3>
                    <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-white text-sm font-bold">
                      {betSlip.length}
                    </span>
                  </div>
                </div>

                {/* Bet Slip Content */}
                <div className="p-4">
                  {betSlip.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">🎯</div>
                      <p className="text-gray-400 mb-2">No bets selected</p>
                      <p className="text-gray-500 text-sm">Click on odds to add selections</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {betSlip.map(bet => (
                        <div key={bet.id} className="bg-gradient-to-r from-slate-700 to-gray-700 rounded-xl p-3 border border-gray-600">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm truncate">{bet.selection}</p>
                              <p className="text-gray-300 text-xs">{bet.market}</p>
                            </div>
                            <button
                              onClick={() => removeBet(bet.id)}
                              className="text-red-400 hover:text-red-300 ml-2"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-yellow-400 font-bold text-lg">{bet.odds?.toFixed(2)}</span>
                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-2 py-1 rounded text-white text-xs font-bold">
                              ⚡ LIVE
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Bet Actions */}
                      <div className="pt-4 border-t border-gray-600">
                        <div className="space-y-3">
                          <div className="flex justify-between text-white">
                            <span>Total Odds:</span>
                            <span className="font-bold text-yellow-400">
                              {betSlip.reduce((acc, bet) => acc * (bet.odds || 1), 1).toFixed(2)}
                            </span>
                          </div>
                          <button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg">
                            🚀 Place Bet
                          </button>
                          <button 
                            onClick={() => setBetSlip([])}
                            className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-xl transition-all duration-200"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-6 bg-gradient-to-br from-blue-800/50 to-purple-800/50 backdrop-blur-sm rounded-2xl p-4 border border-blue-500/30">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  📊 Quick Stats
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Available Markets:</span>
                    <span className="text-white font-bold">{Object.keys(match.markets || {}).length}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Best Odds:</span>
                    <span className="text-green-400 font-bold">⚡ Live</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Status:</span>
                    <span className="text-yellow-400 font-bold">Pre-match</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PregameMatchDetailPage;