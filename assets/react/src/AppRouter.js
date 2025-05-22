import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import MatchDetailPageNew from './components/MatchDetailPageNew';

function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/match/:sport/:matchId" element={<MatchDetailPageNew />} />
      </Routes>
    </Router>
  );
}

export default AppRouter;