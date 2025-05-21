import React, { useState, useEffect } from 'react';
import { Socket } from 'phoenix';
import SportFilter from './components/SportFilter';
import MatchesList from './components/MatchesList';
import './App.css';

function App() {
  const [selectedSport, setSelectedSport] = useState('soccer');
  const [sports, setSports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [socket, setSocket] = useState(null);
  const [channel, setChannel] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(new Date());

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

  // Handle sport selection changes
  useEffect(() => {
    if (!socket || !selectedSport) return;

    // Leave previous channel if exists
    if (channel) {
      channel.leave();
    }

    // Join new sport channel
    const newChannel = socket.channel(`matches:${selectedSport}`, {});

    newChannel.join()
      .receive('ok', resp => {
        console.log(`Joined matches:${selectedSport} successfully`, resp);
      })
      .receive('error', resp => {
        console.log(`Unable to join matches:${selectedSport}`, resp);
      });

    // Handle initial matches data
    newChannel.on('initial_matches', payload => {
      console.log('Received initial matches:', payload);
      setMatches(payload.matches || []);
      setLastUpdate(new Date());
    });

    // Handle match updates
    newChannel.on('matches_updated', payload => {
      console.log('Matches updated:', payload);
      setMatches(payload.matches || []);
      setLastUpdate(new Date());
    });

    // Handle individual match removals
    newChannel.on('match_removed', payload => {
      console.log('Match removed:', payload);
      setLastUpdate(new Date());
    });

    setChannel(newChannel);

    // Subscribe to individual match updates for real-time data
    matches.forEach(league => {
      league.matches.forEach(match => {
        const matchChannel = socket.channel(`match:${selectedSport}:${match.id}`, {});
        
        matchChannel.join()
          .receive('ok', () => {
            console.log(`Subscribed to match ${match.id}`);
          });

        matchChannel.on('match_update', payload => {
          console.log(`Match ${match.id} updated:`, payload);
          // Update specific match in the matches array
          setMatches(prevMatches => 
            prevMatches.map(league => ({
              ...league,
              matches: league.matches.map(m => 
                m.id === match.id ? { ...m, data: payload.data } : m
              )
            }))
          );
          setLastUpdate(new Date());
        });
      });
    });

    // Cleanup
    return () => {
      if (newChannel) {
        newChannel.leave();
      }
    };
  }, [socket, selectedSport]);

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