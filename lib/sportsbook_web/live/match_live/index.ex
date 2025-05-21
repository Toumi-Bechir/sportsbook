defmodule SportsbookWeb.MatchLive.Index do
  use SportsbookWeb, :live_view
  require Logger

  @sports ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"]

  @impl true
  def mount(_params, _session, socket) do
    # Subscribe to match updates
    Phoenix.PubSub.subscribe(Sportsbook.PubSub, "match_updates")
    
    # Get initial data for all sports
    available_matches = Sportsbook.Storage.MatchStore.get_all_available_matches()
    
    matches_by_sport = @sports
      |> Enum.map(fn sport -> {sport, Sportsbook.Storage.MatchStore.get_sport_matches(sport)} end)
      |> Enum.into(%{})
    
    # Setup auto-refresh every 10 seconds
    if connected?(socket) do
      :timer.send_interval(10000, self(), :refresh_data)
    end
    
    {:ok, socket
      |> assign(:selected_tab, "overview")
      |> assign(:available_matches, available_matches)
      |> assign(:matches_by_sport, matches_by_sport)
      |> assign(:loading, false)
      |> assign(:last_update, DateTime.utc_now())
      |> assign(:sports, @sports)
    }
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :index, _params) do
    socket
    |> assign(:page_title, "Live Match Data")
    |> assign(:selected_tab, "overview")
  end

  defp apply_action(socket, :show_available, _params) do
    socket
    |> assign(:page_title, "Available Matches")
    |> assign(:selected_tab, "available")
  end

  defp apply_action(socket, :show_sport, %{"sport" => sport}) do
    socket
    |> assign(:page_title, "#{String.capitalize(sport)} Matches")
    |> assign(:selected_tab, sport)
  end

  # This handler is no longer needed as we've moved to path-based navigation
  # Keeping it for backward compatibility with any existing buttons
  @impl true
  def handle_event("select-tab", %{"tab" => tab}, socket) do
    case tab do
      "overview" ->
        {:noreply, push_patch(socket, to: ~p"/matches")}
        
      "available" ->
        {:noreply, push_patch(socket, to: ~p"/matches/available")}
        
      # For sport tabs, navigate to the sport-specific route
      sport when sport in @sports ->
        {:noreply, push_patch(socket, to: ~p"/matches/#{sport}")}
      
      # Fallback
      _ ->
        {:noreply, assign(socket, :selected_tab, tab)}
    end
  end

  @impl true
  def handle_info({:match_updated, sport, match_id, _small_data}, socket) do
    # A match has been updated, refresh the matches for this sport
    matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
    matches_by_sport = Map.put(socket.assigns.matches_by_sport, sport, matches)
    
    {:noreply, socket
      |> assign(:matches_by_sport, matches_by_sport)
      |> assign(:last_update, DateTime.utc_now())}
  end
  
  @impl true
  def handle_info({:match_removed, sport, match_id}, socket) do
    # A match has been removed, refresh the matches for this sport
    matches = Sportsbook.Storage.MatchStore.get_sport_matches(sport)
    matches_by_sport = Map.put(socket.assigns.matches_by_sport, sport, matches)
    
    {:noreply, socket
      |> assign(:matches_by_sport, matches_by_sport)
      |> assign(:last_update, DateTime.utc_now())}
  end

  @impl true
  def handle_info(:refresh_data, socket) do
    # Refresh all data
    available_matches = Sportsbook.Storage.MatchStore.get_all_available_matches()
    
    matches_by_sport = @sports
      |> Enum.map(fn sport -> {sport, Sportsbook.Storage.MatchStore.get_sport_matches(sport)} end)
      |> Enum.into(%{})
    
    {:noreply, socket
      |> assign(:available_matches, available_matches)
      |> assign(:matches_by_sport, matches_by_sport)
      |> assign(:last_update, DateTime.utc_now())}
  end

  # Helper to format time in a human-readable way
  defp format_time(seconds) when is_integer(seconds) do
    minutes = div(seconds, 60)
    remaining_seconds = rem(seconds, 60)
    "#{minutes}:#{String.pad_leading("#{remaining_seconds}", 2, "0")}"
  end
  defp format_time(_), do: "00:00"
  
  # Get score for a match based on sport
  defp get_score(small_data, sport) do
    case sport do
      "soccer" -> "#{small_data["t1"]["score"]}-#{small_data["t2"]["score"]}"
      "basket" -> "#{small_data["t1"]["score"]}-#{small_data["t2"]["score"]}"
      "tennis" -> 
        sets1 = small_data["t1"]["sets"]
        sets2 = small_data["t2"]["sets"]
        if sets1 && sets2 do
          "Sets: #{Enum.count(sets1)}-#{Enum.count(sets2)}"
        else
          "0-0"
        end
      "baseball" -> 
        innings1 = small_data["t1"]["innings"]
        innings2 = small_data["t2"]["innings"]
        if innings1 && innings2 do
          "#{Enum.sum(innings1 || [0])}-#{Enum.sum(innings2 || [0])}"
        else
          "0-0"
        end
      "amfootball" -> "#{small_data["t1"]["score"]}-#{small_data["t2"]["score"]}"
      "hockey" -> "#{small_data["t1"]["score"]}-#{small_data["t2"]["score"]}"
      "volleyball" ->
        sets1 = small_data["t1"]["sets"]
        sets2 = small_data["t2"]["sets"]
        if sets1 && sets2 do
          score1 = Enum.count(Enum.filter(sets1, fn s -> s > 0 end))
          score2 = Enum.count(Enum.filter(sets2, fn s -> s > 0 end))
          "Sets: #{score1}-#{score2}"
        else
          "0-0"
        end
      _ -> "N/A"
    end
  end
  
  # Get period description based on sport and period count
  defp get_period(period, sport) do
    case sport do
      "soccer" ->
        case period do
          1 -> "1st Half"
          2 -> "2nd Half"
          3 -> "Extra Time"
          4 -> "Penalties"
          _ -> "Unknown"
        end
      "basket" ->
        case period do
          1 -> "1st Quarter"
          2 -> "2nd Quarter"
          3 -> "3rd Quarter"
          4 -> "4th Quarter"
          5 -> "Overtime"
          _ -> "Unknown"
        end
      "tennis" -> "Set #{period}"
      "baseball" -> "Inning #{period}"
      "amfootball" ->
        case period do
          1 -> "1st Quarter"
          2 -> "2nd Quarter"
          3 -> "3rd Quarter"
          4 -> "4th Quarter"
          5 -> "Overtime"
          _ -> "Unknown"
        end
      "hockey" ->
        case period do
          1 -> "1st Period"
          2 -> "2nd Period"
          3 -> "3rd Period"
          4 -> "Overtime"
          _ -> "Unknown"
        end
      "volleyball" -> "Set #{period}"
      _ -> "Period #{period}"
    end
  end
end