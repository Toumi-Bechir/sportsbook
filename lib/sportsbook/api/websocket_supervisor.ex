defmodule Sportsbook.API.WebsocketSupervisor do
  @moduledoc """
  Supervisor for managing websocket connections to different sports feeds.
  
  This supervisor starts and monitors websocket clients for each sport type
  that we want to connect to at application startup.
  """
  use Supervisor
  require Logger

  # All available sports to connect to at startup
  @all_sports [
    :soccer,
    :basket,
    :tennis,
    :baseball,
    :amfootball,
    :hockey,
    :volleyball
  ]

  def start_link(opts) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    # Get sports to connect to from config, defaulting to all sports
    # This allows overriding via application config if needed
    sports = Application.get_env(:sportsbook, :websocket_sports, @all_sports)
    
    Logger.info("Starting websocket connections for #{length(sports)} sports: #{inspect(sports)}")
    
    # Create a child spec for each sport
    children = Enum.map(sports, fn sport ->
      {Sportsbook.API.WebsocketClient, sport}
    end)
    
    # Use one_for_one strategy so an individual sport connection can fail
    # without affecting the others
    Supervisor.init(children, strategy: :one_for_one)
  end
  
  @doc """
  Dynamically start a websocket client for a specific sport.
  """
  def start_sport(sport) do
    Supervisor.start_child(__MODULE__, {Sportsbook.API.WebsocketClient, sport})
  end
  
  @doc """
  Dynamically stop a websocket client for a specific sport.
  """
  def stop_sport(sport) do
    # Find the child with this sport
    case find_child_by_sport(sport) do
      {:ok, child_id} ->
        Supervisor.terminate_child(__MODULE__, child_id)
        Supervisor.delete_child(__MODULE__, child_id)
        
      :error ->
        {:error, :not_found}
    end
  end
  
  @doc """
  List all active websocket connections.
  """
  def list_active_connections do
    for {id, pid, _, _} <- Supervisor.which_children(__MODULE__) do
      case pid do
        :undefined -> nil
        _ -> 
          # Extract the sport from the websocket client state
          %{sport: sport} = :sys.get_state(pid)
          {id, sport}
      end
    end
    |> Enum.reject(&is_nil/1)
  end
  
  # Find a child by its sport
  defp find_child_by_sport(sport) do
    # Loop through children and check their state
    Supervisor.which_children(__MODULE__)
    |> Enum.find_value(:error, fn {id, pid, _, _} ->
      case pid do
        :undefined -> nil
        _ ->
          case :sys.get_state(pid) do
            %{sport: ^sport} -> {:ok, id}
            _ -> nil
          end
      end
    end)
  end
end