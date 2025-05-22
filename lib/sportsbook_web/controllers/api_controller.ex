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

  def market_name(conn, %{"sport" => sport, "market_id" => market_id}) do
    market_name = case Integer.parse(market_id) do
      {id, ""} -> get_market_name_for_sport(sport, id)
      _ -> "Invalid Market ID"
    end
    
    json(conn, %{
      sport: sport,
      market_id: market_id,
      market_name: market_name
    })
  end

  def markets(conn, %{"sport" => sport}) do
    sport_atom = String.to_existing_atom(sport)
    markets = Sportsbook.MarketDictionaries.get_all_markets(sport_atom)
    match_events = Sportsbook.StateDictionaries.get_all_match_events(sport_atom)
    
    markets_list = Enum.map(markets, fn {id, name} ->
      %{id: id, name: name}
    end)
    
    match_events_list = Enum.map(match_events, fn {code, name} ->
      %{code: code, name: name}
    end)
    
    json(conn, %{
      sport: sport,
      markets: markets_list,
      match_events: match_events_list
    })
  rescue
    ArgumentError ->
      json(conn, %{error: "Unknown sport: #{sport}"})
  end

  # Private helper functions

  defp get_market_name_for_sport(sport, market_id) do
    case sport do
      "soccer" -> Sportsbook.MarketDictionaries.get_soccer_market_name(market_id)
      "basket" -> Sportsbook.MarketDictionaries.get_basket_market_name(market_id)
      "tennis" -> Sportsbook.MarketDictionaries.get_tennis_market_name(market_id)
      "baseball" -> Sportsbook.MarketDictionaries.get_baseball_market_name(market_id)
      "hockey" -> Sportsbook.MarketDictionaries.get_hockey_market_name(market_id)
      "volleyball" -> Sportsbook.MarketDictionaries.get_volleyball_market_name(market_id)
      "amfootball" -> Sportsbook.MarketDictionaries.get_amfootball_market_name(market_id)
      _ -> "Unknown Sport"
    end
  end
  
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