import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'phoenix';
import { useNavigate } from 'react-router-dom';
import SportFilter from './components/SportFilter';
import MatchesList from './components/MatchesList';

function App() {
  const navigate = useNavigate();
  const [selectedSport, setSelectedSport] = useState('soccer');
  const [sports, setSports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Match expansion state
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [fullMatchData, setFullMatchData] = useState({});
  
  // Market dictionaries cache
  const [marketDictionaries, setMarketDictionaries] = useState({});
  
  // Match events dictionaries cache
  const [matchEventsDictionaries, setMatchEventsDictionaries] = useState({});
  
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Keep track of active match subscriptions
  const matchChannelsRef = useRef(new Map());
  const detailChannelRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = new Socket('/socket', {
      params: { userToken: 'anonymous' }
    });

    newSocket.onOpen(() => {
      console.log('Socket connected');
      setConnectionStatus('connected');
    });

    newSocket.onError(() => {
      console.log('Socket error');
      setConnectionStatus('error');
    });

    newSocket.onClose(() => {
      console.log('Socket closed');
      setConnectionStatus('disconnected');
    });

    newSocket.connect();
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Fetch initial sports list
  useEffect(() => {
    fetch('/api/sports')
      .then(response => response.json())
      .then(data => {
        setSports(data.sports || []);
      })
      .catch(error => {
        console.error('Error fetching sports:', error);
      });
  }, []);

  // Fetch market dictionary and match events when sport changes
  useEffect(() => {
    if (!selectedSport) return;
    
    // Check if we already have both dictionaries for this sport
    if (marketDictionaries[selectedSport] && matchEventsDictionaries[selectedSport]) {
      console.log(`Dictionaries for ${selectedSport} already cached`);
      return;
    }

    console.log(`Fetching dictionaries for ${selectedSport}`);
    fetch(`/api/markets/${selectedSport}`)
      .then(response => response.json())
      .then(data => {
        if (data.markets) {
          // Convert markets array to map for faster lookups
          const marketMap = {};
          data.markets.forEach(market => {
            marketMap[market.id] = market.name;
          });
          
          setMarketDictionaries(prev => ({
            ...prev,
            [selectedSport]: marketMap
          }));
          console.log(`Cached ${data.markets.length} markets for ${selectedSport}`);
        }

        if (data.match_events) {
          // Convert match events array to map for faster lookups
          const eventsMap = {};
          data.match_events.forEach(event => {
            eventsMap[event.code] = event.name;
          });
          
          setMatchEventsDictionaries(prev => ({
            ...prev,
            [selectedSport]: eventsMap
          }));
          console.log(`Cached ${data.match_events.length} match events for ${selectedSport}`);
        }
      })
      .catch(error => {
        console.error('Error fetching dictionaries:', error);
      });
  }, [selectedSport, marketDictionaries, matchEventsDictionaries]);

  // Fetch initial matches when sport changes
  useEffect(() => {
    if (!selectedSport) return;

    console.log(`Fetching initial matches for ${selectedSport}`);
    fetch(`/api/matches/${selectedSport}`)
      .then(response => response.json())
      .then(data => {
        console.log(`Received initial matches for ${selectedSport}:`, data);
        setMatches(data.matches || []);
        setLastUpdate(new Date());
      })
      .catch(error => {
        console.error('Error fetching matches:', error);
        setMatches([]);
      });
  }, [selectedSport]);

  // Subscribe to individual matches when matches change
  useEffect(() => {
    if (!socket || !selectedSport || matches.length === 0) return;

    console.log(`Setting up match subscriptions for ${selectedSport}`);
    
    // Clean up existing subscriptions
    matchChannelsRef.current.forEach((channel, matchId) => {
      console.log(`Leaving subscription for match ${matchId}`);
      channel.leave();
    });
    matchChannelsRef.current.clear();

    // Subscribe to each match
    matches.forEach(league => {
      league.matches.forEach(match => {
        subscribeToMatch(match.id);
      });
    });

    // Cleanup function
    return () => {
      matchChannelsRef.current.forEach((channel, matchId) => {
        console.log(`Cleaning up subscription for match ${matchId}`);
        channel.leave();
      });
      matchChannelsRef.current.clear();
    };
  }, [socket, selectedSport, matches.length]); // Only re-run when matches count changes

  // Handle expanded match detail subscription
  useEffect(() => {
    if (!socket || !expandedMatch || !selectedSport) {
      // Clean up detail channel if no expanded match
      if (detailChannelRef.current) {
        detailChannelRef.current.leave();
        detailChannelRef.current = null;
      }
      return;
    }

    console.log(`Setting up detail subscription for match ${expandedMatch}`);
    
    // Clean up existing detail channel
    if (detailChannelRef.current) {
      detailChannelRef.current.leave();
    }

    // Subscribe to detailed match updates
    const detailChannel = socket.channel(`match_details:${selectedSport}:${expandedMatch}`, {});
    
    detailChannel.join()
      .receive('ok', () => {
        console.log(`✅ Successfully subscribed to detailed updates for match ${expandedMatch}`);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to detailed updates for match ${expandedMatch}:`, resp);
      });

    // Handle full match data updates
    detailChannel.on('full_match_data', payload => {
      console.log(`🔄 Full match data for ${expandedMatch}:`, payload);
      setFullMatchData(prev => ({
        ...prev,
        [expandedMatch]: payload.data
      }));
      setLastUpdate(new Date());
    });

    detailChannelRef.current = detailChannel;

    // Cleanup when expandedMatch changes
    return () => {
      if (detailChannel) {
        detailChannel.leave();
      }
    };
  }, [socket, expandedMatch, selectedSport]);

  const subscribeToMatch = (matchId) => {
    if (matchChannelsRef.current.has(matchId)) {
      return; // Already subscribed
    }

    const channelTopic = `match:${selectedSport}:${matchId}`;
    console.log(`Subscribing to ${channelTopic}`);
    
    const matchChannel = socket.channel(channelTopic, {});
    
    matchChannel.join()
      .receive('ok', () => {
        console.log(`✅ Successfully subscribed to match ${matchId}`);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to match ${matchId}:`, resp);
      });

    // Handle individual match updates
    matchChannel.on('match_update', payload => {
      console.log(`🔄 Match ${matchId} updated:`, payload);
      updateSpecificMatch(matchId, payload.data);
    });

    // Store the channel reference
    matchChannelsRef.current.set(matchId, matchChannel);
  };

  // Efficient function to update only a specific match
  const updateSpecificMatch = (matchId, newData) => {
    setMatches(prevMatches => {
      return prevMatches.map(league => {
        const matchIndex = league.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) return league; // Match not in this league
        
        // Create new matches array with updated match
        const updatedMatches = [...league.matches];
        updatedMatches[matchIndex] = {
          ...updatedMatches[matchIndex],
          data: newData
        };
        
        return {
          ...league,
          matches: updatedMatches
        };
      });
    });
    
    setLastUpdate(new Date());
  };

  // Handle match toggle
  const handleToggleMatch = (matchId) => {
    if (expandedMatch === matchId) {
      // Close currently expanded match
      setExpandedMatch(null);
      setFullMatchData(prev => {
        const newData = { ...prev };
        delete newData[matchId];
        return newData;
      });
    } else {
      // Open new match (close others automatically)
      setExpandedMatch(matchId);
      // Clear previous match data
      setFullMatchData({});
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10B981';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTotalMatches = () => {
    return matches.reduce((total, league) => total + league.matches.length, 0);
  };

  const getLiveMatches = () => {
    return matches.reduce((total, league) => 
      total + league.matches.filter(m => m.data?.time > 0).length, 0
    );
  };

  return (
    <div className="min-h-screen w-full bg-gray-900">
      {/* Modern Dark Header */}
      <header className="bg-gray-800 text-white shadow-xl border-b border-gray-700 w-full">
        <div className="w-full">
          {/* Promotional banner */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-4 text-xs text-center font-medium">
            <span className="inline-flex items-center gap-2">
              🎉 Welcome Bonus - Bet £10 Get £30 in Free Bets
              <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs font-bold">NEW</span>
            </span>
          </div>
          
          {/* Main header */}
          <div className="flex items-center justify-between py-4 px-6 border-b border-gray-700">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                {/* Mobile menu button */}
                <button
                  className="md:hidden p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  <div className="w-5 h-5 flex flex-col justify-center">
                    <div className={`w-full h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : 'mb-1'}`}></div>
                    <div className={`w-full h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : 'mb-1'}`}></div>
                    <div className={`w-full h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}></div>
                  </div>
                </button>
                
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg">
                    <span className="text-white font-black text-lg">S</span>
                  </div>
                  <h1 className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    SportsBet
                  </h1>
                </div>
                
                <div className="hidden sm:flex items-center gap-2 bg-gray-700 px-3 py-1.5 rounded-full text-xs">
                  <div 
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: getConnectionStatusColor() }}
                  />
                  <span className="text-gray-300 font-medium">{connectionStatus.toUpperCase()}</span>
                </div>
              </div>
              
              <div className="hidden lg:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  <span className="font-bold text-white">{getLiveMatches()} LIVE</span>
                </div>
                <div className="bg-gray-700 px-3 py-1.5 rounded-full">
                  <span className="text-gray-300">{getTotalMatches()} Events</span>
                </div>
                <div className="bg-gray-700 px-3 py-1.5 rounded-full">
                  <span className="text-gray-300">{matchChannelsRef.current.size} Active</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-xs text-gray-400">
                Updated: {lastUpdate.toLocaleTimeString()}
              </div>
              <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105">
                JOIN NOW
              </button>
              <button className="bg-gray-700 hover:bg-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                LOG IN
              </button>
            </div>
          </div>
          
          {/* Navigation tabs */}
          <div className="bg-gray-800 border-b border-gray-700">
            <div className="flex items-center justify-between px-6 py-3">
              <nav className="flex items-center gap-1">
                <button 
                  className="bg-blue-600 text-white px-4 py-2 text-sm font-bold rounded-lg"
                  onClick={() => navigate('/')}
                >
                  Sports
                </button>
                <button 
                  className="text-gray-400 hover:text-white hover:bg-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                  onClick={() => navigate('/pregame')}
                >
                  Pregame
                </button>
                <button className="text-gray-400 hover:text-white hover:bg-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-colors">
                  Casino
                </button>
                <button className="text-gray-400 hover:text-white hover:bg-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-colors">
                  Live Casino
                </button>
                <button className="text-gray-400 hover:text-white hover:bg-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-colors">
                  Esports
                </button>
              </nav>
              
              <div className="flex items-center gap-4 text-sm">
                <button className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2">
                  <span>🔴</span>
                  Live Streaming
                </button>
                <button className="text-gray-400 hover:text-white">
                  Results
                </button>
                <button className="text-gray-400 hover:text-white">
                  Statistics
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-navigation */}
      <div className="bg-gray-850 text-white shadow-sm w-full border-b border-gray-700">
        <div className="w-full px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-white">Live Events</span>
              </div>
              <div className="w-px h-4 bg-gray-600"></div>
              <div className="flex items-center gap-6 text-sm">
                <button className="text-blue-400 font-medium hover:text-blue-300">Football</button>
                <button className="text-gray-400 hover:text-white">Tennis</button>
                <button className="text-gray-400 hover:text-white">Basketball</button>
                <button className="text-gray-400 hover:text-white">Ice Hockey</button>
                <button className="text-gray-400 hover:text-white">Baseball</button>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span className="flex items-center gap-2">
                <span>📺</span>
                {getLiveMatches()} live streams
              </span>
              <span className="flex items-center gap-2">
                <span>⚡</span>
                Fast markets
              </span>
              <span className="flex items-center gap-2">
                <span>💰</span>
                Cash out
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          {/* Mobile Menu Sidebar */}
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-out">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg">
                  <span className="text-white font-black text-sm">S</span>
                </div>
                <span className="text-white font-bold text-lg">Sports Menu</span>
              </div>
              <button
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="text-lg">×</span>
              </button>
            </div>
            
            {/* Mobile Menu Content */}
            <div className="h-full overflow-y-auto pb-20">
              <SportFilter
                sports={sports}
                selectedSport={selectedSport}
                onSportChange={setSelectedSport}
              />
              
              {/* Mobile Matches Section */}
              {matches && matches.length > 0 && (
                <div className="border-t border-gray-700">
                  <div className="p-4 bg-gray-900">
                    <h3 className="text-white font-bold text-sm mb-1">
                      {selectedSport?.charAt(0).toUpperCase() + selectedSport?.slice(1)} Matches
                    </h3>
                    <div className="text-xs text-gray-400">
                      {matches.reduce((total, league) => total + league.matches.length, 0)} events available
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {matches.map((league, leagueIndex) => (
                      <div key={leagueIndex} className="border-b border-gray-700 last:border-b-0">
                        {/* League Header */}
                        <div className="px-4 py-2 bg-gray-750 border-l-4 border-blue-500">
                          <div className="flex items-center justify-between">
                            <span className="text-blue-400 font-bold text-xs">{league.league}</span>
                            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                              {league.matches.length}
                            </span>
                          </div>
                        </div>
                        
                        {/* League Matches */}
                        <div className="bg-gray-800">
                          {league.matches.slice(0, 5).map((match) => {
                            const isLive = match.data?.time > 0;
                            return (
                              <button
                                key={match.id}
                                className="w-full text-left p-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-750 transition-colors"
                                onClick={() => {
                                  navigate(`/match/${selectedSport}/${match.id}`);
                                  setIsMobileMenuOpen(false);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-white text-xs font-bold truncate">
                                        {match.data?.t1?.name || 'Team 1'}
                                      </span>
                                      <span className={`text-xs font-bold ${isLive ? 'text-red-400' : 'text-gray-300'}`}>
                                        {match.data?.t1?.score || 0}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white text-xs font-bold truncate">
                                        {match.data?.t2?.name || 'Team 2'}
                                      </span>
                                      <span className={`text-xs font-bold ${isLive ? 'text-red-400' : 'text-gray-300'}`}>
                                        {match.data?.t2?.score || 0}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-right">
                                    <div className="text-xs font-bold text-gray-400">{formatTime(match.data?.time)}</div>
                                    {isLive ? (
                                      <div className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                                        LIVE
                                      </div>
                                    ) : (
                                      <div className="text-xs text-gray-500">Pre-Match</div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          
                          {league.matches.length > 5 && (
                            <button
                              className="w-full p-3 text-center text-xs font-bold bg-gray-750 hover:bg-gray-700 text-blue-400 transition-colors"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              View all {league.matches.length} matches →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modern Main Content */}
      <main className="w-full bg-gray-900">
        <div className="flex w-full min-h-screen">
          {/* Left Sidebar - Desktop only */}
          <div className="w-64 lg:w-72 xl:w-80 hidden md:block bg-gray-800 border-r border-gray-700 shadow-xl">
            <SportFilter
              sports={sports}
              selectedSport={selectedSport}
              onSportChange={setSelectedSport}
            />
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 w-full bg-gray-900">
            <MatchesList
              sport={selectedSport}
              matches={matches}
              formatTime={formatTime}
              expandedMatch={expandedMatch}
              onToggleMatch={handleToggleMatch}
              fullMatchData={fullMatchData}
              marketDictionary={marketDictionaries[selectedSport] || {}}
              matchEventsDictionary={matchEventsDictionaries[selectedSport] || {}}
            />
          </div>
          
          {/* Right Sidebar - Modern Bet Slip */}
          <div className="w-80 xl:w-96 hidden lg:block bg-gray-800 border-l border-gray-700 shadow-xl">
            <div className="p-4">
              {/* Bet Slip Card */}
              <div className="bg-gray-750 rounded-xl p-4 border border-gray-600 shadow-lg">
                <div className="text-center mb-4">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <span className="text-2xl">🎫</span>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Bet Slip</h3>
                  <p className="text-gray-400 text-sm">Add selections to get started</p>
                </div>
                <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 px-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105">
                  Quick Bet
                </button>
              </div>
              
              {/* Promotions Card */}
              <div className="mt-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎁</span>
                  <span className="font-bold text-sm">Daily Boost</span>
                </div>
                <p className="text-xs text-purple-100 mb-3">Enhanced odds on featured matches</p>
                <button className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  View Boosts
                </button>
              </div>
              
              {/* Live Statistics Card */}
              <div className="mt-4 bg-gray-750 rounded-xl p-4 border border-gray-600 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📊</span>
                  <span className="text-white font-bold text-sm">Live Stats</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Active bets:</span>
                    <span className="text-white font-bold">1,247,392</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Biggest win today:</span>
                    <span className="text-green-400 font-bold">£89,420</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Popular bet:</span>
                    <span className="text-blue-400 font-bold">Man City Win</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Live events:</span>
                    <span className="text-red-400 font-bold">{getLiveMatches()}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 space-y-2">
                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <span>🔴</span>
                  Live Streaming
                </button>
                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <span>📈</span>
                  Statistics
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;