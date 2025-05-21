defmodule Sportsbook.BettingFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Sportsbook.Betting` context.
  """

  @doc """
  Generate a event.
  """
  def event_fixture(attrs \\ %{}) do
    {:ok, event} =
      attrs
      |> Enum.into(%{
        date: ~U[2025-05-19 18:38:00Z],
        description: "some description",
        title: "some title"
      })
      |> Sportsbook.Betting.create_event()

    event
  end
end
