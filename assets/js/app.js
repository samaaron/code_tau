// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html";
// Establish Phoenix Socket and LiveView configuration.
import { Socket } from "phoenix";
import { LiveSocket } from "phoenix_live_view";

// Vendored libs
import topbar from "../vendor/topbar";
import mermaid from "../vendor/mermaid";

// Internal libs
import TauEditor from "./lib/tau_editor";
import TauAudio from "./lib/tau_audio";
console.log("oooooh");
mermaid.initialize({ startOnLoad: true });

let tau_audio = new TauAudio();
window.tau_audio = tau_audio;

window.foo = function (a) {
  console.log(a);
};

let csrfToken = document
  .querySelector("meta[name='csrf-token']")
  .getAttribute("content");

let Hooks = { TauEditor };
let liveSocket = new LiveSocket("/live", Socket, {
  hooks: Hooks,
  params: { _csrf_token: csrfToken, flibble: "Wobble" },
});

// Show progress bar on live navigation and form submits
topbar.config({ barColors: { 0: "#29d" }, shadowColor: "rgba(0, 0, 0, .3)" });
window.addEventListener("phx:page-loading-start", (_info) => topbar.show(300));
window.addEventListener("phx:page-loading-stop", (_info) => topbar.hide());

// connect if there are any LiveViews on the page
liveSocket.connect();

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket;

window.addEventListener(`phx:update-luareplres`, (e) => {
  document.getElementById("luareplres").innerHTML = e.detail.lua_repl_result;
});

window.addEventListener(`phx:tau-synth`, (e) => {
  try {
    const cmd = JSON.parse(e.detail.cmd);
    tau_audio.dispatch(e.detail.time, cmd);
  } catch (ex) {
    console.log(`audio-at error ${ex.message}`);
    console.log(ex);
  }
});
