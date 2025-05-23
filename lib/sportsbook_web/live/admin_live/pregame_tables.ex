defmodule SportsbookWeb.AdminLive.PregameTables do
  use SportsbookWeb, :live_view
  require Logger

  @sports [:soccer, :basketball, :tennis, :hockey, :handball, :volleyball, :football,
          :baseball, :cricket, :rugby, :rugbyleague, :boxing, :esports, :futsal,
          :mma, :table_tennis, :golf, :darts]

  @impl true
  def mount(_params, _session, socket) do
    tables_data = fetch_pregame_tables()
    
    if connected?(socket) do
      :timer.send_interval(5000, self(), :refresh_data)
    end
    
    {:ok, socket
      |> assign(:page_title, "Pregame Tables Inspector")
      |> assign(:tables_data, tables_data)
      |> assign(:selected_sport, nil)
      |> assign(:selected_match, nil)
      |> assign(:last_update, DateTime.utc_now())
    }
  end
  
  @impl true
  def handle_params(%{"sport" => sport}, _url, socket) do
    sport_atom = String.to_atom(sport)
    {:noreply, assign(socket, :selected_sport, sport_atom)}
  end
  
  def handle_params(_params, _url, socket) do
    {:noreply, socket}
  end
  
  @impl true
  def handle_event("select-sport", %{"sport" => sport}, socket) do
    {:noreply, push_patch(socket, to: ~p"/admin/pregame-tables/#{sport}")}
  end
  
  def handle_event("select-match", %{"match_id" => match_id}, socket) do
    {:noreply, assign(socket, :selected_match, match_id)}
  end
  
  def handle_event("clear-tables", _params, socket) do
    clear_all_tables()
    tables_data = fetch_pregame_tables()
    
    {:noreply, socket
      |> assign(:tables_data, tables_data)
      |> put_flash(:info, "All pregame tables cleared!")
    }
  end
  
  @impl true
  def handle_info(:refresh_data, socket) do
    tables_data = fetch_pregame_tables()
    
    {:noreply, socket
      |> assign(:tables_data, tables_data)
      |> assign(:last_update, DateTime.utc_now())}
  end
  
  # Private functions
  
  defp fetch_pregame_tables do
    @sports
    |> Enum.map(fn sport ->
      table = String.to_atom("pregame_#{sport}")
      
      {entries, size} = case :ets.info(table) do
        :undefined -> {[], 0}
        _ -> 
          entries = :ets.tab2list(table)
          {entries, length(entries)}
      end
      
      {sport, table, entries, size}
    end)
  end
  
  defp clear_all_tables do
    Enum.each(@sports, fn sport ->
      table = String.to_atom("pregame_#{sport}")
      case :ets.info(table) do
        :undefined -> :ok
        _ -> :ets.delete_all_objects(table)
      end
    end)
  end
  
  def get_match_details(entries, match_id) when is_list(entries) do
    Enum.find(entries, fn {id, _record} -> id == match_id end)
  end
  
  def format_timestamp(timestamp) when is_integer(timestamp) do
    DateTime.from_unix!(timestamp)
    |> DateTime.to_string()
  end
  def format_timestamp(_), do: "Invalid"
  
  def count_markets(markets) when is_map(markets) do
    markets
    |> Enum.map(fn {_name, odds} -> length(odds || []) end)
    |> Enum.sum()
  end
  def count_markets(_), do: 0
end