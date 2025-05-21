defmodule SportsbookWeb.WebsocketLive.Index do
  use SportsbookWeb, :live_view
  require Logger

  @impl true
  def mount(_params, _session, socket) do
    # Subscribe to PubSub events for soccer by default
    Phoenix.PubSub.subscribe(Sportsbook.PubSub, "goalserve:soccer")
    
    active_connections = Sportsbook.API.WebsocketSupervisor.list_active_connections()
    
    {:ok, socket
    |> assign(:active_connections, active_connections)
    |> assign(:current_sport, :soccer)
    |> assign(:events, [])
    |> assign(:token, get_current_token())
    }
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_action(socket, socket.assigns.live_action, params)}
  end

  defp apply_action(socket, :index, _params) do
    socket
    |> assign(:page_title, "Goalserve Websocket Feed")
  end

  @impl true
  def handle_event("toggle-connection", %{"sport" => sport}, socket) do
    sport = String.to_existing_atom(sport)
    
    # Check if this sport is in the active connections
    active_connections = socket.assigns.active_connections
    is_active = Enum.any?(active_connections, fn {_id, s} -> s == sport end)
    
    if is_active do
      # Stop the connection
      Sportsbook.API.WebsocketSupervisor.stop_sport(sport)
      # Unsubscribe from events
      Phoenix.PubSub.unsubscribe(socket.assigns.current_sport)
    else
      # Start the connection
      Sportsbook.API.WebsocketSupervisor.start_sport(sport)
    end
    
    # Update the list of active connections
    active_connections = Sportsbook.API.WebsocketSupervisor.list_active_connections()
    
    {:noreply, assign(socket, :active_connections, active_connections)}
  end
  
  def handle_event("change-sport", %{"sport" => sport}, socket) do
    sport = String.to_existing_atom(sport)
    
    # Unsubscribe from the current sport
    Phoenix.PubSub.unsubscribe(socket.assigns.current_sport)
    
    # Subscribe to the new sport
    Phoenix.PubSub.subscribe("goalserve:#{sport}")
    
    {:noreply, assign(socket, :current_sport, sport)}
  end
  
  def handle_event("refresh-token", _, socket) do
    # Force a token refresh
    Sportsbook.API.TokenClient.force_refresh()
    
    # Wait for the token to refresh
    Process.sleep(500)
    
    # Get the updated token
    token = get_current_token()
    
    {:noreply, assign(socket, :token, token)}
  end

  @impl true
  def handle_info({:goalserve_event, event}, socket) do
    # Add the new event to the list, keeping only the last 20
    events = [event | socket.assigns.events] |> Enum.take(20)
    
    {:noreply, assign(socket, :events, events)}
  end
  
  # Helper to get the current token
  defp get_current_token do
    case Sportsbook.API.TokenClient.get_current_token() do
      {:ok, token_data} ->
        token_data
      _ ->
        nil
    end
  end
end