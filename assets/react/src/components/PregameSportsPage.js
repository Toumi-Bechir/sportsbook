import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

const SPORTS = [
  'soccer', 'basketball', 'tennis', 'hockey', 'handball', 'volleyball', 'football',
  'baseball', 'cricket', 'rugby', 'rugbyleague', 'boxing', 'esports', 'futsal',
  'mma', 'table_tennis', 'golf', 'darts'
];

const FILTERS = [
  { key: 'one_hour', label: '1 Hour' },
  { key: 'three_hours', label: '3 Hours' },
  { key: 'six_hours', label: '6 Hours' },
  { key: 'twelve_hours', label: '12 Hours' },
  { key: 'today', label: 'Today' },
  { key: 'all', label: 'All' }
];

const PregameSportsPage = () => {
  const navigate = useNavigate();
  const { sport: urlSport } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedSport, setSelectedSport] = useState(urlSport || 'soccer');
  const [filter, setFilter] = useState(searchParams.get('filter') || 'today');
  const [selectedLeagues, setSelectedLeagues] = useState({});
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, [selectedSport, filter]);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/pregame/sports/${selectedSport}?filter=${filter}`);
      const data = await response.json();
      setLeagues(data.leagues || []);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSportSelect = (sport) => {
    setSelectedSport(sport);
    setSelectedLeagues({});
    navigate(`/pregame/${sport}?filter=${filter}`);
  };

  const handleFilterSelect = (filterKey) => {
    setFilter(filterKey);
    setSelectedLeagues({});
    setSearchParams({ filter: filterKey });
  };

  const toggleLeague = (leagueKey) => {
    setSelectedLeagues(prev => ({
      ...prev,
      [leagueKey]: !prev[leagueKey]
    }));
  };

  const selectAll = () => {
    const allLeagues = {};
    leagues.forEach(league => {
      const country = league.country;
      const leagueList = league.leagues;
      leagueList.forEach(leagueName => {
        allLeagues[`${country}:${leagueName}`] = true;
      });
    });
    setSelectedLeagues(allLeagues);
  };

  const validateSelection = () => {
    const selectedKeys = Object.keys(selectedLeagues).filter(key => selectedLeagues[key]);
    if (selectedKeys.length === 0) return;
    
    const params = new URLSearchParams({
      sport: selectedSport,
      filter: filter,
      leagues: selectedKeys
    });
    navigate(`/pregame/matches?${params}`);
  };

  const filterLabel = (filterKey) => {
    const filterObj = FILTERS.find(f => f.key === filterKey);
    return filterObj ? filterObj.label : 'Unknown';
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {/* Mobile Header with Hamburger */}
      <div className="md:hidden flex items-center justify-between bg-[#282828] p-4">
        <h2 className="text-xl font-bold text-[#00FFB6]">Sports</h2>
        <button 
          onClick={toggleSidebar}
          className="text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>

      {/* Sidebar - Hidden on mobile by default */}
      <div className={`${
        sidebarVisible ? 'block' : 'hidden'
      } md:block md:w-[17rem] w-full bg-[#282828] text-white p-4 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-[#404040] scrollbar-track-[#282828]`}>
        <h2 className="text-xl font-bold mb-4 text-[#00FFB6] md:block hidden">Sports</h2>
        <ul className="-mx-4">
          {SPORTS.map(sport => (
            <li
              key={sport}
              className={`block w-full flex items-center font-semibold py-2 px-4 rounded bg-transparent transition hover:text-[#00DFA9] ${
                sport === selectedSport ? 'bg-gray-600' : 'hover:text-[#00DFA9]'
              } transition cursor-pointer`}
              onClick={() => handleSportSelect(sport)}
            >
              <img 
                src={`/images/${sport}.svg`} 
                className="h-[20px] w-[20px] mr-2" 
                alt={sport}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              {sport.charAt(0).toUpperCase() + sport.slice(1).replace('_', ' ')}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content - Takes full width on mobile */}
      <div className="flex-1 p-4 overflow-y-auto bg-[#383838]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h1 className="text-2xl font-bold text-white">Leagues</h1>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(filterObj => (
              <button
                key={filterObj.key}
                className={`py-1.5 px-3.5 rounded-full font-medium text-xs sm:text-sm border transition-all duration-150 shadow-[0_3px_0_rgba(0,0,0,0.2)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2)] active:translate-y-0.5 active:shadow-none ${
                  filterObj.key === filter 
                    ? 'bg-[#00FFB6] border-[#00DFA9] text-[#282828] font-semibold' 
                    : 'bg-[#464646] border-[#404040] text-gray-300 hover:bg-[#404040]'
                }`}
                onClick={() => handleFilterSelect(filterObj.key)}
              >
                <span className="flex items-center gap-1.5">
                  {filterObj.key === 'all' && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
                    </svg>
                  )}
                  {filterObj.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Rest of content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-white">Loading leagues...</div>
          </div>
        ) : leagues.length === 0 ? (
          <p className="text-gray-500">No leagues available for the selected sport and filter.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-col sm:flex-row gap-1">
              {/* Select All Button */}
              <button
                className="py-1.5 px-3 rounded-sm font-medium text-xs sm:text-sm bg-transparent border border-[#00DFA9] text-[#00DFA9] hover:bg-[#00DFA9]/10 hover:border-[#00FFB6] hover:text-[#00FFB6] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#00FFB6]"
                onClick={selectAll}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  Select All
                </span>
              </button>

              {/* Validate Button */}
              <button
                className="py-1.5 px-3 rounded-sm font-medium text-xs sm:text-sm bg-[#00DFA9] text-[#282828] hover:bg-[#00FFB6] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#00FFB6]"
                onClick={validateSelection}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                  Confirm
                </span>
              </button>
            </div>

            {leagues.map((league, index) => (
              <div key={`${league.country}-${index}`} className="border-b border-[#404040]/50">
                {/* Country Header - Reduced height */}
                <div className="flex items-center justify-between px-1 py-1.5 bg-[#464646]">
                  <h2 className="text-[12px] font-semibold text-gray-100 uppercase tracking-tight">
                    {league.country}
                  </h2>
                  <span className="text-[11px] bg-[#404040] text-gray-300 px-1.5 py-0.5 rounded">
                    {league.count} leagues
                  </span>
                </div>

                {/* Leagues List - Compact version */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
                  {league.leagues.map((leagueName, leagueIndex) => {
                    const leagueKey = `${league.country}:${leagueName}`;
                    return (
                      <div key={`${leagueName}-${leagueIndex}`} className="group flex items-center">
                        {/* Checkbox - Compact */}
                        <div className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded-sm border-gray-500 text-[#00DFA9] focus:ring-1 focus:ring-[#00DFA9] bg-[#464646]"
                            checked={!!selectedLeagues[leagueKey]}
                            onChange={() => toggleLeague(leagueKey)}
                          />
                        </div>

                        {/* League Name - Compact */}
                        <button 
                          onClick={() => {
                            const params = new URLSearchParams({
                              sport: selectedSport,
                              filter: filter,
                              leagues: [leagueKey]
                            });
                            navigate(`/pregame/matches?${params}`);
                          }}
                          className="flex-1 px-2 py-1.5 text-[13px] font-medium text-gray-100 hover:text-[#00FFB6] text-left"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[12px]">{leagueName}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default PregameSportsPage;