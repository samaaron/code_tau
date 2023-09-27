defmodule CodeTauWeb.MainLive do
  require Logger
  use CodeTauWeb, :live_view
  alias Phoenix.LiveView.JS

  @impl true
  def mount(params, session, socket) do
    CodeTauWeb.Endpoint.subscribe("room:tau-synth")
    {:ok, assign(socket, data: data())}
  end

  def data() do
    [
      %{
        uuid: "84325588-5b8e-11ee-a06c-d2957a874c38",
        kind: :markdown,
        content: """
        # Web-based TB303

        ROLAND TB-303 bassline synth with delay and distortion. The original is switchable between sawtooth and square waveforms, I allow these to be mixed. _Additional parameters control accent and slide._

        This synth was hand-coded by _Guy Brown_.
        """
      },
      %{
        uuid: "8e5a73a6-5b8e-11ee-8e4c-d2957a874c38",
        kind: :editor,
        lang: :lua,
        content: """
        play(36)
        sleep(0.125)
        play(36 + 24)
        sleep(0.125)
        play(36 + 12)
        sleep(0.25)
        play(58)
        sleep(0.125)
        play(36 + 24)
        sleep(0.125)
        play(36 + 12)
        sleep(0.25)
        play(63)
        sleep(0.125)
        play(36 + 12)
        sleep(0.125)
        play(63)
        sleep(0.125)
        play(67)
        """
      },
      %{
        uuid: "9869face-5b8e-11ee-bd22-d2957a874c38",
        kind: :mermaid,
        content: """
        flowchart LR
        oscillator["`**oscillator**
        +pitch
        +tune
        +waveform_mix
        `"]
        filter["`**filter**
        +cutoff
        +resonance
        `"]
        vca["`**VCA**`"]
        accent["accent"]
        envmod["`**env mod**
        `"]
        envelope["`**envelope**
        +decay`"]
            oscillator --> filter --> vca
            envelope --> envmod
            envmod --> filter
            envelope --> vca
            accent --> vca & filter
            vca --> out
        """
      },
      %{
        uuid: "9f458afc-5b8e-11ee-bd76-d2957a874c38",
        kind: :editor,
        lang: :lua,
        content: """
        for i=1, 10 do
          play(50 + i)
          sleep(0.125)
        end
        """
      },
      %{
        uuid: "af94a406-5b8e-11ee-8e3a-d2957a874c38",
        kind: :markdown,
        content: """
        ### Notes

        To do:
        * At the moment the distortion and delay effects are hardwired - need to factor them out into separate module so that they can be used more generally.
        """
      }
    ]
  end

  def render_frag(%{kind: :markdown} = assigns) do
    md = Earmark.as_html!(assigns[:content])
    assigns = assign(assigns, :markdown, md)

    ~H"""
    <div class="p-8 bg-blue-100 border border-gray-600 bottom-9 rounded-xl dark:bg-slate-100">
      <%= Phoenix.HTML.raw(@markdown) %>
    </div>
    """
  end

  def render_frag(%{kind: :mermaid} = assigns) do
    ~H"""
    <div class="p-8 bg-blue-100 border border-gray-600 rounded-xl dark:bg-slate-100">
      <div class="mermaid" phx-update="ignore" id={@uuid}>
        <%= @content %>
      </div>
    </div>
    """
  end

  def render_frag(%{kind: :editor} = assigns) do
    assigns = assign(assigns, :button_id, "button-#{assigns[:uuid]}")
    assigns = assign(assigns, :monaco_path, "#{assigns[:uuid]}.lua")
    assigns = assign(assigns, :monaco_id, "monaco-#{assigns[:uuid]}")

    ~H"""
    <div
    id={@uuid}
    class="flex w-100 h-60"
    phx-hook="TauEditor"
    phx-update="ignore"
    data-language="lua"
    data-content={@content}
    data-monaco-id={@monaco_id}
    data-path={@monaco_path}>

      <button class="px-2 py-1 font-bold text-white bg-blue-500 rounded hover:bg-pink-600" id={@button_id}>Run</button>
      <div
        class="w-full h-full"
        id={@monaco_id}
        monaco-code-editor>
      </div>
    </div>
    """
  end

  @impl true
  def render(assigns) do
    ~H"""
    <%= for frag <- @data do %>
      <div class="p-2 ">
        <.render_frag {frag} />
      </div>
    <% end %>

    <p id="luareplres"></p>
    """
  end

  def play(lua, args) do
    note = Enum.at(args, 0)
    {[global_time | _rest], lua} = :luerl.do(<<"return tau_global_time">>, lua)
    {[start_time | _rest], _lua} = :luerl.do(<<"return tau_start_time">>, lua)
    # time = Enum.at(global_time, 0) + Enum.at(start_time, 0)
    time = global_time + start_time
    CodeTauWeb.Endpoint.broadcast("room:tau-synth", "msg", {time, {:play, note}})
  end

  @impl true
  def handle_event("eval-code", %{"value" => value}, socket) do
    lua = :luerl_sandbox.init()
    start_time = :erlang.system_time(:milli_seconds) / 1000.0
    {_, lua} = :luerl.do(<<"tau_start_time = #{start_time}">>, lua)
    {_, lua} = :luerl.do(<<"tau_global_time = 0">>, lua)

    {_, lua} =
      :luerl.do(
        <<"function sleep (t)
  tau_global_time = tau_global_time + t
end

function shuffle(x)
shuffled = {}
for i, v in ipairs(x) do
	local pos = math.random(1, #shuffled+1)
	table.insert(shuffled, pos, v)
end
return shuffled
end

function pick(x)
return shuffle(x)[1]
end
">>,
        lua
      )

    lua =
      :luerl.set_table(
        [<<"play">>],
        fn args, state ->
          play(state, args)
          {[0], state}
        end,
        lua
      )

    res_or_exception =
      try do
        :luerl_new.do_dec(value, lua)
      rescue
        e ->
          {:exception, e, __STACKTRACE__}
      end

    {:noreply,
     socket
     |> display_eval_result(res_or_exception)}
  end

  def display_eval_result(socket, {:exception, e, trace}) do
    socket
    |> push_event("update-luareplres", %{
      lua_repl_result: Exception.format(:error, e, trace)
    })
  end

  def display_eval_result(socket, {:ok, result, _new_state}) do
    result =
      Enum.map(result, fn el ->
        # IO.chardata_to_string(el)
        inspect(el)
      end)

    socket
    |> push_event("update-luareplres", %{lua_repl_result: "#{inspect(result)}"})
  end

  def display_eval_result(socket, {:error, error, _new_state}) do
    socket
    |> push_event("update-luareplres", %{lua_repl_result: "Error - #{inspect(error)}"})
  end

  @impl true
  def handle_info(%{topic: "room:tau-synth", payload: {time, {:play, note}}}, socket) do
    {:noreply,
     push_event(socket, "tau-synth", %{
       time: time,
       cmd: "{\"method\": \"play\", \"note\": #{note}, \"dur\": 0.5}"
     })}
  end
end
