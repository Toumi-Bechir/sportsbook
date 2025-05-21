defmodule Mix.Tasks.Token do
  @moduledoc """
  Mix tasks for working with API tokens.
  """
  use Mix.Task
  
  @shortdoc "Get the current API token"
  @doc """
  Fetches and displays the current API token.
  
  ## Examples
  
      $ mix token
      
  """
  def run(_args) do
    # Start required applications
    {:ok, _} = Application.ensure_all_started(:sportsbook)
    
    # Display token information
    Sportsbook.API.TokenClient.cli()
  end
end