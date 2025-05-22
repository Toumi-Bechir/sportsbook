defmodule SportsbookWeb.Router do
  use SportsbookWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {SportsbookWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", SportsbookWeb do
    pipe_through :browser

    # Homepage serves React app
    get "/", PageController, :react_app
    
    # Event routes
    live "/events", EventLive.Index, :index
    live "/events/new", EventLive.Index, :new
    live "/events/:id/edit", EventLive.Index, :edit
    live "/events/:id", EventLive.Show, :show
    live "/events/:id/show/edit", EventLive.Show, :edit
    
    # API Token CLI route
    get "/api/token", PageController, :token
    
    # Websocket feed viewer
    live "/websocket", WebsocketLive.Index, :index
    
    # Match data viewer (ETS tables)
    live "/matches", MatchLive.Index, :index
    live "/matches/available", MatchLive.Index, :show_available
    live "/matches/:sport", MatchLive.Index, :show_sport
    
    # Admin tools
    live "/admin/tables", AdminLive.Tables, :index
    live "/admin/tables/:table", AdminLive.Tables, :index
  end

  # API routes for React frontend
  scope "/api", SportsbookWeb do
    pipe_through :api
    
    get "/sports", ApiController, :sports
    get "/matches", ApiController, :matches
    get "/matches/:sport", ApiController, :matches
    get "/market-name/:sport/:market_id", ApiController, :market_name
    get "/markets/:sport", ApiController, :markets
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:sportsbook, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: SportsbookWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
