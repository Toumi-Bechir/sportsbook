import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import MatchDetailPageNew from './components/MatchDetailPageNew';
import PregameSportsPage from './components/PregameSportsPage';
import PregameMatchesPage from './components/PregameMatchesPage';
import PregameMatchDetailPage from './components/PregameMatchDetailPage';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/match/:sport/:matchId" element={<MatchDetailPageNew />} />
        
        {/* Pregame routes */}
        <Route path="/pregame" element={<PregameSportsPage />} />
        <Route path="/pregame/:sport" element={<PregameSportsPage />} />
        <Route path="/pregame/matches" element={<PregameMatchesPage />} />
        <Route path="/pregame/match/:sport/:matchId" element={<PregameMatchDetailPage />} />
      </Routes>
    </Router>
  );
}

export default AppRouter;