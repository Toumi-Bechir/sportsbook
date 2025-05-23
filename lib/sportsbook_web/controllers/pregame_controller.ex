defmodule SportsbookWeb.PregameController do
  use SportsbookWeb, :controller
  require Logger

  def sports(conn, %{"sport" => sport, "filter" => filter}) do
    sport_atom = String.to_atom(sport)
    filter_atom = case filter do
      "one_hour" -> 1
      "three_hours" -> 3
      "six_hours" -> 6
      "twelve_hours" -> 12
      "today" -> :today
      "all" -> :all
      _ -> :today
    end

    leagues = Sportsbook.Pregame.Cache.get_countries_by_sport(sport_atom, filter_atom)
    
    json(conn, %{
      sport: sport,
      filter: filter,
      leagues: leagues
    })
  end

  def matches(conn, params) do
    sport = String.to_atom(params["sport"] || "soccer")
    filter = case params["filter"] do
      "one_hour" -> 1
      "three_hours" -> 3
      "six_hours" -> 6
      "twelve_hours" -> 12
      "today" -> :today
      "all" -> :all
      _ -> :today
    end
    
    leagues = case params["leagues"] do
      leagues when is_list(leagues) ->
        Enum.map(leagues, fn league ->
          case String.split(league, ":", parts: 2) do
            [country, league_name] -> {normalize_country(country), normalize_league_name(league_name)}
            _ -> nil
          end
        end)
        |> Enum.filter(& &1)
      league when is_binary(league) ->
        # Handle comma-separated leagues in a single string
        league
        |> String.split(",")
        |> Enum.map(fn single_league ->
          case String.split(String.trim(single_league), ":", parts: 2) do
            [country, league_name] -> {normalize_country(country), normalize_league_name(league_name)}
            _ -> nil
          end
        end)
        |> Enum.filter(& &1)
      _ -> []
    end

    Logger.info("Processed leagues for matching: #{inspect(leagues)}")
    matches = Sportsbook.Pregame.Cache.get_matches_by_leagues(leagues, filter)
    Logger.info("Found #{length(matches)} countries with matches")
    
    # Transform matches to match React component expectations
    formatted_matches = format_matches_for_react(matches)
    
    json(conn, %{
      sport: params["sport"],
      filter: params["filter"],
      matches: formatted_matches
    })
  end

  def match_details(conn, %{"sport" => sport, "match_id" => match_id}) do
    sport_atom = String.to_atom(sport)
    
    case Sportsbook.Pregame.Cache.get_match(sport_atom, match_id) do
      {:ok, match} ->
        json(conn, %{
          match: format_match_for_react(match)
        })
      {:error, _reason} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Match not found"})
    end
  end

  defp format_matches_for_react(matches) do
    Enum.map(matches, fn %{country: country, leagues: leagues} ->
      %{
        country: country,
        leagues: Enum.map(leagues, fn {league, league_matches} ->
          %{
            league: league,
            matches: Enum.map(league_matches, fn {_country, _league, start_time, match_id, team1, team2, markets} ->
              %{
                match_id: match_id,
                start_time: start_time,
                team1_name: team1,
                team2_name: team2,
                markets: markets,
                home_odds: get_home_odds(markets),
                away_odds: get_away_odds(markets)
              }
            end)
          }
        end)
      }
    end)
  end

  defp format_match_for_react({match_id, start_time, team1, team2, country, league, markets, stats, updated_at}) do
    %{
      match_id: match_id,
      start_time: start_time,
      team1_name: team1,
      team2_name: team2,
      country: country,
      league: league,
      markets: markets,
      stats: stats,
      updated_at: updated_at,
      home_odds: get_home_odds(markets),
      away_odds: get_away_odds(markets)
    }
  end

  defp get_home_odds(markets) do
    case markets[:home_away] do
      nil -> nil
      odds ->
        case Enum.find(odds, fn o -> o.name == "Home" end) do
          nil -> nil
          %{value: value} -> value
        end
    end
  end

  defp get_away_odds(markets) do
    case markets[:home_away] do
      nil -> nil
      odds ->
        case Enum.find(odds, fn o -> o.name == "Away" end) do
          nil -> nil
          %{value: value} -> value
        end
    end
  end

  defp normalize_league_name(name) when is_binary(name) do
    name
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]/, " ")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  defp normalize_league_name(_), do: ""

  defp normalize_country(country) when is_binary(country) do
    country
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]/, " ")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  defp normalize_country(_), do: ""
end