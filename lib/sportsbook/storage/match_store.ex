defmodule Sportsbook.Storage.MatchStore do
  @moduledoc """
  ETS-based storage for match data from websocket frames.
  
  This module provides functions to store and retrieve match data from different sports,
  including both match updates (updt) and available matches (avl) frames.
  """
  
  require Logger
  
  @doc """
  Initialize all required ETS tables.
  Should be called when the application starts.
  """
  def init() do
    # Table for available matches across all sports with read/write concurrency
    :ets.new(:available_matches, [:set, :public, :named_table, read_concurrency: true, write_concurrency: true])
    
    # Tables for each sport's match updates with read/write concurrency
    sport_tables = [
      :soccer_matches,
      :basket_matches,
      :tennis_matches,
      :baseball_matches,
      :amfootball_matches,
      :hockey_matches,
      :volleyball_matches
    ]
    
    Enum.each(sport_tables, fn table ->
      :ets.new(table, [:set, :public, :named_table, read_concurrency: true, write_concurrency: true])
    end)
    
    Logger.info("Match store initialized with ETS tables with read/write concurrency")
    :ok
  end
  
  @doc """
  Store an available matches (avl) frame for a specific sport.
  
  ## Parameters
  - sport: The sport name (e.g., "soccer", "basket")
  - avl_frame: The complete avl frame as received from the websocket
  """
  def store_avl_frame(sport, avl_frame) do
    # Process the frame to ensure it has the expected structure
    processed_frame = case avl_frame do
      %{"evts" => events} when is_list(events) ->
        # Convert to the expected format with "matches" key
        %{
          "matches" => Enum.map(events, fn event ->
            %{
              "id" => event["id"],
              "t1" => %{"n" => event["t1"]["n"]},
              "t2" => %{"n" => event["t2"]["n"]},
              "league" => event["cmp_name"],
              "time" => "",
              "date" => ""
            }
          end),
          "mt" => "avl",
          "sp" => sport,
          "pt" => avl_frame["pt"] || System.system_time(:millisecond)
        }
      
      _ ->
        # If it already has the correct format or something else, keep as is
        avl_frame
    end
    
    # Store the processed frame
    :ets.insert(:available_matches, {sport, processed_frame})
    
    # Clean up matches that are no longer in the available list
    cleanup_removed_matches(sport, processed_frame)
  end
  
  @doc """
  Clean up matches that are no longer in the available matches list.
  
  This function removes matches from the ETS table for a specific sport
  that are not present in the latest available matches frame.
  
  ## Parameters
  - sport: The sport name
  - avl_frame: The processed available matches frame
  """
  def cleanup_removed_matches(sport, avl_frame) do
    # Get the list of match IDs that are currently available
    available_match_ids = case avl_frame do
      %{"matches" => matches} when is_list(matches) ->
        Enum.map(matches, fn match -> match["id"] end)
      _ ->
        []
    end
    
    # Get the appropriate table
    table = get_sport_table(sport)
    
    # Get all matches currently in the table
    current_matches = :ets.tab2list(table)
    
    # For each match in the table
    Enum.each(current_matches, fn {match_id, _small_data, _full_data} ->
      # If this match ID is not in the available list, remove it
      unless match_id in available_match_ids do
        :ets.delete(table, match_id)
        
        # Broadcast that the match was removed
        Phoenix.PubSub.broadcast(
          Sportsbook.PubSub,
          "match_updates",
          {:match_removed, sport, match_id}
        )
      end
    end)
  end
  
  @doc """
  Store a match update (updt) frame for a specific match.
  
  ## Parameters
  - sport: The sport name (e.g., "soccer", "basket")
  - updt_frame: The complete updt frame as received from the websocket
  """
  def store_updt_frame(sport, updt_frame) do
    # Get the appropriate table for this sport
    table = get_sport_table(sport)
    
    # Extract match ID
    match_id = updt_frame["id"]
    
    # Extract small data (relevant information for quick display)
    small_data = extract_small_data(sport, updt_frame)
    
    # Store the data
    :ets.insert(table, {match_id, small_data, updt_frame})
    
    # Broadcast the update via PubSub for general match updates
    Phoenix.PubSub.broadcast(
      Sportsbook.PubSub,
      "match_updates",
      {:match_updated, sport, match_id, small_data}
    )
    
    # Broadcast the specific match update to its own topic for real-time frontend updates
    Phoenix.PubSub.broadcast(
      Sportsbook.PubSub,
      "#{sport}:#{match_id}",
      {:match_data, small_data}
    )
    
    # Broadcast full match data to details topic (only if there are subscribers)
    # Always broadcast - Phoenix PubSub is efficient with no subscribers
    details_topic = "#{sport}:#{match_id}:details"
    Phoenix.PubSub.broadcast(
      Sportsbook.PubSub,
      details_topic,
      {:match_details_data, updt_frame}
    )
  end
  
  @doc """
  Get all available matches from the ETS table.
  
  ## Returns
  A list of {sport, avl_frame} tuples.
  """
  def get_all_available_matches() do
    :ets.tab2list(:available_matches)
  end
  
  @doc """
  Get available matches for a specific sport.
  
  ## Parameters
  - sport: The sport name
  
  ## Returns
  The avl_frame for the specified sport, or nil if not found.
  """
  def get_available_matches(sport) do
    case :ets.lookup(:available_matches, sport) do
      [{^sport, avl_frame}] -> avl_frame
      [] -> nil
    end
  end
  
  @doc """
  Get all match updates for a specific sport.
  
  ## Parameters
  - sport: The sport name
  
  ## Returns
  A list of {match_id, small_data, updt_frame} tuples.
  """
  def get_sport_matches(sport) do
    table = get_sport_table(sport)
    :ets.tab2list(table)
  end
  
  @doc """
  Get a specific match update.
  
  ## Parameters
  - sport: The sport name
  - match_id: The match ID
  
  ## Returns
  A {match_id, small_data, updt_frame} tuple, or nil if not found.
  """
  def get_match(sport, match_id) do
    table = get_sport_table(sport)
    case :ets.lookup(table, match_id) do
      [{^match_id, small_data, updt_frame}] -> {match_id, small_data, updt_frame}
      [] -> nil
    end
  end
  
  # Private functions
  
  # Get the ETS table name for a specific sport
  defp get_sport_table(sport) do
    case sport do
      "soccer" -> :soccer_matches
      "basket" -> :basket_matches
      "tennis" -> :tennis_matches
      "baseball" -> :baseball_matches
      "amfootball" -> :amfootball_matches
      "hockey" -> :hockey_matches
      "volleyball" -> :volleyball_matches
      _ -> 
        Logger.warn("Unknown sport: #{sport}")
        :soccer_matches # Default to soccer as a fallback
    end
  end
  
  # Extract small data (relevant info for quick display) from an updt frame
  defp extract_small_data(sport, updt_frame) do
    # Common data across all sports
    small_data = %{
      "id" => updt_frame["id"],
      "t1" => %{"name" => updt_frame["t1"]["n"]},
      "t2" => %{"name" => updt_frame["t2"]["n"]},
      "time" => updt_frame["et"],
      "period" => updt_frame["pc"],
      "updated_at" => updt_frame["uptd"],
      "league" => updt_frame["ctry_name"] || "Unknown League"
    }
    
    # Add sport-specific score data
    small_data = case sport do
      "soccer" -> 
        stats = updt_frame["stats"]
        score = if stats["a"], do: stats["a"], else: [0, 0]
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "score", Enum.at(score, 0)),
          "t2" => Map.put(small_data["t2"], "score", Enum.at(score, 1)),
          "xy" => updt_frame["xy"] # Ball position for soccer
        })
        
      "basket" ->
        stats = updt_frame["stats"]
        score = if stats["T"], do: stats["T"], else: [0, 0]
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "score", Enum.at(score, 0)),
          "t2" => Map.put(small_data["t2"], "score", Enum.at(score, 1)),
          "quarter_scores" => %{
            "Q1" => stats["Q1"],
            "Q2" => stats["Q2"],
            "Q3" => stats["Q3"],
            "Q4" => stats["Q4"]
          }
        })
        
      "tennis" ->
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "sets", updt_frame["t1"]["s"]),
          "t2" => Map.put(small_data["t2"], "sets", updt_frame["t2"]["s"]),
          "current_server" => updt_frame["stats"]["Current"]
        })
        
      "baseball" ->
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "innings", updt_frame["t1"]["s"]),
          "t2" => Map.put(small_data["t2"], "innings", updt_frame["t2"]["s"]),
          "current" => updt_frame["stats"]["Current"]
        })
        
      "amfootball" ->
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "score", Enum.sum(updt_frame["t1"]["q"] || [0, 0, 0, 0])),
          "t2" => Map.put(small_data["t2"], "score", Enum.sum(updt_frame["t2"]["q"] || [0, 0, 0, 0])),
          "quarters" => %{
            "q1" => updt_frame["t1"]["q"],
            "q2" => updt_frame["t2"]["q"]
          },
          "current" => updt_frame["stats"]["Current"]
        })
        
      "hockey" ->
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "score", Enum.sum(updt_frame["t1"]["p"] || [0, 0, 0])),
          "t2" => Map.put(small_data["t2"], "score", Enum.sum(updt_frame["t2"]["p"] || [0, 0, 0])),
          "periods" => %{
            "p1" => updt_frame["t1"]["p"],
            "p2" => updt_frame["t2"]["p"]
          },
          "current" => updt_frame["stats"]["Current"]
        })
        
      "volleyball" ->
        Map.merge(small_data, %{
          "t1" => Map.put(small_data["t1"], "sets", updt_frame["t1"]["s"]),
          "t2" => Map.put(small_data["t2"], "sets", updt_frame["t2"]["s"]),
          "current" => updt_frame["stats"]["Current"]
        })
        
      # Default fallback
      _ -> small_data
    end
    
    small_data
  end
end