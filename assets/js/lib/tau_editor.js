import * as monaco from "../../vendor/monaco-editor/esm/vs/editor/editor.main";

const TauEditor = {
  mounted() {
    const btn = this.el.querySelector("button");
    const container = this.el.querySelector("[monaco-code-editor]");
    const { path, language, content } = this.el.dataset;

    this.editor = monaco.editor.create(container, {
      theme: "vs-dark",
      value: content,
      language: language,
      minimap: {
        enabled: false,
      },
    });

    btn.addEventListener("click", (e) => {
      window.tau_audio.userInit();
      this.pushEvent("eval-code", {
        value: this.editor.getValue(),
        path: path,
      });
      console.log(this.editor.getValue());
    });
  },

  destroyed() {
    if (this.editor) this.editor.dispose();
  },
};

export default TauEditor;
