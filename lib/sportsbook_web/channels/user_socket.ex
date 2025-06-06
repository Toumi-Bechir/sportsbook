defmodule SportsbookWeb.UserSocket do
  use Phoenix.Socket
  require Logger

  # A Socket handler
  #
  # It's possible to control the websocket connection and
  # assign values that can be accessed by your channel topics.

  ## Channels
  channel "matches:*", SportsbookWeb.MatchChannel
  channel "match:*", SportsbookWeb.MatchChannel
  channel "match_details:*", SportsbookWeb.MatchChannel

  # Socket params are passed from the client and can
  # be used to verify and authenticate a user. After
  # verification, you can put the verified data in the
  # socket assigns.
  @impl true
  def connect(params, socket, _connect_info) do
    Logger.info("Client connecting to socket with params: #{inspect(params)}")
    {:ok, socket}
  end

  # Socket IDs are topics that allow you to identify all sockets for a given user:
  #
  #     def id(socket), do: "user_socket:#{socket.assigns.user_id}"
  #
  # Would allow you to broadcast a "disconnect" event and terminate
  # all active sockets and channels for a given user:
  #
  #     Elixir.SportsbookWeb.Endpoint.broadcast("user_socket:#{user.id}", "disconnect", %{})
  #
  # Returning `nil` makes this socket anonymous.
  @impl true
  def id(_socket), do: nil
end