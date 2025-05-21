defmodule SportsbookWeb.ApiController do
  use SportsbookWeb, :controller

  def matches(conn, %{"sport" => sport}) do
    matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
    
    # Group matches by league
    grouped_matches = group_matches_by_league(matches)
    
    json(conn, %{
      sport: sport,
      matches: grouped_matches
    })
  end

  def matches(conn, _params) do
    # Default to soccer
    matches(conn, %{"sport" => "soccer"})
  end

  def sports(conn, _params) do
    sports = ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"]
    
    # Get match counts for each sport
    sports_with_counts = Enum.map(sports, fn sport ->
      matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
      %{
        name: sport,
        display_name: String.capitalize(sport),
        match_count: length(matches)
      }
    end)
    
    json(conn, %{sports: sports_with_counts})
  end

  # Private helper functions
  
  defp group_matches_by_league(matches) do
    matches
    |> Enum.reduce(%{}, fn {match_id, small_data, _full_data}, acc ->
      league = get_league_name(small_data)
      
      league_matches = Map.get(acc, league, [])
      updated_matches = [%{
        id: match_id,
        data: small_data
      } | league_matches]
      
      Map.put(acc, league, updated_matches)
    end)
    |> Enum.map(fn {league, matches} ->
      %{
        league: league,
        matches: Enum.reverse(matches)
      }
    end)
  end
  
  defp get_league_name(small_data) do
    # Try to get league from different possible fields
    small_data["league"] || 
    small_data["ctry_name"] || 
    small_data["competition"] || 
    "Unknown League"
  end
end