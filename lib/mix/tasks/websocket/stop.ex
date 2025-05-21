defmodule Mix.Tasks.Websocket.Stop do
  @moduledoc """
  Mix task for stopping a websocket connection for a specific sport.
  """
  use Mix.Task
  
  @shortdoc "Stop a websocket connection for a sport"
  @doc """
  Stops a websocket connection for a specific sport.
  
  ## Examples
  
      $ mix websocket.stop soccer
      $ mix websocket.stop basket
      $ mix websocket.stop tennis
      $ mix websocket.stop baseball
      $ mix websocket.stop amfootball
      $ mix websocket.stop hockey
      $ mix websocket.stop volleyball
      
  """
  def run(args) do
    # Start required applications
    {:ok, _} = Application.ensure_all_started(:sportsbook)
    
    sport = parse_sport(args)
    
    IO.puts("Stopping #{sport} websocket connection...")
    
    case Sportsbook.API.WebsocketSupervisor.stop_sport(sport) do
      :ok ->
        IO.puts("Successfully stopped #{sport} websocket connection")
        
      {:error, :not_found} ->
        IO.puts("No active #{sport} websocket connection found")
        
      {:error, reason} ->
        IO.puts("Failed to stop #{sport} websocket connection: #{inspect(reason)}")
    end
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
end