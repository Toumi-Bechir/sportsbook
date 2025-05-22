import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'phoenix';
import SportFilter from './components/SportFilter';
import MatchesList from './components/MatchesList';
import './App.css';

function App() {
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🏆 Sportsbook Live</h1>
          <div className="header-info">
            <div 
              className="connection-status"
              style={{ color: getConnectionStatusColor() }}
            >
              ● {connectionStatus}
            </div>
            <div className="subscriptions-count">
              📡 {matchChannelsRef.current.size} match subscriptions
            </div>
            {expandedMatch && (
              <div className="detail-subscription">
                🔍 Details: {expandedMatch}
              </div>
            )}
            <div className="last-update">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <SportFilter
            sports={sports}
            selectedSport={selectedSport}
            onSportChange={setSelectedSport}
          />
          
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
      </main>
    </div>
  );
}

export default App;