defmodule SportsbookWeb.MatchChannel do
  use SportsbookWeb, :channel
  require Logger

  @impl true
  def join("matches:" <> sport, _payload, socket) do
    Logger.info("Client joined matches channel for sport: #{sport} (deprecated - use individual match channels)")
    
    # This channel is now deprecated - clients should use individual match:sport:id channels
    # Keeping for backwards compatibility but not subscribing to updates
    
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
  def join("match_details:" <> match_topic, _payload, socket) do
    [sport, match_id] = String.split(match_topic, ":")
    Logger.info("Client subscribed to detailed match data: #{sport}:#{match_id}")
    
    # Subscribe to this specific match's full data updates
    Phoenix.PubSub.subscribe(Sportsbook.PubSub, "#{sport}:#{match_id}:details")
    
    # Send self a message to push initial full match data after join
    send(self(), {:after_detail_join, sport, match_id})
    
    {:ok, socket 
          |> assign(:detail_topic, "#{sport}:#{match_id}")
          |> assign(:match_id, match_id)
          |> assign(:sport, sport)}
  end

  @impl true
  def handle_info({:after_join, sport}, socket) do
    # Deprecated - no longer used with individual match subscriptions
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
  def handle_info({:after_detail_join, sport, match_id}, socket) do
    # Get current full match data if available
    case Sportsbook.Storage.MatchStore.get_match(sport, match_id) do
      {^match_id, _small_data, full_data} ->
        push(socket, "full_match_data", %{
          match_id: match_id,
          data: full_data
        })
      _ ->
        push(socket, "full_match_data", %{
          match_id: match_id,
          data: nil
        })
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
  def handle_info({:match_details_data, full_data}, socket) do
    # Forward the full match data update to the client
    if socket.assigns[:match_id] do
      push(socket, "full_match_data", %{
        match_id: socket.assigns.match_id,
        data: full_data
      })
    end
    
    {:noreply, socket}
  end

  @impl true
  def handle_info({:match_updated, sport, match_id, small_data}, socket) do
    # Deprecated - no longer used with individual match subscriptions
    {:noreply, socket}
  end

  @impl true
  def handle_info({:match_removed, sport, match_id}, socket) do
    # Deprecated - no longer used with individual match subscriptions  
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