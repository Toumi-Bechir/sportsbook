defmodule Sportsbook.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Initialize ETS tables for match storage
    Sportsbook.Storage.MatchStore.init()

    children = [
      SportsbookWeb.Telemetry,
      Sportsbook.Repo,
      {DNSCluster, query: Application.get_env(:sportsbook, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Sportsbook.PubSub},
      # Start the Finch HTTP client for API requests and emails
      {Finch, name: Sportsbook.Finch},
      # Start the token client for API authentication
      Sportsbook.API.TokenClient,
      # Start the websocket clients for different sports
      {Sportsbook.API.WebsocketSupervisor, []},
      # Start the pregame system
      {Sportsbook.Pregame.Supervisor, []},
      # Start a worker by calling: Sportsbook.Worker.start_link(arg)
      # {Sportsbook.Worker, arg},
      # Start to serve requests, typically the last entry
      SportsbookWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Sportsbook.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    SportsbookWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
