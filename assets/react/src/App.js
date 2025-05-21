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
  
  // Keep track of active match subscriptions
  const matchChannelsRef = useRef(new Map());

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
              📡 {matchChannelsRef.current.size} active subscriptions
            </div>
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
          />
        </div>
      </main>
    </div>
  );
}

export default App;