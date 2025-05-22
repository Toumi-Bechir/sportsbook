import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Socket } from 'phoenix';
import './MatchDetailPageNew.css';

function MatchDetailPageNew() {
  const { sport: selectedSport, matchId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [allMatches, setAllMatches] = useState({});
  const [sports, setSports] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [fullMatchData, setFullMatchData] = useState(null);
  const [expandedSports, setExpandedSports] = useState(new Set([selectedSport]));
  const [marketDictionaries, setMarketDictionaries] = useState({});
  const [matchEventsDictionaries, setMatchEventsDictionaries] = useState({});
  const [matchEvents, setMatchEvents] = useState([]);
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 50 });
  const [ballPath, setBallPath] = useState([]);
  
  // Refs
  const matchChannelsRef = useRef(new Map());
  const detailChannelRef = useRef(null);
  const subscribedMatches = useRef(new Set());

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = new Socket('/socket', {
      params: { userToken: 'anonymous' }
    });

    newSocket.connect();

    newSocket.onOpen(() => {
      console.log('✅ WebSocket connected');
      setConnectionStatus('connected');
    });

    newSocket.onError((error) => {
      console.log('❌ WebSocket error:', error);
      setConnectionStatus('error');
    });

    newSocket.onClose(() => {
      console.log('🔌 WebSocket disconnected');
      setConnectionStatus('disconnected');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Fetch sports and matches data
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔄 Fetching sports data...');
        const response = await fetch('/api/sports');
        const data = await response.json();
        console.log('📊 Received sports data:', JSON.stringify(data, null, 2));
        
        // Handle different possible data structures
        if (data.sports && Array.isArray(data.sports)) {
          // Structure: { sports: [{ name: "soccer", matches: [...] }] }
          setSports(data.sports);
          
          const matchesData = {};
          data.sports.forEach(sport => {
            if (sport.matches && Array.isArray(sport.matches)) {
              matchesData[sport.name] = sport.matches;
            }
          });
          
          console.log('📊 Method 1 - Processed matches data:', JSON.stringify(matchesData, null, 2));
          setAllMatches(matchesData);
        } else if (data.matches) {
          // Structure: { sports: [...], matches: { soccer: [...] } }
          setSports(data.sports || []);
          console.log('📊 Method 2 - Direct matches data:', JSON.stringify(data.matches, null, 2));
          setAllMatches(data.matches);
        } else {
          // Try to extract from the data object directly
          console.log('📊 Method 3 - Trying direct extraction');
          const possibleSports = Object.keys(data).filter(key => 
            Array.isArray(data[key]) && data[key].length > 0 && data[key][0].league
          );
          
          if (possibleSports.length > 0) {
            const sportsArray = possibleSports.map(sportName => ({
              name: sportName,
              match_count: data[sportName].reduce((total, league) => total + league.matches.length, 0),
              matches: data[sportName]
            }));
            
            const matchesData = {};
            possibleSports.forEach(sportName => {
              matchesData[sportName] = data[sportName];
            });
            
            console.log('📊 Method 3 - Extracted sports:', JSON.stringify(sportsArray, null, 2));
            console.log('📊 Method 3 - Extracted matches:', JSON.stringify(matchesData, null, 2));
            
            setSports(sportsArray);
            setAllMatches(matchesData);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching sports data:', error);
      }
    };

    fetchData();
  }, []);

  // Fetch dictionaries for selected sport
  useEffect(() => {
    if (selectedSport) {
      fetchDictionaries(selectedSport);
    }
  }, [selectedSport]);

  // Subscribe to match updates
  useEffect(() => {
    if (!socket || !allMatches[selectedSport]) return;

    // Subscribe to all matches of the selected sport
    allMatches[selectedSport].forEach(league => {
      league.matches.forEach(match => {
        subscribeToMatch(selectedSport, match.id);
      });
    });

    return () => {
      // Cleanup subscriptions
      matchChannelsRef.current.forEach(channel => {
        channel.leave();
      });
      matchChannelsRef.current.clear();
      subscribedMatches.current.clear();
    };
  }, [socket, allMatches, selectedSport]);

  // Subscribe to detailed match data
  useEffect(() => {
    if (!socket || !selectedSport || !matchId) return;

    const detailChannel = socket.channel(`match_details:${selectedSport}:${matchId}`, {});

    detailChannel.join()
      .receive('ok', () => {
        console.log(`✅ Subscribed to detailed match data: ${selectedSport}:${matchId}`);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to detailed match data:`, resp);
      });

    detailChannel.on('match_detail_update', payload => {
      console.log('📊 Received detailed match data:', payload);
      setFullMatchData(payload.data);
      
      // Extract match events for tracker
      if (payload.data?.events) {
        setMatchEvents(payload.data.events);
      }
      
      // Extract ball position if available
      if (payload.data?.ball_position) {
        const newPos = { x: payload.data.ball_position.x, y: payload.data.ball_position.y };
        setBallPosition(newPos);
        setBallPath(prev => [...prev.slice(-10), newPos]); // Keep last 10 positions
      }
    });

    detailChannelRef.current = detailChannel;

    return () => {
      if (detailChannel) {
        detailChannel.leave();
      }
    };
  }, [socket, selectedSport, matchId]);

  // Find and set selected match
  useEffect(() => {
    if (allMatches[selectedSport] && matchId) {
      const match = findMatchById(selectedSport, matchId);
      if (match) {
        setSelectedMatch(match);
        // Ensure selected sport is expanded
        setExpandedSports(prev => new Set([...prev, selectedSport]));
      }
    }
  }, [allMatches, selectedSport, matchId]);

  const fetchDictionaries = async (sport) => {
    try {
      const response = await fetch(`/api/markets/${sport}`);
      const data = await response.json();
      
      if (data.markets) {
        const marketMap = {};
        data.markets.forEach(market => {
          marketMap[market.id] = market.name;
        });
        setMarketDictionaries(prev => ({ ...prev, [sport]: marketMap }));
      }

      if (data.match_events) {
        const eventsMap = {};
        data.match_events.forEach(event => {
          eventsMap[event.id] = event.name;
        });
        setMatchEventsDictionaries(prev => ({ ...prev, [sport]: eventsMap }));
      }
    } catch (error) {
      console.error('Error fetching dictionaries:', error);
    }
  };

  const subscribeToMatch = (sport, matchId) => {
    if (!socket) return;
    
    const channelKey = `${sport}:${matchId}`;
    if (subscribedMatches.current.has(channelKey)) return;

    const matchChannel = socket.channel(`match:${sport}:${matchId}`, {});
    
    matchChannel.join()
      .receive('ok', () => {
        console.log(`✅ Subscribed to match: ${sport}:${matchId}`);
        subscribedMatches.current.add(channelKey);
      })
      .receive('error', resp => {
        console.log(`❌ Failed to subscribe to match:`, resp);
      });

    matchChannel.on('match_update', payload => {
      updateMatchData(sport, matchId, payload.data);
    });

    matchChannelsRef.current.set(channelKey, matchChannel);
  };

  const updateMatchData = (sport, matchId, newData) => {
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

  const handleSportToggle = (sportName) => {
    setExpandedSports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sportName)) {
        newSet.delete(sportName);
      } else {
        newSet.add(sportName);
      }
      return newSet;
    });
  };

  const handleMatchSelect = (sport, matchId) => {
    navigate(`/match/${sport}/${matchId}`);
  };

  const getMarketName = (marketId) => {
    return marketDictionaries[selectedSport]?.[marketId] || `Market ${marketId}`;
  };

  const getEventName = (eventId) => {
    return matchEventsDictionaries[selectedSport]?.[eventId] || `Event ${eventId}`;
  };

  const formatSportName = (sport) => {
    return sport.charAt(0).toUpperCase() + sport.slice(1);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getScore = (matchData) => {
    if (!matchData) return '0 - 0';
    const score1 = matchData.t1?.score || 0;
    const score2 = matchData.t2?.score || 0;
    return `${score1} - ${score2}`;
  };

  // Debug logging
  console.log('🔍 Debug Info:', {
    selectedSport,
    matchId,
    selectedMatch,
    allMatches: Object.keys(allMatches),
    sports: sports.length
  });

  if (!selectedMatch && sports.length > 0 && Object.keys(allMatches).length > 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Match not found: {selectedSport}:{matchId}</p>
        <p>Available sports: {Object.keys(allMatches).join(', ')}</p>
        <button onClick={() => navigate('/')}>← Back to Home</button>
      </div>
    );
  }

  if (!selectedMatch) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading match data...</p>
        <p>Sport: {selectedSport}, Match: {matchId}</p>
        <button onClick={() => navigate('/')}>← Back to Home</button>
      </div>
    );
  }

  return (
    <div className="match-detail-page-new">
      {/* Left Sidebar - Sports and Matches */}
      <aside className="left-sidebar">
        <div className="sidebar-header">
          <button 
            className="back-button"
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
        </div>
        
        <div className="sports-list">
          {sports.map(sport => (
            <div key={sport.name} className="sport-item">
              <div 
                className={`sport-header ${expandedSports.has(sport.name) ? 'expanded' : ''}`}
                onClick={() => handleSportToggle(sport.name)}
              >
                <span className="sport-name">{formatSportName(sport.name)}</span>
                <span className="match-count">{sport.match_count}</span>
                <span className="toggle-arrow">
                  {expandedSports.has(sport.name) ? '▼' : '▶'}
                </span>
              </div>
              
              {expandedSports.has(sport.name) && allMatches[sport.name] && (
                <div className="matches-container">
                  {allMatches[sport.name].map((league, leagueIndex) => (
                    <div key={leagueIndex} className="league-section">
                      <div className="league-header">{league.league}</div>
                      {league.matches.map(match => (
                        <div
                          key={match.id}
                          className={`match-item ${match.id === matchId ? 'selected' : ''}`}
                          onClick={() => handleMatchSelect(sport.name, match.id)}
                        >
                          <div className="match-teams">
                            <div className="team-name">{match.data?.t1?.name || 'Team 1'}</div>
                            <div className="vs">vs</div>
                            <div className="team-name">{match.data?.t2?.name || 'Team 2'}</div>
                          </div>
                          <div className="match-score">{getScore(match.data)}</div>
                          <div className="match-time">{formatTime(match.data?.time)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content - Match Details */}
      <main className="main-section">
        <div className="match-header">
          <div className="teams-info">
            <div className="team">
              <h2 className="team-name">{fullMatchData?.t1?.name || selectedMatch.data?.t1?.name || 'Team 1'}</h2>
              <div className="team-score">{fullMatchData?.t1?.score || selectedMatch.data?.t1?.score || 0}</div>
            </div>
            <div className="match-status">
              <div className="match-time">{formatTime(fullMatchData?.time || selectedMatch.data?.time)}</div>
              <div className="vs">VS</div>
            </div>
            <div className="team">
              <div className="team-score">{fullMatchData?.t2?.score || selectedMatch.data?.t2?.score || 0}</div>
              <h2 className="team-name">{fullMatchData?.t2?.name || selectedMatch.data?.t2?.name || 'Team 2'}</h2>
            </div>
          </div>
        </div>

        <div className="markets-section">
          {fullMatchData?.odds && Array.isArray(fullMatchData.odds) ? (
            <div className="markets-grid">
              {fullMatchData.odds.map((market, index) => (
                <div key={index} className="market-card">
                  <div className="market-header">
                    <h3 className="market-name">
                      {getMarketName(market.id)}
                      {market.ha && <span className="handicap">({market.ha})</span>}
                    </h3>
                  </div>
                  <div className="odds-grid">
                    {market.o && Array.isArray(market.o) ? (
                      market.o.map((odd, oddIndex) => (
                        <button 
                          key={oddIndex} 
                          className={`odd-button ${odd.bl === 1 ? 'blocked' : ''}`}
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
            <div className="loading-markets">
              <div className="loading-spinner"></div>
              <p>Loading match markets...</p>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar - Live Match Tracker */}
      <aside className="right-sidebar">
        <div className="tracker-header">
          <h3>Live Match Tracker</h3>
          <div className={`connection-indicator ${connectionStatus}`}>
            ● {connectionStatus}
          </div>
        </div>
        
        <div className="match-field">
          <svg className="field-svg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
            {/* Football Field */}
            <rect x="0" y="0" width="400" height="300" fill="#4ade80" stroke="#ffffff" strokeWidth="2"/>
            
            {/* Center Line */}
            <line x1="200" y1="0" x2="200" y2="300" stroke="#ffffff" strokeWidth="2"/>
            
            {/* Center Circle */}
            <circle cx="200" cy="150" r="50" fill="none" stroke="#ffffff" strokeWidth="2"/>
            
            {/* Penalty Areas */}
            <rect x="0" y="75" width="60" height="150" fill="none" stroke="#ffffff" strokeWidth="2"/>
            <rect x="340" y="75" width="60" height="150" fill="none" stroke="#ffffff" strokeWidth="2"/>
            
            {/* Goal Areas */}
            <rect x="0" y="112.5" width="20" height="75" fill="none" stroke="#ffffff" strokeWidth="2"/>
            <rect x="380" y="112.5" width="20" height="75" fill="none" stroke="#ffffff" strokeWidth="2"/>
            
            {/* Corner Arcs */}
            <path d="M 0 0 A 10 10 0 0 1 10 0" fill="none" stroke="#ffffff" strokeWidth="2"/>
            <path d="M 390 0 A 10 10 0 0 0 400 0" fill="none" stroke="#ffffff" strokeWidth="2"/>
            <path d="M 0 300 A 10 10 0 0 0 10 300" fill="none" stroke="#ffffff" strokeWidth="2"/>
            <path d="M 390 300 A 10 10 0 0 1 400 300" fill="none" stroke="#ffffff" strokeWidth="2"/>
            
            {/* Ball Path */}
            {ballPath.length > 1 && (
              <g>
                {ballPath.map((pos, index) => {
                  if (index === 0) return null;
                  const prevPos = ballPath[index - 1];
                  return (
                    <line
                      key={index}
                      x1={prevPos.x * 4}
                      y1={prevPos.y * 3}
                      x2={pos.x * 4}
                      y2={pos.y * 3}
                      stroke="#fbbf24"
                      strokeWidth="2"
                      opacity={0.7}
                    />
                  );
                })}
              </g>
            )}
            
            {/* Ball Position */}
            <circle 
              cx={ballPosition.x * 4} 
              cy={ballPosition.y * 3} 
              r="6" 
              fill="#fbbf24" 
              stroke="#ffffff" 
              strokeWidth="2"
            >
              <animate attributeName="r" values="6;8;6" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>

        <div className="match-events">
          <h4>Match Events</h4>
          <div className="events-list">
            {matchEvents.slice(-10).map((event, index) => (
              <div key={index} className={`event-item ${event.type}`}>
                <div className="event-time">{formatTime(event.time)}</div>
                <div className="event-description">
                  <span className="event-icon">{getEventIcon(event.type)}</span>
                  <span className="event-text">{getEventName(event.type)}</span>
                  {event.player && <span className="event-player">{event.player}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="match-stats">
          <h4>Live Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Possession</span>
              <div className="stat-bar">
                <div className="stat-fill" style={{width: `${fullMatchData?.stats?.possession || 50}%`}}></div>
              </div>
              <span className="stat-value">{fullMatchData?.stats?.possession || 50}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Shots</span>
              <span className="stat-value">{fullMatchData?.stats?.shots || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Corners</span>
              <span className="stat-value">{fullMatchData?.stats?.corners || 0}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function getEventIcon(eventType) {
  const icons = {
    'goal': '⚽',
    'yellow_card': '🟡',
    'red_card': '🟥',
    'corner': '🚩',
    'attack': '⚡',
    'dangerous_attack': '🔥',
    'throw_in': '🤾',
    'goal_kick': '🥅',
    'free_kick': '🦶',
    'penalty': '🥅',
    'substitution': '🔄'
  };
  return icons[eventType] || '●';
}

export default MatchDetailPageNew;