var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/ocaml");

var input = document.getElementById("input");
var output = document.getElementById("output");
var invite = document.getElementById("prompt");
var interpreter = new Worker("ocaml/toplevel.js");
var ready = false;
var lines = 1;
invite.style.display = "none";
input.style.display = "none";

var history = [];
var h = [""];
var pos = 0;

function onresponse(e) {
  if("out" in e.data)
    output.appendChild(document.createTextNode(e.data.out))
  if("ready" in e.data) {
    invite.innerHTML = e.data.ready;
    ready = true;
    lines = 1;
    input.rows = 1;
    input.rows = lines;
    invite.style.display = "block";
    input.style.display = "block";
    input.value = "";
    pos = history.length;
    h = history.slice();
    h.push("");
  }
}

interpreter.onmessage = onresponse;

function reset() {
  interpreter.terminate();
  interpreter = new Worker("ocaml/toplevel.js");
  output.innerHTML = "";
  ready = false;
  lines = 1;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.onmessage = onresponse;
}

document.onkeypress = function(ev) {
  if(ev.keyCode == 27 && ev.ctrlKey) {
    reset();
  }
}

function send(s) {
  if(history.length < 1 || s !== history[history.length - 1]) {
    history.push(s);
  }
  ready = false;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.postMessage({"input": s});
  input.value = "";
}

function key(ev) {
  function timeTravel(delta) {
    h[pos] = input.value;
    pos += delta;
    input.value = h[pos];
    var m = h[pos].match(/\n/g);
    if(m === null)
      lines = 1
    else
      lines = m.length + 1;
    input.rows = lines;
  }
  if(ev.keyCode == 13 && ready) { // ENTER
    if(/;;/.test(input.value)) {
      send(/[^;]*;;/.exec(input.value)[0]);
    } else {
      lines++;
      input.rows = lines;
    }
  } else if(ev.keyCode == 38 &&
            pos > 0 &&
            (input.value.indexOf("\n") < 0 ||
             input.selectionStart <= input.value.indexOf("\n"))) { // UP
    timeTravel(-1);
  } else if(ev.keyCode == 40 &&
            pos < history.length &&
            input.selectionEnd > input.value.lastIndexOf("\n")) { // DOWN
    timeTravel(1);
  }
}

function executeAll() {
  var sentence = /[^;]*;;/g;
  var s = editor.getValue();
  while((res = sentence.exec(s)) !== null) {
    send(res[0].replace(/^\s*/, ""));
  }
}

function execute() {
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

function submit(ev) {
  if(ev.keyCode == 13 && ev.ctrlKey) {
    if(ev.shiftKey) {
      executeAll();
    } else {
      execute();
    }
  }
}

