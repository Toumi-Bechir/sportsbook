defmodule Sportsbook.Pregame.Supervisor do
  use Supervisor

  def start_link(_), do: Supervisor.start_link(__MODULE__, :ok, name: __MODULE__)

  def init(:ok) do
    children = [
      {Sportsbook.Pregame.Cache, []},
      {Sportsbook.Pregame.Fetcher, []}
    ]
    Supervisor.init(children, strategy: :one_for_one)
  end
end