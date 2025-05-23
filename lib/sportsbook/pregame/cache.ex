defmodule Sportsbook.Pregame.Cache do
  use GenServer
  require Logger

  @sports [
    :soccer, :basketball, :tennis, :hockey, :handball, :volleyball, :football,
    :baseball, :cricket, :rugby, :rugbyleague, :boxing, :esports, :futsal,
    :mma, :table_tennis, :golf, :darts
  ]

  def start_link(_), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  def init(state) do
    Logger.info("Starting Pregame Cache")
    create_ets_tables()
    schedule_cleanup()
    {:ok, state}
  end

  def list_sports, do: @sports

  def get_countries_by_sport(sport, filter) do
    table = String.to_atom("pregame_#{sport}")
    now = System.system_time(:second)
    
    if :ets.info(table) == :undefined do
      Logger.error("Table #{table} does not exist")
      []
    else
      :ets.safe_fixtable(table, true)
      try do
        :ets.foldl(
          fn {_match_id, {_, start_time, _, _, country, league, _, _, _}}, acc ->
            if start_time > now and matches_filter?(start_time, now, filter) do
              country_key = normalize_country(country)
              league_key = normalize_league_name(league)
              current_leagues = Map.get(acc, country_key, [])
              Map.put(acc, country_key, [league_key | current_leagues])
            else
              acc
            end
          end,
          %{},
          table
        )
        |> Enum.map(fn {country, leagues} ->
          unique_leagues = Enum.uniq(leagues)
          %{
            country: country,
            leagues: unique_leagues,
            count: length(unique_leagues)
          }
        end)
        |> Enum.sort_by(fn %{country: country} -> country end)
      after
        :ets.safe_fixtable(table, false)
      end
    end
  end

  def get_matches_by_leagues(leagues, filter) do
    now = System.system_time(:second)
    
    Enum.flat_map(@sports, fn sport ->
      table = String.to_atom("pregame_#{sport}")
      if :ets.info(table) != :undefined do
        :ets.safe_fixtable(table, true)
        try do
          :ets.foldl(
            fn {_match_id, {match_id, start_time, team1, team2, country, league, markets, stats, updated_at}}, acc ->
              normalized_country = normalize_country(country)
              normalized_league = normalize_league_name(league)
              if start_time > now and matches_filter?(start_time, now, filter) and {normalized_country, normalized_league} in leagues do
                [{normalized_country, normalized_league, start_time, match_id, team1, team2, markets} | acc]
              else
                acc
              end
            end,
            [],
            table
          )
        after
          :ets.safe_fixtable(table, false)
        end
      else
        []
      end
    end)
    |> Enum.group_by(fn {country, _league, _start_time, _match_id, _team1, _team2, _markets} -> country end)
    |> Enum.map(fn {country, matches} ->
      leagues = Enum.group_by(matches, fn {_country, league, _start_time, _match_id, _team1, _team2, _markets} -> league end)
      %{country: country, leagues: leagues}
    end)
  end

  def get_match(sport, match_id) do
    table = String.to_atom("pregame_#{sport}")
    now = System.system_time(:second)
    
    if :ets.info(table) != :undefined do
      case :ets.lookup(table, match_id) do
        [{_, {_, start_time, _, _, _, _, _, _, _} = match}] when start_time > now -> {:ok, match}
        _ -> {:error, :not_found}
      end
    else
      {:error, :table_not_found}
    end
  end

  def handle_info(:cleanup, state) do
    four_hours_ago = System.system_time(:second) - 4 * 60 * 60
    
    Enum.each(@sports, fn sport ->
      table = String.to_atom("pregame_#{sport}")
      if :ets.info(table) != :undefined do
        :ets.safe_fixtable(table, true)
        try do
          :ets.foldl(
            fn {match_id, {_, start_time, _, _, _, _, _, _, _}}, acc ->
              if start_time < four_hours_ago do
                :ets.delete(table, match_id)
              end
              acc
            end,
            nil,
            table
          )
        after
          :ets.safe_fixtable(table, false)
        end
      end
    end)
    
    schedule_cleanup()
    {:noreply, state}
  end

  defp create_ets_tables do
    Enum.each(@sports, fn sport ->
      table = String.to_atom("pregame_#{sport}")
      case :ets.info(table) do
        :undefined ->
          :ets.new(table, [:set, :public, :named_table, {:write_concurrency, true}, {:read_concurrency, true}])
          Logger.info("Created ETS table: #{table}")
        _ ->
          Logger.info("ETS table #{table} already exists")
      end
    end)
  end

  defp matches_filter?(_start_time, _now, :all), do: true
  defp matches_filter?(start_time, now, :today) do
    case DateTime.from_unix(now, :second) do
      {:ok, now_dt} ->
        case DateTime.from_unix(start_time, :second) do
          {:ok, start_dt} ->
            Date.compare(DateTime.to_date(now_dt), DateTime.to_date(start_dt)) == :eq
          _ -> false
        end
      _ -> false
    end
  end
  defp matches_filter?(start_time, now, hours) when is_integer(hours) do
    start_time <= now + hours * 60 * 60
  end

  defp schedule_cleanup, do: Process.send_after(self(), :cleanup, 3_600_000) # 1 hour

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