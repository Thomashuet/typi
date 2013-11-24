var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/ocaml");

var input = document.getElementById("input");
var output = document.getElementById("output");
var invite = document.getElementById("prompt");
var interpreter = new Worker("ocaml/toplevel.js");
var ready = false;
var lines = 1;

function onresponse(e) {
  if("out" in e.data)
    output.appendChild(document.createTextNode(e.data.out))
  if("ready" in e.data) {
    invite.innerHTML = e.data.ready;
    ready = true;
    lines = 1;
    input.rows = 1;
    invite.style.display = "block";
    input.style.display = "block";
    input.value = "";
  }
}

interpreter.onmessage = onresponse;

function reset() {
  interpreter.terminate();
  interpreter = new Worker("ocaml/toplevel.js");
  output.value = "";
  ready = false;
  lines = 1;
  interpreter.onmessage = onresponse;
}

function send(s) {
  ready = false;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.postMessage({"input": s});
  input.value = "";
}

function key(ev) {
  if(ev.keyCode == 13 && ready) {
    if(/;;/.test(input.value)) {
      send(/[^;]*;;/.exec(input.value));
    } else {
      lines++;
      input.rows = lines;
    }
  }
}

function submit(ev) {
  if(ev.keyCode == 13 && ev.ctrlKey) {
    if(ev.shiftKey) {
      send(editor.getValue());
    } else {
      var sentence = /[^;]*;;/g;
      var i = editor.getSession().getDocument().positionToIndex(editor.getCursorPosition());
      var s = editor.getValue();
      var cur = "";
      while((res = sentence.exec(s)) !== null && res.index < i) {
	cur = res[0];
      }
      cur = cur.replace(/^\s*/, "");
      if(cur !== "") {
	send(cur);
      }
    }
  }
}

