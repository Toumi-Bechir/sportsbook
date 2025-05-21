defmodule Sportsbook.Betting.Event do
  use Ecto.Schema
  import Ecto.Changeset

  schema "events" do
    field :date, :utc_datetime
    field :description, :string
    field :title, :string

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(event, attrs) do
    event
    |> cast(attrs, [:title, :date, :description])
    |> validate_required([:title, :date, :description])
  end
end
