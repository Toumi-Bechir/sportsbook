defmodule SportsbookWeb.HomeLive.Index do
  use SportsbookWeb, :live_view
  
  @impl true
  def mount(_params, _session, socket) do
    # Get active sports with matches
    sports_with_matches = [
      "soccer", 
      "basket", 
      "tennis", 
      "baseball", 
      "amfootball", 
      "hockey", 
      "volleyball"
    ]
    |> Enum.map(fn sport -> 
      {sport, Sportsbook.Storage.MatchStore.get_sport_matches(sport)}
    end)
    |> Enum.filter(fn {_sport, matches} -> not Enum.empty?(matches) end)
    |> Enum.map(fn {sport, matches} -> sport end)
    
    # Get active websocket connections
    active_connections = 
      try do
        Sportsbook.API.WebsocketSupervisor.list_active_connections()
        |> Enum.map(fn {_id, sport} -> Atom.to_string(sport) end)
      rescue
        _ -> []
      end
    
    {:ok, socket
      |> assign(:page_title, "Sportsbook LiveView Demo")
      |> assign(:sports_with_matches, sports_with_matches)
      |> assign(:active_connections, active_connections)
    }
  end
end