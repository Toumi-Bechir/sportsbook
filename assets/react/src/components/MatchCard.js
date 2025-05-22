import React, { useState } from 'react';
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
  const [hoveredOdd, setHoveredOdd] = useState(null);

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
    if (!data?.period) return 'Pre-Match';
    
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
          case 1: return 'Q1';
          case 2: return 'Q2';
          case 3: return 'Q3';
          case 4: return 'Q4';
          case 5: return 'OT';
          default: return `Q${data.period}`;
        }
      
      case 'hockey':
        switch (data.period) {
          case 1: return 'P1';
          case 2: return 'P2';
          case 3: return 'P3';
          case 4: return 'OT';
          default: return `P${data.period}`;
        }
      
      case 'tennis':
        return `Set ${data.period}`;
      
      case 'baseball':
        return `Inn ${data.period}`;
      
      case 'volleyball':
        return `Set ${data.period}`;
      
      default:
        return `Period ${data.period}`;
    }
  };

  const getQuickStats = () => {
    if (!data) return null;
    
    switch (sport) {
      case 'soccer':
        return {
          corners: data.corners ? `${data.corners[0]}-${data.corners[1]}` : null,
          cards: data.cards ? `${data.cards[0]}-${data.cards[1]}` : null,
          shots: data.shots ? `${data.shots[0]}-${data.shots[1]}` : null
        };
      
      case 'basket':
        return {
          q1: data.quarter_scores?.Q1 ? `${data.quarter_scores.Q1[0]}-${data.quarter_scores.Q1[1]}` : null,
          q2: data.quarter_scores?.Q2 ? `${data.quarter_scores.Q2[0]}-${data.quarter_scores.Q2[1]}` : null,
          fouls: data.fouls ? `${data.fouls[0]}-${data.fouls[1]}` : null
        };
      
      case 'tennis':
        return {
          server: data.current_server,
          game: data.current_game,
          aces: data.aces ? `${data.aces[0]}-${data.aces[1]}` : null
        };
      
      default:
        return null;
    }
  };

  const renderQuickOdds = () => {
    // bet365 authentic odds with proper colors
    const sampleOdds = {
      soccer: [
        { name: '1', value: '2.15', type: 'home' },
        { name: 'X', value: '3.40', type: 'draw' },
        { name: '2', value: '2.80', type: 'away' },
        { name: 'O2.5', value: '1.85', type: 'over' },
        { name: 'U2.5', value: '1.95', type: 'under' },
        { name: 'BTTS Y', value: '1.70', type: 'btts_yes' }
      ],
      basket: [
        { name: '1', value: '1.95', type: 'home' },
        { name: '2', value: '1.85', type: 'away' },
        { name: 'O215.5', value: '1.90', type: 'over' },
        { name: 'U215.5', value: '1.90', type: 'under' },
        { name: '+5.5', value: '1.85', type: 'spread_home' },
        { name: '-5.5', value: '1.95', type: 'spread_away' }
      ],
      tennis: [
        { name: '1', value: '1.65', type: 'home' },
        { name: '2', value: '2.25', type: 'away' },
        { name: 'O22.5', value: '1.80', type: 'over' },
        { name: 'U22.5', value: '2.00', type: 'under' },
        { name: '2-0', value: '2.80', type: 'set_score' },
        { name: '2-1', value: '3.40', type: 'set_score' }
      ]
    };

    const odds = sampleOdds[sport] || sampleOdds.soccer;
    
    return (
      <div className="flex gap-1">
        {odds.slice(0, 6).map((odd, index) => (
          <button
            key={index}
            className={`flex-1 min-w-0 text-white text-xs font-bold py-1.5 px-1 transition-all duration-150 hover:opacity-90 ${
              hoveredOdd === `${match.id}-${index}` ? 'opacity-80' : ''
            }`}
            style={{ 
              backgroundColor: '#F9DC1C',
              color: '#000',
              border: '1px solid #e6c300'
            }}
            onMouseEnter={() => setHoveredOdd(`${match.id}-${index}`)}
            onMouseLeave={() => setHoveredOdd(null)}
            onClick={(e) => {
              e.stopPropagation();
              // Add bet slip logic here
            }}
          >
            <div className="leading-tight">
              <div className="truncate">{odd.name}</div>
              <div className="font-black text-sm">{odd.value}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderMarkets = () => {
    if (!fullMatchData?.odds || !Array.isArray(fullMatchData.odds)) {
      return (
        <div className="text-center py-12 text-gray-500" style={{ backgroundColor: '#f7f7f7' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-sm font-medium">No additional markets available</div>
          <div className="text-xs text-gray-400 mt-1">Markets will appear here during live play</div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold flex items-center gap-2" style={{ color: '#0066cc' }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#0066cc' }}>
              {fullMatchData.odds.length}
            </span>
            All Markets
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#00ff00' }}></span>
            Live updating
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fullMatchData.odds.map((market, index) => (
            <div key={index} className="rounded p-4 shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: 'white', border: '1px solid #ccc' }}>
              <div className="mb-4">
                <h5 className="font-bold text-sm mb-1" style={{ color: '#0066cc' }}>
                  {getMarketName(market.id)}
                  {market.ha && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e6f3ff', color: '#0066cc' }}>
                      {market.ha}
                    </span>
                  )}
                </h5>
                <div className="text-xs text-gray-500">Market #{market.id}</div>
              </div>
              
              <div className="space-y-2">
                {market.o && Array.isArray(market.o) ? (
                  market.o.map((odd, oddIndex) => (
                    <button 
                      key={oddIndex} 
                      className={`w-full p-3 transition-all duration-200 text-sm font-bold ${
                        odd.bl === 1 
                          ? 'cursor-not-allowed text-gray-400' 
                          : 'hover:opacity-90 text-black'
                      }`}
                      style={{ 
                        backgroundColor: odd.bl === 1 ? '#f0f0f0' : '#F9DC1C',
                        border: `1px solid ${odd.bl === 1 ? '#ddd' : '#e6c300'}`
                      }}
                      disabled={odd.bl === 1}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-left font-medium">{odd.n}</span>
                        <span className="text-right text-lg font-black">{odd.v}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm rounded" style={{ backgroundColor: '#f7f7f7' }}>
                    <div className="text-lg mb-1">⏳</div>
                    <div>Odds loading...</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getMarketName = (marketId) => {
    return marketDictionary[marketId] || `Market ${marketId}`;
  };

  const getMatchEventName = (eventCode) => {
    if (!eventCode) return null;
    
    const code = typeof eventCode === 'string' ? parseInt(eventCode, 10) : eventCode;
    let eventName = matchEventsDictionary[code] || `Event ${eventCode}`;
    
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
  const quickStats = getQuickStats();
  const currentEvent = getMatchEventName(data?.sc);

  return (
    <div className="transition-all duration-200 border-b last:border-b-0" style={{ 
      borderColor: '#e0e0e0',
      backgroundColor: isExpanded ? '#f9f9f9' : 'white'
    }}>
      {/* Mobile-First Responsive Layout */}
      <div className="p-3 hover:bg-gray-50 transition-colors">
        {/* Mobile Layout (default) */}
        <div className="block md:hidden">
          <div 
            className="cursor-pointer"
            onClick={() => navigate(`/match/${sport}/${match.id}`)}
          >
            {/* Mobile Header - Time & Status */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-gray-600">{formatTime(data?.time)}</div>
                {isLive ? (
                  <div className="text-xs px-2 py-1 rounded-full font-bold animate-pulse" style={{ 
                    backgroundColor: '#ff3333', 
                    color: 'white' 
                  }}>
                    🔴 LIVE
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">{getPeriod()}</div>
                )}
              </div>
              <button 
                className="px-3 py-1 rounded text-xs font-bold"
                style={{ backgroundColor: '#F9DC1C', color: 'black' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                {isExpanded ? 'Less' : 'More'}
              </button>
            </div>
            
            {/* Mobile Teams & Scores */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-bold text-base truncate" style={{ color: '#003366' }}>
                    {data?.t1?.name || 'Team 1'}
                  </span>
                  {quickStats?.corners && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
                      C: {quickStats.corners.split('-')[0]}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black" style={{ color: isLive ? '#ff3333' : '#333' }}>
                  {data?.t1?.score || 0}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-bold text-base truncate" style={{ color: '#003366' }}>
                    {data?.t2?.name || 'Team 2'}
                  </span>
                  {quickStats?.corners && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
                      C: {quickStats.corners.split('-')[1]}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black" style={{ color: isLive ? '#ff3333' : '#333' }}>
                  {data?.t2?.score || 0}
                </div>
              </div>
            </div>
            
            {/* Mobile Quick Odds */}
            <div className="mt-3">
              {renderQuickOdds()}
            </div>
            
            {currentEvent && (
              <div className="text-sm font-medium mt-3 p-2 rounded" style={{ color: '#0066cc', backgroundColor: '#f0f8ff' }}>
                🔵 {currentEvent}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout (md and up) */}
        <div className="hidden md:flex items-center gap-4">
          {/* Time & Status */}
          <div className="w-16 text-center">
            <div className="text-xs font-bold text-gray-600">{formatTime(data?.time)}</div>
            {isLive ? (
              <div className="text-xs px-1.5 py-0.5 rounded-full font-bold animate-pulse mt-1" style={{ 
                backgroundColor: '#ff3333', 
                color: 'white' 
              }}>
                LIVE
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">{getPeriod()}</div>
            )}
          </div>
          
          {/* Teams & Score - bet365 team colors */}
          <div className="flex-1 min-w-0">
            <div 
              className="cursor-pointer group" 
              onClick={() => navigate(`/match/${sport}/${match.id}`)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-bold truncate group-hover:underline transition-all" style={{ color: '#003366' }}>
                    {data?.t1?.name || 'Team 1'}
                  </span>
                  {quickStats?.corners && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
                      C: {quickStats.corners.split('-')[0]}
                    </span>
                  )}
                </div>
                <div className="text-xl font-black min-w-0" style={{ color: isLive ? '#ff3333' : '#333' }}>
                  {data?.t1?.score || 0}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-bold truncate group-hover:underline transition-all" style={{ color: '#003366' }}>
                    {data?.t2?.name || 'Team 2'}
                  </span>
                  {quickStats?.corners && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
                      C: {quickStats.corners.split('-')[1]}
                    </span>
                  )}
                </div>
                <div className="text-xl font-black min-w-0" style={{ color: isLive ? '#ff3333' : '#333' }}>
                  {data?.t2?.score || 0}
                </div>
              </div>
              
              {currentEvent && (
                <div className="text-xs font-medium mt-1 truncate" style={{ color: '#0066cc' }}>
                  🔵 {currentEvent}
                </div>
              )}
            </div>
          </div>
          
          {/* Quick Odds - bet365 style */}
          <div className="flex-1 max-w-md">
            {renderQuickOdds()}
          </div>
          
          {/* More Markets */}
          <div className="w-12 text-center">
            <button 
              className={`w-10 h-10 rounded-full text-xs font-black transition-all duration-200 border-2 ${
                isExpanded 
                  ? 'shadow-lg' 
                  : 'hover:shadow-md'
              }`}
              style={{
                backgroundColor: isExpanded ? '#F9DC1C' : 'white',
                borderColor: isExpanded ? '#e6c300' : '#ccc',
                color: isExpanded ? '#000' : '#666'
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggle();
              }}
            >
              +{fullMatchData?.odds?.length || '87'}
            </button>
          </div>
        </div>
        
        {/* Additional Quick Info - Mobile & Desktop */}
        {(quickStats || isLive) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 pt-2 gap-2" style={{ borderTop: '1px solid #e0e0e0' }}>
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 flex-wrap">
              {quickStats?.shots && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0066cc' }}></span>
                  Shots: {quickStats.shots}
                </span>
              )}
              {quickStats?.cards && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffcc00' }}></span>
                  Cards: {quickStats.cards}
                </span>
              )}
              {isLive && (
                <span className="flex items-center gap-1 font-medium" style={{ color: '#009900' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#00ff00' }}></span>
                  Live betting available
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>ID: {match.id}</span>
              <span>•</span>
              <span>{sport.toUpperCase()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Markets Section - bet365 style */}
      {isExpanded && (
        <div className="border-t p-6" style={{ backgroundColor: '#f7f7f7', borderColor: '#e0e0e0' }}>
          {fullMatchData ? renderMarkets() : (
            <div className="text-center py-12 text-gray-500">
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#0066cc' }}></div>
              <div className="text-sm font-medium">Loading additional markets...</div>
              <div className="text-xs text-gray-400 mt-1">Fetching latest odds and markets</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MatchCard;