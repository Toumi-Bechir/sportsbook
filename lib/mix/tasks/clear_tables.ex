defmodule Mix.Tasks.ClearTables do
  @moduledoc """
  Clear all ETS tables for pregame data to force fresh data fetch.
  """
  
  use Mix.Task
  
  @sports [
    :soccer, :basketball, :tennis, :hockey, :handball, :volleyball, :football,
    :baseball, :cricket, :rugby, :rugbyleague, :boxing, :esports, :futsal,
    :mma, :table_tennis, :golf, :darts
  ]

  def run(_) do
    Mix.shell().info("Clearing all pregame ETS tables...")
    
    # Start the application to ensure ETS tables exist
    Application.ensure_all_started(:sportsbook)
    
    Enum.each(@sports, fn sport ->
      table = String.to_atom("pregame_#{sport}")
      case :ets.info(table) do
        :undefined ->
          Mix.shell().info("Table #{table} does not exist")
        _ ->
          :ets.delete_all_objects(table)
          Mix.shell().info("Cleared table #{table}")
      end
    end)
    
    Mix.shell().info("All tables cleared. Restarting fetcher...")
    
    # Restart the pregame fetcher to force fresh fetch
    if Process.whereis(Sportsbook.Pregame.Fetcher) do
      GenServer.stop(Sportsbook.Pregame.Fetcher)
      Mix.shell().info("Stopped pregame fetcher")
    end
    
    # Start it again
    {:ok, _pid} = Sportsbook.Pregame.Supervisor.start_link([])
    Mix.shell().info("Restarted pregame fetcher")
    
    Mix.shell().info("Done! Fresh data will be fetched shortly.")
  end
end