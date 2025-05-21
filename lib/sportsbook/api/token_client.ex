defmodule Sportsbook.API.TokenClient do
  @moduledoc """
  Client for retrieving and caching API tokens from the authentication service.

  This module automatically refreshes the token every 55 minutes and makes
  it available to other modules via the `get_current_token/0` function.
  """
  use GenServer
  require Logger

  # 55 minutes in milliseconds
  @refresh_interval 55 * 60 * 1000

  # Client API

  @doc """
  Starts the token client.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Gets the current valid token.

  Returns the cached token if available, or fetches a new one if needed.
  """
  def get_current_token do
    GenServer.call(__MODULE__, :get_token)
  end

  @doc """
  Forces a token refresh regardless of expiration time.
  """
  def force_refresh do
    GenServer.cast(__MODULE__, :refresh_token)
  end

  @doc """
  Command-line interface for fetching and displaying tokens.
  """
  def cli do
    IO.puts("Getting current token...")

    case get_current_token() do
      {:ok, token} ->
        IO.puts("\nToken retrieved successfully:")
        IO.puts("Token: #{token["token"]}")
        IO.puts("Expiry: #{token["expiry"]}")
        IO.puts("\nFull response:")
        IO.puts(Jason.encode!(token, pretty: true))

      {:error, reason} ->
        IO.puts("\nError retrieving token:")
        IO.puts(reason)
    end
  end

  # Server callbacks

  @impl true
  def init(_opts) do
    Logger.info("Starting TokenClient")
    # Immediately fetch a token when starting
    {:ok, %{token: nil, last_refresh: nil}, {:continue, :fetch_token}}
  end

  @impl true
  def handle_continue(:fetch_token, state) do
    case fetch_token() do
      {:ok, token} ->
        Logger.info("Initial token fetched successfully")
        schedule_refresh()
        {:noreply, %{state | token: token, last_refresh: System.monotonic_time(:millisecond)}}

      {:error, reason} ->
        Logger.error("Failed to fetch initial token: #{reason}")
        # Retry after a short delay
        Process.send_after(self(), :refresh_token, 5000)
        {:noreply, state}
    end
  end

  @impl true
  def handle_call(:get_token, _from, %{token: nil} = state) do
    # No token yet, fetch one immediately
    case fetch_token() do
      {:ok, token} ->
        schedule_refresh()
        {:reply, {:ok, token}, %{state | token: token, last_refresh: System.monotonic_time(:millisecond)}}

      {:error, _} = error ->
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call(:get_token, _from, %{token: token} = state) do
    # Return cached token
    {:reply, {:ok, token}, state}
  end

  @impl true
  def handle_cast(:refresh_token, state) do
    case fetch_token() do
      {:ok, token} ->
        Logger.info("Token refreshed successfully")
        schedule_refresh()
        {:noreply, %{state | token: token, last_refresh: System.monotonic_time(:millisecond)}}

      {:error, reason} ->
        Logger.error("Failed to refresh token: #{reason}")
        # Try again after a short delay
        Process.send_after(self(), :refresh_token, 5000)
        {:noreply, state}
    end
  end

  @impl true
  def handle_info(:refresh_token, state) do
    GenServer.cast(self(), :refresh_token)
    {:noreply, state}
  end

  # Private functions

  defp schedule_refresh do
    # Schedule the next token refresh
    Process.send_after(self(), :refresh_token, @refresh_interval)
  end

  defp fetch_token do
    url = "http://152.89.28.69:8765/api/v1/auth/gettoken"
    headers = [{"Content-Type", "application/json"}]
    body = Jason.encode!(%{apiKey: "d306a694785d45065cb608dada5f9a88"})

    case Finch.build(:post, url, headers, body)
         |> Finch.request(Sportsbook.Finch) do
      {:ok, %Finch.Response{status: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, response} ->
            {:ok, response}
          {:error, _} = error ->
            error
        end

      {:ok, %Finch.Response{status: status, body: body}} ->
        {:error, "Request failed with status #{status}: #{body}"}

      {:error, _} = error ->
        error
    end
  end
end
