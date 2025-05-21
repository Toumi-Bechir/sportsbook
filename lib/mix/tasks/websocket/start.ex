defmodule Mix.Tasks.Websocket.Start do
  @moduledoc """
  Mix task for starting a websocket connection for a specific sport.
  """
  use Mix.Task
  
  @shortdoc "Start a websocket connection for a sport"
  @doc """
  Starts a websocket connection for a specific sport.
  
  ## Examples
  
      $ mix websocket.start soccer
      $ mix websocket.start basket
      $ mix websocket.start tennis
      $ mix websocket.start baseball
      $ mix websocket.start amfootball
      $ mix websocket.start hockey
      $ mix websocket.start volleyball
      
  """
  def run(args) do
    # Start required applications
    {:ok, _} = Application.ensure_all_started(:sportsbook)
    
    sport = parse_sport(args)
    
    IO.puts("Starting #{sport} websocket connection...")
    
    case Sportsbook.API.WebsocketSupervisor.start_sport(sport) do
      {:ok, _pid} ->
        IO.puts("Successfully started #{sport} websocket connection")
        
      {:error, {:already_started, _}} ->
        IO.puts("#{sport} websocket connection is already active")
        
      {:error, reason} ->
        IO.puts("Failed to start #{sport} websocket connection: #{inspect(reason)}")
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