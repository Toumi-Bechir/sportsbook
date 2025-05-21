defmodule SportsbookWeb.AdminLive.Tables do
  use SportsbookWeb, :live_view
  require Logger

  @sports ["soccer", "basket", "tennis", "baseball", "amfootball", "hockey", "volleyball"]

  @impl true
  def mount(_params, _session, socket) do
    # Get table data
    tables_data = %{
      available_matches: fetch_available_matches(),
      sport_tables: fetch_sport_tables()
    }
    
    # Set up auto-refresh
    if connected?(socket) do
      :timer.send_interval(5000, self(), :refresh_data)
    end
    
    {:ok, socket
      |> assign(:page_title, "ETS Tables Inspector")
      |> assign(:tables_data, tables_data)
      |> assign(:selected_table, nil)
      |> assign(:search_term, "")
      |> assign(:last_update, DateTime.utc_now())
    }
  end
  
  @impl true
  def handle_params(%{"table" => table}, _url, socket) do
    {:noreply, assign(socket, :selected_table, table)}
  end
  
  def handle_params(_params, _url, socket) do
    {:noreply, socket}
  end
  
  @impl true
  def handle_event("select-table", %{"table" => table}, socket) do
    {:noreply, push_patch(socket, to: ~p"/admin/tables/#{table}")}
  end
  
  def handle_event("search", %{"search" => %{"term" => term}}, socket) do
    {:noreply, assign(socket, :search_term, term)}
  end
  
  @impl true
  def handle_info(:refresh_data, socket) do
    tables_data = %{
      available_matches: fetch_available_matches(),
      sport_tables: fetch_sport_tables()
    }
    
    {:noreply, socket
      |> assign(:tables_data, tables_data)
      |> assign(:last_update, DateTime.utc_now())}
  end
  
  # Private functions to fetch data
  
  defp fetch_available_matches do
    Sportsbook.Storage.MatchStore.get_all_available_matches()
  end
  
  defp fetch_sport_tables do
    @sports
    |> Enum.map(fn sport -> 
      table_name = case sport do
        "soccer" -> :soccer_matches
        "basket" -> :basket_matches
        "tennis" -> :tennis_matches
        "baseball" -> :baseball_matches
        "amfootball" -> :amfootball_matches
        "hockey" -> :hockey_matches
        "volleyball" -> :volleyball_matches
      end
      
      {sport, table_name, :ets.tab2list(table_name)}
    end)
  end
  
  # View helpers
  
  def filter_entries(entries, search_term) when is_binary(search_term) and search_term != "" do
    search_term = String.downcase(search_term)
    
    Enum.filter(entries, fn entry ->
      entry_string = inspect(entry) |> String.downcase()
      String.contains?(entry_string, search_term)
    end)
  end
  
  def filter_entries(entries, _), do: entries
  
  def table_size(table_name) do
    case table_name do
      :available_matches -> 
        length(:ets.tab2list(:available_matches))
      _ -> 
        :ets.info(table_name, :size) || 0
    end
  end
  
  def format_match_id({id, _small_data, _full_data}), do: id
  def format_match_id(_), do: "N/A"
  
  def format_team_names({_id, small_data, _full_data}) do
    t1 = get_in(small_data, ["t1", "name"]) || "Unknown"
    t2 = get_in(small_data, ["t2", "name"]) || "Unknown"
    "#{t1} vs #{t2}"
  end
  def format_team_names(_), do: "Unknown vs Unknown"
  
  def format_score({_id, small_data, _full_data}) do
    t1_score = get_in(small_data, ["t1", "score"]) || 0
    t2_score = get_in(small_data, ["t2", "score"]) || 0
    "#{t1_score}-#{t2_score}"
  end
  def format_score(_), do: "0-0"
  
  def format_time(seconds) when is_integer(seconds) do
    minutes = div(seconds, 60)
    remaining_seconds = rem(seconds, 60)
    "#{minutes}:#{String.pad_leading("#{remaining_seconds}", 2, "0")}"
  end
  def format_time(_), do: "00:00"
  
  def format_update_time({_id, small_data, _full_data}) do
    small_data["updated_at"] || "Unknown"
  end
  def format_update_time(_), do: "Unknown"
end