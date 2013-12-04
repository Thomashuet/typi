var argv = location.search.replace(/[\?\/]/g, '').split('&');
var params = {
  "tuto": "ocaml-example.html",
  "lang": "ocaml"
};
for(var i = 0; i < argv.length; i++) {
  var a = argv[i].split('=');
  params[a[0]] = a[1];
};
if("tp" in params) {
  params.tuto = "tp%2F" + params.tp;
};

var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/" + params.lang);

var unsaved = false;
editor.on("change", function() {unsaved = true;});

window.addEventListener("beforeunload", function (e) {
  if(unsaved) {
    var confirmationMessage = "You have unsaved modifications.";
    (e || window.event).returnValue = confirmationMessage;
    return confirmationMessage;
  }
});

var tp = document.getElementById("tp");

var input = document.getElementById("input");
var output = document.getElementById("output");
var invite = document.getElementById("prompt");
var worker = params.lang + "-worker.js";
var interpreter = new Worker(worker);
var tester = new Worker(worker);
var tooLong = false;
var ready = false;
var lines = 1;
invite.style.display = "none";
input.style.display = "none";

var history = [];
var h = [""];
var pos = 0;

var questions = [];
var toValidate = [];

function onresponse(e) {
  if("out" in e.data) {
    output.appendChild(document.createTextNode(e.data.out))
    output.scrollIntoView(false);
  }
  if("res" in e.data) {
    output.appendChild(document.createTextNode(e.data.res))
    output.scrollIntoView(false);
  }
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
    input.scrollIntoView(false);
  }
}

interpreter.onmessage = onresponse;

function onresult(e) {
  if("res" in e.data && (/^Error: /.test(e.data.res) ||
                         /^Error: /.test(e.data.res))) {
    var annot = editor.getSession().getAnnotations();
    annot.push({"row": e.data.id, "text": e.data.res, "type": "error"});
    editor.getSession().setAnnotations(annot);
  } else if("res" in e.data && e.data.id < 0 && e.data.res === "- : bool = true\n") {
    var q = toValidate[-1-e.data.id].question;
    toValidate[-1-e.data.id] = null;
    var onlyOne = true;
    for(var i = 0; i < toValidate.length; i++)
      onlyOne = onlyOne && (toValidate[i] === null || toValidate[i].question !== q);
    if(onlyOne)
      questions[q].style.backgroundColor = "#D0FFD0";
  }
}

function reset() {
  interpreter.terminate();
  interpreter = new Worker(worker);
  output.innerHTML = "";
  ready = false;
  lines = 1;
  invite.style.display = "none";
  input.style.display = "none";
  interpreter.onmessage = onresponse;
}

function save() {
  window.open("data:text/x-" + params.lang + ";charset=utf-8,"
             +encodeURIComponent(editor.getValue()));
  unsaved = false;
}

var focus = "tp";

tp.onclick = function(ev) {
  focus = "tp";
}

document.getElementById("editor").onclick = function(ev) {
  focus = "editor";
}

document.getElementById("toplevel").onclick = function(ev) {
  focus = "toplevel";
}

document.onkeypress = function(ev) {
  if(ev.keyCode == 27 && ev.ctrlKey) {
    reset();
  } else if(ev.charCode == 115 && ev.ctrlKey) {
    save();
    return false;
  } else if(ev.charCode == 111 && ev.ctrlKey) {
    openFile(pickFile());
    return false;
  } else if(focus === "editor") {
    keyEditor(ev);
  } else if(focus === "toplevel") {
    keyToplevel(ev);
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

function getSentences(s) {
  var ans = [];
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

function keyToplevel(ev) {
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
  if(!ev.ctrlKey)
    input.focus();
  if(ev.keyCode == 13 && ready) { // ENTER
    var sentences = getSentences(input.value);
    if(sentences.length > 0) {
      send(sentences[0].s);
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

function test(sentences) {
  tester.terminate();
  tester = new Worker(worker);
  tester.onmessage = onresult;
  editor.getSession().setAnnotations([]);
  for(var i = 0; i < sentences.length; i++) {
    tester.postMessage({"req": sentences[i].s, "id": sentences[i].row});
  }
  for(var i = 0; i < toValidate.length; i++) {
    if(toValidate[i] !== null)
      tester.postMessage({"req": toValidate[i].test, "id": -1-i});
  }
}

function executeAll() {
  var sentences = getSentences(editor.getValue());
  for(var i = 0; i < sentences.length; i++) {
    send(sentences[i].s);
  }
  test(sentences);
}

function execute() {
  var sentences = getSentences(editor.getValue());
  var cursor = editor.getSession().getDocument().positionToIndex(editor.getCursorPosition());
  var notDone = true;
  for(var i = 0; notDone && i < sentences.length; i++) {
    if(sentences[i].begin <= cursor && sentences[i].end >= cursor) {
      send(sentences[i].s);
      notDone = false;
    } 
  }
  if(notDone && sentences.length > 0)
    send(sentences[sentences.length - 1].s);
  test(sentences);
}

function keyEditor(ev) {
  if(ev.keyCode == 13 && ev.ctrlKey) {
    if(ev.shiftKey) {
      executeAll();
    } else {
      execute();
    }
  }
}

function pickFile() {
  var file = prompt("Enter the URL of the file");
  if(!(/^http:\/\//.test(file) || /^https:\/\//.test(file) || /^ftp:\/\//.test(file)))
    file = "http://" + file;
  return file;
}

function openFile(file) {
  if(file === null)
    return;
  file = decodeURIComponent(file);
  var req = new XMLHttpRequest();
  req.open("GET", file, true);
  req.send();
  req.onload = function() {
    tp.innerHTML = req.responseText;
    questions = tp.getElementsByClassName("question");
    for(var i = 0; i < questions.length; i++) {
      var t = questions[i].getElementsByClassName("test");
      for(var j = 0; j < t.length; j++) {
        toValidate.push({"test": t[j].textContent, "question": i});
      }
    }
    var pre = tp.getElementsByTagName("pre");
    var lineHeight = document.getElementsByClassName("ace_line")[0].style.height;
    for(var i = 0; i < pre.length; i++) {
      var m = pre[i].textContent.match(/\n/g);
      var loc = 1;
      if(m !== null)
        loc += m.length;
      pre[i].style.height = "calc(" + loc + "*" + lineHeight + ")";
      var edit = ace.edit(pre[i]);
      edit.setTheme("ace/theme/monokai");
      edit.getSession().setMode("ace/mode/" + params.lang);
      edit.setReadOnly(true);
      edit.renderer.setShowGutter(false);
      function click(edit) {
        return function() {
          editor.insert(edit.getValue() + '\n');
        }
      }
      pre[i].ondblclick = click(edit);
    }
    var code = tp.getElementsByTagName("code");
    var charWidth = "6px";
    for(var i = 0; i < code.length; i++) {
      var w = code[i].clientWidth;
      var n = code[i].textContent.length;
      code[i].style.height = lineHeight;
      code[i].style.width = "calc((" + n + "*" + charWidth + ") + 1em)";
      code[i].style.display = "inline-block";
      var edit = ace.edit(code[i]);
      edit.setTheme("ace/theme/monokai");
      edit.getSession().setMode("ace/mode/" + params.lang);
      edit.setReadOnly(true);
      edit.renderer.setShowGutter(false);
      function click(edit) {
        return function() {
          editor.insert(edit.getValue() + '\n');
        }
      }
      code[i].ondblclick = click(edit);
    }
    var test = tp.getElementsByClassName("test");
    for(var i = 0; i < test.length; i++)
      test[i].style.display = "none";
  };
}

openFile(params.tuto);
