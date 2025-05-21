import React from 'react';

function SportFilter({ sports, selectedSport, onSportChange }) {
  const formatSportName = (sport) => {
    const sportNames = {
      soccer: '⚽ Soccer',
      basket: '🏀 Basketball', 
      tennis: '🎾 Tennis',
      baseball: '⚾ Baseball',
      amfootball: '🏈 Am. Football',
      hockey: '🏒 Hockey',
      volleyball: '🏐 Volleyball'
    };
    return sportNames[sport] || sport;
  };

  return (
    <div className="sport-filter">
      <h2>Select Sport</h2>
      <div className="sport-buttons">
        {sports.map(sport => (
          <button
            key={sport.name}
            className={`sport-button ${selectedSport === sport.name ? 'active' : ''}`}
            onClick={() => onSportChange(sport.name)}
          >
            {formatSportName(sport.name)}
            <span className="badge">{sport.match_count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SportFilter;