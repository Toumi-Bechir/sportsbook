import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Socket } from 'phoenix';

function MatchDetailPageNew() {
  const { sport: selectedSport, matchId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [sports, setSports] = useState([]);
  const [allMatches, setAllMatches] = useState({});
  const [expandedSports, setExpandedSports] = useState(new Set([selectedSport]));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [expandedSportsInSidebar, setExpandedSportsInSidebar] = useState(new Set());
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [fullMatchData, setFullMatchData] = useState(null);
  const [activeTab, setActiveTab] = useState('tracker');
  const [selectedMarketCategory, setSelectedMarketCategory] = useState('popular');
  
  // Ball trail tracking
  const [ballTrail, setBallTrail] = useState([]);
  
  // Dictionaries
  const [marketDictionaries, setMarketDictionaries] = useState({});
  const [matchEventsDictionaries, setMatchEventsDictionaries] = useState({});
  
  // Socket management
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const matchChannelsRef = useRef(new Map());
  const detailChannelRef = useRef(null);
  const subscribedMatches = useRef(new Set());

  // Initialize socket
  useEffect(() => {
    const newSocket = new Socket('/socket', {
      params: { userToken: 'anonymous' }
    });

    newSocket.onOpen(() => {
      setConnectionStatus('connected');
    });

    newSocket.onError(() => {
      setConnectionStatus('error');
    });

    newSocket.onClose(() => {
      setConnectionStatus('disconnected');
    });

    newSocket.connect();
    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Fetch sports list
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

  // Fetch dictionaries for expanded sports
  useEffect(() => {
    expandedSports.forEach(sport => {
      if (!marketDictionaries[sport] || !matchEventsDictionaries[sport]) {
        fetchDictionaries(sport);
      }
    });
  }, [expandedSports]);

  // Fetch matches for expanded sports
  useEffect(() => {
    expandedSports.forEach(sport => {
      if (!allMatches[sport]) {
        fetchMatches(sport);
      }
    });
  }, [expandedSports]);

  // Subscribe to matches when sports are expanded and matches are available
  useEffect(() => {
    if (!socket) return;

    expandedSports.forEach(sport => {
      if (allMatches[sport]) {
        allMatches[sport].forEach(league => {
          league.matches.forEach(match => {
            const channelKey = `${sport}:${match.id}`;
            if (!subscribedMatches.current.has(channelKey)) {
              subscribeToMatch(sport, match.id);
            }
          });
        });
      }
    });

    const keysToRemove = [];
    subscribedMatches.current.forEach(key => {
      const [sport] = key.split(':');
      if (!expandedSports.has(sport)) {
        const channel = matchChannelsRef.current.get(key);
        if (channel) {
          channel.leave();
          matchChannelsRef.current.delete(key);
        }
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      subscribedMatches.current.delete(key);
    });
  }, [socket, expandedSports]);

  // Clean up subscriptions when component unmounts
  useEffect(() => {
    return () => {
      matchChannelsRef.current.forEach((channel) => {
        channel.leave();
      });
      matchChannelsRef.current.clear();
      subscribedMatches.current.clear();
    };
  }, []);

  // Subscribe to detailed match data for selected match (big data)
  useEffect(() => {
    if (!socket || !matchId) return;

    if (detailChannelRef.current) {
      detailChannelRef.current.leave();
    }

    const detailChannel = socket.channel(`match_details:${selectedSport}:${matchId}`, {});
    
    detailChannel.join()
      .receive('ok', () => {
        console.log(`✅ Subscribed to detailed updates for match ${matchId}`);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to detailed updates:`, resp);
      });

    detailChannel.on('full_match_data', payload => {
      const newData = payload.data;
      setFullMatchData(newData);
      
      // Track ball position for trail effect
      if (newData?.xy) {
        const coords = newData.xy.split(',');
        if (coords.length === 2) {
          const x = parseFloat(coords[0]);
          const y = parseFloat(coords[1]);
          
          setBallTrail(prevTrail => {
            const newTrail = [...prevTrail, { x, y, timestamp: Date.now() }];
            // Keep only last 8 positions and remove old ones (older than 10 seconds)
            const cutoffTime = Date.now() - 10000;
            return newTrail
              .filter(pos => pos.timestamp > cutoffTime)
              .slice(-8);
          });
        }
      }
    });

    detailChannelRef.current = detailChannel;

    return () => {
      if (detailChannel) {
        detailChannel.leave();
      }
    };
  }, [socket, selectedSport, matchId]);

  // Subscribe to current match small data updates
  useEffect(() => {
    if (!socket || !selectedSport || !matchId) return;

    const channelKey = `${selectedSport}:${matchId}`;
    
    // Don't create duplicate subscription if already exists
    if (matchChannelsRef.current.has(channelKey)) {
      return;
    }

    const channelTopic = `match:${selectedSport}:${matchId}`;
    const matchChannel = socket.channel(channelTopic, {});
    
    matchChannel.join()
      .receive('ok', () => {
        console.log(`✅ Subscribed to small data for current match ${matchId}`);
        subscribedMatches.current.add(channelKey);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to current match small data:`, resp);
      });

    matchChannel.on('match_update', payload => {
      updateSpecificMatch(selectedSport, matchId, payload.data);
    });

    matchChannelsRef.current.set(channelKey, matchChannel);

    return () => {
      if (matchChannel) {
        matchChannel.leave();
        matchChannelsRef.current.delete(channelKey);
        subscribedMatches.current.delete(channelKey);
      }
    };
  }, [socket, selectedSport, matchId]);

  // Load initial selected match
  useEffect(() => {
    if (allMatches[selectedSport] && matchId) {
      const match = findMatchById(selectedSport, matchId);
      if (match) {
        setSelectedMatch(match);
      }
    }
  }, [allMatches, selectedSport, matchId]);

  // Update selected match when navigating to different match
  useEffect(() => {
    if (allMatches[selectedSport] && matchId) {
      const match = findMatchById(selectedSport, matchId);
      if (match && (!selectedMatch || selectedMatch.id !== matchId)) {
        setSelectedMatch(match);
      }
    }
  }, [selectedSport, matchId]);

  // Ensure selectedSport is always in expandedSports
  useEffect(() => {
    if (selectedSport) {
      setExpandedSports(prev => new Set([...prev, selectedSport]));
    }
  }, [selectedSport]);

  const fetchDictionaries = async (sport) => {
    try {
      const response = await fetch(`/api/markets/${sport}`);
      const data = await response.json();
      
      if (data.markets) {
        const marketMap = {};
        data.markets.forEach(market => {
          marketMap[market.id] = market.name;
        });
        
        setMarketDictionaries(prev => ({
          ...prev,
          [sport]: marketMap
        }));
      }

      if (data.match_events) {
        const eventsMap = {};
        data.match_events.forEach(event => {
          eventsMap[event.code] = event.name;
        });
        
        setMatchEventsDictionaries(prev => ({
          ...prev,
          [sport]: eventsMap
        }));
      }
    } catch (error) {
      console.error('Error fetching dictionaries:', error);
    }
  };

  const fetchMatches = async (sport) => {
    try {
      const response = await fetch(`/api/matches/${sport}`);
      const data = await response.json();
      setAllMatches(prev => ({
        ...prev,
        [sport]: data.matches || []
      }));
    } catch (error) {
      console.error('Error fetching matches:', error);
      setAllMatches(prev => ({
        ...prev,
        [sport]: []
      }));
    }
  };

  const subscribeToMatch = (sport, matchId) => {
    const channelKey = `${sport}:${matchId}`;
    
    if (subscribedMatches.current.has(channelKey)) {
      return;
    }

    const channelTopic = `match:${sport}:${matchId}`;
    const matchChannel = socket.channel(channelTopic, {});
    
    matchChannel.join()
      .receive('ok', () => {
        console.log(`✅ Subscribed to ${sport} match ${matchId}`);
        subscribedMatches.current.add(channelKey);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to ${sport} match ${matchId}:`, resp);
      });

    matchChannel.on('match_update', payload => {
      updateSpecificMatch(sport, matchId, payload.data);
    });

    matchChannelsRef.current.set(channelKey, matchChannel);
  };

  const updateSpecificMatch = (sport, matchId, newData) => {
    // Update sidebar menu matches with small data
    setAllMatches(prevMatches => {
      if (!prevMatches[sport]) return prevMatches;
      
      return {
        ...prevMatches,
        [sport]: prevMatches[sport].map(league => {
          const matchIndex = league.matches.findIndex(m => m.id === matchId);
          if (matchIndex === -1) return league;
          
          const updatedMatches = [...league.matches];
          updatedMatches[matchIndex] = {
            ...updatedMatches[matchIndex],
            data: newData
          };
          
          return {
            ...league,
            matches: updatedMatches
          };
        })
      };
    });

    // Update selected match with small data for header
    if (selectedMatch && selectedMatch.id === matchId && sport === selectedSport) {
      setSelectedMatch(prevMatch => ({
        ...prevMatch,
        data: newData
      }));
    }
  };

  const findMatchById = (sport, matchId) => {
    if (!allMatches[sport]) return null;
    
    for (const league of allMatches[sport]) {
      const match = league.matches.find(m => m.id === matchId);
      if (match) return match;
    }
    return null;
  };

  const handleMatchSelect = (sport, matchId) => {
    navigate(`/match/${sport}/${matchId}`);
  };

  const handleSportChange = (newSport) => {
    // Add the new sport to expanded sports to fetch its matches
    setExpandedSports(prev => new Set([...prev, newSport]));
    navigate(`/match/${newSport}/${matchId}`);
  };

  const toggleSidebarSport = (sportName) => {
    setExpandedSportsInSidebar(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sportName)) {
        newSet.delete(sportName);
      } else {
        newSet.add(sportName);
        // Also fetch matches for this sport if not already fetched
        setExpandedSports(prevExpanded => new Set([...prevExpanded, sportName]));
      }
      return newSet;
    });
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatSportName = (sport) => {
    const sportNames = {
      soccer: '⚽ Football',
      basket: '🏀 Basketball', 
      tennis: '🎾 Tennis',
      baseball: '⚾ Baseball',
      amfootball: '🏈 American Football',
      hockey: '🏒 Ice Hockey',
      volleyball: '🏐 Volleyball'
    };
    return sportNames[sport] || sport;
  };

  const getMarketName = (marketId) => {
    return marketDictionaries[selectedSport]?.[marketId] || `Market ${marketId}`;
  };

  const getScore = (matchData) => {
    if (!matchData) return '0-0';
    
    switch (selectedSport) {
      case 'soccer':
      case 'basket':
      case 'amfootball':
      case 'hockey':
        return `${matchData.t1?.score || 0}-${matchData.t2?.score || 0}`;
      default:
        return '0-0';
    }
  };

  const getMarketCategories = () => {
    if (!fullMatchData?.odds) return [];
    
    const categories = {
      popular: 'Most Popular',
      match: 'Match Result',
      goals: 'Goals',
      corners: 'Corners',
      cards: 'Cards',
      specials: 'Specials'
    };
    
    return Object.entries(categories).map(([key, name]) => ({
      key,
      name,
      count: fullMatchData.odds.length // In real app, would filter by category
    }));
  };

  const isLive = fullMatchData?.time > 0 || selectedMatch?.data?.time > 0;

  if (!selectedMatch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Match Details</h3>
          <p className="text-gray-500">Fetching live data and markets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-900">
      {/* Modern Header */}
      <header className="bg-gray-800 text-white shadow-xl border-b border-gray-700 w-full">
        <div className="w-full">
          {/* Top notification bar */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-4 text-xs text-center font-medium">
            <span className="inline-flex items-center gap-2">
              🎯 Live Match Center • Real-time odds • Cash Out available
              <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs font-bold">LIVE</span>
            </span>
          </div>
          
          {/* Main header */}
          <div className="flex items-center justify-between py-4 px-6 border-b border-gray-700">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {/* Hamburger menu for small screens */}
                  <button 
                    className="md:hidden bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    <div className="w-5 h-5 flex flex-col justify-center items-center space-y-1">
                      <div 
                        className={`w-4 h-0.5 bg-white transition-all duration-300 ${
                          isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                        }`}
                      ></div>
                      <div 
                        className={`w-4 h-0.5 bg-white transition-all duration-300 ${
                          isMobileMenuOpen ? 'opacity-0' : ''
                        }`}
                      ></div>
                      <div 
                        className={`w-4 h-0.5 bg-white transition-all duration-300 ${
                          isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                        }`}
                      ></div>
                    </div>
                  </button>
                  <h1 className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    SportsBet
                  </h1>
                </div>
                
                
              
              <div className="hidden lg:flex items-center gap-4 text-sm">
                {isLive && (
                  <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    <span className="font-bold text-white">LIVE MATCH</span>
                  </div>
                )}
                <div className="bg-gray-700 px-3 py-1.5 rounded-full">
                  <span className="text-gray-300">Match #{matchId}</span>
                </div>
              </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105"
                onClick={() => navigate('/')}
              >
                ← Live
              </button>
            </div>
          </div>
          
        </div>
      </header>

      {/* Modern Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-70 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-80 bg-gray-800 shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Quick Navigation</h2>
              <button 
                className="text-gray-400 hover:text-white text-xl transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="p-4">
              <button 
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 px-4 rounded-lg font-bold mb-4 transition-all duration-200 transform hover:scale-105"
                onClick={() => {
                  navigate('/');
                  setIsMobileMenuOpen(false);
                }}
              >
                ← Back to Live Events
              </button>
              
              <div className="space-y-2">
                {sports.map(sport => (
                  <button
                    key={sport.name}
                    className="w-full text-left p-3 rounded-lg bg-gray-750 border border-gray-600 hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      handleSportChange(sport.name);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="font-medium text-white">{formatSportName(sport.name)}</div>
                    <div className="text-sm text-gray-400">{sport.match_count} matches</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        <div className="flex w-full min-h-screen">
          {/* Left Sidebar - Modern Sports Browser */}
          <div className={`hidden md:block bg-gray-800 border-r border-gray-700 overflow-y-auto max-h-screen transition-all duration-300 shadow-xl ${
            isLeftSidebarOpen ? 'w-64 lg:w-72' : 'w-12'
          }`}>
            {isLeftSidebarOpen ? (
              // Full Sidebar Content
              <div className="h-full">
                {/* Modern Sidebar Header - Clickable */}
                <div className="p-4 bg-gray-900 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <button 
                      className="flex items-center gap-3 w-full hover:bg-gray-800 p-2 rounded-lg transition-colors"
                      onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                    >
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg">
                        {/* Animated Hamburger Menu */}
                        <div className="w-5 h-5 flex flex-col justify-center items-center space-y-1">
                          <div 
                            className={`w-4 h-0.5 bg-white transition-all duration-300 ${
                              isLeftSidebarOpen ? 'rotate-45 translate-y-1.5' : ''
                            }`}
                          ></div>
                          <div 
                            className={`w-4 h-0.5 bg-white transition-all duration-300 ${
                              isLeftSidebarOpen ? 'opacity-0' : ''
                            }`}
                          ></div>
                          <div 
                            className={`w-4 h-0.5 bg-white transition-all duration-300 ${
                              isLeftSidebarOpen ? '-rotate-45 -translate-y-1.5' : ''
                            }`}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white text-left">Sports Browser</h3>
                        <div className="text-xs text-gray-400 text-left">Navigate & Explore</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Modern Sports List */}
                <div className="flex-1 bg-gray-800">
                  {sports.map(sport => (
                    <div key={sport.name} className="mb-1">
                      {/* Sport Header - Clickable to expand/collapse */}
                      <button
                        className={`w-full text-left p-3 border-b border-gray-200 transition-colors ${
                          selectedSport === sport.name 
                            ? 'bg-yellow-100 border-l-4 border-yellow-500' 
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => toggleSidebarSport(sport.name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{
                              sport.name === 'soccer' ? '⚽' :
                              sport.name === 'basket' ? '🏀' :
                              sport.name === 'tennis' ? '🎾' :
                              sport.name === 'baseball' ? '⚾' :
                              sport.name === 'amfootball' ? '🏈' :
                              sport.name === 'hockey' ? '🏒' :
                              sport.name === 'volleyball' ? '🏐' : '🏆'
                            }</span>
                            <div>
                              <div className="font-medium text-sm" style={{ 
                                color: selectedSport === sport.name ? '#003d02' : '#333' 
                              }}>
                                {formatSportName(sport.name)}
                              </div>
                              <div className="text-xs text-gray-500">{sport.match_count} matches</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedSport === sport.name && (
                              <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ 
                                backgroundColor: '#ffb80a', 
                                color: 'black' 
                              }}>
                                CURRENT
                              </span>
                            )}
                            <span className="text-gray-400">
                              {expandedSportsInSidebar.has(sport.name) ? '▼' : '►'}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Matches List */}
                      {expandedSportsInSidebar.has(sport.name) && allMatches[sport.name] && (
                        <div style={{ backgroundColor: 'white' }} className="border-l-4 border-gray-200">
                          {allMatches[sport.name].map((league, leagueIndex) => (
                            <div key={leagueIndex}>
                              {/* League Header */}
                              <div className="px-4 py-2 text-xs font-bold bg-blue-50 text-blue-600">
                                {league.league} ({league.matches.length})
                              </div>
                              
                              {/* League Matches */}
                              {league.matches.map((match, matchIndex) => {
                                const isCurrentMatch = match.id === matchId && sport.name === selectedSport;
                                const isLive = match.data?.time > 0;
                                
                                return (
                                  <button
                                    key={match.id}
                                    className={`w-full text-left p-2 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                                      isCurrentMatch ? 'bg-yellow-50' : ''
                                    }`}
                                    onClick={() => handleMatchSelect(sport.name, match.id)}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        {isLive && (
                                          <span className="w-2 h-2 rounded-full animate-pulse bg-red-500"></span>
                                        )}
                                        <span className="text-xs text-gray-600">
                                          {isLive ? formatTime(match.data.time) : 'Pre-Match'}
                                        </span>
                                      </div>
                                      {isCurrentMatch && (
                                        <span className="text-xs px-1 py-0.5 rounded font-bold bg-yellow-400 text-black">
                                          VIEWING
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="text-xs space-y-0.5">
                                      <div className="flex justify-between">
                                        <span className="font-medium text-blue-900">
                                          {match.data?.t1?.name || 'Team 1'}
                                        </span>
                                        <span className="font-bold text-red-600">
                                          {match.data?.t1?.score || 0}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="font-medium text-blue-900">
                                          {match.data?.t2?.name || 'Team 2'}
                                        </span>
                                        <span className="font-bold text-red-600">
                                          {match.data?.t2?.score || 0}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Collapsed Sidebar - Icons Only
              <div className="h-full" style={{ backgroundColor: '#f7f7f7' }}>
                <div className="p-2" style={{ backgroundColor: '#003d02' }}>
                  <button 
                    className="w-full text-center hover:bg-gray-800 p-2 rounded transition-colors"
                    onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                    title="Expand Sports Browser"
                  >
                    {/* Collapsed Hamburger Menu */}
                    <div className="w-5 h-5 flex flex-col justify-center items-center space-y-1 mx-auto">
                      <div className="w-4 h-0.5 bg-white transition-all duration-300"></div>
                      <div className="w-4 h-0.5 bg-white transition-all duration-300"></div>
                      <div className="w-4 h-0.5 bg-white transition-all duration-300"></div>
                    </div>
                  </button>
                </div>
                
                <div className="p-1">
                  {sports.map(sport => (
                    <button
                      key={sport.name}
                      className={`w-full p-2 mb-1 rounded text-center transition-colors ${
                        selectedSport === sport.name 
                          ? 'bg-yellow-400 text-black' 
                          : 'hover:bg-gray-200'
                      }`}
                      onClick={() => handleSportChange(sport.name)}
                      title={formatSportName(sport.name)}
                    >
                      <span className="text-lg block">{
                        sport.name === 'soccer' ? '⚽' :
                        sport.name === 'basket' ? '🏀' :
                        sport.name === 'tennis' ? '🎾' :
                        sport.name === 'baseball' ? '⚾' :
                        sport.name === 'amfootball' ? '🏈' :
                        sport.name === 'hockey' ? '🏒' :
                        sport.name === 'volleyball' ? '🏐' : '🏆'
                      }</span>
                      <span className="text-xs block">{sport.match_count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 w-full bg-gray-50">
            {/* Compact Match Header */}
            <div className="bg-white border-b border-gray-200 w-full">
              <div className="p-4 lg:p-6">
                {/* Teams and Scores in one line */}
                <div className="flex items-center justify-center gap-6 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg lg:text-xl font-bold text-gray-900">
                      {fullMatchData?.t1?.name || selectedMatch?.data?.t1?.name || 'Team 1'}
                    </span>
                    <span className="text-2xl lg:text-3xl font-black text-blue-600">
                      {fullMatchData?.t1?.score ?? selectedMatch?.data?.t1?.score ?? 0}
                    </span>
                  </div>
                  
                  <span className="text-xl lg:text-2xl font-bold text-gray-500">-</span>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-2xl lg:text-3xl font-black text-blue-600">
                      {fullMatchData?.t2?.score ?? selectedMatch?.data?.t2?.score ?? 0}
                    </span>
                    <span className="text-lg lg:text-xl font-bold text-gray-900">
                      {fullMatchData?.t2?.name || selectedMatch?.data?.t2?.name || 'Team 2'}
                    </span>
                  </div>
                </div>

                {/* Sport and Live indicator */}
                <div className="flex items-center justify-center gap-3">
                  <span className="text-sm">
                    {selectedSport === 'soccer' ? '⚽' : 
                     selectedSport === 'basket' ? '🏀' : 
                     selectedSport === 'tennis' ? '🎾' : 
                     selectedSport === 'baseball' ? '⚾' : 
                     selectedSport === 'amfootball' ? '🏈' : 
                     selectedSport === 'hockey' ? '🏒' : 
                     selectedSport === 'volleyball' ? '🏐' : '🏆'}
                  </span>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {selectedSport}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-red-500 font-bold text-sm">Live</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatTime(fullMatchData?.time ?? selectedMatch?.data?.time)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Markets Content - Always displayed */}
            <div className="p-4 lg:p-6 w-full">
              {/* Market Categories */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                  <h2 className="text-lg lg:text-xl font-bold text-gray-900">Betting Markets</h2>
                  <span className="bg-blue-100 text-blue-800 text-xs sm:text-sm px-2 py-1 rounded-full font-bold w-fit">
                    {fullMatchData?.odds?.length || 0} Available
                  </span>
                </div>
                
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {getMarketCategories().map(category => (
                    <button
                      key={category.key}
                      className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                        selectedMarketCategory === category.key
                          ? 'bg-yellow-500 text-black'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => setSelectedMarketCategory(category.key)}
                    >
                      {category.name} ({category.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Markets Grid */}
              {fullMatchData?.odds && Array.isArray(fullMatchData.odds) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6 w-full">
                  {fullMatchData.odds.map((market, index) => (
                    <div key={index} className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow w-full">
                      <div className="mb-4">
                        <h3 className="font-bold text-gray-900 text-sm lg:text-lg mb-1">
                          {getMarketName(market.id)}
                          {market.ha && (
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                              {market.ha}
                            </span>
                          )}
                        </h3>
                        <div className="text-xs lg:text-sm text-gray-500">Market #{market.id}</div>
                      </div>
                      
                      <div className="space-y-2 lg:space-y-3">
                        {market.o && Array.isArray(market.o) ? (
                          market.o.map((odd, oddIndex) => (
                            <button 
                              key={oddIndex} 
                              className={`w-full p-3 lg:p-4 rounded-xl transition-all duration-200 text-xs lg:text-sm font-bold border-2 ${
                                odd.bl === 1 
                                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' 
                                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white border-transparent shadow-lg hover:shadow-xl transform hover:scale-105'
                              }`}
                              disabled={odd.bl === 1}
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-left font-medium truncate">{odd.n}</span>
                                <span className="text-right text-lg lg:text-xl font-black">{odd.v}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-6 lg:py-8 text-gray-400 bg-gray-50 rounded-xl">
                            <div className="text-xl lg:text-2xl mb-2">⏳</div>
                            <div className="text-xs lg:text-sm">Loading odds...</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 lg:py-16 text-gray-500">
                  <div className="w-16 lg:w-20 h-16 lg:h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl lg:text-3xl">📊</span>
                  </div>
                  <h3 className="text-lg lg:text-xl font-semibold text-gray-700 mb-2">Loading Markets</h3>
                  <p className="text-sm lg:text-base text-gray-500 mb-4">Fetching the latest betting odds...</p>
                  <div className="w-6 lg:w-8 h-6 lg:h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Sidebar - Bet Slip */}
          <div className="hidden xl:block w-96 2xl:w-[28rem] bg-white border-l border-gray-200">
            {/* Action buttons and tabs at top */}
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <div className="flex items-center justify-center gap-4 text-xs mb-3">
                <button className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  <span>🔴</span>
                  Watch Live
                </button>
                <button className="text-gray-600 hover:text-gray-800 flex items-center gap-1">
                  <span>💰</span>
                  Cash Out
                </button>
              </div>
              
              {/* Navigation tabs */}
              <div className="flex items-center gap-1">
                <button 
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all flex-1 text-center ${
                    activeTab === 'stats' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveTab('stats')}
                >
                  📊 Statistics
                </button>
                <button 
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all flex-1 text-center ${
                    activeTab === 'tracker' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveTab('tracker')}
                >
                  ⚽ Live Tracker
                </button>
              </div>
            </div>
            
            {/* Tab Content Area */}
            <div className="p-4 lg:p-6">
              {/* Statistics content (when stats tab active) */}
              {activeTab === 'stats' && (
                <div className="mb-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      📊 Match Statistics
                    </div>
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Possession</span>
                          <span>65% - 35%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{width: '65%'}}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Shots</span>
                          <span>8 - 3</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{width: '72%'}}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Shots on Target</span>
                          <span>4 - 1</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{width: '80%'}}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="text-center">
                          <div className="font-bold">2</div>
                          <div className="text-gray-500">Corners</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold">1</div>
                          <div className="text-gray-500">Cards</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Live Tracker content (when tracker tab active) */}
              {activeTab === 'tracker' && (
                <div className="mb-6">
                  {/* Match Header */}
                  <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '1rem', borderRadius: '0.5rem 0.5rem 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{fullMatchData?.t1?.name || selectedMatch?.data?.t1?.name || 'AZ'}</span>
                      <span style={{ color: '#60a5fa', fontSize: '1.2rem', fontWeight: '700' }}>
                        {fullMatchData?.t1?.score ?? selectedMatch?.data?.t1?.score ?? '4'}
                      </span>
                    </div>
                    <div style={{ color: '#9ca3af' }}>-</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#60a5fa', fontSize: '1.2rem', fontWeight: '700' }}>
                        {fullMatchData?.t2?.score ?? selectedMatch?.data?.t2?.score ?? '1'}
                      </span>
                      <span>{fullMatchData?.t2?.name || selectedMatch?.data?.t2?.name || 'Heerenveen'}</span>
                    </div>
                  </div>

                  {/* Soccer Field Tracker */}
                  <div style={{ backgroundColor: '#000000', position: 'relative', borderRadius: '0 0 0.5rem 0.5rem', overflow: 'hidden' }}>
                    <svg viewBox="0 0 450 300" style={{ width: '100%', height: 'auto', minHeight: '250px', display: 'block' }}>
                      {/* Define realistic grass texture and effects */}
                      <defs>
                        {/* Grass texture pattern */}
                        <pattern id="grassTexture" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                          <rect width="20" height="20" fill="#2d5a3d"/>
                          <rect x="0" y="0" width="10" height="10" fill="#245132" opacity="0.8"/>
                          <rect x="10" y="10" width="10" height="10" fill="#245132" opacity="0.8"/>
                          <circle cx="5" cy="5" r="1" fill="#1f4529" opacity="0.6"/>
                          <circle cx="15" cy="15" r="1" fill="#1f4529" opacity="0.6"/>
                        </pattern>
                        
                        {/* Field lighting gradient */}
                        <radialGradient id="fieldLighting" cx="50%" cy="50%" r="70%">
                          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3"/>
                          <stop offset="70%" stopColor="#22c55e" stopOpacity="0.1"/>
                          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.2"/>
                        </radialGradient>

                        {/* Ball shadow filter */}
                        <filter id="ballShadow" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#000000" floodOpacity="0.3"/>
                        </filter>
                      </defs>

                      {/* Field Background with grass texture */}
                      <rect x="0" y="0" width="450" height="300" fill="url(#grassTexture)"/>
                      <rect x="0" y="0" width="450" height="300" fill="url(#fieldLighting)"/>
                      
                      {/* Field Border */}
                      <rect x="10" y="10" width="430" height="280" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      
                      {/* Center Line */}
                      <line x1="225" y1="10" x2="225" y2="290" stroke="#ffffff" strokeWidth="2"/>
                      
                      {/* Center Circle */}
                      <circle cx="225" cy="150" r="40" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      <circle cx="225" cy="150" r="2" fill="#ffffff"/>
                      
                      {/* Left Penalty Area */}
                      <rect x="10" y="80" width="55" height="140" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      
                      {/* Right Penalty Area */}
                      <rect x="385" y="80" width="55" height="140" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      
                      {/* Left Goal Area */}
                      <rect x="10" y="115" width="20" height="70" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      
                      {/* Right Goal Area */}
                      <rect x="420" y="115" width="20" height="70" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      
                      {/* Left Goal */}
                      <rect x="7" y="125" width="3" height="50" fill="#ffffff"/>
                      
                      {/* Right Goal */}
                      <rect x="440" y="125" width="3" height="50" fill="#ffffff"/>
                      
                      {/* Penalty Spots */}
                      <circle cx="37" cy="150" r="2" fill="#ffffff"/>
                      <circle cx="413" cy="150" r="2" fill="#ffffff"/>
                      
                      {/* Corner Arcs */}
                      <path d="M 10 10 A 8 8 0 0 1 18 10" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      <path d="M 432 10 A 8 8 0 0 0 440 10" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      <path d="M 10 290 A 8 8 0 0 0 18 290" fill="none" stroke="#ffffff" strokeWidth="2"/>
                      <path d="M 432 290 A 8 8 0 0 1 440 290" fill="none" stroke="#ffffff" strokeWidth="2"/>

                      {/* Match Time Display */}
                      <rect x="195" y="25" width="60" height="25" fill="#000000" fillOpacity="0.8" rx="4"/>
                      <text x="225" y="42" textAnchor="middle" fill="#00ff88" fontSize="14" fontWeight="bold" fontFamily="Arial">
                        {formatTime(fullMatchData?.time ?? selectedMatch?.data?.time) || '85:06'}
                      </text>
                      
                      {/* Ball Trail - using ballTrail state */}
                      {ballTrail.length > 1 && (
                        <g>
                          {ballTrail.map((pos, index) => {
                            if (index === 0) return null;
                            const prevPos = ballTrail[index - 1];
                            const opacity = Math.max(0.2, (index / ballTrail.length) * 0.8);
                            const prevX = 10 + (prevPos.x * 430);
                            const prevY = 10 + (prevPos.y * 280);
                            const currX = 10 + (pos.x * 430);
                            const currY = 10 + (pos.y * 280);
                            
                            return (
                              <line
                                key={`trail-${index}`}
                                x1={prevX}
                                y1={prevY}
                                x2={currX}
                                y2={currY}
                                stroke="#00ff88"
                                strokeWidth="3"
                                opacity={opacity}
                                strokeDasharray="3,2"
                              />
                            );
                          })}
                        </g>
                      )}

                      {/* Ball Position - using real xy coordinates from big_data */}
                      {(() => {
                        // Parse xy coordinates from big_data
                        let ballX = 295; // default position
                        let ballY = 120;
                        
                        if (fullMatchData?.xy) {
                          const coords = fullMatchData.xy.split(',');
                          if (coords.length === 2) {
                            const x = parseFloat(coords[0]); // 0-1 range
                            const y = parseFloat(coords[1]); // 0-1 range
                            
                            // Map to field dimensions (accounting for field borders)
                            // Field area: x=10 to x=440 (430px wide), y=10 to y=290 (280px tall)
                            ballX = 10 + (x * 430);
                            ballY = 10 + (y * 280);
                          }
                        }
                        
                        return (
                          <g transform={`translate(${ballX}, ${ballY})`}>
                            {/* Ball shadow */}
                            <ellipse cx="1" cy="8" rx="4" ry="2" fill="#000000" fillOpacity="0.3"/>
                            
                            {/* Ball */}
                            <circle 
                              cx="0" 
                              cy="0" 
                              r="5" 
                              fill="#ffffff" 
                              stroke="#000000" 
                              strokeWidth="1"
                              filter="url(#ballShadow)"
                            >
                              <animate attributeName="cy" values="0;-2;0" dur="0.8s" repeatCount="indefinite"/>
                            </circle>
                            
                            {/* Ball pattern */}
                            <path d="M-3,-2 L3,-2 M-2,-4 L2,0 M-2,4 L2,0" stroke="#000000" strokeWidth="0.5" fill="none"/>
                          </g>
                        );
                      })()}

                      {/* Live Event Indicator - using sc (state code) from big_data */}
                      {(() => {
                        // Get event name from sc code using match events dictionary
                        let eventName = 'In Possession';
                        let teamName = fullMatchData?.t2?.name || selectedMatch?.data?.t2?.name || 'Heerenveen';
                        
                        if (fullMatchData?.sc && matchEventsDictionaries[selectedSport]) {
                          const eventFromDict = matchEventsDictionaries[selectedSport][fullMatchData.sc];
                          if (eventFromDict) {
                            eventName = eventFromDict;
                            // If it's a specific event, show it without team name
                            if (eventName !== 'In Possession') {
                              teamName = '';
                            }
                          }
                        }
                        
                        return (
                          <g>
                            <rect x="320" y="60" width="110" height="30" fill="#000000" fillOpacity="0.8" rx="4"/>
                            <text x="375" y="78" textAnchor="middle" fill="#00ff88" fontSize="12" fontWeight="bold" fontFamily="Arial">
                              {teamName}
                            </text>
                            <text x="375" y="90" textAnchor="middle" fill="#00ff88" fontSize="10" fontFamily="Arial">
                              {eventName}
                            </text>
                          </g>
                        );
                      })()}

                      {/* Live Event Animation - pulsing circle for active events */}
                      {fullMatchData?.sc && (
                        (() => {
                          // Parse ball coordinates for event position
                          let eventX = 295;
                          let eventY = 120;
                          
                          if (fullMatchData?.xy) {
                            const coords = fullMatchData.xy.split(',');
                            if (coords.length === 2) {
                              const x = parseFloat(coords[0]);
                              const y = parseFloat(coords[1]);
                              eventX = 10 + (x * 430);
                              eventY = 10 + (y * 280);
                            }
                          }
                          
                          return (
                            <g>
                              <circle 
                                cx={eventX} 
                                cy={eventY} 
                                r="15" 
                                fill="none" 
                                stroke="#00ff88" 
                                strokeWidth="2"
                                opacity="0.7"
                              >
                                <animate attributeName="r" values="15;25;15" dur="2s" repeatCount="indefinite"/>
                                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite"/>
                              </circle>
                            </g>
                          );
                        })()
                      )}
                    </svg>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-100 rounded-xl p-6 text-center mb-6">
                <div className="text-gray-600 mb-3">
                  <div className="text-3xl mb-3">🎫</div>
                  <div className="font-bold text-lg">Bet Slip</div>
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  Click on odds to add selections
                </div>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-bold transition-colors">
                  Quick Bet
                </button>
              </div>
              
              {/* Live Updates */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 text-white mb-4">
                <div className="text-sm font-medium mb-2">🔴 Live Updates</div>
                <div className="text-xs mb-3">Get real-time notifications for this match</div>
                <button className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium">
                  Enable Alerts
                </button>
              </div>
              
              {/* Match Insights */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700 mb-3">📈 Match Insights</div>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Bets placed:</span>
                    <span className="font-medium">2,847</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Most backed:</span>
                    <span className="font-medium text-green-600">Home Win</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biggest bet:</span>
                    <span className="font-medium">£5,420</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Live bettors:</span>
                    <span className="font-medium text-red-600">1,203</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchDetailPageNew;