defmodule SportsbookWeb.PageController do
  use SportsbookWeb, :controller

  def home(conn, _params) do
    # The home page is often custom made,
    # so skip the default app layout.
    render(conn, :home, layout: false)
  end
  
  def react_app(conn, _params) do
    # Serve the React app
    conn
    |> put_resp_header("content-type", "text/html; charset=utf-8")
    |> send_file(200, Path.join([:code.priv_dir(:sportsbook), "static", "react", "index.html"]))
  end
  
  def token(conn, _params) do
    # Get the current token from the GenServer
    response = case Sportsbook.API.TokenClient.get_current_token() do
      {:ok, token} -> 
        # Format token for display
        """
        Token details:
        - Token: #{token["token"]}
        - Expiry: #{token["expiry"]}
        
        Full response: 
        #{Jason.encode!(token, pretty: true)}
        """
        
      {:error, reason} ->
        "Error retrieving token: #{reason}"
    end
    
    # Display token info on the web page
    render(conn, :token, response: response)
  end
end
