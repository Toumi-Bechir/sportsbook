defmodule Sportsbook.BettingTest do
  use Sportsbook.DataCase

  alias Sportsbook.Betting

  describe "events" do
    alias Sportsbook.Betting.Event

    import Sportsbook.BettingFixtures

    @invalid_attrs %{date: nil, description: nil, title: nil}

    test "list_events/0 returns all events" do
      event = event_fixture()
      assert Betting.list_events() == [event]
    end

    test "get_event!/1 returns the event with given id" do
      event = event_fixture()
      assert Betting.get_event!(event.id) == event
    end

    test "create_event/1 with valid data creates a event" do
      valid_attrs = %{date: ~U[2025-05-19 18:38:00Z], description: "some description", title: "some title"}

      assert {:ok, %Event{} = event} = Betting.create_event(valid_attrs)
      assert event.date == ~U[2025-05-19 18:38:00Z]
      assert event.description == "some description"
      assert event.title == "some title"
    end

    test "create_event/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Betting.create_event(@invalid_attrs)
    end

    test "update_event/2 with valid data updates the event" do
      event = event_fixture()
      update_attrs = %{date: ~U[2025-05-20 18:38:00Z], description: "some updated description", title: "some updated title"}

      assert {:ok, %Event{} = event} = Betting.update_event(event, update_attrs)
      assert event.date == ~U[2025-05-20 18:38:00Z]
      assert event.description == "some updated description"
      assert event.title == "some updated title"
    end

    test "update_event/2 with invalid data returns error changeset" do
      event = event_fixture()
      assert {:error, %Ecto.Changeset{}} = Betting.update_event(event, @invalid_attrs)
      assert event == Betting.get_event!(event.id)
    end

    test "delete_event/1 deletes the event" do
      event = event_fixture()
      assert {:ok, %Event{}} = Betting.delete_event(event)
      assert_raise Ecto.NoResultsError, fn -> Betting.get_event!(event.id) end
    end

    test "change_event/1 returns a event changeset" do
      event = event_fixture()
      assert %Ecto.Changeset{} = Betting.change_event(event)
    end
  end
end
