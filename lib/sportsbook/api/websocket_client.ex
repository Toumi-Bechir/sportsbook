defmodule Sportsbook.API.WebsocketClient do
  @moduledoc """
  Client for connecting to the Goalserve websocket API.

  Uses the token from TokenClient to establish a connection
  and process incoming messages.
  """
  use WebSockex
  require Logger

  @base_url "ws://152.89.28.69:8765/ws"

  # Map of sport types to their string representation for the URL
  @sport_types %{
    soccer: "soccer",
    basket: "basket",
    tennis: "tennis",
    baseball: "baseball",
    amfootball: "amfootball",
    hockey: "hockey",
    volleyball: "volleyball"
  }

  # Client API

  @doc """
  Starts a websocket connection for the specified sport type.
  This function is called by the supervisor.

  ## Parameters

  * `sport` - The sport type to connect to. Can be one of:
    `:soccer`, `:basket`, `:tennis`, `:baseball`, `:amfootball`, `:hockey`, `:volleyball`
  * `opts` - Additional options to pass to WebSockex

  ## Returns

  * `{:ok, pid}` - If the connection is successful
  * `{:error, reason}` - If the connection fails
  """
  def start_link(sport) when is_atom(sport) do
    Logger.info("Starting WebsocketClient for #{sport}")
    opts = []  # Can be configured in the future if needed

    case validate_sport(sport) do
      {:ok, sport_code} ->
        case {:ok, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1biI6InRiZWNoaXIiLCJuYmYiOjE3NDc3OTk4ODksImV4cCI6MTc0NzgwMzQ4OSwiaWF0IjoxNzQ3Nzk5ODg5fQ.hK0XBhXPsM_PjfJ_L7nHX2TwbtM8jSmOmv-gn5-rQUQ"} do #Sportsbook.API.TokenClient.get_current_token() do
          {:ok, token_data} ->
            token = token_data#["token"]
            url = "#{@base_url}/#{sport_code}?tkn=#{token}"
            name = process_name(sport)
            Logger.info("Connecting to #{url} with token: #{String.slice(token, 0, 10)}...")
            WebSockex.start_link(url, __MODULE__, %{sport: sport, reconnect_attempts: 0}, [name: name] ++ opts)

          {:error, reason} ->
            Logger.error("Failed to get token for websocket connection: #{reason}")
            {:error, "Failed to get token: #{reason}"}
        end

      {:error, _} = error ->
        error
    end
  end

  # Support for child_spec to work with Supervisor
  def child_spec(sport) do
    %{
      id: {__MODULE__, sport},
      start: {__MODULE__, :start_link, [sport]},
      restart: :permanent,
      shutdown: 5000,
      type: :worker
    }
  end

  @doc """
  Sends a message to the websocket connection.

  ## Parameters

  * `sport` - The sport type connection to send to
  * `message` - The message to send
  """
  def send_message(sport, message) do
    case validate_sport(sport) do
      {:ok, _} ->
        name = process_name(sport)
        WebSockex.send_frame(name, {:text, message})

      {:error, _} = error ->
        error
    end
  end

  @doc """
  Stops the websocket connection.

  ## Parameters

  * `sport` - The sport type connection to stop
  """
  def stop(sport) do
    case validate_sport(sport) do
      {:ok, _} ->
        name = process_name(sport)
        WebSockex.cast(name, :stop)

      {:error, _} = error ->
        error
    end
  end

  # Server Callbacks

  @impl true
  def handle_connect(conn, state) do
    Logger.info("Connected to #{state.sport} websocket")
    # Reset reconnect attempts counter on successful connection
    {:ok, Map.put(state, :reconnect_attempts, 0)}
  end

  @impl true
  def handle_frame({:text, msg}, state) do
    case Jason.decode(msg) do
      {:ok, parsed} ->
        Logger.debug("Received message from #{state.sport} websocket: #{inspect(parsed)}")
        process_message(parsed, state.sport)

      {:error, _} ->
        Logger.warn("Received non-JSON message from #{state.sport} websocket: #{msg}")
    end

    {:ok, state}
  end

  @impl true
  def handle_cast(:stop, state) do
    Logger.info("Stopping #{state.sport} websocket connection")
    {:close, state}
  end

  @impl true
  def handle_disconnect(%{reason: reason}, state) do
    Logger.warn("#{state.sport} websocket disconnected: #{inspect(reason)}")

    # Attempt to reconnect after a short delay with backoff
    # Start with 5 seconds, but use exponential backoff for persistent failures
    backoff = Map.get(state, :reconnect_attempts, 0) * 1000 + 5000
    backoff = min(backoff, 60000) # Max 60 seconds

    Process.sleep(backoff)
    Logger.info("Attempting to reconnect #{state.sport} websocket (attempt #{Map.get(state, :reconnect_attempts, 0) + 1})...")

    # Get a fresh token in case the disconnect was due to token expiration
    case Sportsbook.API.TokenClient.get_current_token() do
      {:ok, token_data} ->
        token = token_data["token"]
        sport_code = Map.get(@sport_types, state.sport)
        url = "#{@base_url}/#{sport_code}?tkn=#{token}"
        Logger.info("Reconnecting to #{url} with token: #{String.slice(token, 0, 10)}...")

        # Update state with incremented reconnect attempts
        state = Map.update(state, :reconnect_attempts, 1, &(&1 + 1))
        {:reconnect, url, state}

      {:error, reason} ->
        Logger.error("Failed to get token for reconnect: #{reason}")
        # Update state with incremented reconnect attempts
        state = Map.update(state, :reconnect_attempts, 1, &(&1 + 1))
        # Try again after backoff
        {:reconnect, nil, state}
    end
  end

  @impl true
  def terminate(reason, state) do
    Logger.warn("#{state.sport} websocket terminated: #{inspect(reason)}")
    :ok
  end

  # Private Functions

  defp validate_sport(sport) when is_atom(sport) do
    case Map.get(@sport_types, sport) do
      nil -> {:error, "Invalid sport type: #{sport}"}
      sport_code -> {:ok, sport_code}
    end
  end

  defp validate_sport(sport) when is_binary(sport) do
    # Try to convert string to atom if it's a valid sport name
    try do
      sport
      |> String.to_existing_atom()
      |> validate_sport()
    rescue
      ArgumentError -> {:error, "Invalid sport type: #{sport}"}
    end
  end

  defp validate_sport(sport) do
    {:error, "Invalid sport type: #{inspect(sport)}"}
  end

  defp process_name(sport) do
    # Create a process name based on the sport
    :"goalserve_ws_#{sport}"
  end

  defp process_message(message, sport) do
    # Process the incoming message from the websocket
    sport_str = Atom.to_string(sport)

    # Store the message in the appropriate ETS table based on message type
    case message["mt"] do
      "updt" ->
        # Store match update message
        Sportsbook.Storage.MatchStore.store_updt_frame(sport_str, message)

      "avl" ->
        # Store available matches message and clean up removed matches
        Logger.info("Received available matches for #{sport_str} with #{length(message["evts"] || [])} events")
        Sportsbook.Storage.MatchStore.store_avl_frame(sport_str, message)


      _ ->
        # For other message types, just log
        Logger.debug("Received unsupported message type: #{message["mt"]}")
    end

    # Create a topic based on the sport
    topic = "goalserve:#{sport}"

    # Broadcast the message to subscribers
    Phoenix.PubSub.broadcast(Sportsbook.PubSub, topic, {:goalserve_event, message})
  end
end
