var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/ocaml");

var input = document.getElementById("input");
var output = document.getElementById("output");
var invite = document.getElementById("prompt");
var interpreter = new Worker("ocaml/toplevel.js");
var tester = new Worker("ocaml/toplevel.js");
var tooLong = false;
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
  if("res" in e.data)
    output.appendChild(document.createTextNode(e.data.res))
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

function onresult(e) {
  if("res" in e.data && (/^Error: /.test(e.data.res) ||
                         /^Error: /.test(e.data.res))) {
    var annot = editor.getSession().getAnnotations();
    annot.push({"row": e.data.id, "text": e.data.res, "type": "error"});
    editor.getSession().setAnnotations(annot);
  }
}

tester.onmessage = onresult;

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

function save() {
  window.open("data:application/force-download;charset=utf-8,"
             +encodeURIComponent(editor.getValue()));
}

document.onkeypress = function(ev) {
  if(ev.keyCode == 27 && ev.ctrlKey) {
    reset();
  } else if(ev.charCode == 115 && ev.ctrlKey) {
    save();
    return false;
  }
}

function send(s) {
  if(history.length < 1 || s !== history[history.length - 1]) {
    history.push(s);
  }
  ready = false;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.postMessage({"req": s, "id": 0});
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
      send(/[^;]*(;[^;]+)*;;/.exec(input.value)[0]);
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

function getSentences() {
  var ans = [];
  var s = editor.getValue();
  var i = 0;
  var j = 0;
  var comment = 0;
  var row = 0;
  var r = 0;
  while(i < s.length) {
    if(s[i] == '(' && i+1 < s.length && s[i+1] == '*') {
      comment++;
      i += 2;
    } else if(comment > 0 && s[i] == '*' && i+1 < s.length && s[i+1] == ')') {
      comment--;
      i += 2;
    } else if(s[i] == '\n') {
      row++;
      i++;
    } else if(comment > 0 || /\s/.test(s[i])) {
      i++;
    } else {
      j = i;
      r = row;
      while(j < s.length -1 && (comment > 0 || s[j] !== ';' || s[j+1] !== ';')) {
	if(s[j] == '(' && s[j+1] == '*') {
	  comment++;
	  j += 2;
	} else if(comment > 0 && s[j] == '*' && s[j+1] == ')') {
	  comment--;
	  j += 2;
	} else if(s[j] == '\n') {
	  row++;
	  j++;
        } else {
          j++;
        }
      }
      if(j < s.length - 1) {
        ans.push({"row": r, "s": s.slice(i, j+2), "begin": i, "end": j+2});
      }
      i = j+2;
    }
  }
  return ans;
}

function test(sentences) {
  editor.getSession().setAnnotations([]);
  for(var i = 0; i < sentences.length; i++) {
    tester.postMessage({"req": sentences[i].s, "id": sentences[i].row});
  }
}

function executeAll() {
  var sentences = getSentences();
  for(var i = 0; i < sentences.length; i++) {
    send(sentences[i].s);
  }
  test(sentences);
}

function execute() {
  var sentences = getSentences();
  var cursor = editor.getSession().getDocument().positionToIndex(editor.getCursorPosition());
  for(var i = 0; i < sentences.length; i++) {
    if(sentences[i].begin <= cursor && sentences[i].end >= cursor) {
      send(sentences[i].s);
      i = sentences.length;
    } 
  }
  test(sentences);
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

