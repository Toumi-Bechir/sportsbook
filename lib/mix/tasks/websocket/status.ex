defmodule Mix.Tasks.Websocket.Status do
  @moduledoc """
  Mix task for checking the status of websocket connections.
  """
  use Mix.Task
  
  @shortdoc "Check websocket connection status"
  @doc """
  Displays the status of all websocket connections.
  
  ## Examples
  
      $ mix websocket.status
      
  """
  def run(_args) do
    # Start required applications
    {:ok, _} = Application.ensure_all_started(:sportsbook)
    
    # Get list of active connections
    active_connections = Sportsbook.API.WebsocketSupervisor.list_active_connections()
    
    IO.puts("\nActive Websocket Connections:")
    IO.puts("-----------------------------")
    
    if Enum.empty?(active_connections) do
      IO.puts("No active connections")
    else
      for {id, sport} <- active_connections do
        IO.puts("#{sport} (#{id})")
      end
    end
    
    IO.puts("\nAvailable sports:")
    available_sports = [:soccer, :basket, :tennis, :baseball, :amfootball, :hockey, :volleyball]
    |> Enum.map_join(", ", &to_string/1)
    
    IO.puts(available_sports)
    
    # Print token info
    IO.puts("\nToken Status:")
    IO.puts("------------")
    
    case Sportsbook.API.TokenClient.get_current_token() do
      {:ok, token} ->
        IO.puts("Token: #{token["token"]}")
        IO.puts("Expiry: #{token["expiry"]}")
        
      {:error, reason} ->
        IO.puts("Error: #{reason}")
    end
  end
end