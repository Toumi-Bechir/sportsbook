import React, { useState } from 'react';
import MatchCard from './MatchCard';

function MatchesList({ 
  sport, 
  matches, 
  formatTime, 
  expandedMatch, 
  onToggleMatch, 
  fullMatchData,
  marketDictionary,
  matchEventsDictionary 
}) {
  const [viewMode, setViewMode] = useState('compact');
  const [sortBy, setSortBy] = useState('time');
  const [filterLive, setFilterLive] = useState(false);

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

  const getTotalMatches = () => {
    return matches.reduce((total, league) => total + league.matches.length, 0);
  };

  const getLiveMatches = () => {
    return matches.reduce((total, league) => 
      total + league.matches.filter(m => m.data?.time > 0).length, 0
    );
  };

  const getPreMatchCount = () => {
    return getTotalMatches() - getLiveMatches();
  };

  const getFilteredMatches = () => {
    let filteredMatches = [...matches];
    
    if (filterLive) {
      filteredMatches = filteredMatches.map(league => ({
        ...league,
        matches: league.matches.filter(m => m.data?.time > 0)
      })).filter(league => league.matches.length > 0);
    }

    filteredMatches = filteredMatches.map(league => ({
      ...league,
      matches: [...league.matches].sort((a, b) => {
        switch (sortBy) {
          case 'live':
            return (b.data?.time || 0) - (a.data?.time || 0);
          case 'time':
            return (a.data?.time || 0) - (b.data?.time || 0);
          default:
            return 0;
        }
      })
    }));

    return filteredMatches;
  };

  const getSportIcon = () => {
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

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700">
        {/* Modern header */}
        <div className="bg-gray-800 p-6 rounded-t-lg border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 rounded-xl">
                <span className="text-2xl">{getSportIcon()}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{formatSportName(sport)}</h2>
                <div className="text-gray-400">Live & Pre-Match Events</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">Total Events</div>
              <div className="text-3xl font-bold text-blue-400">0</div>
            </div>
          </div>
        </div>
        
        <div className="p-16 text-center bg-gray-900">
          <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 max-w-md mx-auto">
            <div className="text-6xl mb-6">{getSportIcon()}</div>
            <h3 className="text-xl font-bold text-white mb-2">No events available</h3>
            <p className="text-gray-400 mb-6">We're currently updating {formatSportName(sport)} fixtures</p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Auto-refresh enabled
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live data feed active
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredMatches = getFilteredMatches();

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700">
      {/* Modern header */}
      <div className="bg-gray-800 rounded-t-lg border-b border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 rounded-xl">
                <span className="text-3xl">{getSportIcon()}</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">{formatSportName(sport)}</h2>
                <div className="text-gray-400">Live & Pre-Match Betting</div>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Live Now</div>
                <div className="text-2xl font-bold text-red-400">{getLiveMatches()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Pre-Match</div>
                <div className="text-2xl font-bold text-blue-400">{getPreMatchCount()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total</div>
                <div className="text-2xl font-bold text-white">{getTotalMatches()}</div>
              </div>
            </div>
          </div>
          
          {/* Modern controls */}
          <div className="flex items-center justify-between border-t border-gray-700 pt-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
                <button
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    !filterLive 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                  onClick={() => setFilterLive(false)}
                >
                  All Events
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    filterLive 
                      ? 'bg-red-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                  onClick={() => setFilterLive(true)}
                >
                  🔴 Live Only
                </button>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <span className="font-medium">Sort by:</span>
                <select 
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="time">Kick-off Time</option>
                  <option value="live">Live First</option>
                  <option value="league">League</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>Live odds updating</span>
              </div>
              
              {expandedMatch && (
                <div className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-bold animate-pulse shadow-lg">
                  TRACKING: {expandedMatch}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Modern betting headers */}
        <div className="bg-gray-750 border-t border-gray-700">
          <div className="px-6 py-3">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
              <div className="w-16 text-center">Time</div>
              <div className="flex-1 ml-4">Match</div>
              <div className="w-80 text-center">Quick Bets</div>
              <div className="w-12 text-center">More</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modern matches content */}
      <div className="bg-gray-900">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 max-w-md mx-auto">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-white mb-2">No matches found</h3>
              <p className="text-gray-400">Try adjusting your filters or check back later</p>
            </div>
          </div>
        ) : (
          filteredMatches.map((league, index) => (
            <div key={index} className="mb-2">
              {/* Modern league header */}
              <div className="bg-gray-800 border border-gray-700 border-b-0 px-6 py-4 border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg text-white">{league.league}</h3>
                    <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                      {league.matches.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      <span className="text-red-400 font-bold">
                        {league.matches.filter(m => m.data?.time > 0).length} Live
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-blue-400 font-bold">
                        {league.matches.filter(m => !m.data?.time || m.data.time === 0).length} Pre-Match
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              
              {/* League matches with modern styling */}
              <div className="bg-gray-900 border border-gray-700 border-t-0 rounded-b-lg border-l-4 border-l-gray-600">
                {league.matches.map((match, matchIndex) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    sport={sport}
                    formatTime={formatTime}
                    isExpanded={expandedMatch === match.id}
                    onToggle={() => onToggleMatch(match.id)}
                    fullMatchData={expandedMatch === match.id ? fullMatchData[match.id] : null}
                    marketDictionary={marketDictionary}
                    matchEventsDictionary={matchEventsDictionary}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Modern footer */}
      {filteredMatches.length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 rounded-b-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-8 text-gray-300">
              <span className="font-medium">
                Showing <span className="text-white font-bold">{filteredMatches.reduce((total, league) => total + league.matches.length, 0)}</span> of <span className="text-white font-bold">{getTotalMatches()}</span> events
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="font-medium">Real-time odds</span>
              </span>
              <span className="text-green-400 font-bold flex items-center gap-1">
                <span>💰</span>
                Best odds guaranteed
              </span>
              <span className="text-orange-400 font-bold flex items-center gap-1">
                <span>⚡</span>
                Cash out available
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-gray-300">
              <span className="flex items-center gap-1">
                <span>📱</span>
                Mobile optimized
              </span>
              <span className="text-green-400 font-bold flex items-center gap-1">
                <span>🔒</span>
                Secure betting
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchesList;