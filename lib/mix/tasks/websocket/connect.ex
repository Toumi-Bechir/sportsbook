defmodule Mix.Tasks.Websocket.Connect do
  @moduledoc """
  Mix task for connecting to the Goalserve websocket for a specific sport.
  """
  use Mix.Task
  require Logger
  
  @shortdoc "Connect to a sport's websocket feed"
  @doc """
  Connects to the Goalserve websocket feed for a specific sport.
  
  ## Examples
  
      $ mix websocket.connect soccer
      $ mix websocket.connect basket
      $ mix websocket.connect tennis
      $ mix websocket.connect baseball
      $ mix websocket.connect amfootball
      $ mix websocket.connect hockey
      $ mix websocket.connect volleyball
      
  """
  def run(args) do
    # Start required applications
    {:ok, _} = Application.ensure_all_started(:sportsbook)
    
    sport = parse_sport(args)
    
    # Connect to the websocket
    IO.puts("Connecting to #{sport} websocket feed...")
    {:ok, _pid} = Sportsbook.API.WebsocketClient.start_link(sport)
    
    IO.puts("Connected! Listening for messages (Press Ctrl+C to quit)...")
    
    # Subscribe to the PubSub channel to receive messages
    Phoenix.PubSub.subscribe(Sportsbook.PubSub, "goalserve:#{sport}")
    
    # Keep the process alive to receive messages
    listen_for_events()
  end
  
  defp parse_sport([sport | _]) do
    # Convert the sport name to a symbol
    String.to_atom(sport)
  end
  
  defp parse_sport(_) do
    # Default to soccer if no sport is provided
    IO.puts("No sport specified, defaulting to soccer")
    :soccer
  end
  
  defp listen_for_events do
    receive do
      {:goalserve_event, event} ->
        IO.puts("\nReceived event:")
        IO.puts(Jason.encode!(event, pretty: true))
        listen_for_events()
        
      other ->
        IO.puts("\nReceived unknown message: #{inspect(other)}")
        listen_for_events()
    end
  end
end