defmodule Sportsbook.Repo do
  use Ecto.Repo,
    otp_app: :sportsbook,
    adapter: Ecto.Adapters.MyXQL
end
