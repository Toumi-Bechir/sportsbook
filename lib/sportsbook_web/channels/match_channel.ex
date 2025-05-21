defmodule SportsbookWeb.MatchChannel do
  use SportsbookWeb, :channel
  require Logger

  @impl true
  def join("matches:" <> sport, _payload, socket) do
    Logger.info("Client joined matches channel for sport: #{sport}")
    
    # Subscribe to match updates for this sport
    Phoenix.PubSub.subscribe(Sportsbook.PubSub, "match_updates")
    
    # Send self a message to push initial data after join
    send(self(), {:after_join, sport})
    
    {:ok, assign(socket, :sport, sport)}
  end

  @impl true
  def join("match:" <> match_topic, _payload, socket) do
    [sport, match_id] = String.split(match_topic, ":")
    Logger.info("Client subscribed to specific match: #{sport}:#{match_id}")
    
    # Subscribe to this specific match's updates
    Phoenix.PubSub.subscribe(Sportsbook.PubSub, "#{sport}:#{match_id}")
    
    # Send self a message to push initial match data after join
    send(self(), {:after_match_join, sport, match_id})
    
    {:ok, assign(socket, :match_topic, "#{sport}:#{match_id}")}
  end

  @impl true
  def handle_info({:after_join, sport}, socket) do
    # Get all matches for this sport
    matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
    
    # Group matches by league
    grouped_matches = group_matches_by_league(matches)
    
    # Send initial data
    push(socket, "initial_matches", %{
      sport: sport,
      matches: grouped_matches
    })
    
    {:noreply, socket}
  end

  @impl true
  def handle_info({:after_match_join, sport, match_id}, socket) do
    # Get current match data if available
    case Sportsbook.Storage.MatchStore.get_match(sport, match_id) do
      {^match_id, small_data, _full_data} ->
        push(socket, "match_update", %{
          match_id: match_id,
          data: small_data
        })
      _ ->
        :ok
    end
    
    {:noreply, socket}
  end

  @impl true
  def handle_info({:match_data, small_data}, socket) do
    # Forward the match data update to the client
    push(socket, "match_update", %{
      data: small_data
    })
    
    {:noreply, socket}
  end

  @impl true
  def handle_info({:match_updated, sport, match_id, small_data}, socket) do
    # Only handle if this is for our sport
    if socket.assigns[:sport] == sport do
      # Get all matches for this sport and regroup
      matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
      grouped_matches = group_matches_by_league(matches)
      
      push(socket, "matches_updated", %{
        sport: sport,
        matches: grouped_matches
      })
    end
    
    {:noreply, socket}
  end

  @impl true
  def handle_info({:match_removed, sport, match_id}, socket) do
    # Only handle if this is for our sport
    if socket.assigns[:sport] == sport do
      push(socket, "match_removed", %{
        sport: sport,
        match_id: match_id
      })
      
      # Get updated matches and regroup
      matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
      grouped_matches = group_matches_by_league(matches)
      
      push(socket, "matches_updated", %{
        sport: sport,
        matches: grouped_matches
      })
    end
    
    {:noreply, socket}
  end

  # Catch-all for other messages
  @impl true
  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  # Private helper functions
  
  defp group_matches_by_league(matches) do
    matches
    |> Enum.reduce(%{}, fn {match_id, small_data, _full_data}, acc ->
      league = small_data["league"] || "Unknown League"
      
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
end