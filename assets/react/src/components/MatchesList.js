import React from 'react';
import MatchCard from './MatchCard';

function MatchesList({ 
  sport, 
  matches, 
  formatTime, 
  expandedMatch, 
  onToggleMatch, 
  fullMatchData 
}) {
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

  if (!matches || matches.length === 0) {
    return (
      <div className="matches-container">
        <div className="matches-header">
          <h2>{formatSportName(sport)} Matches</h2>
        </div>
        <div className="no-matches">
          <p>No live matches available for {formatSportName(sport)} at the moment.</p>
          <p>Check back later for updates!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matches-container">
      <div className="matches-header">
        <h2>{formatSportName(sport)} Matches</h2>
        {expandedMatch && (
          <div className="expanded-indicator">
            📊 Showing detailed view for match {expandedMatch}
          </div>
        )}
      </div>
      
      {matches.map((league, index) => (
        <div key={index} className="league-section">
          <div className="league-header">
            {league.league} ({league.matches.length} matches)
          </div>
          <div className="matches-grid">
            {league.matches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                sport={sport}
                formatTime={formatTime}
                isExpanded={expandedMatch === match.id}
                onToggle={() => onToggleMatch(match.id)}
                fullMatchData={expandedMatch === match.id ? fullMatchData[match.id] : null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MatchesList;