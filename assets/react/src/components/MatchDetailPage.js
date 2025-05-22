import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Socket } from 'phoenix';

function MatchDetailPage() {
  const { sport: selectedSport, matchId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [sports, setSports] = useState([]);
  const [allMatches, setAllMatches] = useState({});
  const [expandedSports, setExpandedSports] = useState(new Set([selectedSport]));

  // Ensure selected sport is always expanded
  useEffect(() => {
    if (selectedSport && !expandedSports.has(selectedSport)) {
      setExpandedSports(new Set([selectedSport]));
    }
  }, [selectedSport, expandedSports]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [fullMatchData, setFullMatchData] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');
  
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

    // Clean up subscriptions for sports that are no longer expanded
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

  // Subscribe to detailed match data for selected match
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
      setFullMatchData(payload.data);
    });

    detailChannelRef.current = detailChannel;

    return () => {
      if (detailChannel) {
        detailChannel.leave();
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

    // Update selected match if it's the one being updated
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

  const handleSportToggle = (sport) => {
    console.log('🔥 handleSportToggle called with:', sport);
    console.log('🔥 Current expandedSports:', Array.from(expandedSports));
    setExpandedSports(prev => {
      console.log('🔥 Previous expanded sports:', Array.from(prev));
      const newSet = new Set();
      // If sport is not currently expanded, expand it (and collapse others)
      if (!prev.has(sport)) {
        newSet.add(sport);
        console.log('🔥 Expanding sport:', sport);
      } else {
        console.log('🔥 Collapsing sport:', sport);
      }
      console.log('🔥 New expanded sports will be:', Array.from(newSet));
      // If sport is already expanded, clicking it will collapse it (empty set)
      return newSet;
    });
  };

  const handleMatchSelect = (sport, matchId) => {
    navigate(`/match/${sport}/${matchId}`);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatSportName = (sport) => {
    const sportNames = {
      soccer: '⚽ Soccer',
      basket: '🏀 Basketball', 
      tennis: '🎾 Tennis',
      baseball: '⚾ Baseball',
      amfootball: '🏈 American Football',
      hockey: '🏒 Hockey',
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

  if (!selectedMatch) {
    return (
      <div className="match-detail-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading match details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="match-detail-page">
      {/* Left Sidebar - Sports Menu */}
      <aside className="sports-sidebar">
        <div className="sidebar-header">
          <button 
            className="back-button"
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
        </div>
        
        <div className="new-sports-menu">
          {sports.map(sport => {
            const isExpanded = expandedSports.has(sport.name);
            return (
              <div key={sport.name} className={`sport-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
                <div 
                  className="sport-header"
                  onClick={() => {
                    console.log('🔥 NEW MENU - Clicked sport:', sport.name);
                    const newExpanded = new Set();
                    if (!isExpanded) {
                      newExpanded.add(sport.name);
                    }
                    setExpandedSports(newExpanded);
                  }}
                >
                  <div className="sport-info">
                    <h3 className="sport-title">{formatSportName(sport.name)}</h3>
                    <span className="sport-badge">{sport.match_count} matches</span>
                  </div>
                  <div className="expand-arrow">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
                
                {isExpanded && allMatches[sport.name] && (
                  <div className="sport-matches">
                    {allMatches[sport.name].map((league, leagueIndex) => (
                      <div key={leagueIndex} className="league-container">
                        <div className="league-title">{league.league}</div>
                        <div className="match-grid">
                          {league.matches.map(match => (
                            <div
                              key={match.id}
                              className={`match-row ${match.id === matchId ? 'active' : ''}`}
                              onClick={() => handleMatchSelect(sport.name, match.id)}
                            >
                              <div className="match-header-mini">
                                <span className="match-time-mini">{formatTime(match.data?.time)}</span>
                              </div>
                              <div className="teams-mini">
                                <div className="team-row">
                                  <span className="team-name-mini">{match.data?.t1?.name || 'Team 1'}</span>
                                  <span className="team-score-mini">{match.data?.t1?.score || 0}</span>
                                </div>
                                <div className="team-row">
                                  <span className="team-name-mini">{match.data?.t2?.name || 'Team 2'}</span>
                                  <span className="team-score-mini">{match.data?.t2?.score || 0}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Sticky Header */}
        <header className="match-header sticky">
          <div className="match-info">
            <div className="teams">
              <span className="team-name">{fullMatchData?.t1?.name || selectedMatch.data?.t1?.name || 'Team 1'}</span>
              <span className="vs">vs</span>
              <span className="team-name">{fullMatchData?.t2?.name || selectedMatch.data?.t2?.name || 'Team 2'}</span>
            </div>
            <div className="score">{getScore(fullMatchData || selectedMatch.data)}</div>
            <div className="match-time">{formatTime(fullMatchData?.time || selectedMatch.data?.time)}</div>
          </div>
          <div className="connection-status" style={{ color: connectionStatus === 'connected' ? '#10B981' : '#EF4444' }}>
            ● {connectionStatus}
          </div>
        </header>

        {/* Markets and Odds */}
        <section className="markets-section">
          <div className="markets-container">
            {fullMatchData?.odds && Array.isArray(fullMatchData.odds) ? (
              <div className="markets-grid">
                {fullMatchData.odds.map((market, index) => (
                  <div key={index} className="market-card">
                    <div className="market-header">
                      <h5 className="market-name">
                        {getMarketName(market.id)}
                        {market.ha && <span className="handicap">({market.ha})</span>}
                      </h5>
                    </div>
                    <div className="odds-list">
                      {market.o && Array.isArray(market.o) ? (
                        market.o.map((odd, oddIndex) => (
                          <button 
                            key={oddIndex} 
                            className="odd-button"
                            disabled={odd.bl === 1}
                          >
                            <span className="odd-name">{odd.n}</span>
                            <span className="odd-value">{odd.v}</span>
                          </button>
                        ))
                      ) : (
                        <div className="no-odds">No odds available</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="loading-markets">Loading markets...</div>
            )}
          </div>
        </section>
      </main>

      {/* Right Sidebar - Match Tracker and Stats */}
      <aside className="match-tracker">
        {/* Match Tracker Placeholder */}
        <div className="tracker-section">
          <h3>Match Tracker</h3>
          <div className="tracker-placeholder">
            <p>Match tracker will be implemented here</p>
          </div>
        </div>

        {/* Stats/Timeline Filter */}
        <div className="stats-section">
          <nav className="stats-nav">
            <button 
              className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Stats
            </button>
            <button 
              className={`nav-tab ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </nav>
          
          <div className="stats-content">
            {activeTab === 'stats' ? (
              <div className="stats-data">
                <p>Match statistics will be displayed here</p>
              </div>
            ) : (
              <div className="timeline-data">
                <p>Match timeline will be displayed here</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default MatchDetailPage;