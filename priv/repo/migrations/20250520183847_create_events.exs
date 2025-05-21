defmodule Sportsbook.Repo.Migrations.CreateEvents do
  use Ecto.Migration

  def change do
    create table(:events) do
      add :title, :string
      add :date, :utc_datetime
      add :description, :text

      timestamps(type: :utc_datetime)
    end
  end
end
