import React, { useState } from 'react';

function SportFilter({ sports, selectedSport, onSportChange }) {
  const [viewMode, setViewMode] = useState('all'); // all, live, popular
  
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

  const getSportStats = (sport) => {
    // Mock data - in real app this would come from props or API
    const stats = {
      soccer: { live: 24, total: 156, popular: true },
      basket: { live: 12, total: 78, popular: true },
      tennis: { live: 8, total: 45, popular: true },
      baseball: { live: 6, total: 32, popular: false },
      amfootball: { live: 4, total: 18, popular: false },
      hockey: { live: 7, total: 28, popular: false },
      volleyball: { live: 3, total: 12, popular: false }
    };
    return stats[sport] || { live: 0, total: sport.match_count || 0, popular: false };
  };

  const getTotalLiveEvents = () => {
    return sports.reduce((total, sport) => {
      const stats = getSportStats(sport.name);
      return total + stats.live;
    }, 0);
  };

  const getTotalEvents = () => {
    return sports.reduce((total, sport) => total + (sport.match_count || 0), 0);
  };

  const getFilteredSports = () => {
    switch (viewMode) {
      case 'live':
        return sports.filter(sport => getSportStats(sport.name).live > 0);
      case 'popular':
        return sports.filter(sport => getSportStats(sport.name).popular);
      default:
        return sports;
    }
  };

  const getSportIcon = (sport) => {
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

  return (
    <div className="bg-gray-800 shadow-xl">
      {/* Modern header */}
      <div className="p-6 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 rounded-xl">
            <span className="text-xl">🏆</span>
          </div>
          <div>
            <h2 className="font-bold text-xl text-white">Sports</h2>
            <div className="text-gray-400">Live & Pre-Match</div>
          </div>
        </div>
        
        {/* Modern stats overview */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-600">
            <div className="text-xs text-gray-400 mb-2 font-medium">Live Now</div>
            <div className="text-2xl font-bold text-red-400">{getTotalLiveEvents()}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-600">
            <div className="text-xs text-gray-400 mb-2 font-medium">Total</div>
            <div className="text-2xl font-bold text-blue-400">{getTotalEvents()}</div>
          </div>
        </div>
        
        {/* Modern view mode filters */}
        <div className="flex gap-2 bg-gray-700 rounded-lg p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'live', label: 'Live' },
            { key: 'popular', label: 'Popular' }
          ].map(mode => (
            <button
              key={mode.key}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === mode.key
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
              onClick={() => setViewMode(mode.key)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Modern sports list */}
      <div className="p-4">
        <div className="space-y-2">
          {getFilteredSports().map(sport => {
            const stats = getSportStats(sport.name);
            const isSelected = selectedSport === sport.name;
            
            return (
              <button
                key={sport.name}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 border ${
                  isSelected
                    ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-600/20'
                    : 'bg-gray-750 border-gray-600 hover:bg-gray-700 hover:border-gray-500 shadow-lg'
                }`}
                onClick={() => onSportChange(sport.name)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getSportIcon(sport.name)}</span>
                    <div>
                      <div className={`font-bold text-base ${isSelected ? 'text-white' : 'text-white'}`}>
                        {formatSportName(sport.name)}
                      </div>
                      {stats.popular && (
                        <div className={`text-xs font-medium ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>
                          ⭐ Popular
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {stats.live > 0 && (
                      <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                        {stats.live} LIVE
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-bold text-white ${
                      isSelected ? 'bg-blue-800' : 'bg-gray-600'
                    }`}>
                      {sport.match_count || stats.total}
                    </span>
                  </div>
                </div>
                
                {/* Modern progress bar */}
                <div className={`w-full rounded-full h-2 ${isSelected ? 'bg-blue-800' : 'bg-gray-600'}`}>
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isSelected ? 'bg-blue-300' : 'bg-blue-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, (stats.live / Math.max(stats.total, 1)) * 100)}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className={isSelected ? 'text-blue-200' : 'text-gray-400'}>
                    {stats.live} live
                  </span>
                  <span className={isSelected ? 'text-blue-200' : 'text-gray-400'}>
                    {stats.total} total
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Modern quick actions */}
      <div className="p-4 border-t border-gray-700 bg-gray-900">
        <div className="space-y-3">
          <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg">
            <span>🔴</span>
            <span>Watch Live Stream</span>
          </button>
          
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg">
            <span>📊</span>
            <span>View All Stats</span>
          </button>
        </div>
        
        {/* Modern live indicators */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center gap-3 text-sm text-gray-300 mb-3">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="font-medium">Real-time updates</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span className="font-medium">Live betting available</span>
          </div>
        </div>
      </div>
      
      {/* Modern promotional footer */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4">
        <div className="text-center">
          <div className="text-sm font-bold mb-2 flex items-center justify-center gap-2">
            <span>🎁</span>
            <span>New Customer Offer</span>
          </div>
          <div className="text-xs text-purple-100 mb-3">Bet £10 Get £30 Free Bets</div>
          <button className="bg-white text-purple-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors shadow-lg">
            Claim Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default SportFilter;