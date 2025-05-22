import React from 'react';
import { useNavigate } from 'react-router-dom';

function MatchCard({ 
  match, 
  sport, 
  formatTime, 
  isExpanded, 
  onToggle, 
  fullMatchData,
  marketDictionary,
  matchEventsDictionary 
}) {
  const { data } = match;
  const navigate = useNavigate();

  const getScore = () => {
    if (!data) return '0-0';
    
    switch (sport) {
      case 'soccer':
      case 'basket':
      case 'amfootball':
      case 'hockey':
        return `${data.t1?.score || 0}-${data.t2?.score || 0}`;
      
      case 'tennis':
        if (data.t1?.sets && data.t2?.sets) {
          const sets1 = data.t1.sets.length || 0;
          const sets2 = data.t2.sets.length || 0;
          return `Sets: ${sets1}-${sets2}`;
        }
        return '0-0';
      
      case 'baseball':
        if (data.t1?.innings && data.t2?.innings) {
          const score1 = data.t1.innings.reduce((a, b) => a + (b || 0), 0);
          const score2 = data.t2.innings.reduce((a, b) => a + (b || 0), 0);
          return `${score1}-${score2}`;
        }
        return '0-0';
      
      case 'volleyball':
        if (data.t1?.sets && data.t2?.sets) {
          const sets1 = data.t1.sets.filter(s => s > 0).length;
          const sets2 = data.t2.sets.filter(s => s > 0).length;
          return `Sets: ${sets1}-${sets2}`;
        }
        return '0-0';
      
      default:
        return '0-0';
    }
  };

  const getPeriod = () => {
    if (!data?.period) return 'Unknown';
    
    switch (sport) {
      case 'soccer':
        switch (data.period) {
          case 1: return '1st Half';
          case 2: return '2nd Half';
          case 3: return 'Extra Time';
          case 4: return 'Penalties';
          default: return `Period ${data.period}`;
        }
      
      case 'basket':
      case 'amfootball':
        switch (data.period) {
          case 1: return '1st Quarter';
          case 2: return '2nd Quarter';
          case 3: return '3rd Quarter';
          case 4: return '4th Quarter';
          case 5: return 'Overtime';
          default: return `Quarter ${data.period}`;
        }
      
      case 'hockey':
        switch (data.period) {
          case 1: return '1st Period';
          case 2: return '2nd Period';
          case 3: return '3rd Period';
          case 4: return 'Overtime';
          default: return `Period ${data.period}`;
        }
      
      case 'tennis':
        return `Set ${data.period}`;
      
      case 'baseball':
        return `Inning ${data.period}`;
      
      case 'volleyball':
        return `Set ${data.period}`;
      
      default:
        return `Period ${data.period}`;
    }
  };

  const getSportSpecificDetails = () => {
    if (!data) return [];
    
    switch (sport) {
      case 'soccer':
        return [
          { label: 'Ball Position', value: data.xy || 'N/A' },
          { label: 'Corners', value: data.corners ? `${data.corners[0]}-${data.corners[1]}` : 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      case 'basket':
        return [
          { label: 'Q1', value: data.quarter_scores?.Q1 ? `${data.quarter_scores.Q1[0]}-${data.quarter_scores.Q1[1]}` : 'N/A' },
          { label: 'Q2', value: data.quarter_scores?.Q2 ? `${data.quarter_scores.Q2[0]}-${data.quarter_scores.Q2[1]}` : 'N/A' },
          { label: 'Q3', value: data.quarter_scores?.Q3 ? `${data.quarter_scores.Q3[0]}-${data.quarter_scores.Q3[1]}` : 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      case 'tennis':
        return [
          { label: 'Server', value: data.current_server || 'N/A' },
          { label: 'Current Game', value: data.current_game || 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      case 'baseball':
        return [
          { label: 'At Bat', value: data.current?.AtBat || 'N/A' },
          { label: 'Outs', value: data.current?.Outs !== undefined ? data.current.Outs : 'N/A' },
          { label: 'Pitcher', value: data.current?.Pitcher || 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      case 'amfootball':
        return [
          { label: 'Down', value: data.current?.Down || 'N/A' },
          { label: 'To Go', value: data.current?.ToGo ? `${data.current.ToGo} yds` : 'N/A' },
          { label: 'Yard Line', value: data.current?.YardLine || 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      case 'hockey':
        return [
          { label: 'Situation', value: data.current?.Situation || 'N/A' },
          { label: 'Time Left', value: data.current?.Time || 'N/A' },
          { label: 'Shots on Goal', value: data.shots ? `${data.shots[0]}-${data.shots[1]}` : 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      case 'volleyball':
        return [
          { label: 'Server', value: data.current?.Server || 'N/A' },
          { label: 'Current Set', value: data.current?.Set || 'N/A' },
          { label: 'Set Score', value: data.current?.Score || 'N/A' },
          { label: 'Match Events', value: getMatchEventName(data.sc) }
        ];
      
      default:
        return [];
    }
  };

  const renderMarkets = () => {
    if (!fullMatchData?.odds || !Array.isArray(fullMatchData.odds)) {
      return <div className="no-markets">No markets available</div>;
    }

    return (
      <div className="markets-container">
        <h4 className="markets-title">Markets & Odds</h4>
        <div className="markets-grid">
          {fullMatchData.odds.map((market, index) => (
            <div key={index} className="market-card">
              <div className="market-header">
                <h5 className="market-name">
                  {getMarketName(market.id)} <span className="market-id">(ID: {market.id})</span>
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
      </div>
    );
  };

  const getMarketName = (marketId) => {
    // Simple lookup in the cached dictionary
    return marketDictionary[marketId] || `Market ${marketId}`;
  };

  const getMatchEventName = (eventCode) => {
    // Simple lookup in the cached match events dictionary
    if (!eventCode) return 'No Event';
    
    // Convert string to number if needed
    const code = typeof eventCode === 'string' ? parseInt(eventCode, 10) : eventCode;
    let eventName = matchEventsDictionary[code] || `Event ${eventCode}`;
    
    // Replace generic team references with actual team names
    if (data?.t1?.name && data?.t2?.name) {
      eventName = eventName
        .replace(/Home Team/g, data.t1.name)
        .replace(/Home/g, data.t1.name)
        .replace(/Away Team/g, data.t2.name)
        .replace(/Away/g, data.t2.name);
    }
    
    return eventName;
  };

  const isLive = data?.time > 0;

  return (
    <div className="match-card">
      {isLive && <div className="live-indicator">Live</div>}
      
      <div className="match-header" onClick={() => navigate(`/match/${sport}/${match.id}`)}>
        <div className="teams">
          <div className="team-names">
            {data?.t1?.name || 'Team 1'} vs {data?.t2?.name || 'Team 2'}
          </div>
          <div className="match-info">
            <span>{getPeriod()}</span>
            <span>{formatTime(data?.time)}</span>
            <span>ID: {data?.id}</span>
          </div>
        </div>
        <div className="match-header-right">
          <div className="score">
            {getScore()}
          </div>
          <button 
            className={`toggle-button ${isExpanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggle();
            }}
          >
            ▼
          </button>
        </div>
      </div>

      <div className="match-details">
        {getSportSpecificDetails().map((detail, index) => (
          <div key={index} className="detail-item">
            <div className="detail-label">{detail.label}</div>
            <div className="detail-value">{detail.value}</div>
          </div>
        ))}
      </div>

      {isExpanded && (
        <div className="match-expansion">
          {fullMatchData ? renderMarkets() : (
            <div className="loading-markets">Loading markets...</div>
          )}
        </div>
      )}
    </div>
  );
}

export default MatchCard;